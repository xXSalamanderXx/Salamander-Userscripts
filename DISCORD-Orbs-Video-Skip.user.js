// ==UserScript==
// @name         DISCORD-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      3.0.2
// @description  Bypass ads for Discord Orbs with this smart helper script.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://discord.com/assets/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==
/* Manual start only. No API calls, automatic claims, or CAPTCHA solving.
 * No route polling, chat style changes, scroll writes, or automatic focus.
 * v3.0.2: removed Popover/top-layer usage and made route-change handling
 * asynchronous so it cannot interfere with Discord chat scroll handling.
 */
(() => {
'use strict';
if (self !== top) return;
const KEY = Symbol.for('orbs.helper.lifecycle.v302');
if (window[KEY]) return;
const state = {session:null, suspended:false, pending:false};
window[KEY] = state;
const quest = () => /^\/quest-home\/?$/.test(location.pathname);
const FEED = '[data-jump-section="global"]';
const PLAYER = '[data-testid="discord-web-video-player-container"],[data-testid="discord-web-video-player-frame"]';
const VIDEO = 'video[data-testid="discord-web-video-player-video"],[data-testid="discord-web-video-player-container"] video,[data-testid="discord-web-video-player-frame"] video';
const PLANS = [{rate:16,seek:true},{rate:16},{rate:8},{rate:4},{rate:2},{rate:1}];
let minimized = false;
function detach() {
  const x = state.session;
  if (!x) return;
  state.session = null;
  x.controller.abort();
  x.run?.abort();
  x.host.remove();
}
function visible(e) {
  if (!e.isConnected || e.closest('[hidden],[aria-hidden="true"]')) return false;
  const s = getComputedStyle(e);
  return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length > 0;
}
function mount() {
  if (state.session || !quest() || state.suspended || !document.body) return;
  const host = document.createElement('div');
  host.id = 'orbs-simple-host';
  // Plain fixed element: never uses the Popover API or the top layer, which
  // can interfere with Discord's virtualised chat scrolling/focus handling.
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:auto 18px 18px auto!important;margin:0!important;padding:0!important;border:0!important;width:max-content!important;height:max-content!important;max-width:calc(100vw - 36px)!important;background:transparent!important;overflow:visible!important;z-index:2147483647!important;pointer-events:auto!important;contain:layout style!important;';
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = `<style>
  *{box-sizing:border-box}[hidden]{display:none!important}
  section{width:330px;max-width:calc(100vw - 36px);max-height:calc(100dvh - 36px);overflow:auto;color:#dbdee1;font:13px/1.5 system-ui;background:linear-gradient(145deg,#272232,#191a22);border:1px solid #a978ee55;border-radius:16px;box-shadow:0 16px 50px #0009;padding:14px}
  header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:0;font-size:14px;color:white}
  button{cursor:pointer;color:white;background:#6539a8;border:0;border-radius:12px;padding:10px}button:focus-visible{outline:2px solid #b9c2ff}
  #min{width:30px;height:30px;padding:0;background:#ffffff09;font-size:21px}
  #watch{width:100%;padding:16px 10px;font:700 15px system-ui;background:linear-gradient(125deg,#6539a8,#4937a0)}
  small{display:block;margin-top:9px;color:#b5bac1}#status{padding:10px;background:#ffffff09;border-radius:10px;margin:12px 0;overflow-wrap:anywhere}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;background:#111214;border-radius:9px;padding:10px;user-select:text}
  #orb{width:50px;height:50px;border-radius:50%;border:1px solid #ddaaffaa;background:radial-gradient(circle at 33% 25%,#efd2ff,#ba7aff 18%,#7d40cf 48%,#302268 85%);box-shadow:0 0 22px #a459ff70;padding:0}
  #copy{background:none;color:#c8a5ff;text-decoration:underline;padding:5px 0}
  </style><section id="panel"><header><h2>Discord Orbs Video Skip</h2><button id="min" aria-label="Minimise to orb">−</button></header><button id="watch">I started watching</button><small>Manual playback helper. Claim rewards yourself in Discord.</small><div id="status" role="status">Open a quest video, then start the helper.</div><details><summary>Logs</summary><pre id="logs">No logs yet.</pre></details><button id="copy">Copy logs</button></section><button id="orb" hidden aria-label="Open Discord Orbs Video Skip"></button>`;
  const controller = new AbortController();
  const x = {host,controller,run:null};
  state.session = x;
  const $ = id => root.getElementById(id);
  const valid = () => state.session===x && quest() && !controller.signal.aborted;
  const lines=[];
  function log(text) {
    if(!valid()) return;
    lines.push(`[${new Date().toISOString()}] ${text}`);
    if(lines.length>100) lines.shift();
    $('logs').textContent=lines.join('\n'); $('status').textContent=text;
  }
  function toggle(value) {if(valid()){minimized=value;$('panel').hidden=value;$('orb').hidden=!value;}}
  function listen(id,fn) {$(id).addEventListener('click',fn,{signal:controller.signal});}
  listen('min',()=>toggle(true)); listen('orb',()=>toggle(false));
  listen('copy',async()=>{
    try {await navigator.clipboard.writeText(lines.join('\n'));log('Logs copied.');}
    catch {log('Clipboard blocked. Select text in Logs manually.');}
  });
  listen('watch',async()=>{
    if(!valid()) return;
    if(x.run){x.run.abort();return;}
    // Exclude chat-fed players before any visibility reads or media mutations.
    const players=[];
    for(const v of document.querySelectorAll(VIDEO)){
      if(!v.closest(FEED) && !v.loop && !v.error && Number.isFinite(v.duration) && v.duration>0 && visible(v)) players.push(v);
    }
    if(players.length!==1){log(`Found ${players.length} loaded non-chat players; keep exactly one quest video open.`);return;}
    const video=players[0];
    const container=video.closest(PLAYER);
    if(!container || container.closest(FEED) || container.querySelector(FEED)) {log('Safe quest player container not identified.');return;}
    // Only a dedicated dialog without a message feed may broaden the scope.
    const dialog=video.closest('[role="dialog"],dialog');
    const scope=dialog && !dialog.closest(FEED) && !dialog.querySelector(FEED) ? dialog : container;
    const run=new AbortController();x.run=run;
    const original={playbackRate:video.playbackRate,muted:video.muted,volume:video.volume};
    const src=video.currentSrc||video.src;
    let restored=false, captchaAt=-Infinity, captchaCached=false;
    function restore(){
      if(restored)return;restored=true;
      for(const [key,value] of Object.entries(original)){try{video[key]=value;}catch{}}
    }
    run.signal.addEventListener('abort',restore,{once:true});
    function check(){
      if(!valid()||run.signal.aborted)throw Error('Stopped.');
      if(!video.isConnected || !scope.isConnected || video.closest(FEED) || (video.currentSrc||video.src)!==src)throw Error('Player changed; stopped.');
    }
    function captcha(){
      if(performance.now()-captchaAt<1200)return captchaCached;
      captchaAt=performance.now();
      captchaCached=false;
      for(const e of scope.querySelectorAll('iframe,[role="alert"]')){
        if(e.closest(FEED))continue;
        const match=e.tagName==='IFRAME' ? /captcha|challenges\.cloudflare/i.test(e.getAttribute('src')+' '+e.title) : /verify (?:that )?you are human|captcha|human verification/i.test(e.textContent||'');
        if(match && visible(e)){captchaCached=true;break;}
      }
      return captchaCached;
    }
    function guard(){check();if(captcha())throw Error('Human verification detected. Complete it manually in Discord.');}
    function delay(ms){
      check();
      return new Promise((resolve,reject)=>{
        const abort=()=>{clearTimeout(timer);reject(Error('Stopped.'));};
        const timer=setTimeout(()=>{run.signal.removeEventListener('abort',abort);resolve();},ms);
        run.signal.addEventListener('abort',abort,{once:true});
      });
    }
    async function play(){
      let timer,abort;
      try{
        await Promise.race([video.play(),new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(Error('Playback timed out.')),10000);
          abort=()=>reject(Error('Stopped.'));
          run.signal.addEventListener('abort',abort,{once:true});
        })]);
      }finally{clearTimeout(timer);if(abort)run.signal.removeEventListener('abort',abort);}
      guard();
    }
    function claim(){
      const buttons=[];
      for(const b of scope.querySelectorAll('button,[role="button"]')){
        if(b.closest(FEED))continue;
        if(/^(claim|collect)(?:\s+(?:reward|orbs?))?(?:\s*\(?[\d,]+\)?)?$/i.test((b.getAttribute('aria-label')||b.textContent||'').trim()) && visible(b)) buttons.push(b);
      }
      if(!buttons.length)return 'missing';
      for(const b of buttons){
        if(!b.disabled && !b.hasAttribute('disabled') && b.getAttribute('aria-disabled')!=='true') return 'ready';
      }
      return 'locked';
    }
    $('watch').textContent='Stop attempt';
    try{
      guard();video.muted=true;
      for(let i=0;i<PLANS.length;i++){
        guard();
        if(claim()==='ready'){log('Claim appears enabled. Claim manually in Discord.');break;}
        const plan=PLANS[i];log(`Attempt ${i+1}/${PLANS.length}: ${plan.rate}x${plan.seek?' with incremental seeks':''}.`);
        video.playbackRate=plan.rate;video.currentTime=0;await play();
        let last=video.currentTime,moved=Date.now(),seekAt=Date.now()+4000;
        const deadline=Date.now()+Math.max(120000,(video.duration+90)*1000);
        while(!video.ended){
          await delay(500);guard();
          if(video.error)throw Error(`Media error ${video.error.code}.`);
          if(video.currentTime>last+.02){last=video.currentTime;moved=Date.now();}
          if(Date.now()-moved>20000 || Date.now()>deadline)throw Error('Playback stalled or timed out. Watch normally.');
          if(video.paused && !video.ended)throw Error('Playback paused; stopped.');
          if(plan.seek && Date.now()>seekAt && video.duration-video.currentTime>5){video.currentTime=Math.min(video.duration-3,video.currentTime+Math.min(8,video.duration/10));seekAt=Date.now()+4000;}
        }
        let result='missing';
        for(let n=0;n<20;n++){await delay(500);guard();result=claim();if(result==='ready')break;}
        if(result==='ready'){log('Claim appears enabled. Claim manually in Discord.');break;}
        if(result==='missing'){log('Claim button not identified in safe player scope. Check Discord manually.');break;}
        if(i===PLANS.length-1){log('Completion not verified. Watch normally in Discord.');break;}
        log('Claim still locked. Waiting before slower fallback.');await delay(10000);
      }
    }catch(e){log(e.message);}
    finally{restore();if(x.run===run)x.run=null;if(valid())$('watch').textContent='I started watching';}
  });
  // The only added node is outside #app-mount, never in a Discord scroller.
  document.body.append(host);toggle(minimized);
}
function reconcile(){
  if(state.suspended || !quest()){detach();return;}
  if(state.session && !state.session.host.isConnected)detach();
  if(!state.session){try{mount();}catch(e){detach();console.warn('[Orbs] Mount failed:',e);}}
}
// Route changes are handled asynchronously (rAF-coalesced) so a synchronous
// history.replaceState call issued during Discord's scroll/render cycle can
// never trigger DOM mounting/removal in the middle of a scroll gesture.
function scheduleReconcile(){
  if(state.pending) return;
  state.pending = true;
  requestAnimationFrame(()=>{state.pending=false;reconcile();});
}
// Prefer the Navigation API where available; fall back to history patching.
let navigationHandler = null;
const wrappers=[];
if (window.navigation && typeof window.navigation.addEventListener === 'function') {
  navigationHandler = () => scheduleReconcile();
  window.navigation.addEventListener('currententrychange', navigationHandler);
} else {
  for(const name of ['pushState','replaceState']){
    const previous=history[name];
    function wrapped(...args){
      const result=Reflect.apply(previous,this,args);
      scheduleReconcile();
      return result;
    }
    try{history[name]=wrapped;wrappers.push({name,previous,wrapped});}catch{}
  }
}
function onShow(){state.suspended=false;scheduleReconcile();}
function onHide(){state.suspended=true;detach();}
window.addEventListener('popstate',scheduleReconcile);
window.addEventListener('pageshow',onShow);
window.addEventListener('pagehide',onHide);
// One-shot readiness retry, not a DOM observer or a recurring timer.
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleReconcile,{once:true});
state.destroy=()=>{
  detach();
  window.removeEventListener('popstate',scheduleReconcile);
  window.removeEventListener('pageshow',onShow);
  window.removeEventListener('pagehide',onHide);
  document.removeEventListener('DOMContentLoaded',scheduleReconcile);
  if(navigationHandler && window.navigation) window.navigation.removeEventListener('currententrychange',navigationHandler);
  for(const {name,previous,wrapped} of wrappers)if(history[name]===wrapped)history[name]=previous;
  delete window[KEY];
};
reconcile();
})();
