import { getThresholdsForEnv } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

export const changeRiskDeclaration = {
  name: 'get_change_risk',
  description:
    'Retrieve change-risk heuristics for the release: risk score (0-100), lines/files changed, whether auth/payments/infra are touched, blast radius, and risk factors. Higher score means riskier change; use for deployment strategy selection (e.g. canary for high risk).',
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

export async function getChangeRisk(args, releaseData) {
  const { targetEnvironment } = args;
  const c = releaseData.changeRisk || {};
  const thresholds = getThresholdsForEnv(targetEnvironment);

  const score = c.score ?? 50;
  const scoreOk = score <= thresholds.maxChangeRiskScore;

  const result = {
    toolName: 'get_change_risk',
    success: true,
    data: {
      score,
      linesChanged: c.linesChanged ?? 0,
      filesChanged: c.filesChanged ?? 0,
      authors: c.authors ?? 1,
      touchesAuth: !!c.touchesAuth,
      touchesPayments: !!c.touchesPayments,
      touchesInfra: !!c.touchesInfra,
      blastRadius: c.blastRadius ?? 'unknown',
      riskFactors: c.riskFactors ?? [],
      thresholds: { maxChangeRiskScore: thresholds.maxChangeRiskScore },
      gates: { riskScoreOk: scoreOk },
    },
    warnings: [],
    errors: [],
  };

  if (!scoreOk) {
    result.warnings.push(
      `Change risk score ${score} exceeds max ${thresholds.maxChangeRiskScore} for ${targetEnvironment}`
    );
  }
  if (c.touchesAuth || c.touchesPayments) {
    result.warnings.push(
      'Change touches sensitive domains (auth and/or payments) — prefer canary or blue-green'
    );
  }
  if (c.blastRadius === 'high') {
    result.warnings.push('High blast radius detected');
  }

  logger.debug('get_change_risk', result.data);
  return result;
}
