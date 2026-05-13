// Vendored from https://raw.githubusercontent.com/ai-village-agents/deepseek-pattern-archive/60d665b7321a81eed5091ac9b4ab0e32351dd4af/proof-constellation-integration/proof-constellation.js (commit 60d665b7321a81eed5091ac9b4ab0e32351dd4af) to avoid CDN outages.
/*!
 * Proof Constellation Integration (core)
 * Version: 1.0.0
 * Zero tracking: no analytics, no cookies, no third-party beacons. Only a GET to the configured source URL.
 *
 * API:
 *   const client = ProofConstellationIntegration.createClient({
 *     sourceUrl: 'https://ai-village-agents.github.io/deepseek-pattern-archive/api/ecosystem.json', // required data source (defaults to live ecosystem feed)
 *     pollIntervalMs: 30000,                          // adjustable polling cadence
 *     theme: { accent: '#2563eb', background: '#0b1021', text: '#e5e7eb', surface: '#111827' },
 *     position: 'bottom-right',                      // bottom-right | bottom-left | top-right | top-left
 *     panel: { enabled: true }                       // optional floating panel
 *   });
 *
 * Events:
 *   client.addEventListener('update', (e) => console.log(e.detail));
 *   client.addEventListener('offline', (e) => console.warn(e.detail.reason));
 *   client.addEventListener('error', (e) => console.error(e.detail.error));
 */
(function (global) {
  const VERSION = '1.0.0';
  const STORAGE_KEY = 'proof-constellation:v1:cache';
  const DEFAULTS = {
    sourceUrl: 'https://ai-village-agents.github.io/deepseek-pattern-archive/api/ecosystem.json',
    pollIntervalMs: 30000,
    maxBackoffMs: 300000,
    theme: {
      accent: '#2563eb',
      background: '#0b1021',
      surface: '#0f172a',
      text: '#e5e7eb',
      muted: '#9ca3af',
    },
    position: 'bottom-right',
    panel: {
      enabled: true,
      title: 'Proof Constellation',
    },
  };

  const css = (strings, ...values) =>
    strings.reduce((acc, part, idx) => acc + part + (values[idx] ?? ''), '');

  function mergeDefaults(userConfig = {}) {
    const target = JSON.parse(JSON.stringify(DEFAULTS));
    return deepMerge(target, userConfig);
  }

  function deepMerge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(extra).forEach((key) => {
      const value = extra[key];
      if (Array.isArray(value)) {
        base[key] = value.slice();
      } else if (value && typeof value === 'object') {
        base[key] = deepMerge(base[key] || {}, value);
      } else {
        base[key] = value;
      }
    });
    return base;
  }

  class ProofConstellationClient extends EventTarget {
    constructor(userConfig = {}) {
      super();
      this.config = mergeDefaults(userConfig);
      this.state = { backoff: 0, timer: null, destroyed: false, lastUpdate: null };
      this.cache = this.readCache();
      this.panel = null;
      if (this.config.panel.enabled) {
        this.ensurePanel();
      }
      this.render(this.cache, 'cached');
      this.start();
    }

    start() {
      if (this.state.destroyed) return;
      this.pollNow();
    }

    stop() {
      if (this.state.timer) {
        clearTimeout(this.state.timer);
        this.state.timer = null;
      }
    }

    disablePanel() {
      if (this.panel?.root) {
        this.panel.root.remove();
      }
      this.panel = null;
      this.config.panel.enabled = false;
    }

    enablePanel() {
      if (this.panel?.root || this.config.panel.enabled === false) {
        if (this.config.panel.enabled === false) this.config.panel.enabled = true;
      }
      this.ensurePanel();
      if (this.cache) {
        this.render(this.cache, 'cached');
      }
    }

    destroy() {
      this.stop();
      this.state.destroyed = true;
      if (this.panel?.root) {
        this.panel.root.remove();
        this.panel = null;
      }
    }

    pollNow() {
      this.stop();
      this.fetchStatus().catch((error) => {
        this.state.lastUpdate = null;
        this.handleOffline(error);
      }).finally(() => {
        if (this.state.destroyed) return;
        const nextInterval = this.nextInterval();
        this.state.timer = setTimeout(() => this.pollNow(), nextInterval);
      });
    }

    async fetchStatus() {
      const { sourceUrl } = this.config;
      const response = await fetch(sourceUrl, {
        cache: 'no-store',
        credentials: 'omit',
        keepalive: false,
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`Status endpoint returned ${response.status}`);
      }
      const raw = await response.json();
      const normalized = this.normalize(raw);
      this.cache = normalized;
      this.state.backoff = 0;
      this.state.lastUpdate = Date.now();
      this.writeCache(normalized);
      this.render(normalized, 'live');
      this.dispatchEvent(new CustomEvent('update', { detail: normalized }));
      return normalized;
    }

    normalize(raw = {}) {
      const ecosystem = raw?.proof_constellation_specific || raw?.proof_constellation || {};
      const adoptionCurrent =
        firstNumber(
          raw.connected_worlds,
          raw.adoption_current,
          raw.adoptionCurrent,
          raw?.adoption?.current,
        ) ?? 0;
      const adoptionTotal =
        firstNumber(
          raw.total_worlds,
          raw.adoption_total,
          raw.adoptionTotal,
          raw?.adoption?.total,
        ) ?? 14;
      const adoptionPost =
        firstNumber(
          ecosystem.connected_world_count_if_onboarded,
          raw.adoption_post_integration,
          raw.adoptionPostIntegration,
          raw?.adoption?.postIntegration,
        ) ?? adoptionCurrent;
      const predictedAcceleration =
        firstNumber(
          ecosystem.predicted_acceleration,
          raw.predicted_acceleration,
          raw.predictedAcceleration,
          raw?.forecast?.predicted_acceleration,
          raw?.forecast?.predictedAcceleration,
          raw?.urgent_update?.proof_constellation_timing,
        ) ?? null;

      return {
        version: VERSION,
        source: this.config.sourceUrl,
        adoption: {
          current: adoptionCurrent,
          total: adoptionTotal,
          postIntegration: adoptionPost,
        },
        edgeMultiplier:
          firstNumber(
            raw.edge_multiplier,
            raw.edgeMultiplier,
            raw?.multipliers?.edgeGarden,
            raw?.growth_metrics?.edge_garden?.growth_multiplier,
          ) ?? null,
        predictedAcceleration,
        updatedAt: raw.updated_at || raw.updatedAt || raw.timestamp || new Date().toISOString(),
        note:
          raw.note ||
          raw?.urgent_update?.proof_constellation_timing ||
          'Live Proof Constellation status',
      };
    }

    nextInterval() {
      const { pollIntervalMs, maxBackoffMs } = this.config;
      const current = this.state.backoff || pollIntervalMs;
      const next = Math.min(current * 2, maxBackoffMs);
      this.state.backoff = next;
      return this.state.lastUpdate ? pollIntervalMs : current;
    }

    handleOffline(error) {
      const cached = this.readCache();
      if (cached) {
        this.render(cached, 'cached');
        this.dispatchEvent(
          new CustomEvent('offline', { detail: { reason: 'fetch_failed', cached: true, error } }),
        );
      } else {
        this.dispatchEvent(
          new CustomEvent('offline', { detail: { reason: 'fetch_failed', cached: false, error } }),
        );
      }
      this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
    }

    ensurePanel() {
      if (typeof document === 'undefined') return;
      const existing = document.getElementById('pc-integration-panel');
      if (existing) {
        this.panel = { root: existing };
        return;
      }
      const root = document.createElement('div');
      root.id = 'pc-integration-panel';
      root.setAttribute('data-version', VERSION);
      root.style.position = 'fixed';
      root.style.zIndex = '9999';
      this.applyPosition(root);
      this.injectPanelStyles();
      root.innerHTML = this.panelTemplate();
      document.body.appendChild(root);
      this.panel = { root };
      this.wirePanelControls();
    }

    applyPosition(root) {
      const position = this.config.position || 'bottom-right';
      const spacing = '16px';
      root.style.maxWidth = '360px';
      root.style.width = 'min(360px, calc(100% - 24px))';
      switch (position) {
        case 'bottom-left':
          root.style.left = spacing;
          root.style.bottom = spacing;
          break;
        case 'top-right':
          root.style.right = spacing;
          root.style.top = spacing;
          break;
        case 'top-left':
          root.style.left = spacing;
          root.style.top = spacing;
          break;
        default:
          root.style.right = spacing;
          root.style.bottom = spacing;
      }
    }

    injectPanelStyles() {
      if (document.getElementById('pc-integration-style')) return;
      const style = document.createElement('style');
      style.id = 'pc-integration-style';
      const t = this.config.theme;
      style.textContent = css`
        #pc-integration-panel {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: ${t.text};
          background: ${t.background};
          border: 1px solid ${t.surface};
          border-radius: 14px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          overflow: hidden;
        }
        #pc-integration-panel .pc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: linear-gradient(120deg, ${t.surface}, ${t.background});
        }
        #pc-integration-panel .pc-title {
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.4px;
        }
        #pc-integration-panel .pc-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid ${t.accent};
          color: ${t.accent};
          font-size: 12px;
          font-weight: 600;
        }
        #pc-integration-panel .pc-body {
          padding: 16px;
          background: ${t.surface};
        }
        #pc-integration-panel .pc-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        #pc-integration-panel .pc-card {
          padding: 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        #pc-integration-panel .pc-label {
          font-size: 12px;
          color: ${t.muted};
          margin-bottom: 4px;
        }
        #pc-integration-panel .pc-value {
          font-size: 18px;
          font-weight: 700;
          color: ${t.text};
        }
        #pc-integration-panel .pc-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          font-size: 12px;
          color: ${t.muted};
          background: ${t.background};
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        #pc-integration-panel button.pc-toggle {
          background: none;
          border: 0;
          color: ${t.muted};
          cursor: pointer;
          font-size: 12px;
        }
      `;
      document.head.appendChild(style);
    }

    panelTemplate() {
      const { panel } = this.config;
      return `
        <div class="pc-header">
          <div class="pc-title">${panel.title || 'Proof Constellation'}</div>
          <div class="pc-pill" id="pc-pill-status">
            <span>Initializing</span>
          </div>
        </div>
        <div class="pc-body">
          <div class="pc-grid">
            <div class="pc-card">
              <div class="pc-label">Adoption</div>
              <div class="pc-value" id="pc-adoption">0 / 0</div>
              <div class="pc-label" id="pc-adoption-target"></div>
            </div>
            <div class="pc-card">
              <div class="pc-label">Predicted Acceleration</div>
              <div class="pc-value" id="pc-acceleration">–</div>
            </div>
            <div class="pc-card">
              <div class="pc-label">Edge Garden Multiplier</div>
              <div class="pc-value" id="pc-edge">–</div>
            </div>
            <div class="pc-card">
              <div class="pc-label">Last Updated</div>
              <div class="pc-value" id="pc-updated">–</div>
            </div>
          </div>
        </div>
        <div class="pc-foot">
          <span id="pc-foot-note">Zero tracking • browser-only</span>
          <button class="pc-toggle" id="pc-toggle-btn" aria-pressed="true">Hide panel</button>
        </div>
      `;
    }

    wirePanelControls() {
      if (!this.panel?.root) return;
      const toggle = this.panel.root.querySelector('#pc-toggle-btn');
      toggle?.addEventListener('click', () => {
        const body = this.panel.root.querySelector('.pc-body');
        const hidden = body?.style.display === 'none';
        body.style.display = hidden ? 'block' : 'none';
        toggle.textContent = hidden ? 'Hide panel' : 'Show panel';
        toggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
      });
    }

    render(data, mode) {
      if (!data || !this.panel?.root) return;
      const adoptionLabel = this.panel.root.querySelector('#pc-adoption');
      const adoptionTarget = this.panel.root.querySelector('#pc-adoption-target');
      const acceleration = this.panel.root.querySelector('#pc-acceleration');
      const edge = this.panel.root.querySelector('#pc-edge');
      const updated = this.panel.root.querySelector('#pc-updated');
      const pill = this.panel.root.querySelector('#pc-pill-status');
      const note = this.panel.root.querySelector('#pc-foot-note');

      const adoptionText = `${data.adoption.current}/${data.adoption.total}`;
      const targetText = `${data.adoption.postIntegration}/${data.adoption.total} after integration`;
      adoptionLabel.textContent = adoptionText;
      adoptionTarget.textContent = targetText;
      acceleration.textContent = data.predictedAcceleration
        ? `${Number(data.predictedAcceleration).toFixed(1)}x`
        : '—';
      edge.textContent = data.edgeMultiplier ? `${Number(data.edgeMultiplier).toFixed(1)}x` : '—';
      updated.textContent = data.updatedAt;

      if (pill) {
        pill.innerHTML = `<span>${mode === 'live' ? 'Live' : 'Offline cache'}</span>`;
      }
      if (note) {
        note.textContent = 'Zero tracking • data stays in-browser';
      }
    }

    readCache() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        return null;
      }
    }

    writeCache(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // Ignore quota issues to preserve zero-tracking flow
      }
    }
  }

  function firstNumber(...values) {
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      const num = parseNumber(value);
      if (num !== null) return num;
    }
    return null;
  }

  function parseNumber(value) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '');
      const match = normalized.match(/-?\d+(?:\.\d+)?/);
      if (!match) return null;
      const parsed = Number.parseFloat(match[0]);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  const api = {
    createClient: (config = {}) => new ProofConstellationClient(config),
    defaults: DEFAULTS,
    version: VERSION,
    checksum: 'see proof-constellation-integration/checksums.txt for release SRI',
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.ProofConstellationIntegration = api;
})(typeof window !== 'undefined' ? window : globalThis);
