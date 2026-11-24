// ==UserScript==
// @name         DISCORD-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      2.9.0
// @description  Bypass ads for Discord Orbs with this smart helper script.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/* Manual start only. No API calls, CAPTCHA solving, or automatic claims.
   An enabled Claim button does not mean a reward has been received. */

(() => {
  'use strict';

  if (window.top !== window.self) return;

  const QUEST_HOME_PATTERN = /^\/quest-home(?:\/|$|\?|#)/;

  function isQuestHome() {
    return QUEST_HOME_PATTERN.test(location.pathname + location.search);
  }

  const CONFIG = {
    claimWaitMs: 10000,
    fallbackWaitMs: 10000,
    stallMs: 20000,
    plans: [
      { rate: 16, seek: true },
      { rate: 16 },
      { rate: 8 },
      { rate: 4 },
      { rate: 2 },
      { rate: 1 }
    ]
  };

  const SELECTORS = {
    video: 'video[data-testid="discord-web-video-player-video"]',
    container: '[data-testid="discord-web-video-player-container"]',
    frame: '[data-testid="discord-web-video-player-frame"]'
  };

  const TOP_Z = '2147483647';

  let active = null;
  let host = null;
  let shadow = null;
  let ui = null;
  let routeTimer = null;
  let cleanups = [];

  function onCleanup(fn) {
    cleanups.push(fn);
  }

  function runCleanups() {
    const fns = cleanups;
    cleanups = [];

    for (const fn of fns) {
      try {
        fn();
      } catch {
        // Cleanup must never prevent the remaining teardown steps.
      }
    }
  }

  function teardown() {
    if (active) {
      active.cancelled = true;
      restoreVideo(active);
      active = null;
    }

    runCleanups();

    if (host) {
      if (shadow) {
        shadow.replaceChildren();
      }

      host.remove();
    }

    // Remove any duplicate hosts that may have been left by an earlier version
    // or an interrupted mount. This prevents element/memory buildup.
    document
      .querySelectorAll('#orbs-simple-host')
      .forEach((duplicate) => duplicate.remove());

    host = null;
    shadow = null;
    ui = null;
  }

  function ensureUI() {
    // Critical guard: never allow multiple hosts to accumulate if Discord
    // detaches and recreates its body content during SPA navigation.
    const existing = document.getElementById('orbs-simple-host');

    if (existing && existing !== host) {
      existing.remove();
    }

    if (host && !host.isConnected) {
      if (shadow) {
        shadow.replaceChildren();
      }

      host.remove();
      host = null;
      shadow = null;
      ui = null;
    }

    if (host && host.isConnected) return ui;

    // Wait until Discord's document shell is actually available. The route
    // watcher will call this again on the next tick if it is not ready yet.
    if (!document.documentElement || !document.body) return null;

    host = document.createElement('div');
    host.id = 'orbs-simple-host';

    // Mount on <html>, not <body>. This keeps the helper outside Discord's
    // body-level layout and any body flex/grid or mutation-sensitive behaviour.
    //
    // The host uses the maximum z-index and is appended as the final child of
    // <html>, so the shadow UI wins stacking ties against Discord overlays.
    // It has no contain/transform/filter/opacity that could create a containing
    // block or interfere with Discord's chat scroll container.
    host.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:0',
      'height:0',
      'margin:0',
      'padding:0',
      'border:0',
      'background:transparent',
      'overflow:visible',
      `z-index:${TOP_Z}`,
      'pointer-events:none',
      'user-select:none'
    ].join(';');

    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('role', 'presentation');

    document.documentElement.append(host);
    shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          color: #dbdee1;
          font: 13px/1.5 system-ui, sans-serif;
        }

        *, *::before, *::after { box-sizing: border-box; }
        [hidden] { display: none !important; }

        #panel {
          position: fixed;
          right: 18px;
          bottom: 18px;
          width: 330px;
          max-width: calc(100vw - 20px);
          max-height: calc(100dvh - 20px);
          z-index: ${TOP_Z};
          background: linear-gradient(145deg, #272232, #191a22);
          border: 1px solid #a978ee55;
          border-radius: 16px;
          box-shadow: 0 16px 50px #0009;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          pointer-events: auto;
          overscroll-behavior: contain;
        }

        #header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 14px;
          cursor: grab;
          touch-action: none;
          user-select: none;
          border-bottom: 1px solid #b78af51c;
        }

        h2 { margin: 0; font-size: 14px; color: #fff; }

        #content {
          padding: 15px;
          overflow: auto;
          min-height: 0;
          overscroll-behavior: contain;
        }

        button {
          cursor: pointer;
          color: #fff;
          background: #6539a8;
          border: 0;
          border-radius: 12px;
        }

        button:focus-visible { outline: 2px solid #b9c2ff; }

        #minimise {
          width: 30px;
          height: 30px;
          background: #ffffff09;
          font-size: 21px;
        }

        #watch {
          width: 100%;
          padding: 16px 10px;
          font: 700 15px system-ui, sans-serif;
          background: linear-gradient(125deg, #6539a8, #4937a0);
          box-shadow: 0 0 17px #a058ff60;
        }

        small {
          display: block;
          margin-top: 9px;
          color: #b5bac1;
        }

        #status {
          padding: 10px;
          background: #ffffff09;
          border-radius: 10px;
          margin: 12px 0;
          overflow-wrap: anywhere;
        }

        summary { cursor: pointer; }

        pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          max-height: 220px;
          overflow: auto;
          background: #111214;
          border-radius: 9px;
          padding: 10px;
        }

        #orb {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          z-index: ${TOP_Z};
          border: 1px solid #ddaaffaa;
          background: radial-gradient(circle at 33% 25%, #efd2ff, #ba7aff 18%, #7d40cf 48%, #302268 85%);
          box-shadow: 0 0 22px #a459ff70;
          pointer-events: auto;
          overscroll-behavior: contain;
        }

        #copy {
          background: none;
          color: #c8a5ff;
          text-decoration: underline;
          padding: 5px 0;
        }

        #log.empty {
          color: #94909c;
          font-style: italic;
        }
      </style>

      <section id="panel">
        <header id="header">
          <h2>Discord Orbs Video Skip</h2>
          <button id="minimise" aria-label="Minimise to orb">−</button>
        </header>

        <div id="content">
          <button id="watch">I started watching</button>
          <small>Script will attempt to speed up or skip the video with fallback options provided automatically.</small>

          <div id="status" role="status">
            Open an Orbs video and click the button above once it starts playing.
          </div>

          <details>
            <summary>Logs</summary>
            <pre id="log" class="empty">No logs yet..</pre>
          </details>

          <button id="copy" type="button">Click here to copy logs</button>
          <span id="copy-status" role="status"></span>
        </div>
      </section>

      <button id="orb" hidden aria-label="Open Discord Orbs Video Skip"></button>
    `;

    ui = {
      panel: shadow.getElementById('panel'),
      header: shadow.getElementById('header'),
      watch: shadow.getElementById('watch'),
      minimise: shadow.getElementById('minimise'),
      orb: shadow.getElementById('orb'),
      status: shadow.getElementById('status'),
      log: shadow.getElementById('log'),
      copy: shadow.getElementById('copy'),
      copyStatus: shadow.getElementById('copy-status')
    };

    wireUI();
    return ui;
  }

  const lines = [];

  function log(text, kind = 'info') {
    lines.push(`[${new Date().toLocaleTimeString()}] [${kind.toUpperCase()}] ${text}`);
    if (lines.length > 300) lines.shift();

    if (!ui) return;

    ui.log.classList.remove('empty');
    ui.log.textContent = lines.join('\n');
    ui.status.textContent = text;
    console.info('[Orbs]', text);
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;
    if (element.closest('[hidden],[aria-hidden="true"]')) return false;

    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }
    }

    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function findPlayerScope(video) {
    const dialog = video.closest('[role="dialog"],dialog');
    if (dialog) return dialog;

    const player = video.closest(SELECTORS.container);
    if (!player) return null;

    let node = player;
    for (let i = 0; i < 4 && node.parentElement && node.parentElement !== document.body; i++) {
      node = node.parentElement;

      if (node.querySelectorAll(SELECTORS.video).length > 1) break;

      const text = node.textContent || '';
      if (/\b(claim|collect|quest|orbs)\b/i.test(text)) return node;
    }

    return player;
  }

  function choosePlayer() {
    const allVideos = Array.from(document.querySelectorAll('video'));

    const eligible = allVideos.filter((video) => {
      if (video.loop || video.error) return false;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return false;
      if (!video.matches(`${SELECTORS.video}, ${SELECTORS.container} video, ${SELECTORS.frame} video`)) return false;
      return isVisible(video);
    });

    const dialogVideos = eligible.filter((video) => video.closest('[role="dialog"],dialog'));
    const candidates = dialogVideos.length ? dialogVideos : eligible;

    log(
      `Manual selection: ${allVideos.length} videos on page, ` +
      `${candidates.length} eligible non-looping Discord players.`
    );

    if (!candidates.length) {
      throw new Error(
        'No loaded Orbs player found. Keep the quest video open and visible, then press “I started watching” again.'
      );
    }

    let video = candidates[0];

    if (candidates.length > 1) {
      const choices = candidates.map((candidate, index) => {
        const rect = candidate.getBoundingClientRect();
        return `${index + 1}: ${Math.round(candidate.duration)} sec, ` +
          `${Math.round(rect.width)}×${Math.round(rect.height)}`;
      }).join('\n');

      const answer = prompt(`Choose the Orbs player number:\n${choices}`);
      if (answer === null) throw new Error('Selection cancelled.');

      const index = Number(answer) - 1;
      if (!Number.isInteger(index) || !candidates[index]) {
        throw new Error('Invalid player number.');
      }

      video = candidates[index];
    }

    const scope = findPlayerScope(video);
    if (!scope) throw new Error('Could not identify the player container.');

    return {
      video,
      scope,
      src: video.currentSrc || video.src
    };
  }

  function captchaPresent() {
    const frames = Array.from(document.querySelectorAll('iframe')).filter((frame) => {
      if (!isVisible(frame) || frame.getBoundingClientRect().height <= 80) return false;
      return /captcha|challenges\.cloudflare/i.test(`${frame.src} ${frame.title}`);
    });

    if (frames.length) return true;

    return Array.from(document.querySelectorAll('[role="dialog"],[role="alert"]')).some((element) => {
      if (!isVisible(element)) return false;
      return /verify (?:that )?you are human|complete (?:the )?captcha|human verification/i
        .test(element.textContent || '');
    });
  }

  function assertStillValid(run) {
    if (active !== run || run.cancelled) throw new Error('CANCELLED');
    if (!isQuestHome()) throw new Error('LEFT_QUEST_HOME');
    if (captchaPresent()) throw new Error('CAPTCHA');

    if (
      !run.video.isConnected ||
      !run.scope.isConnected ||
      (run.src && (run.video.currentSrc || run.video.src) !== run.src)
    ) {
      throw new Error('PLAYER_CHANGED');
    }
  }

  function wait(ms, run) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + ms;

      const tick = () => {
        try {
          assertStillValid(run);

          if (Date.now() >= deadline) {
            assertStillValid(run);
            resolve();
            return;
          }

          setTimeout(tick, Math.min(200, deadline - Date.now()));
        } catch (error) {
          reject(error);
        }
      };

      tick();
    });
  }

  function claimState(run) {
    const buttons = Array.from(run.scope.querySelectorAll('button,[role="button"]')).filter((button) => {
      if (!isVisible(button)) return false;

      const label = (button.getAttribute('aria-label') || button.textContent || '').trim();
      return /^(claim|collect)(?:\s+(?:reward|orbs?))?(?:\s*\(?[\d,]+\)?)?$/i.test(label);
    });

    const ready = buttons.some((button) =>
      !button.disabled &&
      !button.hasAttribute('disabled') &&
      button.getAttribute('aria-disabled') !== 'true' &&
      !button.matches('[class*="disabled"],[class*="Disabled"]')
    );

    if (ready) return 'ready';
    return buttons.length ? 'locked' : 'missing';
  }

  function errorText(run) {
    return Array.from(run.scope.querySelectorAll('[role="alert"]'))
      .filter(isVisible)
      .map((element) => (element.textContent || '').trim())
      .find((text) => /error|failed|try again|something went wrong/i.test(text)) || '';
  }

  function hideVideo(run) {
    const video = run.video;

    try {
      video.muted = true;
      video.volume = 0;

      if (!run.mask) {
        run.mask = true;
        video.style.setProperty('opacity', '0', 'important');
      }
    } catch {
      // Discord may replace the element during a transition.
    }
  }

  function restoreVideo(run) {
    run.mask = false;
    const video = run.video;

    try {
      video.pause();
      video.muted = run.original.muted;
      video.volume = run.original.volume;
      video.playbackRate = run.original.rate;

      if (run.original.opacity) {
        video.style.setProperty('opacity', run.original.opacity, run.original.priority);
      } else {
        video.style.removeProperty('opacity');
      }
    } catch {
      // Element may already have been removed.
    }
  }

  function cancel() {
    const run = active;
    if (!run) return;

    active = null;
    run.cancelled = true;

    restoreVideo(run);

    if (ui) {
      ui.watch.textContent = 'I started watching';
    }

    log('Stopped. Video paused and original audio, speed and visibility restored.');
  }

  const restartTip = 'Please wait for fallback methods to unlock the “collect” button.';

  async function playVideo(run, plan) {
    assertStillValid(run);
    hideVideo(run);

    log(
      `Attempt ${run.index + 1}/${CONFIG.plans.length}: ` +
      `${plan.rate}x${plan.seek ? ', incremental seeks' : ''}.`
    );

    const video = run.video;
    video.pause();
    video.playbackRate = plan.rate;
    video.currentTime = 0;

    try {
      await Promise.race([
        video.play(),
        wait(15000, run).then(() => {
          throw new Error('Playback start timed out.');
        })
      ]);
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Browser blocked playback. Press Play in Discord and start again.');
      }
      throw error;
    }

    assertStillValid(run);

    let lastTime = video.currentTime;
    let lastMovement = Date.now();
    let nextSeek = Date.now() + 4000;
    let nextProgressLog = Date.now() + 5000;
    let lastPauseCheck = 0;
    let rateClampReported = false;
    const deadline = Date.now() + Math.max(120000, (video.duration + 90) * 1000);

    while (!video.ended) {
      await wait(300, run);
      hideVideo(run);

      if (video.error) {
        throw new Error(`Media error ${video.error.code}.`);
      }

      if (Date.now() > deadline) {
        throw new Error('Playback watchdog expired.');
      }

      if (video.currentTime > lastTime + 0.02) {
        lastTime = video.currentTime;
        lastMovement = Date.now();
      }

      if (Date.now() - lastMovement > CONFIG.stallMs) {
        throw new Error('Playback stalled for 20 seconds.');
      }

      if (video.playbackRate !== plan.rate && !rateClampReported) {
        rateClampReported = true;
        log(
          `Discord/browser changed requested ${plan.rate}x to ${video.playbackRate}x. ` +
          'Not repeatedly forcing the speed.'
        );
      }

      if (video.paused && !video.ended && Date.now() - lastPauseCheck > 4000) {
        lastPauseCheck = Date.now();

        try {
          await Promise.race([
            video.play(),
            wait(10000, run).then(() => {
              throw new Error('Resume timed out.');
            })
          ]);
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            throw new Error('Browser blocked playback. Press Play in Discord and start again.');
          }
          throw error;
        }
      }

      if (
        plan.seek &&
        Date.now() > nextSeek &&
        video.duration - video.currentTime > 5
      ) {
        video.currentTime = Math.min(
          video.duration - 3,
          video.currentTime + Math.min(8, video.duration / 10)
        );
        nextSeek = Date.now() + 4000;
      }

      if (Date.now() > nextProgressLog) {
        nextProgressLog = Date.now() + 5000;
        log(
          `${Math.round((100 * video.currentTime) / video.duration)}% media position · ` +
          `actual ${video.playbackRate}x.`
        );
      }
    }

    log(
      `Video ended. Waiting up to ${CONFIG.claimWaitMs / 1000} seconds for Claim/Collect to unlock. ` +
      restartTip
    );
  }

  async function verifyClaim(run) {
    const deadline = Date.now() + CONFIG.claimWaitMs;
    let state = 'missing';

    while (Date.now() < deadline) {
      assertStillValid(run);
      hideVideo(run);

      state = claimState(run);
      if (state === 'ready') return 'ready';

      const error = errorText(run);
      if (error) throw new Error(error.slice(0, 250));

      await wait(500, run);
    }

    return state;
  }

  async function startAttempt() {
    if (active) {
      cancel();
      return;
    }

    let run = null;

    try {
      log('I started watching pressed. Selecting the quest player.');

      const picked = choosePlayer();
      const video = picked.video;

      run = {
        ...picked,
        index: 0,
        cancelled: false,
        mask: false,
        original: {
          muted: video.muted,
          volume: video.volume,
          rate: video.playbackRate,
          opacity: video.style.getPropertyValue('opacity'),
          priority: video.style.getPropertyPriority('opacity')
        }
      };

      active = run;
      ui.watch.textContent = 'Stop attempt';

      hideVideo(run);

      log('Player selected. Preparing playback attempts.');
      assertStillValid(run);

      if (claimState(run) === 'ready') {
        log('Claim button unlocked! Click it to claim Orbs.');
        return;
      }

      for (let index = 0; index < CONFIG.plans.length; index++) {
        run.index = index;

        try {
          await playVideo(run, CONFIG.plans[index]);
          const result = await verifyClaim(run);

          if (result === 'ready') {
            log('Claim button unlocked! Click it to claim Orbs.');
            return;
          }

          if (result === 'locked') {
            log('Claim/Collect is still disabled after playback.', 'warning');
          } else {
            log(
              'No Claim/Collect button was identifiable in this player. ' +
              'Cannot verify completion. Player restored; check Discord manually.',
              'warning'
            );
            return;
          }
        } catch (error) {
          if (
            ['CANCELLED', 'CAPTCHA', 'PLAYER_CHANGED', 'LEFT_QUEST_HOME'].includes(error.message)
          ) {
            throw error;
          }

          if (error.name === 'NotAllowedError') {
            throw new Error('Browser blocked playback. Press Play in Discord and start again.');
          }

          log(`Attempt failed: ${error.message}`, 'error');
        }

        if (index + 1 < CONFIG.plans.length) {
          const next = CONFIG.plans[index + 1];
          log(
            `Waiting ${CONFIG.fallbackWaitMs / 1000} seconds before the next fallback: ` +
            `${next.rate}x${next.seek ? ' with seeks' : ' without seeks'}. ${restartTip}`
          );
          await wait(CONFIG.fallbackWaitMs, run);
        }
      }

      log(
        'All attempts, including 1x, exhausted. Claim readiness was not verified. ' +
        'Player restored; watch normally in Discord.',
        'warning'
      );
    } catch (error) {
      if (error.message === 'CAPTCHA') {
        log(
          'CAPTCHA — not an error. Player restored. Complete it in Discord, then press ' +
          '“I started watching” to try again.',
          'captcha'
        );
      } else if (error.message === 'PLAYER_CHANGED') {
        log(
          'Selected video was removed or changed. Player restored; reopen the quest and start again.',
          'error'
        );
      } else if (error.message === 'LEFT_QUEST_HOME') {
        log('Left Quest Home. Player restored and helper removed.', 'info');
      } else if (error.message !== 'CANCELLED') {
        log(error.message, 'error');
      }
    } finally {
      if (run) {
        run.video.removeEventListener('volumechange', run.enforceVolume);

        if (active === run) {
          restoreVideo(run);
          active = null;

          if (ui) {
            ui.watch.textContent = 'I started watching';
          }
        }
      }
    }
  }

  let copyTimer = null;
  let copyRequest = 0;

  async function copyLogs() {
    const request = ++copyRequest;
    const feedback = ui.copyStatus;

    clearTimeout(copyTimer);
    feedback.textContent = '';

    if (!lines.length) {
      feedback.textContent = 'No logs yet..';
      copyTimer = setTimeout(() => {
        if (request === copyRequest) feedback.textContent = '';
      }, 5000);
      return;
    }

    const text = lines.join('\n');
    let copied = false;

    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0';

      shadow.append(textarea);
      textarea.focus();
      textarea.select();

      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }

      textarea.remove();
    }

    if (request !== copyRequest) return;

    feedback.textContent = copied
      ? 'Logs Copied'
      : 'Clipboard blocked. Expand Logs and copy the text manually.';

    if (copied) {
      copyTimer = setTimeout(() => {
        if (request === copyRequest) feedback.textContent = '';
      }, 5000);
    }
  }

  let clampQueued = false;
  let dragging = null;

  function clampPanel() {
    clampQueued = false;

    if (!ui || ui.panel.hidden) return;

    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;

    ui.panel.style.maxWidth = `${Math.max(1, width - 20)}px`;
    ui.panel.style.maxHeight = `${Math.max(1, height - 20)}px`;

    const rect = ui.panel.getBoundingClientRect();
    const nextLeft = Math.max(left + 10, Math.min(rect.left, left + width - rect.width - 10));
    const nextTop = Math.max(top + 10, Math.min(rect.top, top + height - rect.height - 10));

    ui.panel.style.left = `${nextLeft}px`;
    ui.panel.style.top = `${nextTop}px`;
    ui.panel.style.right = 'auto';
    ui.panel.style.bottom = 'auto';
  }

  function queueClamp() {
    if (clampQueued) return;
    clampQueued = true;
    requestAnimationFrame(clampPanel);
  }

  function wireUI() {
    const removeViewportListeners = () => {
      window.removeEventListener('resize', queueClamp);
      window.removeEventListener('orientationchange', queueClamp);
      window.removeEventListener('load', handleLoad);
    };

    const handleLoad = () => {
      if (isQuestHome()) {
        ensureUI();
      }
    };

    onCleanup(removeViewportListeners);

    ui.watch.addEventListener('click', startAttempt);
    ui.copy.addEventListener('click', copyLogs);

    // Exact original minimise behaviour: hide the full panel and reveal the orb.
    ui.minimise.addEventListener('click', () => {
      ui.panel.hidden = true;
      ui.orb.hidden = false;
      ui.orb.focus();
    });

    // Exact original restore behaviour: hide the orb and reopen the panel.
    ui.orb.addEventListener('click', () => {
      ui.panel.hidden = false;
      ui.orb.hidden = true;
      queueClamp();
      ui.watch.focus({ preventScroll: true });
    });

    ui.header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;

      const rect = ui.panel.getBoundingClientRect();
      dragging = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top
      };

      ui.header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    ui.header.addEventListener('pointermove', (event) => {
      if (!dragging || dragging.id !== event.pointerId) return;

      ui.panel.style.left = `${dragging.left + event.clientX - dragging.x}px`;
      ui.panel.style.top = `${dragging.top + event.clientY - dragging.y}px`;
      ui.panel.style.right = 'auto';
      ui.panel.style.bottom = 'auto';

      clampPanel();
    });

    const endDrag = (event) => {
      if (dragging && dragging.id === event.pointerId) {
        dragging = null;
        queueClamp();
      }
    };

    ui.header.addEventListener('pointerup', endDrag);
    ui.header.addEventListener('pointercancel', endDrag);
    ui.header.addEventListener('lostpointercapture', endDrag);

    // React only to actual viewport-size changes. Never listen to scroll
    // events, which can interfere with Discord's chat scrolling.
    window.addEventListener('resize', queueClamp, { passive: true });
    window.addEventListener('orientationchange', queueClamp, { passive: true });
    window.addEventListener('load', handleLoad, { once: true });

    queueClamp();
  }

  function startRouteWatcher() {
    if (routeTimer) return;

    // Persistent but extremely cheap route watcher. It performs one URL-string
    // comparison per tick. It creates at most one helper host, waits for the
    // document shell when Quest Home loads slowly, removes stale or duplicate
    // hosts, and removes every trace of the helper when the user navigates away.
    routeTimer = setInterval(() => {
      if (isQuestHome()) {
        if (!host || !host.isConnected) {
          ensureUI();
        }
        return;
      }

      if (host || active) {
        teardown();
      }
    }, 250);
  }

  function installLifecycleCleanup() {
    const handlePageHide = () => {
      if (active) {
        active.cancelled = true;
        restoreVideo(active);
        active = null;
      }
    };

    window.addEventListener('pagehide', handlePageHide);

    onCleanup(() => {
      window.removeEventListener('pagehide', handlePageHide);
    });
  }

  // On a normal channel/server page, this userscript remains completely
  // dormant: no helper DOM, no panel, no orb, and no playback work. It only
  // maintains the tiny route watcher required to detect a later SPA move into
  // Quest Home.
  if (isQuestHome()) {
    ensureUI();
  }

  installLifecycleCleanup();
  startRouteWatcher();
})();
