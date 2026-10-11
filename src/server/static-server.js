/**
 * Lightweight static + mock API server (no Express) for UI demos/screenshots.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadReleaseData, listSampleReleases } from '../services/dataStore.js';
import { ENVIRONMENTS, DEPLOYMENT_STRATEGIES } from '../config/environments.js';
import { THRESHOLDS } from '../config/thresholds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '../../public');
const PORT = process.env.PORT || 3847;

const history = [];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  if (Buffer.isBuffer(body)) {
    res.end(body);
  } else if (typeof body === 'string') {
    res.end(body);
  } else {
    res.end(JSON.stringify(body));
  }
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC)) {
    return send(res, 403, { error: 'Forbidden' });
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
        if (e2) return send(res, 404, { error: 'Not found' });
        send(res, 200, html.toString(), 'text/html; charset=utf-8');
      });
      return;
    }
    const ext = path.extname(filePath);
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

/** Demo decision payloads so UI screens look complete without Gemini */
function mockEvaluate(releaseData) {
  const env = (releaseData.targetEnvironment || 'prod').toLowerCase();
  const isRisky =
    (releaseData.vulnerabilities?.critical ?? 0) > 0 ||
    (releaseData.tests?.failed ?? 0) > 20 ||
    (releaseData.owasp?.score ?? 100) < 70;

  if (isRisky) {
    return {
      id: `eval-${Date.now()}`,
      releaseId: releaseData.releaseId,
      version: releaseData.version,
      serviceName: releaseData.serviceName,
      targetEnvironment: env,
      decision: {
        decision: 'NO_GO',
        confidence: 0.92,
        rationale:
          'Critical vulnerabilities and elevated test failures block promotion to ' +
          env +
          '. OWASP score is below the environment gate. Fix critical CVEs, restore pass ratio, and re-run security controls before retrying.',
        deploymentStrategy: null,
        blockingIssues: [
          'Critical vulnerabilities present (must be 0 for ' + env + ')',
          'Test pass ratio below environment threshold',
          'OWASP compliance score below minimum',
        ],
        recommendations: [
          'Upgrade packages listed in vulnerability report',
          'Stabilize failing e2e / integration suites',
          'Address failed OWASP controls before gamma/prod',
        ],
        toolEvidence: {
          get_test_metrics: {
            success: true,
            gates: { passRatioMet: false, coverageMet: true },
            warnings: ['Pass ratio below threshold'],
            errors: [],
          },
          get_vulnerability_report: {
            success: true,
            gates: { criticalOk: false, highOk: false, mediumOk: true, allSeverityGatesPassed: false },
            warnings: [],
            errors: ['Critical vulnerabilities exceed limit'],
          },
          get_owasp_compliance: {
            success: true,
            gates: { scoreMet: false, noFailedControls: false },
            warnings: ['OWASP score below minimum'],
            errors: [],
          },
        },
        timestamp: new Date().toISOString(),
      },
      deployment: null,
      durationMs: 1820,
      at: new Date().toISOString(),
    };
  }

  const strategy = env === 'prod' || env === 'gamma' ? 'canary' : 'rolling';
  return {
    id: `eval-${Date.now()}`,
    releaseId: releaseData.releaseId,
    version: releaseData.version,
    serviceName: releaseData.serviceName,
    targetEnvironment: env,
    decision: {
      decision: 'GO',
      confidence: 0.88,
      rationale:
        'All critical gates passed for ' +
        env +
        ': strong test pass ratio, no critical/high vulns blocking, OWASP score meets threshold, performance within SLO, and change risk is acceptable. Prefer ' +
        strategy +
        ' for safe rollout.',
      deploymentStrategy: strategy,
      blockingIssues: [],
      recommendations: [
        'Monitor canary error rate for 15 minutes before expanding',
        'Keep rollback plan ready for payments-path changes',
      ],
      toolEvidence: {
        get_test_metrics: {
          success: true,
          gates: { passRatioMet: true, coverageMet: true },
          warnings: [],
          errors: [],
        },
        get_vulnerability_report: {
          success: true,
          gates: { criticalOk: true, highOk: true, mediumOk: true, allSeverityGatesPassed: true },
          warnings: [],
          errors: [],
        },
        get_owasp_compliance: {
          success: true,
          gates: { scoreMet: true, noFailedControls: true },
          warnings: [],
          errors: [],
        },
        get_performance_metrics: {
          success: true,
          gates: { latencyOk: true, throughputOk: true, errorRateOk: true, loadTestPassed: true, allPerfGatesPassed: true },
          warnings: [],
          errors: [],
        },
        get_change_risk: {
          success: true,
          gates: { riskScoreOk: true },
          warnings: [],
          errors: [],
        },
      },
      timestamp: new Date().toISOString(),
    },
    deployment: {
      deploymentId: 'dep-' + Math.random().toString(16).slice(2, 10),
      releaseId: releaseData.releaseId,
      version: releaseData.version,
      environment: env,
      strategy,
      strategyName: strategy === 'canary' ? 'Canary Deployment' : 'Rolling Update',
      canaryPercent: strategy === 'canary' ? 5 : undefined,
      status: 'queued',
      simulated: true,
      message: `Deployment queued: ${strategy} → ${env}`,
    },
    durationMs: 2100,
    at: new Date().toISOString(),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  const url = req.url.split('?')[0];

  try {
    if (url === '/api/health') {
      return send(res, 200, {
        ok: true,
        gemini: false,
        mockMode: true,
        samples: listSampleReleases(),
        time: new Date().toISOString(),
      });
    }

    if (url === '/api/meta') {
      return send(res, 200, {
        environments: ENVIRONMENTS,
        strategies: DEPLOYMENT_STRATEGIES,
        thresholds: THRESHOLDS,
        samples: listSampleReleases(),
      });
    }

    if (url === '/api/samples') {
      return send(res, 200, { samples: listSampleReleases() });
    }

    if (url.startsWith('/api/samples/')) {
      const id = decodeURIComponent(url.slice('/api/samples/'.length));
      try {
        const data = await loadReleaseData(id);
        return send(res, 200, data);
      } catch (e) {
        return send(res, 404, { error: e.message });
      }
    }

    if (url === '/api/history') {
      return send(res, 200, { history: history.slice().reverse() });
    }

    if (url === '/api/evaluate' && req.method === 'POST') {
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return send(res, 400, { error: 'Invalid JSON' });
      }

      let releaseData;
      if (body.sampleId) {
        try {
          releaseData = await loadReleaseData(body.sampleId);
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
      } else if (body.release) {
        releaseData = body.release;
      } else {
        return send(res, 400, { error: 'Provide sampleId or release' });
      }
      if (body.targetEnvironment) releaseData.targetEnvironment = body.targetEnvironment;

      const record = mockEvaluate(releaseData);
      history.push(record);
      if (history.length > 50) history.shift();
      await new Promise((r) => setTimeout(r, 800));
      return send(res, 200, record);
    }

    return serveStatic(req, res);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Agentic Release UI (mock mode) → http://localhost:${PORT}\n`);
});
