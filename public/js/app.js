/**
 * Agentic Release Life Cycle — frontend
 */

const state = {
  meta: null,
  history: [],
  selectedEnv: 'prod',
  evaluating: false,
};

document.addEventListener('DOMContentLoaded', async () => {
  bindNav();
  bindClock();
  bindEvaluateForm();
  bindQuickDemos();
  bindModal();

  await Promise.all([loadHealth(), loadMeta(), loadHistory()]);
  renderDashboard();
  renderPipeline();
  renderThresholds();
});

function bindNav() {
  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', () => showView(el.dataset.view));
  });
}

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const view = document.getElementById(`view-${name}`);
  if (view) view.classList.add('active');

  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach((n) =>
    n.classList.add('active')
  );

  const titles = {
    dashboard: 'Dashboard',
    evaluate: 'Evaluate Release',
    pipeline: 'Pipeline',
    history: 'History',
    thresholds: 'Thresholds',
  };
  document.getElementById('viewTitle').textContent = titles[name] || name;

  if (name === 'history') loadHistory().then(renderHistory);
}

function bindClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    el.textContent = new Date().toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  tick();
  setInterval(tick, 1000);
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function loadHealth() {
  try {
    const h = await api('/api/health');
    const pill = document.getElementById('geminiStatus');
    const label = document.getElementById('geminiLabel');
    if (h.gemini) {
      pill.classList.add('ok');
      label.textContent = 'Gemini ready';
    } else if (h.mockMode) {
      pill.classList.add('ok');
      label.textContent = 'Demo mode';
    } else {
      pill.classList.add('err');
      label.textContent = 'API key missing';
    }
  } catch {
    document.getElementById('geminiStatus').classList.add('err');
    document.getElementById('geminiLabel').textContent = 'Server offline';
  }
}

async function loadMeta() {
  try {
    state.meta = await api('/api/meta');
  } catch (e) {
    console.warn('meta failed', e);
  }
}

async function loadHistory() {
  try {
    const { history } = await api('/api/history');
    state.history = history || [];
  } catch {
    state.history = [];
  }
}

function renderDashboard() {
  const list = state.history;
  const go = list.filter((h) => h.decision?.decision === 'GO').length;
  const nogo = list.filter((h) => h.decision?.decision === 'NO_GO').length;
  const deploys = list.filter((h) => h.deployment).length;

  document.getElementById('statTotal').textContent = list.length;
  document.getElementById('statGo').textContent = go;
  document.getElementById('statNogo').textContent = nogo;
  document.getElementById('statDeploy').textContent = deploys;

  document.querySelectorAll('.pipe-stage').forEach((s) => s.classList.remove('filled'));
  if (list[0]) {
    const env = (list[0].targetEnvironment || '').toLowerCase();
    const order = ['alpha', 'beta', 'gamma', 'prod'];
    const idx = order.indexOf(env);
    order.slice(0, idx + 1).forEach((e) => {
      document.querySelector(`.pipe-stage[data-env="${e}"]`)?.classList.add('filled');
    });
  }

  const recent = document.getElementById('recentList');
  if (!list.length) {
    recent.className = 'recent-list empty-state';
    recent.textContent = 'No evaluations yet. Run a quick demo above.';
    return;
  }
  recent.className = 'recent-list';
  recent.innerHTML = list
    .slice(0, 5)
    .map((h) => recentItemHtml(h))
    .join('');
  recent.querySelectorAll('.recent-item').forEach((el) => {
    el.addEventListener('click', () => openDetail(list.find((x) => x.id === el.dataset.id)));
  });
}

function recentItemHtml(h) {
  const d = h.decision?.decision === 'GO' ? 'go' : 'nogo';
  const label = h.decision?.decision || '?';
  const when = relativeTime(h.at);
  return `
    <div class="recent-item" data-id="${h.id}">
      <span class="decision-badge ${d}">${label}</span>
      <div class="recent-meta">
        <div class="recent-title">${esc(h.serviceName || h.releaseId)} · ${esc(h.version)}</div>
        <div class="recent-sub">${esc((h.targetEnvironment || '').toUpperCase())}
          ${h.decision?.deploymentStrategy ? ' · ' + h.decision.deploymentStrategy : ''}
          ${h.deployment ? ' · deployed' : ''}</div>
      </div>
      <span class="recent-time">${when}</span>
    </div>`;
}

function bindQuickDemos() {
  document.querySelectorAll('.demo-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      showView('evaluate');
      const sample = btn.dataset.sample;
      document.getElementById('sampleSelect').value = sample;
      await loadSampleIntoForm(sample);
      try {
        const data = JSON.parse(document.getElementById('releaseJson').value);
        if (data.targetEnvironment) setEnvPill(data.targetEnvironment);
      } catch { /* ignore */ }
      runEvaluation();
    });
  });
}

function bindEvaluateForm() {
  document.getElementById('sampleSelect').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (id) await loadSampleIntoForm(id);
  });

  document.querySelectorAll('.env-pill').forEach((p) => {
    p.addEventListener('click', () => setEnvPill(p.dataset.env));
  });

  document.getElementById('evalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    runEvaluation();
  });

  document.getElementById('refreshHistory')?.addEventListener('click', async () => {
    await loadHistory();
    renderHistory();
    toast('History refreshed');
  });
}

function setEnvPill(env) {
  state.selectedEnv = env;
  document.querySelectorAll('.env-pill').forEach((p) => {
    p.classList.toggle('active', p.dataset.env === env);
  });
}

async function loadSampleIntoForm(id) {
  try {
    const data = await api(`/api/samples/${id}`);
    document.getElementById('releaseJson').value = JSON.stringify(data, null, 2);
    if (data.targetEnvironment) setEnvPill(data.targetEnvironment);
  } catch (err) {
    toast(err.message, true);
  }
}

async function runEvaluation() {
  if (state.evaluating) return;

  const raw = document.getElementById('releaseJson').value.trim();
  const sampleId = document.getElementById('sampleSelect').value;

  let body;
  if (sampleId && !raw) {
    body = { sampleId, targetEnvironment: state.selectedEnv };
  } else if (raw) {
    try {
      const release = JSON.parse(raw);
      body = { release, targetEnvironment: state.selectedEnv };
    } catch {
      toast('Invalid JSON in release payload', true);
      return;
    }
  } else {
    toast('Select a sample or paste release JSON', true);
    return;
  }

  state.evaluating = true;
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.querySelector('.btn-label').textContent = 'Agent running…';
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  document.getElementById('resultPlaceholder').classList.add('hidden');
  const content = document.getElementById('resultContent');
  content.classList.remove('hidden');
  content.innerHTML = `
    <div class="result-placeholder">
      <div class="btn-spinner" style="width:28px;height:28px;border-width:3px;margin-bottom:1rem"></div>
      <p>Gemini agent is inspecting metrics & deciding…</p>
      <p class="muted">This may take 15–40 seconds</p>
    </div>`;

  try {
    const record = await api('/api/evaluate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    state.history.unshift(record);
    renderResult(record);
    renderDashboard();
    toast(
      record.decision?.decision === 'GO' ? 'GO — deployment may be triggered' : 'NO-GO — release blocked',
      record.decision?.decision !== 'GO'
    );
  } catch (err) {
    content.innerHTML = `
      <div class="result-placeholder">
        <div class="placeholder-icon" style="color:var(--nogo)">✕</div>
        <p>${esc(err.message)}</p>
        <p class="muted">Check GEMINI_API_KEY and server logs</p>
      </div>`;
    toast(err.message, true);
  } finally {
    state.evaluating = false;
    btn.disabled = false;
    btn.querySelector('.btn-label').textContent = 'Run Agent Evaluation';
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
}

function renderResult(record) {
  const d = record.decision || {};
  const isGo = d.decision === 'GO';
  const deploy = record.deployment;

  const gatesHtml = renderGates(d.toolEvidence);
  const issues =
    (d.blockingIssues || []).length > 0
      ? `<div class="section-title">Blocking issues</div>
         <ul class="issue-list">${d.blockingIssues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
      : '';
  const recs =
    (d.recommendations || []).length > 0
      ? `<div class="section-title">Recommendations</div>
         <ul class="issue-list recs">${d.recommendations.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
      : '';

  document.getElementById('resultContent').innerHTML = `
    <div class="decision-hero ${isGo ? 'go' : 'nogo'}">
      <div class="big">${isGo ? '✅ GO' : '🛑 NO-GO'}</div>
      <div class="conf">Confidence ${(Number(d.confidence || 0) * 100).toFixed(0)}% · ${(record.durationMs / 1000).toFixed(1)}s</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><div class="lbl">Release</div><div class="val">${esc(record.releaseId)}</div></div>
      <div class="meta-item"><div class="lbl">Version</div><div class="val">${esc(record.version)}</div></div>
      <div class="meta-item"><div class="lbl">Service</div><div class="val">${esc(record.serviceName || '—')}</div></div>
      <div class="meta-item"><div class="lbl">Target</div><div class="val">${esc((record.targetEnvironment || '').toUpperCase())}</div></div>
      <div class="meta-item"><div class="lbl">Strategy</div><div class="val">${esc(d.deploymentStrategy || '—')}</div></div>
      <div class="meta-item"><div class="lbl">Time</div><div class="val">${esc(record.at || '')}</div></div>
    </div>

    <div class="section-title">Rationale</div>
    <div class="rationale-box">${esc(d.rationale || '—')}</div>

    ${issues}
    ${recs}

    ${
      deploy
        ? `<div class="deploy-box">
            <strong>Deployment triggered</strong><br/>
            ID: <code>${esc(deploy.deploymentId)}</code><br/>
            ${esc(deploy.strategyName || deploy.strategy)} → ${esc(deploy.environment)}
            ${deploy.canaryPercent != null ? ` · canary ${deploy.canaryPercent}%` : ''}<br/>
            <span class="muted">${esc(deploy.message || '')}</span>
          </div>`
        : ''
    }

    ${gatesHtml ? `<div class="section-title">Tool gates</div>${gatesHtml}` : ''}
  `;
}

function renderGates(evidence) {
  if (!evidence || !Object.keys(evidence).length) return '';
  const chips = [];
  for (const [tool, ev] of Object.entries(evidence)) {
    const gates = ev.gates || {};
    for (const [k, v] of Object.entries(gates)) {
      const ok = v === true;
      chips.push(
        `<div class="gate-chip ${ok ? 'pass' : 'fail'}">
          <span>${esc(tool.replace(/^get_/, '').slice(0, 12))}·${esc(k)}</span>
          <span>${ok ? '✓' : '✗'}</span>
        </div>`
      );
    }
  }
  if (!chips.length) return '';
  return `<div class="gates-grid">${chips.join('')}</div>`;
}

function renderPipeline() {
  if (!state.meta) return;
  const envs = state.meta.environments || {};
  const grid = document.getElementById('envDetailGrid');
  grid.innerHTML = Object.values(envs)
    .sort((a, b) => a.order - b.order)
    .map(
      (e) => `
    <div class="env-card">
      <div class="order">Stage ${e.order}</div>
      <h3>${esc(e.displayName)}</h3>
      <p>${esc(e.description)}</p>
      <div class="next">${e.next ? 'Next → ' + e.next : 'Terminal environment'}</div>
      ${e.requiresApproval ? '<div class="next" style="color:var(--warn)">Requires approval</div>' : ''}
    </div>`
    )
    .join('');

  const strats = state.meta.strategies || {};
  document.getElementById('strategyGrid').innerHTML = Object.values(strats)
    .map(
      (s) => `
    <div class="strategy-card">
      <h4>${esc(s.name)} <span class="risk">${esc(s.risk)}</span></h4>
      <p>${esc(s.description)}</p>
      <div class="suitable">Suitable: ${esc((s.suitableFor || []).join(', '))}</div>
      <div class="suitable">Rollback: ${esc(s.rollbackSpeed)}</div>
    </div>`
    )
    .join('');
}

function renderHistory() {
  const el = document.getElementById('historyTable');
  if (!state.history.length) {
    el.className = 'history-table empty-state';
    el.textContent = 'No history yet.';
    return;
  }
  el.className = 'history-table';
  el.innerHTML = state.history
    .map((h) => {
      const d = h.decision?.decision === 'GO' ? 'go' : 'nogo';
      return `
      <div class="history-row" data-id="${h.id}">
        <span class="decision-badge ${d}">${h.decision?.decision || '?'}</span>
        <div>
          <div class="svc">${esc(h.serviceName || h.releaseId)}</div>
          <div class="ver">${esc(h.version)}</div>
        </div>
        <span>${esc((h.targetEnvironment || '').toUpperCase())}</span>
        <span class="ver">${esc(h.decision?.deploymentStrategy || '—')}</span>
        <span class="ver">${h.deployment ? 'deployed' : '—'}</span>
        <span class="ver">${relativeTime(h.at)}</span>
      </div>`;
    })
    .join('');

  el.querySelectorAll('.history-row').forEach((row) => {
    row.addEventListener('click', () => {
      openDetail(state.history.find((x) => x.id === row.dataset.id));
    });
  });
}

function renderThresholds() {
  if (!state.meta?.thresholds) return;
  const t = state.meta.thresholds;
  const tbody = document.querySelector('#thresholdTable tbody');
  const rows = Object.entries(t).map(([key, byEnv]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .replace(/Ms$/, ' (ms)')
      .replace(/Rps$/, ' (RPS)');
    return `<tr>
      <td style="font-family:var(--sans);font-weight:500">${esc(label)}</td>
      <td>${fmtVal(byEnv.alpha)}</td>
      <td>${fmtVal(byEnv.beta)}</td>
      <td>${fmtVal(byEnv.gamma)}</td>
      <td>${fmtVal(byEnv.prod)}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
}

function fmtVal(v) {
  if (typeof v === 'number' && v > 0 && v <= 1) return (v * 100).toFixed(0) + '%';
  if (typeof v === 'number') return String(v);
  return v ?? '—';
}

function bindModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
}

function openDetail(record) {
  if (!record) return;
  const body = document.getElementById('modalBody');
  const isGo = record.decision?.decision === 'GO';
  body.innerHTML = `
    <div class="decision-hero ${isGo ? 'go' : 'nogo'}" style="margin-top:0.5rem">
      <div class="big">${isGo ? '✅ GO' : '🛑 NO-GO'}</div>
      <div class="conf">${esc(record.serviceName || '')} ${esc(record.version)} → ${(record.targetEnvironment || '').toUpperCase()}</div>
    </div>
    <div class="rationale-box" style="margin-bottom:1rem">${esc(record.decision?.rationale || '')}</div>
    <pre style="font-family:var(--mono);font-size:0.72rem;color:var(--text-dim);overflow:auto;max-height:280px;background:var(--bg-elevated);padding:0.75rem;border-radius:8px">${esc(JSON.stringify(record, null, 2))}</pre>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relativeTime(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : ' success');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 4000);
}
