import { getThresholdsForEnv } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

export const owaspCheckerDeclaration = {
  name: 'get_owasp_compliance',
  description:
    'Retrieve OWASP Top 10 / ASVS compliance score, failed controls, and security posture for the release. Score is 0-100; higher is better. Failed controls list specific OWASP categories that need attention.',
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

export async function getOwaspCompliance(args, releaseData) {
  const { targetEnvironment } = args;
  const o = releaseData.owasp || {};
  const thresholds = getThresholdsForEnv(targetEnvironment);

  const score = o.score ?? 0;
  const scoreOk = score >= thresholds.minOwaspScore;
  const failedControls = o.failedControls ?? [];

  const result = {
    toolName: 'get_owasp_compliance',
    success: true,
    data: {
      score,
      asvsLevel: o.asvsLevel ?? null,
      failedControls,
      checkedControls: o.checkedControls ?? 0,
      notes: o.notes ?? '',
      thresholds: { minOwaspScore: thresholds.minOwaspScore },
      gates: {
        scoreMet: scoreOk,
        noFailedControls: failedControls.length === 0,
      },
    },
    warnings: [],
    errors: [],
  };

  if (!scoreOk) {
    result.warnings.push(
      `OWASP score ${score} is below minimum ${thresholds.minOwaspScore} for ${targetEnvironment}`
    );
  }
  if (failedControls.length > 0) {
    result.warnings.push(`Failed OWASP controls: ${failedControls.join('; ')}`);
  }

  logger.debug('get_owasp_compliance', result.data);
  return result;
}
