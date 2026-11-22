// ==UserScript==
// @name         Discord-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      1.1.0
// @description  Attempts to speed up the rate of Orbs collection, with automatic fallback handling.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
  HOW FALLBACK WORKS

  When you press "Start auto fallback", the script tries progressively less
  aggressive playback methods. If an attempt does not reach a claimable state,
  it stops that attempt and automatically tries the next one:

  1. Muted + visually hidden + 16x + small incremental seeks
  2. Muted + visually hidden + 16x
  3. Visible + audible + 16x
  4. Visible + audible + 4x
  5. Visible + audible + 2x
  6. Normal 1x playback

  The individual tools are intended only if automatic fallback does not work.
  They let you manually test one exact playback mode.

  "Visually hidden" only makes the selected video transparent. It does not hide
  the browser tab, spoof focus, or conceal playback state from Discord.

  Fast playback may be ignored, clamped, or rejected by Discord. It cannot make
  a real-time watch requirement finish faster in real time.

  CAPTCHAs are not errors. The script pauses, asks you to complete the CAPTCHA,
  and lets you resume afterward.

  The orb counter only increases when you manually confirm the orbs Discord
  actually credited to your account.
*/

(() => {
'use strict';

if (window.top !== window.self || document.getElementById('orbs-skip-panel')) return;

const PLANS = [
  { id: 1, label: 'Muted + hidden + 16x + seeks', rate: 16, mute: true, hide: true, seek: true },
  { id: 2, label: 'Muted + hidden + 16x', rate: 16, mute: true, hide: true, seek: false },
  { id: 3, label: 'Visible + audible + 16x', rate: 16, mute: false, hide: false, seek: false },
  { id: 4, label: 'Visible + audible + 4x', rate: 4, mute: false, hide: false, seek: false },
  { id: 5, label: 'Visible + audible + 2x', rate: 2, mute: false, hide: false, seek: false }
];

const NORMAL_PLAN = { id: 6, label: 'Normal 1x', rate: 1, mute: false, hide: false, seek: false };

const STORAGE_KEY = 'discord-orbs-video-skip:v1';
const WATCH_TIMEOUT_MS = 10 * 60 * 1000;
const CLAIM_WAIT_MS = 30 * 1000;
const STALL_TIMEOUT_MS = 20 * 1000;

let state = loadState();
let active = null;
let pendingCaptcha = null;
let selectedVideo = null;
let selectedScope = null;
let logs = [];

function loadState() {
  const fallback = {
    startedAt: Date.now(),
    confirmedOrbs: 0,
    completedQuestIds: []
  };

  try {
    return { ...fallback, ...(JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return fallback;
  }
}

function saveState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[Discord-Orbs-Video-Skip] Unable to save state:', error);
  }
}

function resetDailyCounterIfNeeded() {
  const now = Date.now();

  if (now - state.startedAt >= 24 * 60 * 60 * 1000) {
    state = {
      startedAt: now,
      confirmedOrbs: 0,
      completedQuestIds: []
    };
    saveState();
    toast('Daily confirmed-orb counter has reset.', 'info');
  }
}

function isVisible(element) {
  if (!element?.isConnected) return false;

  const style = getComputedStyle(element);
  return (
    element.getClientRects().length > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

function getQuestScope(video) {
  return video.closest('[role="dialog"], dialog') || video.parentElement;
}

function findActiveVideo() {
  const videos = [...document.querySelectorAll('video')]
    .filter(video => isVisible(video) && !document.getElementById('orbs-skip-panel').contains(video));

  const playing = videos.find(video => !video.paused && !video.ended && video.currentTime > 0);

  if (playing) return playing;

  return videos.find(video => video.readyState >= 2 && video.duration > 0) || null;
}

function findStartedWatchingButton() {
  const buttons = [...document.querySelectorAll('button, [role="button"]')];

  return buttons.find(button => {
    if (!isVisible(button)) return false;

    const text = (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase();
    return text.includes('i started watching');
  });
}

function findClaimButton() {
  if (!selectedScope?.isConnected) return null;

  return [...selectedScope.querySelectorAll('button, [role="button"]')].find(button => {
    if (!isVisible(button)) return false;

    const disabled =
      button.disabled ||
      button.getAttribute('aria-disabled') === 'true' ||
      button.classList.contains('disabled');

    if (disabled) return false;

    const text = (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase();

    return (
      text === 'claim' ||
      text === 'claim reward' ||
      text === 'claim orbs' ||
      text === 'collect' ||
      text === 'collect reward' ||
      text === 'collect orbs'
    );
  });
}

function findError() {
  if (!selectedScope?.isConnected) return '';

  return [...selectedScope.querySelectorAll('[role="alert"]')]
    .filter(isVisible)
    .map(element => (element.textContent || '').trim())
    .find(text => /error|failed|try again|something went wrong/i.test(text)) || '';
}

function detectCaptcha() {
  const captchaFrame = [...document.querySelectorAll('iframe')].find(frame =>
    isVisible(frame) &&
    /hcaptcha|recaptcha|captcha|challenges\.cloudflare/i.test(`${frame.src || ''} ${frame.title || ''}`)
  );

  if (captchaFrame) return captchaFrame;

  return [...document.querySelectorAll('[role="dialog"], [role="alert"]')].find(element =>
    isVisible(element) &&
    !document.getElementById('orbs-skip-panel').contains(element) &&
    /verify (?:that )?you are human|complete (?:the )?captcha|human verification/i.test(element.textContent || '')
  );
}

function toast(message, type = 'info', duration = 6000) {
  const colours = {
    info: '#5865f2',
    success: '#23a55a',
    warning: '#f0b232',
    error: '#da373c',
    captcha: '#f0b232'
  };

  const toastElement = document.createElement('div');
  toastElement.className = 'orbs-skip-toast';
  toastElement.setAttribute('role', 'status');
  toastElement.style.cssText = `
    background: ${colours[type] || colours.info};
    color: #fff;
    padding: 12px 14px;
    margin-bottom: 10px;
    border-radius: 12px;
    font: 600 13px/1.45 "gg sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .18s ease, transform .18s ease;
    white-space: pre-wrap;
  `;

  toastElement.textContent = message;
  document.getElementById('orbs-skip-toast-host').appendChild(toastElement);

  requestAnimationFrame(() => {
    toastElement.style.opacity = '1';
    toastElement.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toastElement.style.opacity = '0';
    toastElement.style.transform = 'translateY(-6px)';
    setTimeout(() => toastElement.remove(), 220);
  }, duration);

  while (document.getElementById('orbs-skip-toast-host').children.length > 4) {
    document.getElementById('orbs-skip-toast-host').firstChild.remove();
  }
}

function log(message, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] [${type.toUpperCase()}] ${message}`;

  logs.push(line);

  if (logs.length > 300) logs.shift();

  document.getElementById('orbs-skip-log').textContent = logs.join('\n');
  document.getElementById('orbs-skip-log').scrollTop = 999999;
}

function status(message, type = 'info', notify = true) {
  document.getElementById('orbs-skip-status').textContent = message;
  log(message, type);

  if (notify) toast(message, type);
}

function updateCounter() {
  resetDailyCounterIfNeeded();

  document.getElementById('orbs-skip-counter').textContent =
    `Orbs collected today = ${state.confirmedOrbs}`;
}

function updateSelectedVideoUi() {
  const selected = document.getElementById('orbs-skip-selected');
  const startButton = document.getElementById('orbs-skip-start');
  const manualSection = document.getElementById('orbs-skip-manual');

  if (selectedVideo?.isConnected) {
    const progress = selectedVideo.duration
      ? Math.round((selectedVideo.currentTime / selectedVideo.duration) * 100)
      : 0;

    selected.textContent = `Selected: playing video (${progress}% position)`;
    startButton.disabled = false;
    manualSection.style.opacity = '1';
    manualSection.style.pointerEvents = 'auto';
  } else {
    selected.textContent = 'No quest video detected yet.';
    startButton.disabled = true;
    manualSection.style.opacity = '.55';
    manualSection.style.pointerEvents = 'none';
  }
}

function checkRun(run) {
  if (active !== run || run.controller.signal.aborted) {
    throw new Error('CANCELLED');
  }

  if (!selectedVideo?.isConnected || !selectedScope?.isConnected) {
    throw new Error('VIDEO_REMOVED');
  }

  const captcha = detectCaptcha();

  if (captcha) {
    throw new Error('CAPTCHA');
  }
}

function sleep(ms, run) {
  return new Promise((resolve, reject) => {
    const finish = Date.now() + ms;

    const tick = () => {
      try {
        checkRun(run);
      } catch (error) {
        reject(error);
        return;
      }

      if (Date.now() >= finish) {
        resolve();
        return;
      }

      setTimeout(tick, Math.min(250, finish - Date.now()));
    };

    tick();
  });
}

function restoreVideo(video) {
  if (!video?.isConnected) return;

  try {
    video.pause();
    video.playbackRate = 1;
    video.muted = false;
    video.style.opacity = '';
  } catch (error) {
    console.warn('[Discord-Orbs-Video-Skip] Unable to restore video:', error);
  }
}

function stopActiveRun(quiet = false) {
  if (active) {
    const run = active;
    active = null;
    run.controller.abort();
    restoreVideo(run.video);
  }

  pendingCaptcha = null;

  if (!quiet) {
    status('Stopped. Original playback settings restored.', 'info');
  }

  updateSelectedVideoUi();
}

function interruptRun(run, error) {
  if (active !== run) return;

  restoreVideo(run.video);
  active = null;

  if (error.message === 'CAPTCHA') {
    pendingCaptcha = {
      planIndex: run.planIndex,
      phase: run.phase
    };

    status(
      'CAPTCHA detected — not an error. Complete it in Discord, then press “Resume after CAPTCHA”.',
      'captcha',
      true
    );

    detectCaptcha()?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    return;
  }

  if (error.message === 'CANCELLED') return;

  if (error.message === 'VIDEO_REMOVED') {
    selectedVideo = null;
    selectedScope = null;
    status('The selected quest video or dialog was removed. Open the quest video again.', 'error');
    updateSelectedVideoUi();
    return;
  }

  status(`Attempt failed: ${error.message}`, 'error');
}

async function playWithPlan(run, plan) {
  const video = run.video;

  checkRun(run);
  run.phase = 'playback';

  video.style.opacity = plan.hide ? '0' : '';
  video.muted = Boolean(plan.mute);
  video.playbackRate = plan.rate;

  if (video.readyState < 2) {
    const deadline = Date.now() + 20000;

    while (video.readyState < 2) {
      if (Date.now() > deadline) throw new Error('Video metadata timed out.');
      await sleep(250, run);
    }
  }

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error('Video has no usable duration.');
  }

  video.currentTime = 0;

  try {
    await video.play();
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Playback was blocked. Click the video once, then retry.');
    }

    throw error;
  }

  checkRun(run);

  status(
    `Attempt ${plan.id}/6: ${plan.label}. Requested speed: ${plan.rate}x.`,
    'info',
    plan.id === 1
  );

  const deadline = Date.now() + WATCH_TIMEOUT_MS;
  let lastPosition = video.currentTime;
  let lastMovement = Date.now();
  let nextSeek = Date.now() + 4000;
  let lastResumeAttempt = 0;
  let lastProgressUpdate = 0;

  while (!video.ended) {
    await sleep(500, run);

    if (video.error) {
      throw new Error(`Media error ${video.error.code}.`);
    }

    if (Date.now() > deadline) {
      throw new Error('Playback watchdog timed out.');
    }

    if (video.currentTime > lastPosition + 0.02) {
      lastMovement = Date.now();
      lastPosition = video.currentTime;
    }

    if (Date.now() - lastMovement > STALL_TIMEOUT_MS) {
      throw new Error('Playback stalled for 20 seconds.');
    }

    if (video.paused && !video.ended && Date.now() - lastResumeAttempt > 4000) {
      lastResumeAttempt = Date.now();
      log('Playback paused; attempting to resume.', 'warning', false);
      await video.play();
    }

    if (plan.seek && Date.now() > nextSeek && video.duration - video.currentTime > 5) {
      const jump = Math.min(8, video.duration / 10);
      video.currentTime = Math.min(video.duration - 3, video.currentTime + jump);
      nextSeek = Date.now() + 4000;
    }

    if (Date.now() - lastProgressUpdate > 5000) {
      lastProgressUpdate = Date.now();
      const percent = Math.round((video.currentTime / video.duration) * 100);
      log(`${plan.label}: ${percent}% media position. This is not verified quest credit.`, 'info', false);
    }
  }

  video.style.opacity = '';
  status('Video reached its end. Checking for a claimable reward…', 'info');
}

async function attemptCollection(run) {
  run.phase = 'collection';
  const deadline = Date.now() + CLAIM_WAIT_MS;

  while (Date.now() < deadline) {
    checkRun(run);

    const error = findError();

    if (error) {
      throw new Error(`Collection error: ${error}`);
    }

    const claimButton = findClaimButton();

    if (claimButton) {
      if (document.getElementById('orbs-skip-auto-claim').checked) {
        claimButton.click();
        status('Clicked the enabled claim button once. Checking result…', 'info');

        await sleep(3500, run);

        const postClickError = findError();

        if (postClickError) {
          throw new Error(`Collection error: ${postClickError}`);
        }
      } else {
        claimButton.scrollIntoView({ block: 'center', behavior: 'smooth' });
        status('Enabled claim button found. Click it in Discord.', 'info');
      }

      status(
        'Claim action attempted. This does not prove orbs were received—confirm in Discord before recording them.',
        'warning'
      );

      return true;
    }

    await sleep(500, run);
  }

  return false;
}

async function runAutoFallback() {
  if (active) {
    status('A playback attempt is already running.', 'error');
    return;
  }

  if (!selectedVideo?.isConnected) {
    status('No quest video is selected. Open and start a quest video first.', 'error');
    return;
  }

  const video = selectedVideo;

  const run = {
    video,
    planIndex: 0,
    phase: 'playback',
    controller: new AbortController(),
    original: {
      rate: video.playbackRate,
      muted: video.muted,
      opacity: video.style.opacity
    }
  };

  active = run;
  pendingCaptcha = null;

  try {
    for (let index = 0; index < PLANS.length; index++) {
      run.planIndex = index;

      try {
        await playWithPlan(run, PLANS[index]);

        const collected = await attemptCollection(run);

        if (collected) {
          status('Automatic fallback finished after a claim action.', 'success');
          return;
        }

        status('No enabled claim button appeared. Trying the next fallback method…', 'warning');
      } catch (error) {
        if (['CAPTCHA', 'CANCELLED', 'VIDEO_REMOVED'].includes(error.message)) {
          throw error;
        }

        status(`Attempt ${index + 1} failed: ${error.message}`, 'error');
      }

      restoreVideo(video);

      if (index < PLANS.length - 1) {
        status(`Automatically falling back to: ${PLANS[index + 1].label}`, 'info');
        await sleep(2000, run);
      }
    }

    status(
      'Automatic fallback could not establish a claimable result. Try “Normal 1x” and keep Discord visible.',
      'error',
      true
    );
  } catch (error) {
    interruptRun(run, error);
  } finally {
    if (active === run) {
      restoreVideo(run.video);
      active = null;
      updateSelectedVideoUi();
    }
  }
}

async function runNormal() {
  if (active) {
    status('A playback attempt is already running.', 'error');
    return;
  }

  if (!selectedVideo?.isConnected) {
    status('No quest video is selected. Open and start a quest video first.', 'error');
    return;
  }

  const video = selectedVideo;

  const run = {
    video,
    planIndex: 5,
    phase: 'playback',
    controller: new AbortController(),
    original: {
      rate: video.playbackRate,
      muted: video.muted,
      opacity: video.style.opacity
    }
  };

  active = run;
  pendingCaptcha = null;

  try {
    await playWithPlan(run, NORMAL_PLAN);
    await attemptCollection(run);
  } catch (error) {
    interruptRun(run, error);
  } finally {
    if (active === run) {
      restoreVideo(run.video);
      active = null;
      updateSelectedVideoUi();
    }
  }
}

async function runSinglePlan(planIndex) {
  if (active) {
    status('A playback attempt is already running.', 'error');
    return;
  }

  if (!selectedVideo?.isConnected) {
    status('No quest video is selected. Open and start a quest video first.', 'error');
    return;
  }

  const plan = PLANS[planIndex];
  const video = selectedVideo;

  const run = {
    video,
    planIndex,
    phase: 'playback',
    controller: new AbortController(),
    original: {
      rate: video.playbackRate,
      muted: video.muted,
      opacity: video.style.opacity
    }
  };

  active = run;
  pendingCaptcha = null;

  try {
    await playWithPlan(run, plan);
    await attemptCollection(run);
  } catch (error) {
    interruptRun(run, error);
  } finally {
    if (active === run) {
      restoreVideo(run.video);
      active = null;
      updateSelectedVideoUi();
    }
  }
}

async function retryClaim() {
  if (active) {
    status('Stop the current playback attempt before retrying collection.', 'error');
    return;
  }

  if (!selectedVideo?.isConnected) {
    status('No quest video is selected.', 'error');
    return;
  }

  const run = {
    video: selectedVideo,
    planIndex: lastKnownPlanIndex(),
    phase: 'collection',
    controller: new AbortController(),
    original: {
      rate: selectedVideo.playbackRate,
      muted: selectedVideo.muted,
      opacity: selectedVideo.style.opacity
    }
  };

  active = run;

  try {
    const collected = await attemptCollection(run);

    if (!collected) {
      status('No enabled claim button was found. Collection was not completed.', 'error');
    }
  } catch (error) {
    interruptRun(run, error);
  } finally {
    if (active === run) {
      active = null;
    }
  }
}

function lastKnownPlanIndex() {
  return pendingCaptcha?.planIndex ?? 0;
}

async function copyLogs() {
  const text = logs.join('\n') || 'No log entries yet.';

  try {
    await navigator.clipboard.writeText(text);
    toast('Activity log copied to clipboard.', 'success');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    toast('Activity log copied using fallback clipboard method.', 'success');
  }
}

function createPanel() {
  const panel = document.createElement('section');
  panel.id = 'orbs-skip-panel';
  panel.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    width: 340px;
    max-width: calc(100vw - 32px);
    background: #1e1f22;
    color: #dbdee1;
    border: 1px solid #2e3035;
    border-radius: 16px;
    padding: 14px;
    font: 13px/1.45 "gg sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    box-shadow: 0 12px 36px rgba(0, 0, 0, .45);
  `;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="https://www.google.com/s2/favicons?sz=64&domain=discord.com" alt="" style="width:18px;height:18px;border-radius:4px;">
        <strong style="color:#fff;">Discord Orbs Video Skip</strong>
      </div>
      <button data-action="collapse" style="${smallButtonStyle()}">−</button>
    </div>

    <div id="orbs-skip-body">
      <div style="
        margin: 12px 0;
        padding: 12px;
        border-radius: 12px;
        background: #2b2d31;
        border: 1px solid #3f4147;
      ">
        <div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#949ba4;">
          Step 1 — Detect quest video
        </div>
        <div id="orbs-skip-selected" style="margin-top:6px;color:#fff;font-weight:600;">
          No quest video detected yet.
        </div>
        <div style="margin-top:6px;color:#b5bac1;">
          Open a quest video and press its “I started watching…” button. Detection is automatic.
        </div>
      </div>

      <div id="orbs-skip-counter" style="
        margin-bottom: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: #2b2d31;
        border: 1px solid #3f4147;
        color: #fff;
        font-weight: 700;
      "></div>

      <div id="orbs-skip-status" role="status" style="
        min-height: 38px;
        margin-bottom: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: #2b2d31;
        border: 1px solid #3f4147;
        color: #dbdee1;
      ">Waiting for a quest video…</div>

      <button data-action="start" id="orbs-skip-start" style="${primaryButtonStyle('#5865f2')}" disabled>
        ▶ Start auto fallback
      </button>

      <div style="
        margin: 12px 0 8px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: #949ba4;
      ">
        Manual tools — use only if auto fallback fails
      </div>

      <div id="orbs-skip-manual" style="opacity:.55;pointer-events:none;">
        <button data-action="normal" style="${buttonStyle('#23a55a')}">▶ Normal 1x</button>
        <button data-action="plan-0" style="${buttonStyle('#4e5058')}">1 · Muted + hidden + 16x + seeks</button>
        <button data-action="plan-1" style="${buttonStyle('#4e5058')}">2 · Muted + hidden + 16x</button>
        <button data-action="plan-2" style="${buttonStyle('#4e5058')}">3 · Visible + audible + 16x</button>
        <button data-action="plan-3" style="${buttonStyle('#4e5058')}">4 · Visible + audible + 4x</button>
        <button data-action="plan-4" style="${buttonStyle('#4e5058')}">5 · Visible + audible + 2x</button>
      </div>

      <div style="
        margin: 12px 0 8px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: #949ba4;
      ">
        Recovery and collection
      </div>

      <button data-action="resume" style="${buttonStyle('#f0b232')}">Resume after CAPTCHA</button>
      <button data-action="claim" style="${buttonStyle('#f0b232')}">Retry claim</button>
      <button data-action="stop" style="${buttonStyle('#da373c')}">■ Stop</button>

      <label style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 12px 0;
        color: #b5bac1;
      ">
        <input id="orbs-skip-auto-claim" type="checkbox">
        Automatically click an enabled claim button
      </label>

      <div style="display:flex;gap:8px;">
        <button data-action="copy" style="${buttonStyle('#4e5058')}">📋 Copy logs</button>
        <button data-action="export" style="${buttonStyle('#4e5058')}">⬇ Export log</button>
      </div>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;color:#b5bac1;">Activity log</summary>
        <pre id="orbs-skip-log" style="
          white-space: pre-wrap;
          max-height: 170px;
          overflow: auto;
          margin: 8px 0 0;
          padding: 8px;
          border-radius: 8px;
          background: #111214;
          color: #b5bac1;
          font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        "></pre>
      </details>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;color:#b5bac1;">How fallback works</summary>
        <div style="margin-top:8px;color:#b5bac1;">
          Auto fallback starts with the most aggressive playback attempt and automatically moves to less
          aggressive methods if an attempt does not produce a claimable result. The final fallback is normal
          1x playback. Manual tools are for testing one specific method only.
        </div>
      </details>

      <div style="margin-top:10px;font-size:11px;color:#949ba4;">
        CAPTCHAs are not errors. Complete them manually when prompted. “Visually hidden” does not make
        playback undetectable. Confirm orbs in Discord before recording them.
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  const toastHost = document.createElement('div');
  toastHost.id = 'orbs-skip-toast-host';
  toastHost.style.cssText = `
    position: fixed;
    right: 20px;
    top: 20px;
    z-index: 2147483647;
    max-width: 360px;
    pointer-events: none;
  `;
  document.body.appendChild(toastHost);

  panel.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.action;
    if (!action) return;

    if (action === 'collapse') {
      const body = document.getElementById('orbs-skip-body');
      body.hidden = !body.hidden;
      event.target.textContent = body.hidden ? '+' : '−';
      return;
    }

    if (action === 'start') runAutoFallback();
    if (action === 'normal') runNormal();
    if (action === 'stop') stopActiveRun();
    if (action === 'claim') retryClaim();
    if (action === 'copy') copyLogs();

    if (action === 'resume') {
      if (detectCaptcha()) {
        status('CAPTCHA is still present. Complete or dismiss it first.', 'captcha');
        return;
      }

      if (pendingCaptcha) {
        const pending = pendingCaptcha;
        pendingCaptcha = null;

        if (pending.phase === 'collection') {
          retryClaim();
        } else {
          runSinglePlan(pending.planIndex);
        }
      } else {
        status('There is no CAPTCHA-paused attempt to resume.', 'info');
      }
    }

    if (action === 'confirm') {
      if (active) {
        status('Stop the current attempt before recording a confirmed reward.', 'error');
        return;
      }

      const questId = prompt('Enter a unique quest name or identifier. Only record rewards actually received:');

      if (!questId?.trim()) return;

      const normalisedId = questId.trim().toLowerCase();

      if (state.completedQuestIds.includes(normalisedId)) {
        status('That quest has already been recorded in this browser session.', 'warning');
        return;
      }

      const amount = prompt('Exact number of orbs Discord confirmed you received:');

      if (amount === null) return;

      const orbs = Number(amount);

      if (!Number.isSafeInteger(orbs) || orbs <= 0 || orbs > 100000) {
        status('Enter a positive whole-number orb amount.', 'error');
        return;
      }

      state.completedQuestIds.push(normalisedId);
      state.confirmedOrbs += orbs;
      saveState();
      updateCounter();
      toast(`Recorded ${orbs} manually confirmed orbs.`, 'success');
    }

    if (action === 'export') {
      const blob = new Blob([logs.join('\n') || 'No log entries yet.'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'discord-orbs-video-skip-log.txt';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    if (action.startsWith('plan-')) {
      runSinglePlan(Number(action.replace('plan-', '')));
    }
  });
}

function smallButtonStyle() {
  return `
    all: unset;
    cursor: pointer;
    color: #b5bac1;
    font-size: 16px;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 8px;
  `;
}

function primaryButtonStyle(colour) {
  return `
    all: unset;
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: ${colour};
    color: #fff;
    font-weight: 700;
    text-align: center;
    cursor: pointer;
    transition: filter .15s ease;
  `;
}

function buttonStyle(colour) {
  return `
    all: unset;
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 6px;
    padding: 9px 12px;
    border-radius: 12px;
    background: ${colour};
    color: #fff;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    transition: filter .15s ease;
  `;
}

function monitorVideoDetection() {
  setInterval(() => {
    resetDailyCounterIfNeeded();
    updateCounter();

    const video = findActiveVideo();

    if (video && video !== selectedVideo) {
      selectedVideo = video;
      selectedScope = getQuestScope(video);
      status('Quest video detected automatically.', 'success');
    }

    if (!video && !active) {
      selectedVideo = null;
      selectedScope = null;
    }

    updateSelectedVideoUi();

    const startedButton = findStartedWatchingButton();

    if (startedButton && !active) {
      log('“I started watching…” button detected.', 'info', false);
    }
  }, 750);
}

function init() {
  if (!document.body) {
    setTimeout(init, 300);
    return;
  }

  createPanel();
  updateCounter();
  updateSelectedVideoUi();
  monitorVideoDetection();

  window.addEventListener('pagehide', () => stopActiveRun(true));

  status('Ready. Open a quest video and press “I started watching…”.', 'info');
}

init();
})();
