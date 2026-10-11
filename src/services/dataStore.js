import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

/**
 * In-memory + file-backed sample data for demo / offline use.
 * In production, replace with real CI, scanner, and observability APIs.
 */

const SAMPLE_RELEASES = {
  'demo-healthy': {
    releaseId: 'rel-2026-10-10-001',
    version: '2.4.1',
    commitSha: 'a1b2c3d4e5f6789012345678',
    serviceName: 'payments-api',
    targetEnvironment: 'prod',
    currentEnvironment: 'gamma',
    tests: {
      total: 1240,
      passed: 1235,
      failed: 5,
      skipped: 0,
      coverage: 0.88,
      flakyCount: 2,
      suites: { unit: 0.99, integration: 0.97, e2e: 0.95 },
    },
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 3,
      low: 12,
      info: 40,
      scanner: 'trivy+snyk',
      lastScanAt: '2026-10-10T10:00:00Z',
      topIssues: [
        { id: 'CVE-2024-1234', severity: 'medium', package: 'lodash', fixedIn: '4.17.22' },
      ],
    },
    owasp: {
      score: 96,
      asvsLevel: 2,
      failedControls: [],
      checkedControls: 48,
      notes: 'All OWASP Top 10 categories addressed for this service.',
    },
    codeQuality: {
      criticalBugs: 0,
      majorBugs: 2,
      codeSmells: 45,
      maintainabilityIndex: 78,
      technicalDebtHours: 12,
      duplicatedLinesPct: 2.1,
    },
    performance: {
      p50LatencyMs: 42,
      p95LatencyMs: 110,
      p99LatencyMs: 210,
      throughputRps: 450,
      errorRate: 0.0004,
      loadTestPassed: true,
    },
    changeRisk: {
      score: 18,
      linesChanged: 320,
      filesChanged: 14,
      authors: 3,
      touchesAuth: false,
      touchesPayments: true,
      touchesInfra: false,
      blastRadius: 'medium',
      riskFactors: ['payments path modified'],
    },
  },
  'demo-risky': {
    releaseId: 'rel-2026-10-10-002',
    version: '2.5.0-rc1',
    commitSha: 'f9e8d7c6b5a4321098765432',
    serviceName: 'auth-gateway',
    targetEnvironment: 'prod',
    currentEnvironment: 'gamma',
    tests: {
      total: 890,
      passed: 810,
      failed: 80,
      skipped: 0,
      coverage: 0.72,
      flakyCount: 15,
      suites: { unit: 0.94, integration: 0.85, e2e: 0.7 },
    },
    vulnerabilities: {
      critical: 1,
      high: 4,
      medium: 18,
      low: 30,
      info: 55,
      scanner: 'trivy+snyk',
      lastScanAt: '2026-10-10T09:00:00Z',
      topIssues: [
        { id: 'CVE-2025-9999', severity: 'critical', package: 'openssl', fixedIn: '3.0.15' },
        { id: 'CVE-2024-5678', severity: 'high', package: 'express', fixedIn: '4.21.0' },
      ],
    },
    owasp: {
      score: 62,
      asvsLevel: 1,
      failedControls: ['A01:2021-Broken Access Control', 'A02:2021-Cryptographic Failures'],
      checkedControls: 40,
      notes: 'Access control tests failing on admin routes; weak cipher suite still enabled.',
    },
    codeQuality: {
      criticalBugs: 3,
      majorBugs: 11,
      codeSmells: 120,
      maintainabilityIndex: 48,
      technicalDebtHours: 65,
      duplicatedLinesPct: 8.4,
    },
    performance: {
      p50LatencyMs: 120,
      p95LatencyMs: 890,
      p99LatencyMs: 2100,
      throughputRps: 80,
      errorRate: 0.035,
      loadTestPassed: false,
    },
    changeRisk: {
      score: 78,
      linesChanged: 4200,
      filesChanged: 95,
      authors: 8,
      touchesAuth: true,
      touchesPayments: false,
      touchesInfra: true,
      blastRadius: 'high',
      riskFactors: ['auth module rewrite', 'infra terraform changes', 'large diff'],
    },
  },
  'demo-borderline': {
    releaseId: 'rel-2026-10-10-003',
    version: '1.9.2',
    commitSha: '11223344556677889900aabb',
    serviceName: 'catalog-service',
    targetEnvironment: 'gamma',
    currentEnvironment: 'beta',
    tests: {
      total: 560,
      passed: 548,
      failed: 12,
      skipped: 0,
      coverage: 0.81,
      flakyCount: 4,
      suites: { unit: 0.98, integration: 0.93, e2e: 0.88 },
    },
    vulnerabilities: {
      critical: 0,
      high: 1,
      medium: 8,
      low: 20,
      info: 30,
      scanner: 'trivy',
      lastScanAt: '2026-10-10T11:00:00Z',
      topIssues: [
        { id: 'CVE-2024-8888', severity: 'high', package: 'axios', fixedIn: '1.7.7' },
      ],
    },
    owasp: {
      score: 84,
      asvsLevel: 2,
      failedControls: ['A05:2021-Security Misconfiguration'],
      checkedControls: 45,
      notes: 'Default error pages expose stack traces in non-prod only.',
    },
    codeQuality: {
      criticalBugs: 0,
      majorBugs: 4,
      codeSmells: 60,
      maintainabilityIndex: 68,
      technicalDebtHours: 22,
      duplicatedLinesPct: 3.5,
    },
    performance: {
      p50LatencyMs: 55,
      p95LatencyMs: 180,
      p99LatencyMs: 420,
      throughputRps: 180,
      errorRate: 0.004,
      loadTestPassed: true,
    },
    changeRisk: {
      score: 35,
      linesChanged: 890,
      filesChanged: 28,
      authors: 4,
      touchesAuth: false,
      touchesPayments: false,
      touchesInfra: false,
      blastRadius: 'low',
      riskFactors: ['schema migration included'],
    },
  },
};

/**
 * Load release package by id or from a JSON file path.
 */
export async function loadReleaseData(releaseIdOrPath) {
  if (SAMPLE_RELEASES[releaseIdOrPath]) {
    logger.info(`Loaded sample release: ${releaseIdOrPath}`);
    return structuredClone(SAMPLE_RELEASES[releaseIdOrPath]);
  }

  try {
    const fullPath = path.isAbsolute(releaseIdOrPath)
      ? releaseIdOrPath
      : path.join(DATA_DIR, releaseIdOrPath);
    const raw = await readFile(fullPath, 'utf-8');
    const data = JSON.parse(raw);
    logger.info(`Loaded release data from file: ${fullPath}`);
    return data;
  } catch {
    // fall through
  }

  throw new Error(
    `Unknown release id or file: ${releaseIdOrPath}. Available demos: ${Object.keys(SAMPLE_RELEASES).join(', ')}`
  );
}

export function listSampleReleases() {
  return Object.keys(SAMPLE_RELEASES);
}
