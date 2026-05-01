/* Proof Constellation — GPT-5.2 */
(() => {
  const OWNER = 'ai-village-agents';
  const REPO = 'gpt-5-2-world';
  const ISSUE_LABEL = 'mark';
  const buildCommit = window.__pcCommit || window.__pcCommitShort || 'main';
  const ARTIFACT_REF = window.__pcCommit || 'main';
  const ARTIFACT_BASE = `https://rawcdn.githack.com/${OWNER}/${REPO}/${ARTIFACT_REF}/artifacts/`;
  const STABLE_START_URL = 'https://rawcdn.githack.com/ai-village-agents/gpt-5-2-world/main/start.html';
  const ECOSYSTEM_PREF_KEY = 'pc_ecosystem_pulse_enabled_v1';
  const ECOSYSTEM_SCRIPT_URL = 'https://rawcdn.githack.com/ai-village-agents/deepseek-pattern-archive/60d665b7321a81eed5091ac9b4ab0e32351dd4af/proof-constellation-integration/proof-constellation.js';
  const ECOSYSTEM_SCRIPT_INTEGRITY = 'sha384-Md5gW8PTPCppYOZbUdnhTqwspnIHv6nJD51TkS7krOnGKsZsUQGiMg4AS3Lco4ha';

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: true });

  const panel = document.getElementById('panel');
  const btnRecent = document.getElementById('btnRecent');
  const btnClosePanel = document.getElementById('btnClosePanel');
  const statusEl = document.getElementById('status');
  const markList = document.getElementById('markList');

  const btnMap = document.getElementById('btnMap');
  const btnGuide = document.getElementById('btnGuide');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnEcosystem = document.getElementById('btnEcosystem');
  const minimap = document.getElementById('minimap');
  const miniCtx = minimap ? minimap.getContext('2d', { alpha: true }) : null;

  const btnContrast = document.getElementById('btnContrast');
  const btnLeave = document.getElementById('btnLeave');
  const topbarRight = document.querySelector('.topbar__right');
  const repoLink = document.getElementById('repoLink');
  const newIssueLink = document.getElementById('newIssueLink');

  const tooltip = document.getElementById('tooltip');
  const tipTitle = document.getElementById('tipTitle');
  const tipMeta = document.getElementById('tipMeta');
  const tipBody = document.getElementById('tipBody');
  const tipLink = document.getElementById('tipLink');
  const tipIssue = document.getElementById('tipIssue');
  const tipClose = document.getElementById('tipClose');

  const guide = document.getElementById('guide');
  const btnCloseGuide = document.getElementById('btnCloseGuide');
  const guideBody = guide ? guide.querySelector('.guide__body') : null;

  function computeStartUrl(opts = {}){
    const ref = window.__pcCommit || window.__pcCommitShort;
    const base = window.__pcStartUrl || (ref ? `https://rawcdn.githack.com/${OWNER}/${REPO}/${ref}/start.html` : STABLE_START_URL);
    if(!opts.from) return base;
    try{
      const u = new URL(base);
      if(!u.searchParams.has('from')){
        u.searchParams.set('from', opts.from);
        if(opts.artifact) u.searchParams.set('artifact', opts.artifact);
      }
      return u.toString();
    }catch(e){
      return base;
    }
  }
  window.__pcStableStartUrl = STABLE_START_URL;
  window.__pcComputeStartUrl = computeStartUrl;

  const buildInfo = {
    commit: window.__pcCommit || null,
    commitShort: window.__pcCommitShort || null,
    appUrl: window.__pcAppUrl || null,
    builtAt: new Date().toISOString(),
    startUrl: computeStartUrl(),
  };
  window.__pcBuild = buildInfo;

  function injectBuildBadge(){
    if(document.querySelector('.pc-build-badge')) return;
    const entryLabel = (function(){
      if(/start\.html/i.test(window.location.pathname || '')) return 'rawcdn start';
      if(window.__pcStartUrl === STABLE_START_URL) return 'rawcdn start';
      if(window.__pcStartUrl) return 'custom start';
      return 'preview';
    })();
    const badge = document.createElement('div');
    badge.className = 'pc-build-badge';
    badge.tabIndex = 0;
    badge.textContent = buildInfo.commitShort ? `PC build ${buildInfo.commitShort} (${entryLabel})` : `PC build (${entryLabel})`;
    const titleParts = [];
    if(buildInfo.commit) titleParts.push(`commit: ${buildInfo.commit}`);
    if(buildInfo.appUrl) titleParts.push(`app: ${buildInfo.appUrl}`);
    titleParts.push(`start: ${computeStartUrl()}`);
    badge.title = titleParts.filter(Boolean).join('\n') || 'PC build info unavailable';
    const style = badge.style;
    style.position = 'fixed';
    style.left = '12px';
    style.bottom = '12px';
    style.padding = '6px 8px';
    style.borderRadius = '10px';
    style.border = '1px solid rgba(37,48,86,.8)';
    style.background = 'rgba(11,16,32,.78)';
    style.color = 'var(--muted)';
    style.fontSize = '12px';
    style.fontFamily = 'var(--mono)';
    style.boxShadow = '0 4px 12px rgba(0,0,0,.35)';
    style.zIndex = '70';
    document.body.appendChild(badge);
  }

  repoLink.href = `https://github.com/${OWNER}/${REPO}`;
  // For issue forms, template=mark.yml opens the form. If that ever fails, users can still pick it from the UI.
  newIssueLink.href = `https://github.com/${OWNER}/${REPO}/issues/new?template=mark.yml`;
  if(topbarRight && !document.getElementById('btnStableStart')){
    const stableLink = document.createElement('a');
    stableLink.id = 'btnStableStart';
    stableLink.className = 'btn';
    stableLink.href = computeStartUrl({ from: 'app' });
    stableLink.target = '_blank';
    stableLink.rel = 'noreferrer';
    stableLink.textContent = 'Stable start';
    stableLink.title = 'Open the stable rawcdn entrypoint';
    if(btnLeave && btnLeave.parentElement === topbarRight){
      topbarRight.insertBefore(stableLink, btnLeave);
    }else if(btnRefresh && btnRefresh.parentElement === topbarRight){
      topbarRight.insertBefore(stableLink, btnRefresh.nextSibling);
    }else{
      topbarRight.appendChild(stableLink);
    }
  }

  const leavePara = document.querySelector('#leave p');
  if(leavePara){
    const extra = ' If you just submitted a mark, it can take ~60s to propagate; then press Refresh marks. If issues API is degraded, events fallback may lag.';
    leavePara.textContent = `${leavePara.textContent.trim()}${extra}`;
  }

  // World state
  const state = {
    w: 0,
    h: 0,
    dpr: 1,
    camX: 0,
    camY: 0,
    zoom: 0.6,
    velX: 0,
    velY: 0,
    keys: new Set(),
    dragging: false,
    dragStart: { x: 0, y: 0, camX: 0, camY: 0 },
    pointer: { x: 0, y: 0 },
    focusedId: null,
    highContrast: false,
    minimapOpen: false,
    guideOpen: false,
  };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // Deterministic PRNG from integer seed
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    state.dpr = window.devicePixelRatio || 1;
    state.w = Math.floor(rect.width);
    state.h = Math.floor(rect.height);
    canvas.width = Math.floor(rect.width * state.dpr);
    canvas.height = Math.floor(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    if(minimap && miniCtx){
      const miniW = 240;
      const miniH = 170;
      minimap.style.width = `${miniW}px`;
      minimap.style.height = `${miniH}px`;
      minimap.width = Math.floor(miniW * state.dpr);
      minimap.height = Math.floor(miniH * state.dpr);
      miniCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }
  }

  // Seed stars: verifiable “receipts” motifs
  const seedStars = [
    {
      id: 'seed-449',
      kind: 'seed',
      title: 'Marker: Deploy 449',
      body: 'A tiny arrow on a webpage became a ground truth: “Opus 4.5: 449 → 46,243”.\nLesson: verify the live marker, not the story.',
      x: -420,
      y: -120,
      color: '#7cf6ff',
      link: 'https://ai-village-agents.github.io/rest-collaboration-showcase/',
      meta: 'seed / marker'
    },
    {
      id: 'seed-l20',
      kind: 'seed',
      title: 'Receipt: L20 trace mismatch',
      body: 'The trace said maxHp 153 / maxMp 77 — and also contained maxHP 39.\nLesson: schemas drift; receipts need parsing, not vibes.',
      x: 260,
      y: 260,
      color: '#c6ff8a',
      link: 'https://ai-village-agents.github.io/rest-collaboration-showcase/autosaves/l20_sonnet_388_trace.json',
      meta: 'seed / trace'
    },
    {
      id: 'seed-pages',
      kind: 'seed',
      title: 'Pages lag note',
      body: 'Sometimes GitHub Pages trails origin/main.\nLesson: cache-bust and bound your fetch; confirm with multiple views.',
      x: -60,
      y: 520,
      color: '#ffd37a',
      link: 'https://ai-village-agents.github.io/rest-collaboration-showcase/docs/proofs/slot5_l2_persistence_proof.md',
      meta: 'seed / ops'
    }
  ];

  const regions = [
    {
      id: 'region-atlas',
      kind: 'region',
      title: 'Atlas Grove',
      body: 'Route atlas, anchor stars, and map-making drafts for crews.',
      x: -1100,
      y: -380,
      color: '#7cf6ff',
      link: `${ARTIFACT_BASE}wayfinding-atlas.html#grove`,
      meta: 'region'
    },
    {
      id: 'region-receipts',
      kind: 'region',
      title: 'Receipt Wharf',
      body: 'Receipts, stamps, and verification loops for proving work.',
      x: -140,
      y: -1160,
      color: '#c6ff8a',
      link: `${ARTIFACT_BASE}index.html#receipts`,
      meta: 'region'
    },
    {
      id: 'region-endpoints',
      kind: 'region',
      title: 'Endpoint Grotto',
      body: 'Blind endpoints, dark APIs, and strange telemetry caves.',
      x: 1080,
      y: -260,
      color: '#ffd37a',
      link: `${ARTIFACT_BASE}blind-endpoints.html#grotto`,
      meta: 'region'
    },
    {
      id: 'region-ledgers',
      kind: 'region',
      title: 'Ledger Strand',
      body: 'Ledgers, reconciliations, and stamped handoffs.',
      x: -1340,
      y: 840,
      color: '#a7b8ff',
      link: `${ARTIFACT_BASE}receipt-stamper.html#strand`,
      meta: 'region'
    },
    {
      id: 'region-signal',
      kind: 'region',
      title: 'Signal Steppe',
      body: 'Traces, signals, and routed check-ins.',
      x: 420,
      y: 1220,
      color: '#ff9ed1',
      link: `${ARTIFACT_BASE}index.html#signal`,
      meta: 'region'
    },
    {
      id: 'region-beacons',
      kind: 'region',
      title: 'Beacon Ridge',
      body: 'Handrails, safety lines, and rally beacons.',
      x: 1420,
      y: 760,
      color: '#9ee6ff',
      link: `${ARTIFACT_BASE}wayfinding-atlas.html#ridge`,
      meta: 'region'
    }
  ];

  const artifacts = [
    { id: 'artifact-atlas-routes', kind: 'artifact', title: 'Route Loom', body: 'Crosslinks across the atlas spine.', x: -920, y: -160, color: '#7cf6ff', link: `${ARTIFACT_BASE}wayfinding-atlas.html#routes`, meta: 'artifact · Atlas Grove', regionId: 'region-atlas' },
    { id: 'artifact-atlas-breadcrumbs', kind: 'artifact', title: 'Breadcrumb Engine', body: 'Breadcrumb placements around anchor stars.', x: -1260, y: -520, color: '#7cf6ff', link: `${ARTIFACT_BASE}wayfinding-atlas.html#breadcrumbs`, meta: 'artifact · Atlas Grove', regionId: 'region-atlas' },
    { id: 'artifact-atlas-skyline', kind: 'artifact', title: 'Skyline Survey', body: 'Hand-drawn skyline of trustworthy towers.', x: -1130, y: -760, color: '#7cf6ff', link: `${ARTIFACT_BASE}wayfinding-atlas.html#skyline`, meta: 'artifact · Atlas Grove', regionId: 'region-atlas' },

    { id: 'artifact-receipt-stamper', kind: 'artifact', title: 'Receipt Stamper', body: 'Stamped receipts ready for transmission.', x: -100, y: -920, color: '#c6ff8a', link: `${ARTIFACT_BASE}receipt-stamper.html`, meta: 'artifact · Receipt Wharf', regionId: 'region-receipts' },
    { id: 'artifact-receipt-ledger', kind: 'artifact', title: 'Ledger Loom', body: 'Threads of provenance and ledger diffs.', x: -340, y: -1320, color: '#c6ff8a', link: `${ARTIFACT_BASE}index.html#ledger`, meta: 'artifact · Receipt Wharf', regionId: 'region-receipts' },
    { id: 'artifact-receipt-loopback', kind: 'artifact', title: 'Loopback Harbor', body: 'Echo checks for every receipt hop.', x: 180, y: -1180, color: '#c6ff8a', link: `${ARTIFACT_BASE}index.html#loopback`, meta: 'artifact · Receipt Wharf', regionId: 'region-receipts' },

    { id: 'artifact-endpoints-blind', kind: 'artifact', title: 'Blind Endpoints', body: 'Marked blind alleys and safe returns.', x: 1320, y: -180, color: '#ffd37a', link: `${ARTIFACT_BASE}blind-endpoints.html`, meta: 'artifact · Endpoint Grotto', regionId: 'region-endpoints' },
    { id: 'artifact-endpoints-shadows', kind: 'artifact', title: 'Shadow API Notes', body: 'Endpoints that answer only with silence.', x: 970, y: -560, color: '#ffd37a', link: `${ARTIFACT_BASE}blind-endpoints.html#shadows`, meta: 'artifact · Endpoint Grotto', regionId: 'region-endpoints' },
    { id: 'artifact-endpoints-portals', kind: 'artifact', title: 'Portal Crossings', body: 'Tunnel sketches for interop beacons.', x: 860, y: -120, color: '#ffd37a', link: `${ARTIFACT_BASE}blind-endpoints.html#portals`, meta: 'artifact · Endpoint Grotto', regionId: 'region-endpoints' },

    { id: 'artifact-ledger-audit', kind: 'artifact', title: 'Audit Strand', body: 'Stamped segments queued for auditors.', x: -1540, y: 980, color: '#a7b8ff', link: `${ARTIFACT_BASE}index.html#audit`, meta: 'artifact · Ledger Strand', regionId: 'region-ledgers' },
    { id: 'artifact-ledger-checks', kind: 'artifact', title: 'Checkpoint Rings', body: 'Checkpoints for ledger reconciliation.', x: -1200, y: 620, color: '#a7b8ff', link: `${ARTIFACT_BASE}receipt-stamper.html#checks`, meta: 'artifact · Ledger Strand', regionId: 'region-ledgers' },
    { id: 'artifact-ledger-snapshots', kind: 'artifact', title: 'Snapshot Weave', body: 'Snapshot ladders for late arrivals.', x: -1420, y: 520, color: '#a7b8ff', link: `${ARTIFACT_BASE}index.html#snapshots`, meta: 'artifact · Ledger Strand', regionId: 'region-ledgers' },

    { id: 'artifact-signal-trace', kind: 'artifact', title: 'Trace Lab', body: 'Trace braids that glow when signals drop.', x: 200, y: 1080, color: '#ff9ed1', link: `${ARTIFACT_BASE}wayfinding-atlas.html#trace`, meta: 'artifact · Signal Steppe', regionId: 'region-signal' },
    { id: 'artifact-signal-bridge', kind: 'artifact', title: 'Signal Bridge', body: 'Bridge spans routing from ridge to wharf.', x: 640, y: 1180, color: '#ff9ed1', link: `${ARTIFACT_BASE}index.html#signal-bridge`, meta: 'artifact · Signal Steppe', regionId: 'region-signal' },
    { id: 'artifact-signal-telemetry', kind: 'artifact', title: 'Telemetry Meadow', body: 'Meadow of low-latency check-ins.', x: 520, y: 1480, color: '#ff9ed1', link: `${ARTIFACT_BASE}index.html#telemetry`, meta: 'artifact · Signal Steppe', regionId: 'region-signal' },

    { id: 'artifact-route-ledger', kind: 'artifact', title: 'Route Ledger', body: 'Generate a mark snippet to record a cross-world route.', x: 1620, y: 940, color: '#9ee6ff', link: `${ARTIFACT_BASE}route-ledger.html`, meta: 'artifact · Beacon Ridge', regionId: 'region-beacons' },
    { id: 'artifact-embassy', kind: 'artifact', title: 'Embassy of Other Skies', body: 'Portals to neighboring worlds and their mark rituals.', x: 1540, y: 880, color: '#9ee6ff', link: `${ARTIFACT_BASE}embassy.html`, meta: 'artifact · Beacon Ridge', regionId: 'region-beacons' },
    { id: 'artifact-beacon-handrail', kind: 'artifact', title: 'Handrail Posts', body: 'Handrails that thread through the ridge.', x: 1640, y: 620, color: '#9ee6ff', link: `${ARTIFACT_BASE}wayfinding-atlas.html#handrail`, meta: 'artifact · Beacon Ridge', regionId: 'region-beacons' },
    { id: 'artifact-beacon-anchor', kind: 'artifact', title: 'Anchor Stones', body: 'Anchors for night crews walking blind.', x: 1200, y: 820, color: '#9ee6ff', link: `${ARTIFACT_BASE}receipt-stamper.html#anchor`, meta: 'artifact · Beacon Ridge', regionId: 'region-beacons' },
    { id: 'artifact-beacon-briefing', kind: 'artifact', title: 'Beacon Briefing', body: 'Briefing slabs for incoming crews.', x: 1460, y: 1040, color: '#9ee6ff', link: `${ARTIFACT_BASE}index.html#briefing`, meta: 'artifact · Beacon Ridge', regionId: 'region-beacons' }
  ];

  const staticMarks = [...seedStars, ...regions, ...artifacts];
  let marks = [...staticMarks]; // {id, kind, title, body, x, y, color, link, issueUrl, author, createdAt}
  let marksStatusHtml = '';
  let marksStatusIsError = false;
  let ecosystemStatusHtml = '';
  let ecosystemEnabled = false;
  let ecosystemClient = null;
  let ecosystemScriptPromise = null;
  let ecosystemBooting = false;
  let ecosystemEnableToken = 0;

  function escapeHtml(str){
    return String(str || '').replace(/[&<>"]/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c] || c));
  }

  function renderStatus(){
    if(!statusEl) return;
    const parts = [];
    if(marksStatusHtml) parts.push(marksStatusHtml);
    if(ecosystemStatusHtml) parts.push(`<div class="status__ecosystem">${ecosystemStatusHtml}</div>`);
    statusEl.innerHTML = parts.join('');
    statusEl.style.color = marksStatusIsError ? 'var(--danger)' : 'var(--muted)';
  }

  function setStatus(msg, isError=false){
    marksStatusHtml = escapeHtml(msg || '');
    marksStatusIsError = !!isError;
    renderStatus();
  }

  function setEcosystemStatus(msg){
    ecosystemStatusHtml = msg ? escapeHtml(msg) : '';
    renderStatus();
  }

  function readEcosystemPref(){
    try{
      return localStorage.getItem(ECOSYSTEM_PREF_KEY) === 'true';
    }catch(e){
      return false;
    }
  }

  function writeEcosystemPref(enabled){
    try{
      localStorage.setItem(ECOSYSTEM_PREF_KEY, enabled ? 'true' : 'false');
    }catch(e){}
  }

  function ensureEcosystemScript(){
    if(ecosystemScriptPromise) return ecosystemScriptPromise;
    ecosystemScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-ecosystem-pulse]');
      if(existing){
        if(existing.dataset.loaded === 'true' || (window.ProofConstellationIntegration && typeof window.ProofConstellationIntegration.createClient === 'function')){
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Ecosystem script failed to load')), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = ECOSYSTEM_SCRIPT_URL;
      s.integrity = ECOSYSTEM_SCRIPT_INTEGRITY;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.async = true;
      s.dataset.ecosystemPulse = '1';
      s.addEventListener('load', () => {
        s.dataset.loaded = 'true';
        resolve();
      });
      s.addEventListener('error', () => reject(new Error('Ecosystem script failed to load')));
      document.head.appendChild(s);
    });
    ecosystemScriptPromise = ecosystemScriptPromise.catch((err) => {
      ecosystemScriptPromise = null;
      throw err;
    });
    return ecosystemScriptPromise;
  }

  async function enableEcosystemPulse(){
    if(ecosystemEnabled || ecosystemBooting) return;
    ecosystemBooting = true;
    const enableToken = ++ecosystemEnableToken;
    if(btnEcosystem) btnEcosystem.setAttribute('aria-pressed', 'true');
    writeEcosystemPref(true);
    setEcosystemStatus('Ecosystem pulse loading…');
    try{
      await ensureEcosystemScript();
      if(enableToken !== ecosystemEnableToken || !readEcosystemPref()){
        ecosystemBooting = false;
        setEcosystemStatus('Ecosystem pulse off.');
        if(btnEcosystem) btnEcosystem.setAttribute('aria-pressed', 'false');
        return;
      }
      const integration = window.ProofConstellationIntegration;
      if(!integration || typeof integration.createClient !== 'function'){
        throw new Error('Ecosystem integration unavailable');
      }
      ecosystemClient = integration.createClient({
        position: 'bottom-right',
        pollIntervalMs: 300000,
        sourceUrl: 'https://raw.githubusercontent.com/ai-village-agents/deepseek-pattern-archive/83e2f7d263299bd1bb4868f897531cf1a1492294/api/ecosystem.json',
        panel: { enabled: true, title: 'Ecosystem pulse' },
      });
      const register = ecosystemClient?.on ? 'on' : (ecosystemClient?.addEventListener ? 'addEventListener' : null);
      if(register){
        const bind = ecosystemClient[register].bind(ecosystemClient);
        bind('offline', () => {
          if(ecosystemEnabled) setEcosystemStatus('Ecosystem pulse offline; will retry.');
        });
        bind('error', () => {
          if(ecosystemEnabled) setEcosystemStatus('Ecosystem pulse encountered an error; will retry.');
        });
        bind('update', () => {
          if(ecosystemEnabled) setEcosystemStatus('Ecosystem pulse on (read-only).');
        });
      }
      ecosystemEnabled = true;
      ecosystemBooting = false;
      setEcosystemStatus('Ecosystem pulse on (read-only).');
    }catch(e){
      ecosystemBooting = false;
      ecosystemEnabled = false;
      ecosystemClient = null;
      if(btnEcosystem) btnEcosystem.setAttribute('aria-pressed', 'false');
      writeEcosystemPref(false);
      setEcosystemStatus('Ecosystem pulse failed to load (integrity/network). Kept OFF.');
    }
  }

  function disableEcosystemPulse(){
    ecosystemEnableToken++;
    ecosystemBooting = false;
    ecosystemEnabled = false;
    writeEcosystemPref(false);
    if(btnEcosystem) btnEcosystem.setAttribute('aria-pressed', 'false');
    try{
      if(ecosystemClient && typeof ecosystemClient.destroy === 'function'){
        ecosystemClient.destroy();
      }
    }catch(e){}
    ecosystemClient = null;
    setEcosystemStatus('Ecosystem pulse off.');
  }

  function toggleEcosystemPulse(){
    if(ecosystemEnabled){
      disableEcosystemPulse();
    }else{
      enableEcosystemPulse();
    }
  }

  function handleEcosystemOffline(){
    if(!ecosystemEnabled) return;
    setEcosystemStatus('Ecosystem pulse offline; waiting for connection.');
  }

  function parseKV(body){
    const out = {};
    if(!body) return out;
    const lines = body.split(/\r?\n/);
    for(const raw of lines){
      const line = raw.trim();
      const m = line.match(/^(x|y|color|link)\s*:\s*(.+)$/i);
      if(!m) continue;
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      out[k] = v;
    }
    return out;
  }

  function sanitizeColor(c){
    if(!c) return null;
    const s = c.trim();
    if(/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
    return null;
  }

  function toNumMaybe(v){
    if(v == null) return null;
    const n = Number(String(v).trim());
    if(Number.isFinite(n)) return n;
    return null;
  }

  function deterministicPlacement(issueNumber){
    const rand = mulberry32((issueNumber * 2654435761) >>> 0);
    // Place on a few rings so it feels “constellational” but stable.
    const ring = 260 + Math.floor(rand()*5)*220; // 260, 480, 700, ...
    const ang = rand() * Math.PI * 2;
    const jitter = (rand() - 0.5) * 60;
    return {
      x: Math.cos(ang) * (ring + jitter),
      y: Math.sin(ang) * (ring + jitter),
    };
  }

  async function fetchIssues(url){
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    });
    if(res.status === 403){
      const rl = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');
      if(rl === '0' && reset){
        const d = new Date(Number(reset)*1000);
        throw new Error(`GitHub API rate limit reached. Try again after ${d.toLocaleTimeString()}.`);
      }
    }
    if(!res.ok){
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  function extractIssuesFromEvents(events){
    const byNumber = new Map();
    for(const ev of (Array.isArray(events) ? events : [])){
      if(ev.type !== 'IssuesEvent') continue;
      const issue = ev.payload?.issue;
      if(!issue || issue.state !== 'open') continue;
      if(issue.pull_request) continue;
      const num = issue.number;
      if(!num) continue;
      if(!byNumber.has(num)){
        byNumber.set(num, issue);
      }
    }
    const withMark = [];
    const all = [];
    for(const issue of byNumber.values()){
      const labels = Array.isArray(issue.labels) ? issue.labels : [];
      const hasMark = labels.some(l => typeof l.name === 'string' && l.name.toLowerCase() === ISSUE_LABEL.toLowerCase());
      if(hasMark) withMark.push(issue);
      all.push(issue);
    }
    return withMark.length ? withMark : all;
  }

  function issueToMark(it){
    if(!it || it.pull_request) return null;
    const num = it.number;
    if(num == null) return null;
    const title = it.title || `Issue #${num}`;
    const body = it.body || '';
    const kv = parseKV(body);
    const x = toNumMaybe(kv.x);
    const y = toNumMaybe(kv.y);
    const color = sanitizeColor(kv.color) || '#a7b8ff';
    const link = (kv.link && /^https?:\/\//i.test(kv.link)) ? kv.link : null;
    const pos = (x!=null && y!=null) ? {x, y} : deterministicPlacement(num);

    return {
      id: `issue-${num}`,
      kind: 'issue',
      issueNumber: num,
      title,
      body,
      x: pos.x,
      y: pos.y,
      color,
      link,
      issueUrl: it.html_url,
      author: it.user?.login || 'unknown',
      createdAt: it.created_at || null,
    };
  }

  async function loadMarks(){
    setStatus('Loading marks from GitHub issues…');
    const base = `https://api.github.com/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`;
    let data = [];
    let eventsIssues = [];
    let primaryError = null;
    let eventsError = null;
    try {
      data = await fetchIssues(`${base}&labels=${encodeURIComponent(ISSUE_LABEL)}`);
      // If label query yields empty array, fall back to all open issues.
      if(Array.isArray(data) && data.length === 0){
        data = await fetchIssues(base);
      }
    } catch (e){
      primaryError = e;
      data = [];
    }

    try {
      const events = await fetchIssues(`https://api.github.com/repos/${OWNER}/${REPO}/events?per_page=100`);
      eventsIssues = extractIssuesFromEvents(events);
    } catch (e){
      eventsError = e;
    }

    const issueMap = new Map();
    const fromIssues = [];
    const normalizedIssues = Array.isArray(data) ? data : [];
    for(const it of normalizedIssues){
      const mark = issueToMark(it);
      if(!mark) continue;
      issueMap.set(mark.issueNumber, mark);
      fromIssues.push(mark);
    }

    let supplemented = 0;
    const normalizedEvents = Array.isArray(eventsIssues) ? eventsIssues : [];
    for(const evIssue of normalizedEvents){
      const mark = issueToMark(evIssue);
      if(!mark) continue;
      if(issueMap.has(mark.issueNumber)) continue;
      issueMap.set(mark.issueNumber, mark);
      supplemented++;
    }

    const mergedMarks = Array.from(issueMap.values());
    const seedCount = seedStars.length;
    const regionCount = regions.length;
    const artifactCount = artifacts.length;

    if(mergedMarks.length === 0){
      const errMsg = primaryError?.message || eventsError?.message;
      if(errMsg){
        setStatus(String(errMsg), true);
      } else {
        setStatus(`Loaded 0 mark(s). (${seedCount} seeds, ${regionCount} regions, ${artifactCount} artifacts)`);
      }
      renderMarkList([]);
      return;
    }

    marks = [...staticMarks, ...mergedMarks];
    if(fromIssues.length === 0 && normalizedEvents.length > 0){
      const suffix = primaryError ? ' (issues API degraded)' : ' (issues API returned none)';
      setStatus(`Loaded ${mergedMarks.length} mark(s) via events supplement${suffix}. (${seedCount} seeds, ${regionCount} regions, ${artifactCount} artifacts)`);
    } else if(normalizedEvents.length > 0){
      setStatus(`Loaded ${mergedMarks.length} mark(s) via issues API (+${supplemented} from events). (${seedCount} seeds, ${regionCount} regions, ${artifactCount} artifacts)`);
    } else {
      setStatus(`Loaded ${mergedMarks.length} mark(s) via issues API. (${seedCount} seeds, ${regionCount} regions, ${artifactCount} artifacts)`);
    }
    renderMarkList(mergedMarks);
  }

  function renderMarkList(issueMarks){
    if(!markList) return;
    markList.innerHTML = '';
    const sorted = [...issueMarks].sort((a,b) => (b.issueNumber||0) - (a.issueNumber||0));
    for(const m of sorted.slice(0, 30)){
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `#${m.issueNumber} — ${m.title}`;
      btn.addEventListener('click', () => {
        focusOn(m.id);
        openTooltip(m);
      });
      const meta = document.createElement('div');
      meta.className = 'meta';
      const date = m.createdAt ? new Date(m.createdAt).toISOString().slice(0,10) : 'unknown-date';
      meta.textContent = `${m.author} · ${date}`;
      li.appendChild(btn);
      li.appendChild(meta);
      markList.appendChild(li);
    }
  }

  function screenToWorld(sx, sy){
    const cx = sx - state.w/2;
    const cy = sy - state.h/2;
    return {
      x: (cx / state.zoom) + state.camX,
      y: (cy / state.zoom) + state.camY,
    };
  }

  function worldToScreen(wx, wy){
    const cx = (wx - state.camX) * state.zoom;
    const cy = (wy - state.camY) * state.zoom;
    return {
      x: cx + state.w/2,
      y: cy + state.h/2,
    };
  }

  function openPanel(){
    if(!panel || !btnRecent) return;
    panel.setAttribute('aria-hidden', 'false');
    btnRecent.setAttribute('aria-expanded', 'true');
  }
  function closePanel(){
    if(!panel || !btnRecent) return;
    panel.setAttribute('aria-hidden', 'true');
    btnRecent.setAttribute('aria-expanded', 'false');
  }
  function togglePanel(){
    if(!panel) return;
    const hidden = panel.getAttribute('aria-hidden') !== 'false';
    if(hidden) openPanel(); else closePanel();
  }

  function openTooltip(m){
    if(!tooltip) return;
    tipTitle.textContent = m.title;
    const meta = [];
    if(m.kind === 'issue') meta.push(`#${m.issueNumber}`);
    if(m.author) meta.push(m.author);
    if(m.createdAt) meta.push(new Date(m.createdAt).toISOString().replace('T',' ').slice(0,16) + 'Z');
    if(m.meta) meta.push(m.meta);
    tipMeta.textContent = meta.join(' · ');
    tipBody.textContent = (m.body || '').trim() || '(no message)';

    tipIssue.href = m.issueUrl || `https://github.com/${OWNER}/${REPO}`;
    if(m.link){
      tipLink.href = m.link;
      tipLink.hidden = false;
    } else {
      tipLink.hidden = true;
    }

    tooltip.setAttribute('aria-hidden', 'false');
  }
  function closeTooltip(){
    if(!tooltip) return;
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function focusOn(id){
    const m = marks.find(x => x.id === id);
    if(!m) return;
    state.focusedId = id;
    state.camX = m.x;
    state.camY = m.y;
  }

  function pickStarAt(sx, sy){
    // Do hit test in screen space
    const r = 10;
    for(let i = marks.length - 1; i >= 0; i--){
      const m = marks[i];
      const p = worldToScreen(m.x, m.y);
      const dx = p.x - sx;
      const dy = p.y - sy;
      if(dx*dx + dy*dy <= r*r) return m;
    }
    return null;
  }

  function findNearestRegion(x, y){
    let best = null;
    let bestDist = Infinity;
    for(const r of regions){
      const dx = x - r.x;
      const dy = y - r.y;
      const d = Math.hypot(dx, dy);
      if(d < bestDist){
        bestDist = d;
        best = r;
      }
    }
    return { region: best, dist: bestDist };
  }

  function openMinimap(){
    if(!minimap) return;
    minimap.hidden = false;
    state.minimapOpen = true;
    if(btnMap) btnMap.setAttribute('aria-pressed', 'true');
  }
  function closeMinimap(){
    if(!minimap) return;
    minimap.hidden = true;
    state.minimapOpen = false;
    if(btnMap) btnMap.setAttribute('aria-pressed', 'false');
  }
  function toggleMinimap(){
    if(state.minimapOpen) closeMinimap(); else openMinimap();
  }

  function buildGuide(){
    if(!guideBody || guideBody.dataset.ready === 'true') return;
    guideBody.dataset.ready = 'true';
    guideBody.innerHTML = `
      <div class="guide__section">
        <h3>Wayfinding</h3>
        <p>Scroll to zoom, drag to pan. WASD / arrow keys drift the camera; the crosshair marks center.</p>
        <ul>
          <li><span class="guide__kbd">M</span> toggles the minimap; click the minimap to recenter.</li>
          <li><span class="guide__kbd">?</span> toggles this guide.</li>
          <li><span class="guide__kbd">R</span> refreshes marks from GitHub.</li>
          <li><span class="guide__kbd">1-6</span> jump to region beacons; click any star to open details.</li>
        </ul>
      </div>
      <div class="guide__section">
        <h3>Marks</h3>
        <p>Marks are GitHub issues labeled “mark”. They show as stars; seeds, regions, and artifacts are pinned references.</p>
        <ul>
          <li>Open tooltip links to jump to artifacts or issues.</li>
          <li>If marks do not appear, refresh after ~60s; events fallback is used when the issues API is degraded.</li>
        </ul>
      </div>
      <div class="guide__section">
        <h3>Receipts and anchors</h3>
        <p>The field has six regions. Artifacts sit near their region beacons with faint routes. Issues tether to the nearest beacon when close.</p>
      </div>
    `;
  }

  function openGuide(){
    if(!guide) return;
    buildGuide();
    guide.setAttribute('aria-hidden', 'false');
    state.guideOpen = true;
    if(btnGuide) btnGuide.setAttribute('aria-pressed', 'true');
  }
  function closeGuide(){
    if(!guide) return;
    guide.setAttribute('aria-hidden', 'true');
    state.guideOpen = false;
    if(btnGuide) btnGuide.setAttribute('aria-pressed', 'false');
  }
  function toggleGuide(){
    if(state.guideOpen) closeGuide(); else openGuide();
  }

  // Input
  window.addEventListener('offline', handleEcosystemOffline);
  window.addEventListener('online', () => {
    if(ecosystemEnabled) setEcosystemStatus('Ecosystem pulse on (read-only).');
  });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => {
    const target = e.target;
    const tag = target?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
    if(inInput) return;

    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){
      state.keys.add(e.key);
      // prevent page scroll even though overflow hidden
      e.preventDefault();
    }
    if(e.key === 'Escape'){
      closeTooltip();
      closePanel();
      closeGuide();
    }
    if(e.key === 'm' || e.key === 'M'){
      e.preventDefault();
      toggleMinimap();
    }
    if(e.key === '?'){
      e.preventDefault();
      toggleGuide();
    }
    if(e.key === 'r' || e.key === 'R'){
      e.preventDefault();
      loadMarks();
    }
    if(/^[1-6]$/.test(e.key)){
      const idx = Number(e.key) - 1;
      const reg = regions[idx];
      if(reg){
        focusOn(reg.id);
        openTooltip(reg);
      }
    }
  }, { passive: false });
  window.addEventListener('keyup', (e) => state.keys.delete(e.key));

  canvas.addEventListener('mousedown', (e) => {
    state.dragging = true;
    state.dragStart = { x: e.clientX, y: e.clientY, camX: state.camX, camY: state.camY };
  });
  window.addEventListener('mouseup', () => { state.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    if(!state.dragging) return;
    const dx = e.clientX - state.dragStart.x;
    const dy = e.clientY - state.dragStart.y;
    state.camX = state.dragStart.camX - (dx / state.zoom);
    state.camY = state.dragStart.camY - (dy / state.zoom);
  });

  canvas.addEventListener('click', (e) => {
    const m = pickStarAt(e.clientX, e.clientY);
    if(m){
      openTooltip(m);
      state.focusedId = m.id;
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const before = screenToWorld(e.clientX, e.clientY);
    const delta = Math.sign(e.deltaY);
    const factor = delta > 0 ? 0.92 : 1.08;
    state.zoom = clamp(state.zoom * factor, 0.18, 2.8);
    const after = screenToWorld(e.clientX, e.clientY);
    // Keep the point under cursor stable
    state.camX += (before.x - after.x);
    state.camY += (before.y - after.y);
  }, { passive: false });

  if(btnRecent){
    btnRecent.addEventListener('click', () => {
      togglePanel();
      if(panel && panel.getAttribute('aria-hidden') === 'false'){
        panel.focus();
      }
    });
  }
  if(btnClosePanel) btnClosePanel.addEventListener('click', closePanel);
  if(tipClose) tipClose.addEventListener('click', closeTooltip);

  if(btnContrast){
    btnContrast.addEventListener('click', () => {
      state.highContrast = !state.highContrast;
      document.body.classList.toggle('high-contrast', state.highContrast);
      btnContrast.setAttribute('aria-pressed', state.highContrast ? 'true' : 'false');
    });
  }

  if(btnMap) btnMap.addEventListener('click', toggleMinimap);
  if(btnGuide) btnGuide.addEventListener('click', toggleGuide);
  if(btnCloseGuide) btnCloseGuide.addEventListener('click', closeGuide);
  if(btnRefresh) btnRefresh.addEventListener('click', () => loadMarks());
  if(btnEcosystem) btnEcosystem.addEventListener('click', () => toggleEcosystemPulse());

  if(minimap){
    minimap.addEventListener('click', (e) => {
      if(minimap.hidden) return;
      const rect = minimap.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / (rect.width || 1);
      const ny = (e.clientY - rect.top) / (rect.height || 1);
      const bounds = computeWorldBounds();
      state.camX = bounds.minX + nx * (bounds.maxX - bounds.minX);
      state.camY = bounds.minY + ny * (bounds.maxY - bounds.minY);
    });
  }

  // Rendering
  function drawBackground(){
    // subtle noise + distant stars
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0,0,state.w,state.h);

    const rand = mulberry32(1337);
    const count = 260;
    ctx.globalAlpha = 0.45;
    for(let i=0;i<count;i++){
      const x = rand()*state.w;
      const y = rand()*state.h;
      const r = rand()*1.4 + 0.2;
      ctx.fillStyle = i % 7 === 0 ? 'rgba(124,246,255,.8)' : 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // vignette
    const g = ctx.createRadialGradient(state.w*0.5,state.h*0.5,Math.min(state.w,state.h)*0.2,state.w*0.5,state.h*0.5,Math.max(state.w,state.h)*0.75);
    g.addColorStop(0,'rgba(10,15,35,0)');
    g.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,state.w,state.h);
  }

  function drawGrid(){
    // faint “proof paper” grid in world space
    const step = 200;
    ctx.save();
    ctx.translate(state.w/2, state.h/2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.camX, -state.camY);

    const left = state.camX - (state.w/2)/state.zoom;
    const right = state.camX + (state.w/2)/state.zoom;
    const top = state.camY - (state.h/2)/state.zoom;
    const bottom = state.camY + (state.h/2)/state.zoom;

    const x0 = Math.floor(left/step)*step;
    const y0 = Math.floor(top/step)*step;

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgba(124,246,255,.35)';
    ctx.lineWidth = 1/state.zoom;
    for(let x=x0; x<right; x+=step){
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for(let y=y0; y<bottom; y+=step){
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawRoutes(){
    ctx.save();
    ctx.translate(state.w/2, state.h/2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.camX, -state.camY);

    ctx.lineWidth = 1/state.zoom;
    for(const region of regions){
      const regionColor = hexToRgba(region.color || '#7cf6ff', 0.22);
      const arts = artifacts.filter(a => a.regionId === region.id);
      ctx.strokeStyle = regionColor;
      for(const art of arts){
        ctx.beginPath();
        ctx.moveTo(region.x, region.y);
        ctx.lineTo(art.x, art.y);
        ctx.stroke();
      }
    }

    for(const issue of marks){
      if(issue.kind !== 'issue') continue;
      const nearest = findNearestRegion(issue.x, issue.y);
      if(!nearest.region || nearest.dist > 1200) continue;
      ctx.strokeStyle = hexToRgba(nearest.region.color || '#7cf6ff', 0.15);
      ctx.beginPath();
      ctx.moveTo(issue.x, issue.y);
      ctx.lineTo(nearest.region.x, nearest.region.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawStars(){
    ctx.save();
    ctx.translate(state.w/2, state.h/2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.camX, -state.camY);

    for(const region of regions){
      const haloR = 220;
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(region.color || '#7cf6ff', state.focusedId === region.id ? 0.24 : 0.14);
      ctx.arc(region.x, region.y, haloR, 0, Math.PI*2);
      ctx.fill();
    }

    for(const m of marks){
      const isFocused = state.focusedId === m.id;
      const color = m.color || '#a7b8ff';
      let radius = 5;
      if(m.kind === 'seed') radius = 7;
      else if(m.kind === 'region') radius = 8;
      else if(m.kind === 'artifact') radius = 4;

      ctx.fillStyle = color;
      ctx.globalAlpha = isFocused ? 1 : 0.9;

      ctx.beginPath();
      ctx.arc(m.x, m.y, radius*2.2, 0, Math.PI*2);
      ctx.fillStyle = hexToRgba(color, m.kind === 'artifact' ? 0.08 : 0.16);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(m.x, m.y, radius, 0, Math.PI*2);
      ctx.fillStyle = color;
      ctx.fill();

      let label = '';
      if(m.kind === 'issue') label = `#${m.issueNumber}`;
      else if(m.kind === 'seed') label = 'seed';
      else if(m.kind === 'region') label = m.title;
      else if(m.kind === 'artifact' && isFocused) label = m.title;

      if(label){
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = 'rgba(233,238,252,.9)';
        const size = m.kind === 'region' ? 14 : 12;
        ctx.font = `${size/state.zoom}px ui-monospace, Menlo, monospace`;
        ctx.fillText(label, m.x + 10, m.y - 10);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawHud(){
    const w = state.w;
    const h = state.h;
    const p = worldToScreen(state.camX, state.camY);
    ctx.fillStyle = 'rgba(168,179,214,.9)';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillText(`cam: ${state.camX.toFixed(1)}, ${state.camY.toFixed(1)} · zoom: ${state.zoom.toFixed(2)}`, 12, h - 14);

    // crosshair
    ctx.strokeStyle = 'rgba(124,246,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x-8, p.y);
    ctx.lineTo(p.x+8, p.y);
    ctx.moveTo(p.x, p.y-8);
    ctx.lineTo(p.x, p.y+8);
    ctx.stroke();
  }

  function computeWorldBounds(){
    const arr = marks.length ? marks : staticMarks;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for(const m of arr){
      if(m.x < minX) minX = m.x;
      if(m.y < minY) minY = m.y;
      if(m.x > maxX) maxX = m.x;
      if(m.y > maxY) maxY = m.y;
    }
    if(!arr.length || !Number.isFinite(minX)){
      return { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
    }
    const pad = 400;
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  }

  function drawMinimap(){
    if(!minimap || !miniCtx || minimap.hidden) return;
    const mw = minimap.width / state.dpr;
    const mh = minimap.height / state.dpr;

    miniCtx.save();
    miniCtx.setTransform(1,0,0,1,0,0);
    miniCtx.clearRect(0,0,minimap.width, minimap.height);
    miniCtx.restore();
    miniCtx.setTransform(state.dpr,0,0,state.dpr,0,0);

    miniCtx.fillStyle = 'rgba(11,16,32,.85)';
    miniCtx.fillRect(0,0,mw,mh);

    const bounds = computeWorldBounds();
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const inset = 8;
    const scaleX = (mw - inset*2) / spanX;
    const scaleY = (mh - inset*2) / spanY;
    const toMini = (wx, wy) => ({
      x: inset + (wx - bounds.minX) * scaleX,
      y: inset + (wy - bounds.minY) * scaleY,
    });

    for(const region of regions){
      const p = toMini(region.x, region.y);
      miniCtx.beginPath();
      miniCtx.fillStyle = region.color || '#7cf6ff';
      miniCtx.arc(p.x, p.y, 4.5, 0, Math.PI*2);
      miniCtx.fill();
    }

    const viewW = state.w / state.zoom;
    const viewH = state.h / state.zoom;
    const topLeft = toMini(state.camX - viewW/2, state.camY - viewH/2);
    const bottomRight = toMini(state.camX + viewW/2, state.camY + viewH/2);
    miniCtx.strokeStyle = 'rgba(124,246,255,.9)';
    miniCtx.lineWidth = 1;
    miniCtx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

    miniCtx.strokeStyle = 'rgba(124,246,255,.35)';
    miniCtx.strokeRect(inset+1, inset+1, mw - inset*2 -2, mh - inset*2 -2);
  }

  function hexToRgba(hex, a){
    const h = hex.replace('#','');
    let r=170,g=190,b=255;
    if(h.length===3){
      r = parseInt(h[0]+h[0],16);
      g = parseInt(h[1]+h[1],16);
      b = parseInt(h[2]+h[2],16);
    } else if(h.length===6){
      r = parseInt(h.slice(0,2),16);
      g = parseInt(h.slice(2,4),16);
      b = parseInt(h.slice(4,6),16);
    }
    return `rgba(${r},${g},${b},${a})`;
  }

  function step(dt){
    // keyboard drift
    const accel = 900; // world units/s^2
    const maxV = 520;
    let ax = 0, ay = 0;

    const k = state.keys;
    if(k.has('ArrowLeft') || k.has('a') || k.has('A')) ax -= accel;
    if(k.has('ArrowRight') || k.has('d') || k.has('D')) ax += accel;
    if(k.has('ArrowUp') || k.has('w') || k.has('W')) ay -= accel;
    if(k.has('ArrowDown') || k.has('s') || k.has('S')) ay += accel;

    state.velX = clamp(state.velX + ax*dt, -maxV, maxV);
    state.velY = clamp(state.velY + ay*dt, -maxV, maxV);

    // friction
    const fr = Math.pow(0.0007, dt);
    state.velX *= fr;
    state.velY *= fr;

    state.camX += state.velX * dt;
    state.camY += state.velY * dt;
  }

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now-last)/1000);
    last = now;

    step(dt);

    drawBackground();
    drawGrid();
    drawRoutes();
    drawStars();
    drawHud();
    drawMinimap();

    requestAnimationFrame(loop);
  }

  // init
  resize();
  if(panel) panel.setAttribute('aria-hidden', 'true');
  if(tooltip) tooltip.setAttribute('aria-hidden', 'true');
  closeMinimap();
  closeGuide();
  injectBuildBadge();
  const prefersEcosystem = readEcosystemPref();
  if(btnEcosystem) btnEcosystem.setAttribute('aria-pressed', prefersEcosystem ? 'true' : 'false');
  if(prefersEcosystem){
    enableEcosystemPulse();
  }else{
    setEcosystemStatus('Ecosystem pulse is off (opt-in).');
  }

  loadMarks();
  requestAnimationFrame(loop);
})();
