import { getThresholdsForEnv } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

export const performanceMetricsDeclaration = {
  name: 'get_performance_metrics',
  description:
    'Retrieve performance / load-test results: latency percentiles (p50/p95/p99), throughput (RPS), error rate, and whether load tests passed. Compare against environment SLOs.',
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

export async function getPerformanceMetrics(args, releaseData) {
  const { targetEnvironment } = args;
  const p = releaseData.performance || {};
  const thresholds = getThresholdsForEnv(targetEnvironment);

  const p99 = p.p99LatencyMs ?? Infinity;
  const throughput = p.throughputRps ?? 0;
  const errorRate = p.errorRate ?? 1;

  const latencyOk = p99 <= thresholds.maxP99LatencyMs;
  const throughputOk = throughput >= thresholds.minThroughputRps;
  const errorRateOk = errorRate <= thresholds.maxErrorRate;
  const loadOk = p.loadTestPassed === true;

  const result = {
    toolName: 'get_performance_metrics',
    success: true,
    data: {
      p50LatencyMs: p.p50LatencyMs ?? null,
      p95LatencyMs: p.p95LatencyMs ?? null,
      p99LatencyMs: p.p99LatencyMs ?? null,
      throughputRps: throughput,
      errorRate,
      loadTestPassed: loadOk,
      thresholds: {
        maxP99LatencyMs: thresholds.maxP99LatencyMs,
        minThroughputRps: thresholds.minThroughputRps,
        maxErrorRate: thresholds.maxErrorRate,
      },
      gates: {
        latencyOk,
        throughputOk,
        errorRateOk,
        loadTestPassed: loadOk,
        allPerfGatesPassed: latencyOk && throughputOk && errorRateOk && loadOk,
      },
    },
    warnings: [],
    errors: [],
  };

  if (!latencyOk) {
    result.warnings.push(
      `p99 latency ${p99}ms exceeds ${thresholds.maxP99LatencyMs}ms for ${targetEnvironment}`
    );
  }
  if (!throughputOk) {
    result.warnings.push(
      `Throughput ${throughput} RPS is below ${thresholds.minThroughputRps} for ${targetEnvironment}`
    );
  }
  if (!errorRateOk) {
    result.errors.push(
      `Error rate ${(errorRate * 100).toFixed(2)}% exceeds ${(thresholds.maxErrorRate * 100).toFixed(2)}% for ${targetEnvironment}`
    );
  }
  if (!loadOk) {
    result.errors.push('Load / performance tests did not pass');
  }

  logger.debug('get_performance_metrics', result.data);
  return result;
}
