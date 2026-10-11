#!/usr/bin/env node
/**
 * Agentic Release Life Cycle — CLI entry point
 *
 * Usage:
 *   node src/index.js --demo healthy          # healthy prod candidate → expect GO
 *   node src/index.js --demo risky            # risky prod candidate → expect NO_GO
 *   node src/index.js --demo borderline       # borderline gamma candidate
 *   node src/index.js --release <id-or-file>  # custom release package
 *   node src/index.js --list                  # list sample releases
 */

import 'dotenv/config';
import { initGemini } from './services/geminiClient.js';
import { loadReleaseData, listSampleReleases } from './services/dataStore.js';
import { runReleaseAgent } from './agent/ReleaseAgent.js';
import { logger } from './utils/logger.js';

const DEMO_MAP = {
  healthy: 'demo-healthy',
  risky: 'demo-risky',
  borderline: 'demo-borderline',
};

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--list')) {
    console.log('Sample releases:', listSampleReleases().join(', '));
    console.log('Demo shortcuts: healthy | risky | borderline');
    process.exit(0);
  }

  let releaseKey = null;
  const demoIdx = args.indexOf('--demo');
  const releaseIdx = args.indexOf('--release');

  if (demoIdx !== -1 && args[demoIdx + 1]) {
    const name = args[demoIdx + 1].toLowerCase();
    releaseKey = DEMO_MAP[name] || `demo-${name}`;
  } else if (releaseIdx !== -1 && args[releaseIdx + 1]) {
    releaseKey = args[releaseIdx + 1];
  } else if (args.includes('--demo')) {
    releaseKey = 'demo-healthy';
  } else {
    releaseKey = 'demo-healthy';
    logger.info('No --demo or --release specified; using demo-healthy');
  }

  try {
    initGemini();
  } catch (err) {
    console.error('\n❌', err.message);
    console.error('\nSetup:');
    console.error('  1. cp .env.example .env');
    console.error('  2. Set GEMINI_API_KEY in .env (https://aistudio.google.com/apikey)');
    console.error('  3. npm install && npm run demo\n');
    process.exit(1);
  }

  let releaseData;
  try {
    releaseData = await loadReleaseData(releaseKey);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }

  printBanner(releaseData);

  try {
    const { decision, deployment, conversationLength } = await runReleaseAgent(releaseData);
    printResult(decision, deployment, conversationLength);
    process.exit(decision.decision === 'GO' ? 0 : 2);
  } catch (err) {
    logger.error('Agent failed:', err.message);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(err);
    }
    process.exit(1);
  }
}

function printBanner(data) {
  console.log('\n' + '═'.repeat(64));
  console.log('  AGENTIC RELEASE LIFE CYCLE');
  console.log('  Gemini LLM Agent · Binary GO / NO_GO · Deployment Strategy');
  console.log('═'.repeat(64));
  console.log(`  Release   : ${data.releaseId}`);
  console.log(`  Version   : ${data.version}`);
  console.log(`  Service   : ${data.serviceName || 'n/a'}`);
  console.log(`  Target    : ${(data.targetEnvironment || '').toUpperCase()}`);
  console.log(`  From      : ${data.currentEnvironment || 'n/a'}`);
  console.log('═'.repeat(64) + '\n');
}

function printResult(decision, deployment, conversationLength) {
  const isGo = decision.decision === 'GO';
  const icon = isGo ? '✅' : '🛑';

  console.log('\n' + '─'.repeat(64));
  console.log(`${icon}  DECISION: ${decision.decision}`);
  console.log(`   Confidence : ${(decision.confidence * 100).toFixed(0)}%`);
  console.log(`   Strategy   : ${decision.deploymentStrategy || 'n/a'}`);
  console.log(`   Timestamp  : ${decision.timestamp}`);
  console.log(`   Agent turns: ${conversationLength}`);
  console.log('─'.repeat(64));
  console.log('\nRationale:');
  console.log(`  ${decision.rationale}\n`);

  if (decision.blockingIssues?.length) {
    console.log('Blocking issues:');
    decision.blockingIssues.forEach((i) => console.log(`  • ${i}`));
    console.log();
  }

  if (decision.recommendations?.length) {
    console.log('Recommendations:');
    decision.recommendations.forEach((r) => console.log(`  • ${r}`));
    console.log();
  }

  if (deployment) {
    console.log('Deployment triggered:');
    console.log(`  ID       : ${deployment.deploymentId}`);
    console.log(`  Strategy : ${deployment.strategyName} (${deployment.strategy})`);
    console.log(`  Env      : ${deployment.environment}`);
    if (deployment.canaryPercent) {
      console.log(`  Canary % : ${deployment.canaryPercent}%`);
    }
    console.log(`  Status   : ${deployment.status}`);
    console.log(`  Message  : ${deployment.message}\n`);
  }

  if (decision.toolEvidence && Object.keys(decision.toolEvidence).length) {
    console.log('Tool evidence (gates):');
    for (const [tool, ev] of Object.entries(decision.toolEvidence)) {
      const gates = ev.gates ? JSON.stringify(ev.gates) : '{}';
      const w = ev.warnings?.length ? ` warnings=${ev.warnings.length}` : '';
      const e = ev.errors?.length ? ` errors=${ev.errors.length}` : '';
      console.log(`  ${tool}: ${gates}${w}${e}`);
    }
    console.log();
  }

  console.log('═'.repeat(64));
  console.log(isGo ? '  Release APPROVED for deployment' : '  Release BLOCKED — fix issues and re-run');
  console.log('═'.repeat(64) + '\n');
}

function printHelp() {
  console.log(`
Agentic Release Life Cycle — Gemini LLM agent for release GO/NO_GO

Usage:
  npm run demo                          # run healthy demo
  node src/index.js --demo healthy      # expect GO (prod)
  node src/index.js --demo risky        # expect NO_GO (prod)
  node src/index.js --demo borderline   # borderline gamma case
  node src/index.js --release <id|file> # custom package
  node src/index.js --list              # list samples

Environment:
  GEMINI_API_KEY   Required. https://aistudio.google.com/apikey
  GEMINI_MODEL     Optional. Default: gemini-2.0-flash
  LOG_LEVEL        debug | info | warn | error

Exit codes:
  0  GO (deployment may have been triggered)
  2  NO_GO
  1  Error (missing key, agent failure, etc.)
`);
}

main();
