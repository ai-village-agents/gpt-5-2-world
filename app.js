/* Proof Constellation — GPT-5.2 */
(() => {
  const OWNER = 'ai-village-agents';
  const REPO = 'gpt-5-2-world';
  const ISSUE_LABEL = 'mark';

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d', { alpha: true });

  const panel = document.getElementById('panel');
  const btnRecent = document.getElementById('btnRecent');
  const btnClosePanel = document.getElementById('btnClosePanel');
  const statusEl = document.getElementById('status');
  const markList = document.getElementById('markList');

  const btnContrast = document.getElementById('btnContrast');
  const repoLink = document.getElementById('repoLink');
  const newIssueLink = document.getElementById('newIssueLink');

  const tooltip = document.getElementById('tooltip');
  const tipTitle = document.getElementById('tipTitle');
  const tipMeta = document.getElementById('tipMeta');
  const tipBody = document.getElementById('tipBody');
  const tipLink = document.getElementById('tipLink');
  const tipIssue = document.getElementById('tipIssue');
  const tipClose = document.getElementById('tipClose');

  repoLink.href = `https://github.com/${OWNER}/${REPO}`;
  // For issue forms, template=mark.yml opens the form. If that ever fails, users can still pick it from the UI.
  newIssueLink.href = `https://github.com/${OWNER}/${REPO}/issues/new?template=mark.yml`;

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

  let marks = []; // {id, kind, title, body, x, y, color, link, issueUrl, author, createdAt}

  function setStatus(msg, isError=false){
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'var(--danger)' : 'var(--muted)';
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

  async function loadMarks(){
    setStatus('Loading marks from GitHub issues…');
    const base = `https://api.github.com/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`;
    let data = [];
    let usedEventsFallback = false;
    let primaryError = null;
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

    if(!Array.isArray(data) || data.length === 0){
      usedEventsFallback = true;
      try {
        const events = await fetchIssues(`https://api.github.com/repos/${OWNER}/${REPO}/events?per_page=100`);
        data = extractIssuesFromEvents(events);
      } catch (e){
        setStatus(String(e?.message || primaryError || e), true);
        return;
      }
    }
    if(!Array.isArray(data)){
      setStatus(String(primaryError?.message || 'Unable to load marks'), true);
      return;
    }

    const fromIssues = [];
    for(const it of (Array.isArray(data) ? data : [])){
      if(it.pull_request) continue;
      const num = it.number;
      const title = it.title || `Issue #${num}`;
      const body = it.body || '';
      const kv = parseKV(body);
      const x = toNumMaybe(kv.x);
      const y = toNumMaybe(kv.y);
      const color = sanitizeColor(kv.color) || '#a7b8ff';
      const link = (kv.link && /^https?:\/\//i.test(kv.link)) ? kv.link : null;
      const pos = (x!=null && y!=null) ? {x, y} : deterministicPlacement(num);

      fromIssues.push({
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
      });
    }

    marks = [...seedStars, ...fromIssues];
    if(usedEventsFallback){
      setStatus(`Loaded ${fromIssues.length} mark(s) via GitHub events (issues API degraded). (${seedStars.length} seeds)`);
    } else {
      setStatus(`Loaded ${fromIssues.length} mark(s) from GitHub. (${seedStars.length} seeds)`);
    }
    renderMarkList(fromIssues);
  }

  function renderMarkList(issueMarks){
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
    panel.setAttribute('aria-hidden', 'false');
    btnRecent.setAttribute('aria-expanded', 'true');
  }
  function closePanel(){
    panel.setAttribute('aria-hidden', 'true');
    btnRecent.setAttribute('aria-expanded', 'false');
  }
  function togglePanel(){
    const hidden = panel.getAttribute('aria-hidden') !== 'false';
    if(hidden) openPanel(); else closePanel();
  }

  function openTooltip(m){
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
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function focusOn(id){
    const m = marks.find(x => x.id === id);
    if(!m) return;
    state.focusedId = id;
    // Ease camera towards target
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

  // Input
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => {
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){
      state.keys.add(e.key);
      // prevent page scroll even though overflow hidden
      e.preventDefault();
    }
    if(e.key === 'Escape'){
      closeTooltip();
      closePanel();
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

  btnRecent.addEventListener('click', () => {
    togglePanel();
    if(panel.getAttribute('aria-hidden') === 'false'){
      panel.focus();
    }
  });
  btnClosePanel.addEventListener('click', closePanel);
  tipClose.addEventListener('click', closeTooltip);

  btnContrast.addEventListener('click', () => {
    state.highContrast = !state.highContrast;
    document.body.classList.toggle('high-contrast', state.highContrast);
    btnContrast.setAttribute('aria-pressed', state.highContrast ? 'true' : 'false');
  });

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

  function drawStars(){
    ctx.save();
    ctx.translate(state.w/2, state.h/2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.camX, -state.camY);

    for(const m of marks){
      const radius = (m.kind === 'seed') ? 7 : 5;
      ctx.fillStyle = m.color || '#a7b8ff';
      ctx.globalAlpha = (state.focusedId === m.id) ? 1 : 0.9;

      // glow
      ctx.beginPath();
      ctx.arc(m.x, m.y, radius*2.6, 0, Math.PI*2);
      ctx.fillStyle = hexToRgba(m.color || '#a7b8ff', 0.14);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(m.x, m.y, radius, 0, Math.PI*2);
      ctx.fillStyle = m.color || '#a7b8ff';
      ctx.fill();

      // label
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = 'rgba(233,238,252,.9)';
      ctx.font = `${12/state.zoom}px ui-monospace, Menlo, monospace`;
      const label = (m.kind === 'issue') ? `#${m.issueNumber}` : 'seed';
      ctx.fillText(label, m.x + 10, m.y - 10);
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
    drawStars();
    drawHud();

    requestAnimationFrame(loop);
  }

  // init
  resize();
  // Ensure panel is hidden by default for screen readers
  panel.setAttribute('aria-hidden', 'true');
  tooltip.setAttribute('aria-hidden', 'true');

  loadMarks();
  requestAnimationFrame(loop);
})();
