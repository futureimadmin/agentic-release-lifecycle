import { randomUUID } from 'crypto';
import { DEPLOYMENT_STRATEGIES, getEnvironment } from '../config/environments.js';
import { logger } from '../utils/logger.js';

export const deploymentTriggerDeclaration = {
  name: 'trigger_deployment',
  description:
    'Trigger a deployment to the target environment using a specific strategy. Only call this AFTER you have decided GO and selected an appropriate strategy (rolling, canary, blue-green, recreate, or a-b). Returns a deployment job id and confirmation.',
  parameters: {
    type: 'object',
    properties: {
      releaseId: { type: 'string', description: 'Release identifier' },
      version: { type: 'string', description: 'Software version to deploy' },
      targetEnvironment: {
        type: 'string',
        description: 'Target environment: alpha | beta | gamma | prod',
      },
      strategy: {
        type: 'string',
        description: 'Deployment strategy: rolling | canary | blue-green | recreate | a-b',
        enum: ['rolling', 'canary', 'blue-green', 'recreate', 'a-b'],
      },
      canaryPercent: {
        type: 'number',
        description: 'Initial traffic percent for canary (1-20). Only for canary strategy.',
      },
      reason: {
        type: 'string',
        description: 'Short justification for GO and chosen strategy',
      },
    },
    required: ['releaseId', 'version', 'targetEnvironment', 'strategy', 'reason'],
  },
};

/**
 * Simulated deployment trigger. In production this would call Argo/Flux/Spinnaker/K8s API etc.
 */
export async function triggerDeployment(args, releaseData) {
  const {
    releaseId,
    version,
    targetEnvironment,
    strategy,
    canaryPercent = 5,
    reason,
  } = args;

  const env = getEnvironment(targetEnvironment);
  if (!env) {
    return {
      toolName: 'trigger_deployment',
      success: false,
      data: {},
      errors: [`Unknown environment: ${targetEnvironment}`],
    };
  }

  const strategyDef = Object.values(DEPLOYMENT_STRATEGIES).find((s) => s.id === strategy);
  if (!strategyDef) {
    return {
      toolName: 'trigger_deployment',
      success: false,
      data: {},
      errors: [`Unknown strategy: ${strategy}`],
    };
  }

  if (!strategyDef.suitableFor.includes(String(targetEnvironment).toLowerCase())) {
    return {
      toolName: 'trigger_deployment',
      success: false,
      data: {},
      warnings: [
        `Strategy "${strategy}" is not typically recommended for ${targetEnvironment}. Suitable: ${strategyDef.suitableFor.join(', ')}`,
      ],
      errors: [`Strategy not suitable for environment`],
    };
  }

  const deploymentId = `dep-${randomUUID().slice(0, 8)}`;
  const details = {
    deploymentId,
    releaseId: releaseId || releaseData.releaseId,
    version: version || releaseData.version,
    environment: env.name,
    strategy: strategyDef.id,
    strategyName: strategyDef.name,
    canaryPercent: strategy === 'canary' ? canaryPercent : undefined,
    reason,
    status: 'queued',
    simulated: true,
    message: `Deployment ${deploymentId} queued: ${strategyDef.name} → ${env.displayName}`,
  };

  logger.info(`DEPLOYMENT TRIGGERED: ${details.message}`);
  logger.info(`  Reason: ${reason}`);

  return {
    toolName: 'trigger_deployment',
    success: true,
    data: details,
    warnings: [],
    errors: [],
  };
}
