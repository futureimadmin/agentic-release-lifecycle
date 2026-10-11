import { getThresholdsForEnv } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

export const codeQualityDeclaration = {
  name: 'get_code_quality',
  description:
    'Retrieve static analysis / code quality metrics: critical bugs, major bugs, code smells, maintainability index, technical debt, and duplication. Used to assess maintainability and defect risk before release.',
  parameters: {
    type: 'object',
    properties: {
      releaseId: { type: 'string', description: 'Release identifier' },
      targetEnvironment: {
        type: 'string',
        description: 'Target environment: alpha | beta | gamma | prod',
      },
    },
    required: ['releaseId', 'targetEnvironment'],
  },
};

export async function getCodeQuality(args, releaseData) {
  const { targetEnvironment } = args;
  const q = releaseData.codeQuality || {};
  const thresholds = getThresholdsForEnv(targetEnvironment);

  const criticalBugs = q.criticalBugs ?? 0;
  const maintainability = q.maintainabilityIndex ?? 0;

  const bugsOk = criticalBugs <= thresholds.maxCriticalBugs;
  const maintainabilityOk = maintainability >= thresholds.minMaintainabilityIndex;

  const result = {
    toolName: 'get_code_quality',
    success: true,
    data: {
      criticalBugs,
      majorBugs: q.majorBugs ?? 0,
      codeSmells: q.codeSmells ?? 0,
      maintainabilityIndex: maintainability,
      technicalDebtHours: q.technicalDebtHours ?? 0,
      duplicatedLinesPct: q.duplicatedLinesPct ?? 0,
      thresholds: {
        maxCriticalBugs: thresholds.maxCriticalBugs,
        minMaintainabilityIndex: thresholds.minMaintainabilityIndex,
      },
      gates: {
        criticalBugsOk: bugsOk,
        maintainabilityOk,
      },
    },
    warnings: [],
    errors: [],
  };

  if (!bugsOk) {
    result.errors.push(
      `Critical bugs (${criticalBugs}) exceed limit (${thresholds.maxCriticalBugs}) for ${targetEnvironment}`
    );
  }
  if (!maintainabilityOk) {
    result.warnings.push(
      `Maintainability index ${maintainability} is below ${thresholds.minMaintainabilityIndex} for ${targetEnvironment}`
    );
  }

  logger.debug('get_code_quality', result.data);
  return result;
}
