// ==UserScript==
// @name         DISCORD-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      4.0.5
// @description  One-button quest playback with progressively slower retries and claim-readiness checks.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const onQuestHome = () => /^\/quest-home\/?$/.test(location.pathname);
  const hostId = 'orbs-quest-only-host';

  if (self !== top || !onQuestHome() || !document.body ||
      document.getElementById(hostId)) return;

  const playerSelector = [
    'video[data-testid="discord-web-video-player-video"]',
    '[data-testid="discord-web-video-player-container"] video',
    '[data-testid="discord-web-video-player-frame"] video',
  ].join(',');

  const host = document.createElement('div');
  host.id = hostId;
  const root = host.attachShadow({ mode: 'closed' });
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  let change = null;

  root.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 10000;
        color: #f2eff9;
        font: 14px/1.5 system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      details {
        width: min(370px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        max-height: calc(100dvh - 32px);
        overflow: auto;
        overscroll-behavior: contain;
        border: 1px solid #74549b;
        border-radius: 14px;
        background: #211b2b;
        box-shadow: 0 8px 28px #0007;
      }
      details:not([open]) { width: auto; }
      summary { padding: 12px 16px; cursor: pointer; font-weight: 650; }
      .body { padding: 0 16px 16px; }
      .instruction {
        margin: 16px 0;
        padding: 12px;
        border-radius: 8px;
        background: #30273e;
      }
      .controls { display: flex; flex-wrap: wrap; gap: 8px; }
      button, select {
        font: inherit;
        color: inherit;
        background: #493562;
        border: 1px solid #8a69ad;
        border-radius: 8px;
        padding: 8px 10px;
      }
      button { cursor: pointer; }
      :focus-visible { outline: 2px solid #d5baff; outline-offset: 2px; }
      #status { margin: 12px 0 0; overflow-wrap: anywhere; }
    </style>
    <details>
      <summary>Discord Orbs helper</summary>
      <div class="body">
        <p class="instruction" id="instruction">
          Ensure you have an Orbs video on screen and have pressed Play
          before applying a speed. If Discord does not credit the video,
          use its normal playback and claim controls.
        </p>
        <div class="controls">
          <select id="speed" aria-label="Playback speed">
            <option value="1.25">1.25×</option>
            <option value="1.5" selected>1.5×</option>
            <option value="2">2×</option>
          </select>
          <button type="button" id="apply" aria-describedby="instruction">
            Apply speed
          </button>
          <button type="button" id="restore">Restore speed</button>
        </div>
        <p id="status" role="status">Waiting for you to start the video.</p>
      </div>
    </details>`;

  const status = root.getElementById('status');
  const sourceOf = video => video.currentSrc || video.src;

  function restore() {
    const previous = change;
    change = null;
    if (!previous) return false;
    const { video, source, original, applied } = previous;

    // Do not overwrite a new source or a rate Discord/the user changed.
    if (!video.isConnected || sourceOf(video) !== source ||
        video.playbackRate !== applied) return false;

    try {
      video.playbackRate = original;
      return true;
    } catch {
      return false;
    }
  }

  function close() {
    restore();
    lifetime.abort();
    host.remove();
  }

  function checkRoute() {
    if (onQuestHome()) return true;
    close();
    return false;
  }

  function eligible(video) {
    if (video.paused || video.ended || video.loop || video.error ||
        !Number.isFinite(video.duration) || video.duration <= 0 ||
        !sourceOf(video) ||
        video.closest('[hidden], [aria-hidden="true"], [data-jump-section="global"]')) {
      return false;
    }

    const style = getComputedStyle(video);
    const rect = video.getBoundingClientRect();
    return style.visibility === 'visible' && style.opacity !== '0' &&
      rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.right > 0 &&
      rect.top < innerHeight && rect.left < innerWidth;
  }

  root.getElementById('apply').addEventListener('click', () => {
    if (!checkRoute()) return;

    // One narrow query per click. No scanning between clicks.
    const candidates = [...document.querySelectorAll(playerSelector)].filter(eligible);
    if (candidates.length !== 1) {
      status.textContent = candidates.length
        ? 'More than one matching video is playing. Pause the others and try again.'
        : 'No matching playing video found. Press Play in Quest Home first.';
      return;
    }

    const video = candidates[0];
    restore();

    const source = sourceOf(video);
    const original = video.playbackRate;
    const requested = Number(root.getElementById('speed').value);

    try {
      video.playbackRate = requested;
      const applied = video.playbackRate;
      if (applied !== original) change = { video, source, original, applied };
      status.textContent =
        `Player reports ${applied}× now. The helper will not reapply it.`;
    } catch {
      status.textContent = 'The player rejected the speed change. Use normal playback.';
    }
  }, options);

  root.getElementById('restore').addEventListener('click', () => {
    if (!checkRoute()) return;
    status.textContent = restore()
      ? 'Original speed restored.'
      : 'No helper-applied speed to restore.';
  }, options);

  // Event-driven teardown only. No history patch or polling fallback.
  window.navigation?.addEventListener('currententrychange', checkRoute, options);
  window.addEventListener('popstate', checkRoute, options);
  window.addEventListener('pagehide', close, options);

  document.body.append(host);
})();
