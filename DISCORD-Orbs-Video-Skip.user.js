// ==UserScript==
// @name         DISCORD-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      4.0.0
// @description  One-button quest playback with progressively slower retries and claim-readiness checks.
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
if (window.top !== window.self || document.getElementById('orbs-simple-host')) return;
if (!document.body) return;
const CONFIG = {claimWaitMs:10000,fallbackWaitMs:10000,stallMs:20000,
 plans:[{rate:16,seek:true},{rate:16},{rate:8},{rate:4},{rate:2},{rate:1}]};
const host=document.createElement('div');host.id='orbs-simple-host';document.body.append(host);
const shadow=host.attachShadow({mode:'open'});
shadow.innerHTML=`<style>
:host{all:initial;color:#dbdee1;font:13px/1.5 system-ui}*{box-sizing:border-box}[hidden]{display:none!important}
#panel{position:fixed;right:18px;bottom:18px;width:330px;max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);z-index:2147483646;background:linear-gradient(145deg,#272232,#191a22);border:1px solid #a978ee55;border-radius:16px;box-shadow:0 16px 50px #0009;overflow:hidden;display:flex;flex-direction:column}
#header{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;cursor:grab;touch-action:none;user-select:none;border-bottom:1px solid #b78af51c}h2{margin:0;font-size:14px;color:white}#content{padding:15px;overflow:auto;min-height:0}button{cursor:pointer;color:white;background:#6539a8;border:0;border-radius:12px}button:focus-visible{outline:2px solid #b9c2ff}#minimise{width:30px;height:30px;background:#ffffff09;font-size:21px}
.watch-wrap{position:relative}#watch{width:100%;padding:16px 10px;font:700 15px system-ui;background:linear-gradient(125deg,#6539a8,#4937a0);box-shadow:0 0 17px #a058ff60}
#watch-tip{position:absolute;top:calc(100% + 8px);left:0;right:0;background:#111214;color:#dbdee1;padding:8px 10px;border-radius:9px;border:1px solid #a978ee55;font-size:12px;line-height:1.45;box-shadow:0 8px 24px #0008;opacity:0;visibility:hidden;transform:translateY(-3px);transition:opacity .12s,transform .12s,visibility .12s;pointer-events:none;z-index:3}
.watch-wrap:hover #watch-tip,.watch-wrap:focus-within #watch-tip{opacity:1;visibility:visible;transform:translateY(0)}
small{display:block;margin-top:9px;color:#b5bac1}#status{padding:10px;background:#ffffff09;border-radius:10px;margin:12px 0;overflow-wrap:anywhere}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;background:#111214;border-radius:9px;padding:10px}#orb{position:fixed;right:20px;bottom:20px;width:50px;height:50px;border-radius:50%;z-index:2147483646;border:1px solid #ddaaffaa;background:radial-gradient(circle at 33% 25%,#efd2ff,#ba7aff 18%,#7d40cf 48%,#302268 85%);box-shadow:0 0 22px #a459ff70}#copy{background:none;color:#c8a5ff;text-decoration:underline;padding:5px 0}#log.empty{color:#94909c;font-style:italic}
</style><section id="panel" hidden><header id="header"><h2>Discord Orbs Video Skip</h2><button id="minimise" aria-label="Minimise to orb">−</button></header><div id="content"><div class="watch-wrap"><button id="watch" aria-describedby="watch-tip">I started watching</button><div id="watch-tip" role="tooltip">Ensure you have an Orbs video on screen and have pressed 'play' before pressing this button.</div></div><small>Script will attempt to speed up or skip the video with fallback options provided automatically</small><div id="status" role="status">Click the orb, then press the button when the Orbs video is playing</div><details><summary>Logs</summary><pre id="log" class="empty">No logs yet..</pre></details><button id="copy" type="button">Click here to copy logs</button> <span id="copy-status" role="status"></span></div></section><button id="orb" aria-label="Open Discord Orbs Video Skip"></button>`;
const $=id=>shadow.getElementById(id), lines=[];
let active=null;
const captchaCache={t:0,v:false};
function log(text,kind='info'){lines.push(`[${new Date().toLocaleTimeString()}] [${kind.toUpperCase()}] ${text}`);if(lines.length>300)lines.shift();$('log').classList.remove('empty');$('log').textContent=lines.join('\n');$('status').textContent=text;console.info('[Orbs]',text);}
function shown(e){if(!e?.isConnected||e.closest('[hidden],[aria-hidden="true"]'))return false;for(let n=e;n instanceof Element;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;}
function scopeFor(v){const dialog=v.closest('[role="dialog"],dialog');if(dialog)return dialog;let n=v.closest('[data-testid="discord-web-video-player-container"]');if(!n)return null;const base=n;for(let i=0;i<4&&n.parentElement&&n.parentElement!==document.body;i++){n=n.parentElement;if(n.querySelectorAll('video[data-testid="discord-web-video-player-video"]').length>1)break;if(/\b(claim|collect|quest|orbs)\b/i.test(n.textContent||''))return n;}return base;}
function choose(){const all=[...document.querySelectorAll('video')];let vs=all.filter(v=>!v.loop&&shown(v)&&!v.error&&Number.isFinite(v.duration)&&v.duration>0&&v.matches('video[data-testid="discord-web-video-player-video"],[data-testid="discord-web-video-player-container"] video,[data-testid="discord-web-video-player-frame"] video'));const ds=vs.filter(v=>v.closest('[role="dialog"],dialog'));if(ds.length)vs=ds;log(`Manual selection: ${all.length} videos on page, ${vs.length} eligible non-looping Discord players.`);if(!vs.length)throw Error('No loaded Orbs player found. Keep the quest video open and visible, then press I started watching again.');let v=vs[0];if(vs.length>1){const a=prompt('Choose the Orbs player number:\n'+vs.map((v,i)=>{const r=v.getBoundingClientRect();return `${i+1}: ${Math.round(v.duration)} sec, ${Math.round(r.width)}×${Math.round(r.height)}`;}).join('\n'));if(a===null)throw Error('Selection cancelled.');const i=Number(a)-1;if(!Number.isInteger(i)||!vs[i])throw Error('Invalid player number.');v=vs[i];}const scope=scopeFor(v);if(!scope)throw Error('Could not identify the player container.');return {video:v,scope,src:v.currentSrc||v.src};}
function captcha(){const now=Date.now();if(now-captchaCache.t<1000)return captchaCache.v;captchaCache.t=now;captchaCache.v=[...document.querySelectorAll('iframe')].some(f=>shown(f)&&f.getBoundingClientRect().height>80&&/captcha|challenges\.cloudflare/i.test(f.src+' '+f.title))||[...document.querySelectorAll('[role="dialog"],[role="alert"]')].some(e=>shown(e)&&/verify (?:that )?you are human|complete (?:the )?captcha|human verification/i.test(e.textContent||''));return captchaCache.v;}
function check(r){if(active!==r||r.cancelled)throw Error('CANCELLED');if(captcha())throw Error('CAPTCHA');if(!r.video.isConnected||!r.scope.isConnected||(r.src&&(r.video.currentSrc||r.video.src)!==r.src))throw Error('PLAYER_CHANGED');}
async function wait(ms,r){const until=Date.now()+ms;while(Date.now()<until){check(r);await new Promise(ok=>setTimeout(ok,Math.min(200,until-Date.now())));}check(r);}
function claimState(r){const matches=[...r.scope.querySelectorAll('button,[role="button"]')].filter(b=>shown(b)&&/^(claim|collect)(?:\s+(?:reward|orbs?))?(?:\s*\(?[\d,]+\)?)?$/i.test((b.getAttribute('aria-label')||b.textContent||'').trim()));return matches.some(b=>!b.disabled&&!b.hasAttribute('disabled')&&b.getAttribute('aria-disabled')!=='true'&&!b.matches('[class*="disabled"],[class*="Disabled"]'))?'ready':matches.length?'locked':'missing';}
function errorText(r){return [...r.scope.querySelectorAll('[role="alert"]')].filter(shown).map(e=>(e.textContent||'').trim()).find(t=>/error|failed|try again|something went wrong/i.test(t))||'';}
function suppress(r){const v=r.video;if(!v.muted)v.muted=true;if(v.volume!==0)v.volume=0;if(v.style.getPropertyValue('opacity')!=='0'||v.style.getPropertyPriority('opacity')!=='important')v.style.setProperty('opacity','0','important');r.mask=true;}
function restore(r){r.mask=false;const v=r.video;try{v.pause();v.muted=r.original.muted;v.volume=r.original.volume;v.playbackRate=r.original.rate;if(r.original.opacity!=='')v.style.setProperty('opacity',r.original.opacity,r.original.priority);else v.style.removeProperty('opacity');}catch{}}
function cancel(){const r=active;if(!r)return;active=null;r.cancelled=true;if(r.enforce)r.video.removeEventListener('volumechange',r.enforce);restore(r);$('watch').textContent='I started watching';log('Stopped. Video paused and original audio, speed and visibility restored.');}
const restartTip='Please wait for fallback methods to unlock the "collect" button.';
async function play(r,plan){
 check(r);suppress(r);log(`Attempt ${r.index+1}/${CONFIG.plans.length}: ${plan.rate}x${plan.seek?', incremental seeks':''}.`);
 const v=r.video;v.pause();v.playbackRate=plan.rate;v.currentTime=0;
 await Promise.race([v.play(),wait(15000,r).then(()=>{throw Error('Playback start timed out.');})]);check(r);
 let last=v.currentTime,lastMove=Date.now(),seek=Date.now()+4000,progress=0,pauseAt=0,clampReported=false;
 const end=Date.now()+Math.max(120000,(v.duration+90)*1000);
 while(!v.ended){await wait(300,r);suppress(r);if(v.error)throw Error(`Media error ${v.error.code}.`);if(Date.now()>end)throw Error('Playback watchdog expired.');if(v.currentTime>last+.02){last=v.currentTime;lastMove=Date.now();}if(Date.now()-lastMove>CONFIG.stallMs)throw Error('Playback stalled for 20 seconds.');if(v.playbackRate!==plan.rate&&!clampReported){clampReported=true;log(`Discord/browser changed requested ${plan.rate}x to ${v.playbackRate}x. Not repeatedly forcing the speed.`);}if(v.paused&&!v.ended&&Date.now()-pauseAt>4000){pauseAt=Date.now();await Promise.race([v.play(),wait(10000,r).then(()=>{throw Error('Resume timed out.');})]);}if(plan.seek&&Date.now()>seek&&v.duration-v.currentTime>5){v.currentTime=Math.min(v.duration-3,v.currentTime+Math.min(8,v.duration/10));seek=Date.now()+4000;}if(Date.now()-progress>5000){progress=Date.now();log(`${Math.round(100*v.currentTime/v.duration)}% media position · actual ${v.playbackRate}x.`);}}
 log(`Video ended. Waiting up to ${CONFIG.claimWaitMs/1000} seconds for Claim/Collect to unlock. ${restartTip}`);
}
async function verify(r){const end=Date.now()+CONFIG.claimWaitMs;let state='missing';while(Date.now()<end){check(r);suppress(r);state=claimState(r);if(state==='ready')return 'ready';const e=errorText(r);if(e)throw Error(e.slice(0,250));await wait(500,r);}return state;}
async function start(){
 if(active){cancel();return;}
 let r;
 try{
 log('I started watching pressed. Selecting the quest player.');
 const picked=choose(),v=picked.video;
 r={...picked,index:0,cancelled:false,mask:false,original:{muted:v.muted,volume:v.volume,rate:v.playbackRate,opacity:v.style.getPropertyValue('opacity'),priority:v.style.getPropertyPriority('opacity')}};
 active=r;$('watch').textContent='Stop attempt';
 suppress(r);r.enforce=()=>{if(active===r&&r.mask&&(v.volume!==0||!v.muted))suppress(r);};v.addEventListener('volumechange',r.enforce);
 log('Player selected. Preparing playback attempts.');
 check(r);if(claimState(r)==='ready'){log('Claim button unlocked! Click it to claim Orbs.');return;}
 for(let i=0;i<CONFIG.plans.length;i++){
  r.index=i;
  try{await play(r,CONFIG.plans[i]);const result=await verify(r);if(result==='ready'){log('Claim button unlocked! Click it to claim Orbs.');return;}
   if(result==='locked')log('Claim/Collect is still disabled after playback.','warning');
   else{log('No Claim/Collect button was identifiable in this player. Cannot verify completion. Player restored; check Discord manually.','warning');return;}
  }catch(e){if(['CANCELLED','CAPTCHA','PLAYER_CHANGED'].includes(e.message))throw e;if(e.name==='NotAllowedError')throw Error('Browser blocked playback. Press Play in Discord and start again.');log(`Attempt failed: ${e.message}`,'error');}
  if(i+1<CONFIG.plans.length){const next=CONFIG.plans[i+1];log(`Waiting ${CONFIG.fallbackWaitMs/1000} seconds before the next fallback: ${next.rate}x${next.seek?' with seeks':' without seeks'}. ${restartTip}`);await wait(CONFIG.fallbackWaitMs,r);}
 }
 log('All attempts, including 1x, exhausted. Claim readiness was not verified. Player restored; watch normally in Discord.','warning');
 }catch(e){if(e.message==='CAPTCHA')log('CAPTCHA — not an error. Player restored. Complete it in Discord, then press I started watching to try again.','captcha');else if(e.message==='PLAYER_CHANGED')log('Selected video was removed or changed. Player restored; reopen the quest and start again.','error');else if(e.message!=='CANCELLED')log(e.message,'error');}
 finally{if(r){r.video.removeEventListener('volumechange',r.enforce);if(active===r){restore(r);active=null;$('watch').textContent='I started watching';}}}
}
$('watch').onclick=start;
let copyTimer=null,copyRequest=0;
$('copy').onclick=async()=>{
 const request=++copyRequest,feedback=$('copy-status');clearTimeout(copyTimer);feedback.textContent='';
 if(!lines.length){feedback.textContent='No logs yet..';copyTimer=setTimeout(()=>{if(request===copyRequest)feedback.textContent='';},5000);return;}
 const text=lines.join('\n');let copied=false;
 try{await navigator.clipboard.writeText(text);copied=true;}catch{const t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;top:0;left:0;opacity:0';shadow.append(t);t.focus();t.select();try{copied=document.execCommand('copy');}catch{}t.remove();}
 if(request!==copyRequest)return;
 feedback.textContent=copied?'Logs Copied':'Clipboard blocked. Expand Logs and copy the text manually.';
 if(copied)copyTimer=setTimeout(()=>{if(request===copyRequest)feedback.textContent='';},5000);
};
const panel=$('panel'),handle=$('header');let dragging=null,clampQueued=false;
function clampPanel(){clampQueued=false;if(panel.hidden)return;const vp=window.visualViewport;const left=vp?.offsetLeft||0,top=vp?.offsetTop||0,w=vp?.width||innerWidth,h=vp?.height||innerHeight;panel.style.maxWidth=`${Math.max(1,w-20)}px`;panel.style.maxHeight=`${Math.max(1,h-20)}px`;const rect=panel.getBoundingClientRect();panel.style.left=`${Math.max(left+10,Math.min(rect.left,left+w-rect.width-10))}px`;panel.style.top=`${Math.max(top+10,Math.min(rect.top,top+h-rect.height-10))}px`;panel.style.right='auto';panel.style.bottom='auto';}
function queueClamp(){if(!clampQueued){clampQueued=true;requestAnimationFrame(clampPanel);}}
$('minimise').onclick=()=>{panel.hidden=true;$('orb').hidden=false;$('orb').focus();};$('orb').onclick=()=>{panel.hidden=false;$('orb').hidden=true;queueClamp();$('watch').focus({preventScroll:true});};
handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const rect=panel.getBoundingClientRect();dragging={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};handle.setPointerCapture(e.pointerId);e.preventDefault();});
handle.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;panel.style.left=`${dragging.left+e.clientX-dragging.x}px`;panel.style.top=`${dragging.top+e.clientY-dragging.y}px`;panel.style.right='auto';panel.style.bottom='auto';clampPanel();});
function endDrag(e){if(dragging&&dragging.id===e.pointerId){dragging=null;queueClamp();}}
handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);handle.addEventListener('lostpointercapture',endDrag);
const ro=new ResizeObserver(queueClamp);ro.observe(panel);
addEventListener('resize',queueClamp);
window.visualViewport?.addEventListener('resize',queueClamp);
window.visualViewport?.addEventListener('scroll',queueClamp);
queueClamp();
addEventListener('pagehide',()=>{
 if(active){active.cancelled=true;restore(active);active=null;}
 ro.disconnect();
 removeEventListener('resize',queueClamp);
 window.visualViewport?.removeEventListener('resize',queueClamp);
 window.visualViewport?.removeEventListener('scroll',queueClamp);
},{once:true});
})();
