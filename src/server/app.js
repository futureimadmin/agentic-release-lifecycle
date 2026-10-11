/**
 * Web UI + API server for Agentic Release Life Cycle
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initGemini } from '../services/geminiClient.js';
import { loadReleaseData, listSampleReleases } from '../services/dataStore.js';
import { runReleaseAgent } from '../agent/ReleaseAgent.js';
import { ENVIRONMENTS, DEPLOYMENT_STRATEGIES } from '../config/environments.js';
import { THRESHOLDS } from '../config/thresholds.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '../../public');
const PORT = process.env.PORT || 3847;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC));

/** In-memory history of decisions for the UI */
const history = [];

let geminiReady = false;
try {
  initGemini();
  geminiReady = true;
  logger.info('Gemini ready for UI server');
} catch (err) {
  logger.warn(`Gemini not configured: ${err.message}`);
}

// ─── API ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    gemini: geminiReady,
    samples: listSampleReleases(),
    time: new Date().toISOString(),
  });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    environments: ENVIRONMENTS,
    strategies: DEPLOYMENT_STRATEGIES,
    thresholds: THRESHOLDS,
    samples: listSampleReleases(),
  });
});

app.get('/api/samples', (_req, res) => {
  res.json({ samples: listSampleReleases() });
});

app.get('/api/samples/:id', async (req, res) => {
  try {
    const data = await loadReleaseData(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/history', (_req, res) => {
  res.json({ history: history.slice().reverse() });
});

app.post('/api/evaluate', async (req, res) => {
  if (!geminiReady) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not configured. Set it in .env and restart the server.',
    });
  }

  const { sampleId, release } = req.body || {};
  let releaseData;

  try {
    if (sampleId) {
      releaseData = await loadReleaseData(sampleId);
    } else if (release) {
      releaseData = release;
    } else {
      return res.status(400).json({ error: 'Provide sampleId or release payload' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Optional overrides from UI
  if (req.body.targetEnvironment) {
    releaseData.targetEnvironment = req.body.targetEnvironment;
  }

  const started = Date.now();
  try {
    logger.info(`UI evaluate: ${releaseData.releaseId} → ${releaseData.targetEnvironment}`);
    const result = await runReleaseAgent(releaseData);
    const record = {
      id: `eval-${Date.now()}`,
      releaseId: releaseData.releaseId,
      version: releaseData.version,
      serviceName: releaseData.serviceName,
      targetEnvironment: releaseData.targetEnvironment,
      decision: result.decision,
      deployment: result.deployment,
      durationMs: Date.now() - started,
      at: new Date().toISOString(),
    };
    history.push(record);
    if (history.length > 50) history.shift();
    res.json(record);
  } catch (err) {
    logger.error('Evaluate failed:', err.message);
    res.status(500).json({ error: err.message || 'Agent failed' });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Agentic Release UI → http://localhost:${PORT}`);
  console.log(`  Gemini: ${geminiReady ? 'ready' : 'NOT configured (set GEMINI_API_KEY)'}\n`);
});
