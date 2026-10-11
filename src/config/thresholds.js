/**
 * Soft / hard thresholds used by tools and as guidance for the LLM agent.
 * The LLM makes the final binary classification but is expected to respect these.
 */

export const THRESHOLDS = {
  minPassRatio: {
    alpha: 0.85,
    beta: 0.92,
    gamma: 0.97,
    prod: 0.99,
  },
  minCoverage: {
    alpha: 0.6,
    beta: 0.7,
    gamma: 0.8,
    prod: 0.85,
  },
  maxCriticalVulns: {
    alpha: 2,
    beta: 0,
    gamma: 0,
    prod: 0,
  },
  maxHighVulns: {
    alpha: 10,
    beta: 5,
    gamma: 2,
    prod: 0,
  },
  maxMediumVulns: {
    alpha: 50,
    beta: 20,
    gamma: 10,
    prod: 5,
  },
  minOwaspScore: {
    alpha: 60,
    beta: 75,
    gamma: 85,
    prod: 95,
  },
  maxCriticalBugs: {
    alpha: 5,
    beta: 2,
    gamma: 0,
    prod: 0,
  },
  minMaintainabilityIndex: {
    alpha: 50,
    beta: 60,
    gamma: 70,
    prod: 75,
  },
  maxP99LatencyMs: {
    alpha: 2000,
    beta: 1000,
    gamma: 500,
    prod: 300,
  },
  minThroughputRps: {
    alpha: 10,
    beta: 50,
    gamma: 100,
    prod: 200,
  },
  maxErrorRate: {
    alpha: 0.05,
    beta: 0.02,
    gamma: 0.005,
    prod: 0.001,
  },
  maxChangeRiskScore: {
    alpha: 80,
    beta: 60,
    gamma: 40,
    prod: 25,
  },
};

export function getThresholdsForEnv(envName) {
  const env = String(envName).toLowerCase();
  const result = {};
  for (const [key, byEnv] of Object.entries(THRESHOLDS)) {
    result[key] = byEnv[env] ?? byEnv.prod;
  }
  return result;
}
