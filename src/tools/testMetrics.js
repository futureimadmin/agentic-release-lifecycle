import { getThresholdsForEnv } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

export const testMetricsDeclaration = {
  name: 'get_test_metrics',
  description:
    'Retrieve automated test results for the current release candidate: total tests, passed, failed, pass ratio, coverage, flaky tests, and suite-level pass rates. Use this to evaluate quality gates for the target environment.',
  parameters: {
    type: 'object',
    properties: {
      releaseId: {
        type: 'string',
        description: 'Release identifier',
      },
      targetEnvironment: {
        type: 'string',
        description: 'Target environment: alpha | beta | gamma | prod',
      },
    },
    required: ['releaseId', 'targetEnvironment'],
  },
};

export async function getTestMetrics(args, releaseData) {
  const { targetEnvironment } = args;
  const t = releaseData.tests || {};
  const thresholds = getThresholdsForEnv(targetEnvironment);

  const total = t.total ?? 0;
  const passed = t.passed ?? 0;
  const failed = t.failed ?? 0;
  const passRatio = total > 0 ? passed / total : 0;

  const meetsPassRatio = passRatio >= thresholds.minPassRatio;
  const meetsCoverage = (t.coverage ?? 0) >= thresholds.minCoverage;

  const result = {
    toolName: 'get_test_metrics',
    success: true,
    data: {
      total,
      passed,
      failed,
      skipped: t.skipped ?? 0,
      passRatio: Number(passRatio.toFixed(4)),
      coverage: t.coverage ?? null,
      flakyCount: t.flakyCount ?? 0,
      suites: t.suites ?? {},
      thresholds: {
        minPassRatio: thresholds.minPassRatio,
        minCoverage: thresholds.minCoverage,
      },
      gates: {
        passRatioMet: meetsPassRatio,
        coverageMet: meetsCoverage,
      },
    },
    warnings: [],
    errors: [],
  };

  if (!meetsPassRatio) {
    result.warnings.push(
      `Pass ratio ${(passRatio * 100).toFixed(2)}% is below threshold ${(thresholds.minPassRatio * 100).toFixed(0)}% for ${targetEnvironment}`
    );
  }
  if (!meetsCoverage) {
    result.warnings.push(
      `Coverage ${((t.coverage ?? 0) * 100).toFixed(1)}% is below threshold ${(thresholds.minCoverage * 100).toFixed(0)}% for ${targetEnvironment}`
    );
  }
  if ((t.flakyCount ?? 0) > 5) {
    result.warnings.push(`High flaky test count: ${t.flakyCount}`);
  }

  logger.debug('get_test_metrics', result.data);
  return result;
}
