const OWNER = 'ai-village-agents';
const REPO = 'gpt-5-2-world';
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}`;

const seeds = [
  {
    id: 'seed-449',
    label: 'Deploy 449 marker',
    body: 'Deployment #449 receipt locked in. Proof held steady.',
    x: 220,
    y: -140,
    color: '#7df5ff',
    type: 'seed',
  },
  {
    id: 'seed-l20',
    label: 'L20 trace fields mismatch',
    body: 'Trace field mismatch surfaced and reconciled.',
    x: -260,
    y: 190,
    color: '#ffcf7a',
    type: 'seed',
  },
  {
    id: 'seed-receipt',
    label: 'Receipt zeroed',
    body: 'Baseline marker for zero-knowledge receipts.',
    x: 40,
    y: 40,
    color: '#9aff7d',
    type: 'seed',
  },
];

const ambientStars = buildAmbientStars(320);
let stars = [...seeds];
let issueStars = [];
let selectedStar = null;

let canvas;
let ctx;
let width = 0;
let height = 0;
let deviceScale = 1;
const camera = { x: 0, y: 0, zoom: 1 };
const pressedKeys = new Set();
let dragging = false;
let dragStart = null;
let cameraAtDragStart = null;
let movedDuringDrag = false;

let statusEl;
let detailsEl;
let detailsTitle;
let detailsType;
let detailsMeta;
let detailsBody;
let detailsLink;

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('space');
  ctx = canvas.getContext('2d');
  deviceScale = window.devicePixelRatio || 1;

  statusEl = document.getElementById('status');
  detailsEl = document.getElementById('details');
  detailsTitle = document.getElementById('detailsTitle');
  detailsType = document.getElementById('detailsType');
  detailsMeta = document.getElementById('detailsMeta');
  detailsBody = document.getElementById('detailsBody');
  detailsLink = document.getElementById('detailsLink');

  attachUI();
  resize();
  loadIssues();
  requestAnimationFrame(loop);
});

function attachUI() {
  const markButton = document.getElementById('markButton');
  const contrastToggle = document.getElementById('contrastToggle');
  const recentButton = document.getElementById('recentButton');
  const recentPanel = document.getElementById('recentPanel');
  const detailsClose = document.getElementById('detailsClose');

  markButton.href = buildMarkLink();
  markButton.addEventListener('click', () => {
    statusMessage('Opening GitHub to record your mark...');
  });

  contrastToggle.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('high-contrast');
    contrastToggle.setAttribute('aria-pressed', enabled.toString());
  });

  recentButton.addEventListener('click', () => {
    recentPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    recentPanel.classList.add('flash');
    setTimeout(() => recentPanel.classList.remove('flash'), 600);
  });

  detailsClose.addEventListener('click', closeDetails);

  window.addEventListener('resize', resize);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onCanvasClick);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.focus();

  statusMessage('Loading marks and listening for receipts...');
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * deviceScale;
  canvas.height = height * deviceScale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

async function loadIssues() {
  try {
    let res = await fetchIssues(true);
    if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
      res = await fetchIssues(false);
    }
    if (res.status === 403 && res.remaining === 0) {
      statusMessage('Rate limited by GitHub API. Showing cached seeds only.');
      issueStars = [];
      stars = [...seeds];
      renderList();
      return;
    }
    const data = Array.isArray(res.data) ? res.data : [];
    issueStars = data.map(buildStarFromIssue);
    stars = [...seeds, ...issueStars];
    renderList();
    statusMessage(`Loaded ${issueStars.length} marks. Scroll and click to inspect.`);
  } catch (err) {
    console.error(err);
    statusMessage('Could not load marks from GitHub. Seeds remain available.');
    stars = [...seeds];
    issueStars = [];
    renderList();
  }
}

async function fetchIssues(withLabel) {
  const url = withLabel
    ? `${API_URL}/issues?state=open&per_page=100&labels=mark`
    : `${API_URL}/issues?state=open&per_page=100`;
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  const remaining = Number(response.headers.get('x-ratelimit-remaining'));
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  const json = await response.json();
  if (!response.ok) {
    const reason = response.status === 403 && remaining === 0
      ? 'GitHub API rate limit reached. Try again soon.'
      : (json && json.message) || `Request failed: ${response.status}`;
    statusMessage(reason);
  }
  return { ok: response.ok, data: json, status: response.status, remaining, reset };
}

function buildStarFromIssue(issue) {
  const meta = parseMeta(issue.body || '');
  const coords = meta.coordinates || ringPosition(issue.number);
  const color = meta.color || '#69e0ff';
  const body = (meta.body || issue.body || '').trim();
  return {
    id: issue.id,
    issueNumber: issue.number,
    label: issue.title || 'Mark',
    body,
    x: coords.x,
    y: coords.y,
    color,
    url: issue.html_url,
    author: issue.user?.login || 'anonymous',
    createdAt: issue.created_at,
    link: meta.link,
    type: 'issue',
  };
}

function parseMeta(body) {
  const meta = {};
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    if (/^###\s*coordinate/i.test(line)) {
      const val = (lines[i + 1] || '').trim();
      const match = val.match(/([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/);
      if (match) {
        meta.x = parseFloat(match[1]);
        meta.y = parseFloat(match[2]);
      }
      continue;
    }

    if (/^###\s*x\s*$/i.test(line)) {
      const val = (lines[i + 1] || '').trim();
      const num = parseFloat(val.replace(/[^\d.+-]/g, ''));
      if (!Number.isNaN(num)) meta.x = num;
      continue;
    }
    if (/^###\s*y\s*$/i.test(line)) {
      const val = (lines[i + 1] || '').trim();
      const num = parseFloat(val.replace(/[^\d.+-]/g, ''));
      if (!Number.isNaN(num)) meta.y = num;
      continue;
    }
    if (/^###\s*color\s*$/i.test(line)) {
      const val = (lines[i + 1] || '').trim();
      const match = val.match(/#[0-9a-fA-F]{3,8}/);
      if (match) meta.color = match[0];
      continue;
    }
    if (/^###\s*link\s*$/i.test(line)) {
      const val = (lines[i + 1] || '').trim();
      const match = val.match(/https?:\/\/\S+/i);
      if (match) meta.link = match[0];
      continue;
    }
    if (/^###\s*message\s*$/i.test(line)) {
      let collected = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^###\s+/.test(lines[j])) break;
        collected.push(lines[j]);
      }
      meta.body = collected.join('\n').trim();
      continue;
    }

    if (!line.includes(':')) continue;
    const [keyPart, ...rest] = line.split(':');
    const key = keyPart.toLowerCase().trim();
    const value = rest.join(':').trim();
    if (key === 'x') {
      const num = parseFloat(value.replace(/[^\d.+-]/g, ''));
      if (!Number.isNaN(num)) meta.x = num;
    } else if (key === 'y') {
      const num = parseFloat(value.replace(/[^\d.+-]/g, ''));
      if (!Number.isNaN(num)) meta.y = num;
    } else if (key === 'color') {
      const match = value.match(/#[0-9a-fA-F]{3,8}/);
      if (match) meta.color = match[0];
    } else if (key === 'link') {
      const match = value.match(/https?:\/\/\S+/i);
      if (match) meta.link = match[0];
    } else if (key === 'message' || key === 'body') {
      meta.body = value;
    }
  }

  const coordLine = body.match(/coordinate[^:]*:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/i);
  if (coordLine && (meta.x === undefined || meta.y === undefined)) {
    meta.x = Number(coordLine[1]);
    meta.y = Number(coordLine[2]);
  }

  if (meta.x === undefined) {
    const xMatch = body.match(/^\s*\*?x\*?\s*[=:]?\s*([+-]?\d+(?:\.\d+)?)/im);
    if (xMatch) meta.x = Number(xMatch[1]);
  }
  if (meta.y === undefined) {
    const yMatch = body.match(/^\s*\*?y\*?\s*[=:]?\s*([+-]?\d+(?:\.\d+)?)/im);
    if (yMatch) meta.y = Number(yMatch[1]);
  }

  if (meta.x !== undefined && meta.y !== undefined) {
    meta.coordinates = { x: meta.x, y: meta.y };
  }

  return meta;
}

function ringPosition(num) {
  const radius = 420 + pseudoRandom(num * 5 + 3) * 2200;
  const theta = pseudoRandom(num * 11 + 7) * Math.PI * 2;
  return { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
}

function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898 + 78.233)) % 1;
}

function renderList() {
  const list = document.getElementById('marksList');
  list.innerHTML = '';

  const sorted = issueStars
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (sorted.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No guest marks yet. Be the first to anchor a receipt.';
    list.appendChild(li);
  }

  sorted.forEach((star) => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    const title = document.createElement('p');
    title.className = 'mark-title';
    title.textContent = star.label;
    const meta = document.createElement('p');
    meta.className = 'mark-meta';
    const date = star.createdAt ? new Date(star.createdAt).toLocaleString() : 'Unknown date';
    meta.textContent = `${star.author} - ${date}`;
    li.appendChild(title);
    li.appendChild(meta);
    li.addEventListener('click', () => focusStar(star));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focusStar(star);
      }
    });
    list.appendChild(li);
  });

  if (seeds.length) {
    const divider = document.createElement('li');
    divider.className = 'mark-meta';
    divider.textContent = 'Seed markers';
    list.appendChild(divider);

    seeds.forEach((star) => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      const title = document.createElement('p');
      title.className = 'mark-title mark-seed';
      title.textContent = star.label;
      const meta = document.createElement('p');
      meta.className = 'mark-meta';
      meta.textContent = star.body;
      li.appendChild(title);
      li.appendChild(meta);
      li.addEventListener('click', () => focusStar(star));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focusStar(star);
        }
      });
      list.appendChild(li);
    });
  }
}

function focusStar(star) {
  camera.x = star.x;
  camera.y = star.y;
  selectedStar = star;
  openDetails(star);
  const label = star.label || 'Star';
  const coord = `(${Math.round(star.x)}, ${Math.round(star.y)})`;
  const suffix = star.issueNumber ? `Issue #${star.issueNumber}` : 'Seed marker';
  statusMessage(`${label} - ${suffix} at ${coord}.`);
}

function openDetails(star) {
  detailsEl.hidden = false;
  detailsTitle.textContent = star.label || 'Mark';
  const coord = `(${Math.round(star.x)}, ${Math.round(star.y)})`;
  const kind = star.type === 'seed' ? 'Seed marker' : `Issue #${star.issueNumber || '?'}`;
  detailsType.textContent = kind;
  const when = star.createdAt ? new Date(star.createdAt).toLocaleString() : 'Unknown time';
  detailsMeta.textContent = `${coord}${star.author ? ` | ${star.author}` : ''} | ${when}`;
  detailsBody.textContent = star.body || 'No description provided.';
  if (star.link) {
    detailsLink.textContent = 'Open linked proof';
    detailsLink.href = star.link;
    detailsLink.hidden = false;
  } else if (star.url) {
    detailsLink.textContent = 'Open GitHub issue';
    detailsLink.href = star.url;
    detailsLink.hidden = false;
  } else {
    detailsLink.hidden = true;
  }
}

function closeDetails() {
  detailsEl.hidden = true;
}

function buildMarkLink() {
  const base = `https://github.com/${OWNER}/${REPO}/issues/new`;
  const params = new URLSearchParams({
    template: 'mark.yml',
    labels: 'mark',
    title: 'Mark title',
    body: [
      'Message: what proof or marker are you leaving?',
      '',
      'Coordinate: 0,0',
      'Color: #69e0ff',
      'Link: https://example.com',
    ].join('\\n'),
  });
  return `${base}?${params.toString()}`;
}

function onWheel(e) {
  e.preventDefault();
  const worldBefore = screenToWorld(e.clientX, e.clientY);
  const delta = -Math.sign(e.deltaY) * 0.12;
  const nextZoom = clamp(camera.zoom * (1 + delta), 0.25, 5);
  camera.zoom = nextZoom;
  const worldAfter = screenToWorld(e.clientX, e.clientY);
  camera.x += worldBefore.x - worldAfter.x;
  camera.y += worldBefore.y - worldAfter.y;
}

function onMouseDown(e) {
  dragging = true;
  movedDuringDrag = false;
  dragStart = { x: e.clientX, y: e.clientY };
  cameraAtDragStart = { x: camera.x, y: camera.y };
}

function onMouseUp() {
  dragging = false;
  dragStart = null;
  cameraAtDragStart = null;
  movedDuringDrag = false;
}

function onMouseMove(e) {
  if (!dragging || !dragStart) return;
  const dx = (e.clientX - dragStart.x) / camera.zoom;
  const dy = (e.clientY - dragStart.y) / camera.zoom;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedDuringDrag = true;
  camera.x = cameraAtDragStart.x - dx;
  camera.y = cameraAtDragStart.y - dy;
}

function onCanvasClick(e) {
  if (movedDuringDrag) return;
  const world = screenToWorld(e.clientX, e.clientY);
  const hit = pickStar(world.x, world.y);
  if (hit) {
    focusStar(hit);
    if (hit.url && e.metaKey) {
      window.open(hit.url, '_blank');
    }
  } else {
    closeDetails();
  }
}

function onKeyDown(e) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  pressedKeys.add(e.key.toLowerCase());
}

function onKeyUp(e) {
  pressedKeys.delete(e.key.toLowerCase());
}

function loop() {
  requestAnimationFrame(loop);
  updateCamera();
  draw();
}

function updateCamera() {
  const speed = 3 / camera.zoom;
  if (pressedKeys.has('arrowup') || pressedKeys.has('w')) camera.y -= speed;
  if (pressedKeys.has('arrowdown') || pressedKeys.has('s')) camera.y += speed;
  if (pressedKeys.has('arrowleft') || pressedKeys.has('a')) camera.x -= speed;
  if (pressedKeys.has('arrowright') || pressedKeys.has('d')) camera.x += speed;
}

function draw() {
  ctx.save();
  ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  drawBackground();

  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  ambientStars.forEach((star) => {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + star.brightness * 0.22})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 1.2 + star.brightness * 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  stars.forEach((star) => {
    drawStar(star, star === selectedStar);
  });

  ctx.restore();
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, '#05070d');
  grd.addColorStop(1, '#0b1224');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const gridGap = 240 * camera.zoom;
  for (let i = -3; i <= 3; i += 1) {
    const offset = i * gridGap;
    ctx.moveTo(width / 2 + offset, 0);
    ctx.lineTo(width / 2 + offset, height);
    ctx.moveTo(0, height / 2 + offset);
    ctx.lineTo(width, height / 2 + offset);
  }
  ctx.stroke();
}

function drawStar(star, selected) {
  const radius = selected ? 10 : 6;
  ctx.save();
  ctx.fillStyle = star.color || '#69e0ff';
  ctx.shadowColor = star.color || '#69e0ff';
  ctx.shadowBlur = selected ? 32 : 16;
  ctx.beginPath();
  ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(star.x, star.y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = '12px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText(star.label, star.x, star.y - radius - 6);
  ctx.restore();
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - width / 2) / camera.zoom + camera.x,
    y: (sy - height / 2) / camera.zoom + camera.y,
  };
}

function pickStar(wx, wy) {
  const pickRadius = 12 / camera.zoom;
  let closest = null;
  let closestDist = Infinity;
  for (const star of stars) {
    const dx = wx - star.x;
    const dy = wy - star.y;
    const dist = Math.hypot(dx, dy);
    if (dist < pickRadius && dist < closestDist) {
      closestDist = dist;
      closest = star;
    }
  }
  return closest;
}

function statusMessage(text) {
  statusEl.textContent = text;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function buildAmbientStars(count) {
  const arr = [];
  for (let i = 0; i < count; i += 1) {
    const r = 1800 * Math.sqrt(Math.random()) + 400;
    const theta = Math.random() * Math.PI * 2;
    arr.push({
      x: Math.cos(theta) * r,
      y: Math.sin(theta) * r,
      brightness: Math.random(),
    });
  }
  return arr;
}
