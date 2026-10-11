import { testMetricsDeclaration, getTestMetrics } from './testMetrics.js';
import {
  vulnerabilityScannerDeclaration,
  getVulnerabilityReport,
} from './vulnerabilityScanner.js';
import { owaspCheckerDeclaration, getOwaspCompliance } from './owaspChecker.js';
import { codeQualityDeclaration, getCodeQuality } from './codeQuality.js';
import {
  performanceMetricsDeclaration,
  getPerformanceMetrics,
} from './performanceMetrics.js';
import { changeRiskDeclaration, getChangeRisk } from './changeRisk.js';
import {
  deploymentTriggerDeclaration,
  triggerDeployment,
} from './deploymentTrigger.js';

/** Gemini function declarations for the agent */
export const TOOL_DECLARATIONS = [
  testMetricsDeclaration,
  vulnerabilityScannerDeclaration,
  owaspCheckerDeclaration,
  codeQualityDeclaration,
  performanceMetricsDeclaration,
  changeRiskDeclaration,
  deploymentTriggerDeclaration,
];

/**
 * Map tool name → handler. Handlers receive (args, releaseData).
 */
export const TOOL_HANDLERS = {
  get_test_metrics: getTestMetrics,
  get_vulnerability_report: getVulnerabilityReport,
  get_owasp_compliance: getOwaspCompliance,
  get_code_quality: getCodeQuality,
  get_performance_metrics: getPerformanceMetrics,
  get_change_risk: getChangeRisk,
  trigger_deployment: triggerDeployment,
};

/**
 * Execute a tool by name.
 */
export async function executeTool(name, args, releaseData) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return {
      toolName: name,
      success: false,
      data: {},
      errors: [`Unknown tool: ${name}`],
    };
  }
  return handler(args, releaseData);
}
