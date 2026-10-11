/**
 * Environment promotion chain and deployment strategy options.
 * Alpha → Beta → Gamma → Prod
 */

export const ENVIRONMENTS = {
  ALPHA: {
    name: 'alpha',
    displayName: 'Alpha',
    order: 1,
    description: 'Internal testing / dogfooding',
    next: 'beta',
    requiresApproval: false,
  },
  BETA: {
    name: 'beta',
    displayName: 'Beta',
    order: 2,
    description: 'Limited external users / early adopters',
    next: 'gamma',
    requiresApproval: false,
  },
  GAMMA: {
    name: 'gamma',
    displayName: 'Gamma',
    order: 3,
    description: 'Staging / pre-production (production-like)',
    next: 'prod',
    requiresApproval: true,
  },
  PROD: {
    name: 'prod',
    displayName: 'Production',
    order: 4,
    description: 'Live production traffic',
    next: null,
    requiresApproval: true,
  },
};

export const DEPLOYMENT_STRATEGIES = {
  ROLLING: {
    id: 'rolling',
    name: 'Rolling Update',
    description: 'Gradually replace instances one-by-one or in small batches',
    risk: 'low-medium',
    suitableFor: ['alpha', 'beta', 'gamma', 'prod'],
    rollbackSpeed: 'fast',
  },
  CANARY: {
    id: 'canary',
    name: 'Canary Deployment',
    description: 'Route a small % of traffic to new version, expand if healthy',
    risk: 'low',
    suitableFor: ['beta', 'gamma', 'prod'],
    rollbackSpeed: 'very-fast',
  },
  BLUE_GREEN: {
    id: 'blue-green',
    name: 'Blue-Green Deployment',
    description: 'Maintain two identical environments; switch traffic at once',
    risk: 'medium',
    suitableFor: ['gamma', 'prod'],
    rollbackSpeed: 'instant',
  },
  RECREATE: {
    id: 'recreate',
    name: 'Recreate',
    description: 'Terminate old version completely then start new (downtime)',
    risk: 'high',
    suitableFor: ['alpha'],
    rollbackSpeed: 'slow',
  },
  A_B: {
    id: 'a-b',
    name: 'A/B Testing',
    description: 'Split traffic between versions for experimentation',
    risk: 'low-medium',
    suitableFor: ['beta', 'gamma'],
    rollbackSpeed: 'fast',
  },
};

export function getEnvironment(name) {
  const key = String(name).toUpperCase();
  return ENVIRONMENTS[key] || null;
}

export function getNextEnvironment(current) {
  const env = getEnvironment(current);
  return env?.next ? getEnvironment(env.next) : null;
}
