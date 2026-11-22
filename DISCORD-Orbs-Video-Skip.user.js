// ==UserScript==
// @name         Discord-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      2.1.0
// @description  One-button quest playback with progressively slower retries and claim-readiness checks.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==
/* Manual start only. No API calls, visibility/clock spoofing, CAPTCHA solving,
   claim clicks, or reward accounting. Enabled claim control means ready to claim,
   NOT that a reward has been received. DOM matching is English-language heuristic.
   Fast/hidden/muted playback may not qualify; eligibility cannot be guaranteed. */
(() => {
'use strict';
if(window.top!==window.self||document.getElementById('orbs-simple-host'))return;
const CONFIG={toastMs:18000,claimWaitMs:30000,stallMs:20000,
 plans:[{rate:16,seek:true},{rate:16},{rate:8},{rate:4},{rate:2},{rate:1}]};
const host=document.createElement('div');host.id='orbs-simple-host';document.body.append(host);
const shadow=host.attachShadow({mode:'open'});
shadow.innerHTML=`<style>
:host{all:initial;color:#dbdee1;font:13px/1.5 system-ui}*{box-sizing:border-box}#panel{position:fixed;right:18px;bottom:18px;width:330px;max-width:calc(100vw - 20px);max-height:calc(100dvh - 20px);z-index:2147483646;background:#1e1f22;border:1px solid #41434a;border-radius:16px;box-shadow:0 10px 35px #0008;overflow:auto;padding:14px;contain:inline-size}h2{font-size:14px;margin:0 0 10px;color:white}button{font:700 15px system-ui;border:0;border-radius:12px;width:100%;padding:16px 10px;background:#5865f2;color:white;cursor:pointer}button:hover{filter:brightness(1.12)}button:focus-visible{outline:2px solid #b9c2ff;outline-offset:2px}small{display:block;margin-top:9px;font-size:11px;color:#b5bac1}#status{padding:10px;background:#2b2d31;border-radius:10px;margin:12px 0;overflow-wrap:anywhere}summary{cursor:pointer;color:#b5bac1}pre{font:11px/1.5 monospace;user-select:text;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;background:#111214;border-radius:9px;padding:10px}#toasts{position:fixed;right:18px;top:18px;width:min(360px,calc(100vw - 36px));max-height:45vh;overflow:hidden;z-index:2147483647;pointer-events:none}.toast{background:#343b75;color:white;border-radius:12px;padding:14px;margin-bottom:10px;overflow-wrap:anywhere}

[hidden]{display:none!important}
#panel{background:radial-gradient(ellipse at 10% 0%,#6937a52e,transparent 65%),linear-gradient(145deg,#272232,#191a22);border-color:#a978ee55;box-shadow:0 16px 50px #0009,0 0 25px #8b5cf612;padding:0;overflow:hidden;display:flex;flex-direction:column}
#header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 14px;cursor:grab;touch-action:none;user-select:none;flex-shrink:0;border-bottom:1px solid #b78af51c;background:linear-gradient(100deg,#9b5de511,transparent)}
#header:active{cursor:grabbing}#header h2{margin:0;min-width:0;font-weight:650;letter-spacing:.1px}
#minimise{width:30px;height:30px;padding:0;flex-shrink:0;background:#ffffff09;color:#d9cbef;border-radius:9px;font-size:21px;font-weight:400}
#content{padding:15px;overflow:auto;min-height:0;min-width:0}
#watch{border:1px solid transparent;background:linear-gradient(125deg,#6539a8,#4937a0) padding-box,linear-gradient(115deg,#e0aeff,#9564ff,#785cff) border-box;box-shadow:0 0 0 1px #b575ff33,0 0 17px #a058ff60,inset 0 1px 0 #ffffff1f;transition:box-shadow .18s ease,filter .18s ease}
#watch:hover{box-shadow:0 0 0 1px #cc99ff66,0 0 25px #a058ff90,inset 0 1px 0 #ffffff2f}
#status{background:linear-gradient(130deg,#ffffff07,#ffffff02);border:1px solid #ffffff0d;color:#ded6eb}
#orb{position:fixed;right:20px;bottom:20px;width:50px;height:50px;padding:0;border-radius:50%;z-index:2147483646;border:1px solid #ddaaffaa;background:radial-gradient(circle at 33% 25%,#efd2ff 0%,#ba7aff 18%,#7d40cf 48%,#302268 85%);box-shadow:0 0 22px #a459ff70,inset 0 0 10px #ffffff55;transition:transform .18s ease,box-shadow .18s ease}
#orb:hover{transform:translateY(-2px);box-shadow:0 0 30px #b578ffa0,inset 0 0 10px #ffffff55}
@media(prefers-reduced-motion:reduce){#watch,#orb{transition:none}}
</style><section id="panel"><header id="header"><h2>Discord Orbs Video Skip</h2><button id="minimise" title="Minimise to orb" aria-label="Minimise to orb">−</button></header><div id="content"><button id="watch">I started watching</button><small>Script will attempt to speed up or skip the video with fallback options provided automatically</small><div id="status" role="status">Open the Orbs video, then press the button.</div><details><summary>Logs · select text to copy</summary><pre id="log"></pre></details></div></section><button id="orb" hidden title="Open Discord Orbs Video Skip" aria-label="Open Discord Orbs Video Skip"></button><div id="toasts" aria-live="polite"></div>`;
const $=id=>shadow.getElementById(id),lines=[];let active=null,serial=0;
function log(text,kind='info',notify=true){const line=`[${new Date().toLocaleTimeString()}] [${kind.toUpperCase()}] ${text}`;lines.push(line);if(lines.length>300)lines.shift();$('log').textContent=lines.join('\n');$('status').textContent=text;console.info('[Orbs]',text);if(notify){const t=document.createElement('div');t.className='toast';t.textContent=text;if(kind==='error')t.style.background='#8d2936';if(kind==='captcha')t.style.background='#765018';$('toasts').append(t);while($('toasts').children.length>3)$('toasts').firstChild.remove();setTimeout(()=>t.remove(),CONFIG.toastMs);}}
function shown(e){if(!e?.isConnected||e.closest('[hidden],[aria-hidden="true"]'))return false;for(let n=e;n instanceof Element;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;}
function scopeFor(v){const dialog=v.closest('[role="dialog"],dialog');if(dialog)return dialog;let n=v.closest('[data-testid="discord-web-video-player-container"]');if(!n)return null;const base=n;for(let i=0;i<4&&n.parentElement&&n.parentElement!==document.body;i++){n=n.parentElement;const videos=n.querySelectorAll('video[data-testid="discord-web-video-player-video"]');if(videos.length>1)break;if(/\b(claim|collect|quest|orbs)\b/i.test(n.textContent||''))return n;}return base;}
function choose(){
 const all=[...document.querySelectorAll('video')];
 let vs=all.filter(v=>!v.loop&&shown(v)&&!v.error&&Number.isFinite(v.duration)&&v.duration>0&&v.matches('video[data-testid="discord-web-video-player-video"],[data-testid="discord-web-video-player-container"] video,[data-testid="discord-web-video-player-frame"] video'));
 const ds=vs.filter(v=>v.closest('[role="dialog"],dialog'));if(ds.length)vs=ds;
 log(`Manual selection: ${all.length} videos on page, ${vs.length} eligible non-looping Discord players.`,'info',false);
 if(!vs.length)throw Error('No loaded Orbs player found. Keep the quest video open and visible, then press I started watching again.');
 let v=vs[0];if(vs.length>1){const a=prompt('Choose the Orbs player number:\n'+vs.map((v,i)=>{const r=v.getBoundingClientRect();return `${i+1}: ${Math.round(v.duration)} sec, ${Math.round(r.width)}×${Math.round(r.height)}`;}).join('\n'));if(a===null)throw Error('Selection cancelled.');const i=Number(a)-1;if(!Number.isInteger(i)||!vs[i])throw Error('Invalid player number.');v=vs[i];}
 const scope=scopeFor(v);if(!scope)throw Error('Could not identify the player container.');return {video:v,scope,src:v.currentSrc||v.src};
}
function captcha(){return [...document.querySelectorAll('iframe')].find(f=>shown(f)&&f.getBoundingClientRect().height>80&&/captcha|challenges\.cloudflare/i.test(f.src+' '+f.title))||[...document.querySelectorAll('[role="dialog"],[role="alert"]')].find(e=>shown(e)&&/verify (?:that )?you are human|complete (?:the )?captcha|human verification/i.test(e.textContent||''));}
function check(r){if(active!==r||r.cancelled)throw Error('CANCELLED');if(captcha())throw Error('CAPTCHA');if(!r.video.isConnected||!r.scope.isConnected||(r.src&&(r.video.currentSrc||r.video.src)!==r.src))throw Error('PLAYER_CHANGED');}
async function wait(ms,r){const until=Date.now()+ms;while(Date.now()<until){check(r);await new Promise(ok=>setTimeout(ok,Math.min(200,until-Date.now())));}check(r);}
function claimState(r){const matches=[...r.scope.querySelectorAll('button,[role="button"]')].filter(b=>shown(b)&&/^(claim|collect)(?:\s+(?:reward|orbs?))?(?:\s*\(?[\d,]+\)?)?$/i.test((b.getAttribute('aria-label')||b.textContent||'').trim()));const enabled=matches.find(b=>!b.disabled&&!b.hasAttribute('disabled')&&b.getAttribute('aria-disabled')!=='true'&&!b.matches('[class*="disabled"],[class*="Disabled"]'));return enabled?'ready':matches.length?'locked':'missing';}
function errorText(r){return [...r.scope.querySelectorAll('[role="alert"]')].filter(shown).map(e=>(e.textContent||'').trim()).find(t=>/error|failed|try again|something went wrong/i.test(t))||'';}
function suppress(r){const v=r.video;v.muted=true;v.volume=0;v.style.setProperty('opacity','0','important');r.mask=true;}
function restore(r){r.mask=false;const v=r.video;try{v.pause();v.muted=r.original.muted;v.volume=r.original.volume;v.playbackRate=r.original.rate;if(r.original.opacity)v.style.setProperty('opacity',r.original.opacity,r.original.priority);else v.style.removeProperty('opacity');}catch{}}
function cancel(){const r=active;if(!r)return;active=null;r.cancelled=true;restore(r);$('watch').textContent='I started watching';log('Stopped. Video paused and original audio, speed and visibility restored.');}
async function play(r,plan){
 check(r);suppress(r);log(`Attempt ${r.index+1}/${CONFIG.plans.length}: hidden, muted, ${plan.rate}x${plan.seek?', incremental seeks':''}.`);
 const v=r.video;v.pause();v.playbackRate=plan.rate;v.currentTime=0;
 await Promise.race([v.play(),wait(15000,r).then(()=>{throw Error('Playback start timed out.');})]);check(r);
 let last=v.currentTime,lastMove=Date.now(),seek=Date.now()+4000,progress=0,pauseAt=0,clampReported=false;
 const end=Date.now()+Math.max(120000,(v.duration+90)*1000);
 while(!v.ended){await wait(300,r);suppress(r);if(v.error)throw Error(`Media error ${v.error.code}.`);if(Date.now()>end)throw Error('Playback watchdog expired.');if(v.currentTime>last+.02){last=v.currentTime;lastMove=Date.now();}if(Date.now()-lastMove>20000)throw Error('Playback stalled for 20 seconds.');if(v.playbackRate!==plan.rate&&!clampReported){clampReported=true;log(`Discord/browser changed requested ${plan.rate}x to ${v.playbackRate}x. Not repeatedly forcing the speed.`,'info',false);}if(v.paused&&!v.ended&&Date.now()-pauseAt>4000){pauseAt=Date.now();await Promise.race([v.play(),wait(10000,r).then(()=>{throw Error('Resume timed out.');})]);}if(plan.seek&&Date.now()>seek&&v.duration-v.currentTime>5){v.currentTime=Math.min(v.duration-3,v.currentTime+Math.min(8,v.duration/10));seek=Date.now()+4000;}if(Date.now()-progress>5000){progress=Date.now();log(`${Math.round(100*v.currentTime/v.duration)}% media position · actual ${v.playbackRate}x · muted and hidden. Quest credit unverified.`,'info',false);}}
 log('Video ended. Checking whether Claim/Collect unlocks for up to 30 seconds.');
}
async function verify(r){const end=Date.now()+CONFIG.claimWaitMs;let state='missing';while(Date.now()<end){check(r);suppress(r);state=claimState(r);if(state==='ready')return 'ready';const e=errorText(r);if(e)throw Error(e.slice(0,250));await wait(500,r);}return state;}
async function start(){
 if(active){cancel();return;}
 let r;
 try{
 log('I started watching pressed. Selecting the quest player.');
 const picked=choose(),v=picked.video;
 r={...picked,id:++serial,index:0,cancelled:false,mask:false,original:{muted:v.muted,volume:v.volume,rate:v.playbackRate,opacity:v.style.getPropertyValue('opacity'),priority:v.style.getPropertyPriority('opacity')}};
 active=r;$('watch').textContent='Stop attempt';
 // Silence and hide immediately, before awaiting metadata/playback or checking readiness.
 suppress(r);r.enforce=()=>{if(active===r&&r.mask&&(v.volume!==0||!v.muted))suppress(r);};v.addEventListener('volumechange',r.enforce);
 log('Step 1 complete: selected video muted (volume 0) and visually hidden.');
 check(r);if(claimState(r)==='ready'){log('Claim/Collect is already enabled. Collect your reward manually.');return;}
 for(let i=0;i<CONFIG.plans.length;i++){
  r.index=i;try{await play(r,CONFIG.plans[i]);const result=await verify(r);if(result==='ready'){log('Claim/Collect is enabled. Playback assistance finished; collect the reward yourself.');return;}
  if(result==='locked')log('Claim/Collect is still disabled after playback. Retrying from the start at the next fallback.','warning');
  else{log('No Claim/Collect button was identifiable in this player. Cannot verify completion. Player restored; check Discord manually.','warning');return;}
  }catch(e){if(['CANCELLED','CAPTCHA','PLAYER_CHANGED'].includes(e.message))throw e;if(e.name==='NotAllowedError')throw Error('Browser blocked playback. Press Play in Discord and start again.');log(`Attempt failed: ${e.message}`,'error');}
  if(i+1<CONFIG.plans.length){log(`Next fallback: ${CONFIG.plans[i+1].rate}x${CONFIG.plans[i+1].seek?' with seeks':' without seeks'}, still muted and hidden.`);await wait(2000,r);}
 }
 log('All attempts, including muted/hidden 1x, exhausted. Claim readiness was not verified. Player restored; watch normally in Discord.','warning');
 }catch(e){if(e.message==='CAPTCHA')log('CAPTCHA — not an error. Player restored. Complete it in Discord, then press I started watching to try again.','captcha');else if(e.message==='PLAYER_CHANGED')log('Selected video was removed or changed. Player restored; reopen the quest and start again.','error');else if(e.message!=='CANCELLED')log(e.message,'error');}
 finally{if(r){r.video.removeEventListener('volumechange',r.enforce);if(active===r){restore(r);active=null;$('watch').textContent='I started watching';}}}
}
$('watch').onclick=start;

const panel=$('panel'),handle=$('header');let dragging=null,clampQueued=false;
function clampPanel(){
 clampQueued=false;if(panel.hidden)return;
 const vp=window.visualViewport;
 const left=vp?.offsetLeft||0,top=vp?.offsetTop||0,w=vp?.width||innerWidth,h=vp?.height||innerHeight;
 panel.style.maxWidth=`${Math.max(1,w-20)}px`;panel.style.maxHeight=`${Math.max(1,h-20)}px`;
 const rect=panel.getBoundingClientRect();
 panel.style.left=`${Math.max(left+10,Math.min(rect.left,left+w-rect.width-10))}px`;
 panel.style.top=`${Math.max(top+10,Math.min(rect.top,top+h-rect.height-10))}px`;
 panel.style.right='auto';panel.style.bottom='auto';
}
function queueClamp(){if(!clampQueued){clampQueued=true;requestAnimationFrame(clampPanel);}}
$('minimise').onclick=()=>{panel.hidden=true;$('orb').hidden=false;$('orb').focus();};
$('orb').onclick=()=>{panel.hidden=false;$('orb').hidden=true;queueClamp();$('watch').focus({preventScroll:true});};
handle.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('button'))return;
 const rect=panel.getBoundingClientRect();dragging={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
 handle.setPointerCapture(e.pointerId);e.preventDefault();
});
handle.addEventListener('pointermove',e=>{
 if(!dragging||dragging.id!==e.pointerId)return;
 panel.style.left=`${dragging.left+e.clientX-dragging.x}px`;panel.style.top=`${dragging.top+e.clientY-dragging.y}px`;
 panel.style.right='auto';panel.style.bottom='auto';clampPanel();
});
function endDrag(e){if(dragging&&dragging.id===e.pointerId){dragging=null;queueClamp();}}
handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);handle.addEventListener('lostpointercapture',endDrag);
addEventListener('resize',queueClamp);window.visualViewport?.addEventListener('resize',queueClamp);window.visualViewport?.addEventListener('scroll',queueClamp);
new ResizeObserver(queueClamp).observe(panel);queueClamp();

addEventListener('pagehide',()=>{if(active){active.cancelled=true;restore(active);active=null;}});
})();
