// ==UserScript==
// @name         DISCORD-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      4.0.8
// @description  Earn Orbs Faster With This Orbs Video Skipper/Speed Up Tool
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==
(() => {
  'use strict';
  if (self !== top || !document.body || document.getElementById('orbs-click-only')) return;
  const host = document.createElement('div');
  host.id = 'orbs-click-only';
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 16px; bottom: 16px;
        z-index: 2147483647; color: #f5efff; font: 14px/1.5 system-ui,sans-serif; }
      * { box-sizing: border-box; }
      button, a { font: inherit; color: inherit; background: #573584; border: 1px solid #a876d9;
        border-radius: 10px; padding: 8px 12px; cursor: pointer; display: inline-block; }
      #orb { width: 46px; height: 46px; border-radius: 50%; padding: 0;
        background: radial-gradient(circle at 33% 25%, #d9b2ff, #713aae 70%); }
      #panel { position: absolute; bottom: 56px; right: 0;
        width: min(370px, calc(100vw - 32px)); max-height: calc(100dvh - 88px);
        overflow: auto; overscroll-behavior: contain; padding: 16px;
        border: 1px solid #74549b; border-radius: 14px; background: #211b2b; }
      [hidden] { display: none !important; }
      p { margin: 16px 0; } #status { margin: 12px 0 0; }
      .row { display: flex; flex-wrap: wrap; gap: 8px; }
    </style>
    <button type="button" id="orb" aria-label="Toggle Discord Orbs helper"
      aria-expanded="false" aria-controls="panel"></button>`;
  const orb = root.getElementById('orb');
  let panel;
  const quest = () => /^\/quest-home\/?$/.test(location.pathname);
  function buildPanel() {
    const el = document.createElement('section');
    el.id = 'panel';
    el.setAttribute('aria-label','Discord Orbs helper');
    el.innerHTML = `<strong>Discord Orbs helper</strong>
      <p>Ensure you have an Orbs video on screen and have pressed Play before applying a speed.</p>
      <div class="row">
        <a href="https://discord.com/quest-home">Go to Qrbs Home</a>
        <button type="button" data-rate="1.5">Apply 1.5×</button>
        <button type="button" data-rate="1">Set normal speed</button>
      </div><p id="status" role="status"></p>`;
    const status = el.querySelector('#status');
    for (const button of el.querySelectorAll('button')) {
      button.addEventListener('click', () => {
        if (!quest()) {
          status.textContent = 'Open Orbs Home first. No video was changed.';
          return;
        }
        const selector = 'video[data-testid="discord-web-video-player-video"], [data-testid="discord-web-video-player-container"] video, [data-testid="discord-web-video-player-frame"] video';
        const candidates = [...document.querySelectorAll(selector)].filter(v =>
          !v.paused && !v.ended && !v.error && !v.loop && Number.isFinite(v.duration) &&
          v.duration > 0 && !v.closest('[hidden], [aria-hidden="true"], [data-jump-section="global"]') &&
          v.checkVisibility?.({checkOpacity:true, checkVisibilityCSS:true}) !== false && v.getClientRects().length);
        if (candidates.length !== 1) {
          status.textContent = 'Play exactly one matching Quest Home video first.';
          return;
        }
        try {
          candidates[0].playbackRate = Number(button.dataset.rate);
          status.textContent = `Player reports ${candidates[0].playbackRate}×. No automatic retries.`;
        } catch {
          status.textContent = 'The player rejected the speed change.';
        }
      });
    }
    return el;
  }
  orb.addEventListener('click', () => {
    if (!panel) {
      panel = buildPanel();
      root.append(panel);
    } else {
      panel.hidden = !panel.hidden;
    }
    orb.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.body.append(host);
})();
