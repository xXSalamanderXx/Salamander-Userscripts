// ==UserScript==
// @name         DISCORD-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      3.0.0
// @description  Bypass ads for Discord Orbs with this smart helper script.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
/* Manual playback helper. No API requests or automatic claims.
 * The only off-route activity is a URL check every 500 ms.
 * No chat selectors, global CSS, scroll handlers, focus calls, history patches,
 * modal dialogs, body/html modifications, or document mutation observers.
 */
(() => {
  'use strict';
  if (self !== top) return;
  const KEY = Symbol.for('orbs.helper.lifecycle.v3');
  if (window[KEY]) return;
  const state = { session: null };
  window[KEY] = state;
  const onQuest = () => location.pathname === '/quest-home' || location.pathname === '/quest-home/';
  let minimized = false;

  function unmount() {
    const x = state.session;
    if (!x) return;
    state.session = null;
    x.controller.abort();
    if (x.run) x.run.abort();
    try { if (x.host.matches(':popover-open')) x.host.hidePopover(); } catch {}
    x.host.remove();
  }

  function mount() {
    if (!onQuest() || !document.body || state.session) return;
    const host = document.createElement('div');
    host.id = 'orbs-simple-host';
    // A non-modal manual popover uses the browser top layer, not Discord's
    // stacking contexts. It does not make the app inert or lock scrolling.
    const topLayer = typeof host.showPopover === 'function';
    if (topLayer) host.setAttribute('popover', 'manual');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:auto 18px 18px auto!important;margin:0!important;padding:0!important;border:0!important;width:max-content!important;height:max-content!important;max-width:calc(100vw - 36px)!important;background:transparent!important;overflow:visible!important;z-index:2147483647!important;pointer-events:auto!important;';
    const root = host.attachShadow({mode:'closed'});
    root.innerHTML = `<style>
      :host::backdrop{display:none!important;pointer-events:none!important}
      *{box-sizing:border-box} [hidden]{display:none!important}
      section{width:330px;max-width:calc(100vw - 36px);max-height:calc(100dvh - 36px);overflow:auto;color:#dbdee1;font:13px/1.5 system-ui;background:linear-gradient(145deg,#272232,#191a22);border:1px solid #a978ee55;border-radius:16px;box-shadow:0 16px 50px #0009;padding:14px}
      header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:0;font-size:14px;color:white}
      button{cursor:pointer;color:white;background:#6539a8;border:0;border-radius:12px;padding:10px}button:focus-visible{outline:2px solid #b9c2ff}
      #min{width:30px;height:30px;padding:0;background:#ffffff09;font-size:21px}
      #watch{width:100%;padding:16px 10px;font:700 15px system-ui;background:linear-gradient(125deg,#6539a8,#4937a0)}
      small{display:block;margin-top:9px;color:#b5bac1}#status{padding:10px;background:#ffffff09;border-radius:10px;margin:12px 0;overflow-wrap:anywhere}
      pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;background:#111214;border-radius:9px;padding:10px;user-select:text}
      #orb{width:50px;height:50px;border-radius:50%;border:1px solid #ddaaffaa;background:radial-gradient(circle at 33% 25%,#efd2ff,#ba7aff 18%,#7d40cf 48%,#302268 85%);box-shadow:0 0 22px #a459ff70;padding:0}
      #copy{background:none;color:#c8a5ff;text-decoration:underline;padding:5px 0}
      </style><section id="panel"><header><h2>Discord Orbs Video Skip</h2><button id="min" aria-label="Minimise to orb">−</button></header><button id="watch">I started watching</button><small>Manual playback attempts only. Completion and rewards are controlled by Discord.</small><div id="status" role="status">Open a quest video, then start the helper.</div><details><summary>Logs</summary><pre id="logs">No logs yet.</pre></details><button id="copy">Copy logs</button></section><button id="orb" hidden aria-label="Open Discord Orbs Video Skip"></button>`;
    const controller = new AbortController();
    const x = {host,controller,run:null};
    const $ = id => root.getElementById(id);
    const lines = [];
    const valid = () => state.session === x && onQuest() && !controller.signal.aborted;
    const log = text => {
      if (!valid()) return;
      lines.push(`[${new Date().toISOString()}] ${text}`);
      if (lines.length > 100) lines.shift();
      $('logs').textContent = lines.join('\n'); $('status').textContent = text;
    };
    function toggle(value) {
      if (!valid()) return;
      minimized = value; $('panel').hidden = value; $('orb').hidden = !value;
    }
    const listen = (id, fn) => $(id).addEventListener('click',fn,{signal:controller.signal});
    listen('min',()=>toggle(true)); listen('orb',()=>toggle(false));
    listen('copy',async()=> {
      try { await navigator.clipboard.writeText(lines.join('\n')); log('Logs copied.'); }
      catch { log('Clipboard unavailable. Select text in Logs manually.'); }
    });
    listen('watch',async()=> {
      if (!valid()) { unmount(); return; }
      if (x.run) { x.run.abort(); return; }
      const candidates = [...document.querySelectorAll('video[data-testid="discord-web-video-player-video"], [data-testid="discord-web-video-player-container"] video')]
        .filter(v=>!v.loop && !v.error && Number.isFinite(v.duration) && v.duration>0 && v.getClientRects().length && getComputedStyle(v).visibility !== 'hidden');
      if (candidates.length !== 1) { log(`Found ${candidates.length} loaded quest players. Keep exactly one quest video open.`); return; }
      const v = candidates[0];
      const scope = v.closest('[role="dialog"],dialog') || v.closest('[data-testid="discord-web-video-player-container"]');
      if (!scope) { log('Player container not identified. No changes made.'); return; }
      const run = new AbortController(); x.run = run;
      const original = {rate:v.playbackRate,muted:v.muted,volume:v.volume};
      const src = v.currentSrc || v.src;
      let restored = false;
      function restore() {
        if (restored) return; restored = true;
        for (const [key,value] of Object.entries({playbackRate:original.rate,muted:original.muted,volume:original.volume})) {
          try { v[key] = value; } catch {}
        }
      }
      run.signal.addEventListener('abort',restore,{once:true});
      function check() {
        if (!valid() || run.signal.aborted) throw Error('Stopped.');
        if (!v.isConnected || !scope.isConnected || (v.currentSrc || v.src)!==src) throw Error('Player changed; stopped.');
      }
      function delay(ms) {
        check();
        return new Promise((resolve,reject)=> {
          const abort = ()=>{clearTimeout(timer);reject(Error('Stopped.'));};
          const timer = setTimeout(()=>{run.signal.removeEventListener('abort',abort);resolve();},ms);
          run.signal.addEventListener('abort',abort,{once:true});
        });
      }
      async function play() {
        let timer, abort;
        try {
          await Promise.race([v.play(),new Promise((_,reject)=> {
            timer=setTimeout(()=>reject(Error('Playback start timed out.')),10000);
            abort=()=>reject(Error('Stopped.'));
            run.signal.addEventListener('abort',abort,{once:true});
          })]);
        } finally { clearTimeout(timer); if(abort) run.signal.removeEventListener('abort',abort); }
        check();
      }
      function claim() {
        const buttons=[...scope.querySelectorAll('button,[role="button"]')].filter(b=>/^(claim|collect)(?:\s+(?:reward|orbs?))?(?:\s*\(?[\d,]+\)?)?$/i.test((b.getAttribute('aria-label')||b.textContent||'').trim()));
        if (!buttons.length) return 'missing';
        return buttons.some(b=>!b.disabled && b.getAttribute('aria-disabled')!=='true')?'ready':'locked';
      }
      $('watch').textContent='Stop attempt';
      try {
        check();
        // Never hide the video or touch its layout/style. Only the selected
        // quest media element's playback/audio properties may be changed.
        v.muted=true;
        const plans=[{rate:16,seek:true},{rate:16},{rate:8},{rate:4},{rate:2},{rate:1}];
        for (let i=0;i<plans.length;i++) {
          check();
          if (claim()==='ready') {log('Claim appears enabled. Claim manually in Discord.');break;}
          const plan=plans[i];
          log(`Attempt ${i+1}/${plans.length}: ${plan.rate}x${plan.seek?' with incremental seeks':''}.`);
          v.playbackRate=plan.rate; v.currentTime=0;
          await play();
          let last=v.currentTime, moved=Date.now(), seekAt=Date.now()+4000;
          const end=Date.now()+Math.max(120000,(v.duration+90)*1000);
          while (!v.ended) {
            await delay(500); check();
            if(v.error) throw Error(`Media error ${v.error.code}.`);
            if(v.currentTime>last+.02) {last=v.currentTime;moved=Date.now();}
            if(Date.now()-moved>20000 || Date.now()>end) throw Error('Playback stalled or timed out; watch normally.');
            if(v.paused) throw Error('Playback paused by Discord or the user; stopped.');
            if(plan.seek && Date.now()>seekAt && v.duration-v.currentTime>5) {
              v.currentTime=Math.min(v.duration-3,v.currentTime+Math.min(8,v.duration/10));seekAt=Date.now()+4000;
            }
          }
          let result='missing';
          for(let n=0;n<20;n++) { await delay(500);check();result=claim();if(result==='ready') break; }
          if(result==='ready') {log('Claim appears enabled. Claim manually in Discord.');break;}
          if(result==='missing') {log('Claim button not identifiable. Check Discord manually.');break;}
          if(i===plans.length-1) {log('Completion not verified. Watch normally in Discord.');break;}
          log('Claim still locked. Waiting before slower fallback.'); await delay(10000);
        }
      } catch(e) { log(e.message); }
      finally {
        restore();
        if(x.run===run) x.run=null;
        if(valid()) $('watch').textContent='I started watching';
      }
    });
    state.session=x;
    document.body.append(host);
    toggle(minimized);
    if(topLayer) {
      try {host.showPopover();}
      catch(e) {host.removeAttribute('popover');log(`Top-layer unavailable: ${e.message}`);}
    }
    // No autofocus, focus restoration, dragging, resize or scroll listeners.
  }

  function reconcile() {
    if(!onQuest()) { if(state.session) unmount(); return; }
    if(state.session && !state.session.host.isConnected) unmount();
    if(!state.session) {
      try {mount();} catch(e) {unmount();console.warn('[Orbs] Mount failed:',e);}
    }
  }
  // Kept across SPA transitions. No channel DOM reads, media queries, style
  // writes or layout measurements occur on off-route ticks.
  state.timer=setInterval(reconcile,500);
  reconcile();
})();
