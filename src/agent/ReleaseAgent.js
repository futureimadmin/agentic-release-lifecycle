import { generateWithTools } from '../services/geminiClient.js';
import { TOOL_DECLARATIONS, executeTool } from '../tools/index.js';
import { getEnvironment, DEPLOYMENT_STRATEGIES } from '../config/environments.js';
import { getThresholdsForEnv } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

const SYSTEM_INSTRUCTION = `You are the Agentic Release Life Cycle Decision Agent.

Your job is to decide whether a software release candidate should be promoted to a target environment (Alpha → Beta → Gamma → Prod) using BINARY CLASSIFICATION: GO or NO_GO.

You have tools to inspect:
1. Test metrics (pass ratio, coverage, flaky tests)
2. Vulnerability reports (critical/high/medium counts, CVEs)
3. OWASP / ASVS compliance score and failed controls
4. Code quality (bugs, maintainability, tech debt)
5. Performance / load-test metrics (latency, throughput, error rate)
6. Change risk (score, blast radius, sensitive domains touched)

After gathering evidence with tools, you MUST:
1. Output a clear binary decision: GO or NO_GO
2. Provide confidence (0.0–1.0)
3. List blocking issues (if any)
4. If GO: choose the best deployment strategy:
   - rolling: gradual instance replacement (default for lower risk)
   - canary: small traffic % then expand (preferred for prod / high risk / sensitive changes)
   - blue-green: instant switch between two environments (good for gamma/prod when fast rollback needed)
   - recreate: full stop-then-start (only alpha, accepts downtime)
   - a-b: experimental traffic split (beta/gamma)
5. If GO: call the trigger_deployment tool with the chosen strategy and a short reason
6. If NO_GO: do NOT call trigger_deployment; explain what must be fixed

Decision principles:
- Stricter gates apply as you move toward Prod (thresholds are provided by tools).
- Critical vulnerabilities or failed load tests almost always mean NO_GO for gamma/prod.
- Prefer canary or blue-green for prod when change risk is elevated or auth/payments are touched.
- Be conservative: when evidence is mixed, lean NO_GO and list concrete remediation steps.
- Always call the relevant inspection tools before deciding; do not invent metrics.

Final response format (after tools, when you are ready to conclude):
Respond with a JSON object only (no markdown fences) of this shape:
{
  "decision": "GO" | "NO_GO",
  "confidence": 0.0-1.0,
  "rationale": "2-5 sentence explanation",
  "deploymentStrategy": "rolling|canary|blue-green|recreate|a-b" | null,
  "blockingIssues": ["..."],
  "recommendations": ["..."],
  "toolEvidenceSummary": "brief summary of key metrics"
}`;

const MAX_TOOL_ROUNDS = 8;

/**
 * Run the agentic release decision loop.
 * @param {Object} releaseData - loaded release package
 * @returns {Promise<{decision: Object, deployment: Object|null, conversation: Array}>}
 */
export async function runReleaseAgent(releaseData) {
  const targetEnv = releaseData.targetEnvironment || 'alpha';
  const env = getEnvironment(targetEnv);
  const thresholds = getThresholdsForEnv(targetEnv);

  const userPrompt = buildUserPrompt(releaseData, env, thresholds);

  /** @type {Array} Gemini contents */
  let contents = [{ role: 'user', parts: [{ text: userPrompt }] }];

  let finalDecision = null;
  let deploymentResult = null;
  const toolEvidence = {};

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logger.info(`Agent round ${round + 1}/${MAX_TOOL_ROUNDS}`);

    const result = await generateWithTools(SYSTEM_INSTRUCTION, contents, TOOL_DECLARATIONS);
    const response = result.response;
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error('Empty response from Gemini');
    }

    const parts = candidate.content?.parts || [];
    const functionCalls = parts.filter((p) => p.functionCall);
    const textParts = parts.filter((p) => p.text);

    contents.push({ role: 'model', parts });

    if (functionCalls.length === 0) {
      const text = textParts.map((p) => p.text).join('\n');
      finalDecision = parseDecision(text);
      logger.info(`Agent decision: ${finalDecision.decision} (confidence ${finalDecision.confidence})`);
      break;
    }

    const functionResponses = [];
    for (const fc of functionCalls) {
      const name = fc.functionCall.name;
      const args = fc.functionCall.args || {};
      logger.info(`  → Tool call: ${name}(${JSON.stringify(args)})`);

      const toolResult = await executeTool(name, args, releaseData);
      toolEvidence[name] = toolResult;

      if (name === 'trigger_deployment' && toolResult.success) {
        deploymentResult = toolResult.data;
      }

      functionResponses.push({
        functionResponse: {
          name,
          response: toolResult,
        },
      });
    }

    contents.push({ role: 'user', parts: functionResponses });
  }

  if (!finalDecision) {
    logger.warn('Max tool rounds reached; requesting final decision');
    contents.push({
      role: 'user',
      parts: [
        {
          text: 'You have reached the maximum tool rounds. Based on all tool results so far, output your final JSON decision now (GO or NO_GO). Do not call more tools.',
        },
      ],
    });
    const result = await generateWithTools(SYSTEM_INSTRUCTION, contents, []);
    const text = result.response.text();
    finalDecision = parseDecision(text);
  }

  finalDecision.toolEvidence = summarizeEvidence(toolEvidence);
  finalDecision.timestamp = new Date().toISOString();
  finalDecision.releaseId = releaseData.releaseId;
  finalDecision.version = releaseData.version;
  finalDecision.targetEnvironment = targetEnv;

  return {
    decision: finalDecision,
    deployment: deploymentResult,
    conversationLength: contents.length,
  };
}

function buildUserPrompt(releaseData, env, thresholds) {
  return `Evaluate this release candidate for promotion.

Release ID: ${releaseData.releaseId}
Version: ${releaseData.version}
Commit: ${releaseData.commitSha}
Service: ${releaseData.serviceName || 'unknown'}
Current environment: ${releaseData.currentEnvironment || 'none'}
Target environment: ${env?.displayName || releaseData.targetEnvironment} (${env?.description || ''})

Environment-specific soft thresholds (for your guidance; tools will also report gates):
${JSON.stringify(thresholds, null, 2)}

Available deployment strategies: ${Object.values(DEPLOYMENT_STRATEGIES)
    .map((s) => `${s.id} (${s.name})`)
    .join(', ')}

Instructions:
1. Call the inspection tools you need (tests, vulnerabilities, OWASP, code quality, performance, change risk).
2. Decide GO or NO_GO for ${env?.name || releaseData.targetEnvironment}.
3. If GO, select strategy and call trigger_deployment.
4. End with the required JSON decision object.`;
}

function parseDecision(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      return {
        decision: obj.decision === 'GO' ? 'GO' : 'NO_GO',
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
        rationale: obj.rationale || text,
        deploymentStrategy: obj.deploymentStrategy || null,
        blockingIssues: obj.blockingIssues || [],
        recommendations: obj.recommendations || [],
        toolEvidenceSummary: obj.toolEvidenceSummary || '',
      };
    } catch {
      // fall through
    }
  }

  const upper = text.toUpperCase();
  const isGo = /\bGO\b/.test(upper) && !/\bNO[_\s-]?GO\b/.test(upper);
  return {
    decision: isGo ? 'GO' : 'NO_GO',
    confidence: 0.4,
    rationale: text.slice(0, 500),
    deploymentStrategy: null,
    blockingIssues: ['Could not parse structured decision from model'],
    recommendations: [],
    toolEvidenceSummary: '',
  };
}

function summarizeEvidence(toolEvidence) {
  const summary = {};
  for (const [name, result] of Object.entries(toolEvidence)) {
    if (name === 'trigger_deployment') continue;
    summary[name] = {
      success: result.success,
      gates: result.data?.gates,
      warnings: result.warnings,
      errors: result.errors,
    };
  }
  return summary;
}
