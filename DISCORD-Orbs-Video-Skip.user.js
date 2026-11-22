// ==UserScript==
// @name         Discord-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      1.4.1
// @description  Attempts to speed up the rate of Orbs collection, with automatic fallback handling.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
if(window.top!==window.self||document.getElementById('orbs-skip-host'))return;
const host=document.createElement('div');host.id='orbs-skip-host';document.body.append(host);
const sh=host.attachShadow({mode:'open'});
sh.innerHTML=`<style>
:host{all:initial;font:13px/1.45 system-ui;color:#dbdee1}
*{box-sizing:border-box}button,input{font:inherit}button{border:0;border-radius:10px;background:#4e5058;color:white;padding:10px 12px;cursor:pointer;white-space:normal;overflow-wrap:anywhere}button:hover{filter:brightness(1.12)}button:focus-visible{outline:2px solid #8aa7ff;outline-offset:2px}button:disabled{opacity:.45;cursor:not-allowed}
#panel{position:fixed;z-index:2147483646;right:18px;bottom:18px;width:350px;height:560px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);min-width:min(280px,calc(100vw - 16px));min-height:min(180px,calc(100dvh - 16px));background:#1e1f22;border:1px solid #41434a;border-radius:15px;box-shadow:0 10px 35px #0008;display:flex;flex-direction:column;resize:both;overflow:hidden;contain:inline-size}
header{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:12px;background:#2b2d31;cursor:grab;touch-action:none;flex-shrink:0}header strong{min-width:0;overflow-wrap:anywhere}#body{padding:12px;overflow:auto;min-width:0;min-height:0;flex:1;overflow-wrap:anywhere}#body>button{width:100%;margin:5px 0}.primary{background:#5865f2;font-size:15px;font-weight:700;padding:15px}.card{background:#2b2d31;border:1px solid #3f4147;border-radius:12px;padding:11px;margin-bottom:10px}.step{font-size:11px;text-transform:uppercase;color:#b5bac1;letter-spacing:.06em;font-weight:700}small{display:block;color:#b5bac1;font-size:11px;margin-top:7px}#status{margin-top:10px}details{margin:12px 0}summary{cursor:pointer;color:#c9cbd0}.tools{display:grid;gap:6px;margin-top:10px}.row{display:flex;gap:6px;margin-top:10px}.row>*{flex:1;min-width:0}pre{font:11px/1.5 monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;background:#111214;padding:10px;border-radius:10px}label{display:flex;gap:8px;align-items:center;margin-top:12px}#toasts{position:fixed;right:16px;top:16px;width:min(350px,calc(100vw - 32px));z-index:2147483647;pointer-events:none}.toast{background:#343b75;color:white;margin-bottom:8px;padding:12px;border-radius:12px;overflow-wrap:anywhere}#launcher{position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#5865f2;border-radius:24px;font-weight:700}[hidden]{display:none!important}
</style>
<section id="panel" aria-label="Discord Orbs Video Skip"><header id="drag"><strong>Discord Orbs Video Skip</strong><button id="close" title="Close to floating button" aria-label="Close to floating button">×</button></header><div id="body">
<div class="card"><div class="step">Step 1 — Open the Orbs quest player</div><p id="selected">No video selected.</p><button id="select" class="primary" style="width:100%">I started watching</button><small>Script will attempt to speed up or skip the video with fallback options provided automatically</small></div>
<div id="count" class="card"></div><div class="step">Step 2 — Run automatic fallback</div><button id="start" class="primary" disabled>Start auto fallback</button><div id="status" class="card" role="status">Ready. Open the quest video, then press “I started watching”.</div>
<label><input id="autoclaim" type="checkbox">Click an enabled claim button automatically</label>
<div class="row"><button id="stop" style="background:#a32b35">Stop</button><button id="resume">Resume after CAPTCHA</button></div>
<details><summary>Manual tools — only if automatic fallback fails</summary><div id="tools" class="tools"></div><button id="claim" style="width:100%;margin-top:8px">Retry claim</button></details>
<button id="confirm">Confirm orbs received</button><div class="row"><button id="copy">Copy logs</button><button id="export">Export logs</button></div>
<details><summary>Activity log</summary><pre id="log"></pre></details>
<details><summary>How fallback works</summary><p>After you manually select the video, auto fallback tries: muted and visually hidden at 16x with small seeks; muted and hidden at 16x without seeks; visible and audible at 16x, 4x, then 2x. If these fail, normal 1x is suggested, not started without your choice.</p><p>Video selection uses Discord's player test IDs shown in the supplied screenshot. Looping clips and non-visible players are excluded. Multiple eligible players require you to choose; none is silently substituted during playback.</p><p>Fast playback and seeking may not count toward a quest. Hidden means transparent, not undetectable. CAPTCHA is a manual-action state, not an error. Claim clicks are not proof of receipt; the counter records only amounts you confirm.</p><p>The counter resets after 24 hours or a new tab session. Browser session restoration can preserve session data. Closing this panel keeps an active run going; use Stop to cancel.</p></details>
</div></section><button id="launcher" hidden>Orbs</button><div id="toasts" aria-live="polite"></div>`;
const $=id=>sh.getElementById(id),panel=$('panel'),lines=[];
const plans=[
 {name:'Muted + hidden + 16x + seeks',rate:16,mute:true,hide:true,seek:true},
 {name:'Muted + hidden + 16x',rate:16,mute:true,hide:true},
 {name:'Visible + audible + 16x',rate:16},
 {name:'Visible + audible + 4x',rate:4},
 {name:'Visible + audible + 2x',rate:2},
 {name:'Normal 1x, visible and audible',rate:1}
];
let selected=null,run=null,pending=null,ledger;
const storage='discord-orbs-video-skip:v1';
try{ledger=JSON.parse(sessionStorage.getItem(storage)||'null');}catch{}
if(!ledger||!Number.isFinite(ledger.startedAt)||!Number.isFinite(ledger.confirmedOrbs)||!Array.isArray(ledger.completedQuestIds))ledger={startedAt:Date.now(),confirmedOrbs:0,completedQuestIds:[]};
function save(){try{sessionStorage.setItem(storage,JSON.stringify(ledger));}catch{}}
function count(){if(Date.now()-ledger.startedAt>=86400000){ledger={startedAt:Date.now(),confirmedOrbs:0,completedQuestIds:[]};save();}$('count').textContent=`Orbs collected today = ${ledger.confirmedOrbs} (confirmed)`;}
function note(text,type='info',notify=true){lines.push(`[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${text}`);if(lines.length>300)lines.shift();$('log').textContent=lines.join('\n');$('status').textContent=text;if(notify){const t=document.createElement('div');t.className='toast';t.textContent=text;if(type==='error')t.style.background='#8d2936';if(type==='captcha')t.style.background='#765018';$('toasts').append(t);while($('toasts').children.length>4)$('toasts').firstChild.remove();setTimeout(()=>t.remove(),7000);}}
function visible(e){if(!e?.isConnected||e.closest('[hidden],[aria-hidden="true"]'))return false;for(let n=e;n instanceof Element;n=n.parentElement){const c=getComputedStyle(n);if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0)return false;}const r=e.getBoundingClientRect();return r.width>=160&&r.height>=90&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;}
function scopeFor(v){return v.closest('[role="dialog"],dialog')||v.closest('[data-testid="discord-web-video-player-container"]');}
function ui(){const ok=selected?.video.isConnected;const v=selected?.video;$('selected').textContent=ok?`Selected Discord player · ${Number.isFinite(v.duration)?Math.round(100*v.currentTime/v.duration)||0:0}% media position`:'No video selected.';$('start').disabled=!ok||!!run;for(const b of $('tools').querySelectorAll('button'))b.disabled=!ok||!!run;$('select').disabled=!!run;}
function select(){
 if(run){note('Stop the active run before selecting another video.','error');return;}
 note('Selection requested. Checking Discord player test IDs and excluding looping clips.');
 const all=[...document.querySelectorAll('video')];
 const eligible=all.filter(v=>!v.loop&&visible(v)&&!v.error&&Number.isFinite(v.duration)&&v.duration>0&&v.readyState>=1&&v.matches('video[data-testid="discord-web-video-player-video"], [data-testid="discord-web-video-player-container"] video, [data-testid="discord-web-video-player-frame"] video'));
 const dialogs=eligible.filter(v=>v.closest('[role="dialog"],dialog'));
 const candidates=dialogs.length?dialogs:eligible;
 note(`Selection scan: ${all.length} videos total; ${eligible.length} visible non-looping Discord players; ${candidates.length} candidates.`, 'info',false);
 if(!candidates.length){selected=null;ui();note('No eligible player found. Keep the Orbs player open, visible and loaded, then press I started watching again. Looping clips are deliberately excluded.','error');return;}
 let v=candidates[0];
 if(candidates.length>1){const labels=candidates.map((v,i)=>{const r=v.getBoundingClientRect();return `${i+1}: ${Math.round(v.duration)} seconds, ${Math.round(r.width)}×${Math.round(r.height)}, ${v.paused?'paused':'playing'}`;});const answer=prompt('Multiple Discord players found. Select the Orbs player number:\n'+labels.join('\n'));if(answer===null){note('Selection cancelled.');return;}const i=Number(answer)-1;if(!Number.isInteger(i)||!candidates[i]){note('Invalid player number. No selection changed.','error');return;}v=candidates[i];}
 const scope=scopeFor(v);if(!scope){note('Player container missing. No selection made.','error');return;}
 selected={video:v,scope,src:v.currentSrc||v.src};pending=null;ui();note('Discord player selected. Press Start auto fallback.');
}
function captcha(){return [...document.querySelectorAll('iframe')].find(f=>{const r=f.getBoundingClientRect();return r.width>100&&r.height>80&&getComputedStyle(f).visibility!=='hidden'&&/captcha|challenges\.cloudflare/i.test(f.src+' '+f.title);})||[...document.querySelectorAll('[role="dialog"],[role="alert"]')].find(e=>e.getClientRects().length&&/verify (?:that )?you are human|complete (?:the )?captcha|human verification/i.test(e.textContent||''));}
function check(r){if(run!==r||r.cancelled)throw Error('CANCELLED');if(captcha())throw Error('CAPTCHA');if(!r.video.isConnected||!r.scope.isConnected||(r.src&&(r.video.currentSrc||r.video.src)!==r.src))throw Error('PLAYER_CHANGED');}
async function wait(ms,r){const until=Date.now()+ms;while(Date.now()<until){check(r);await new Promise(ok=>setTimeout(ok,Math.min(250,until-Date.now())));}check(r);}
function restore(r){try{const v=r.video;v.pause();v.muted=r.original.muted;v.playbackRate=r.original.rate;v.style.opacity=r.original.opacity;}catch{}}
function stop(){if(run){const r=run;r.cancelled=true;run=null;restore(r);}pending=null;ui();note('Stopped. Video paused; original mute, speed and opacity restored.');}
async function play(r,plan){
 check(r);r.phase='playback';const v=r.video;note(`Attempt ${r.index+1}: ${plan.name}.`);
 v.style.opacity=plan.hide?'0':r.original.opacity;v.muted=!!plan.mute;v.playbackRate=plan.rate;v.currentTime=0;
 await Promise.race([v.play(),wait(15000,r).then(()=>{throw Error('Playback start timed out');})]);check(r);
 let last=v.currentTime,moved=Date.now(),seek=Date.now()+4000,progress=0,resume=0;const deadline=Date.now()+Math.max(90000,(v.duration+60)*1000);
 while(!v.ended){await wait(500,r);if(v.error)throw Error(`Media error ${v.error.code}`);if(Date.now()>deadline)throw Error('Playback timed out');if(v.currentTime>last+.02){last=v.currentTime;moved=Date.now();}if(Date.now()-moved>20000)throw Error('Playback stalled for 20 seconds');if(v.paused&&!v.ended&&Date.now()-resume>4000){resume=Date.now();await Promise.race([v.play(),wait(10000,r).then(()=>{throw Error('Resume timed out');})]);}if(plan.seek&&Date.now()>seek&&v.duration-v.currentTime>5){v.currentTime=Math.min(v.duration-3,v.currentTime+Math.min(8,v.duration/10));seek=Date.now()+4000;}if(Date.now()-progress>5000){progress=Date.now();note(`${Math.round(v.currentTime/v.duration*100)}% media position; actual rate ${v.playbackRate}x. Quest credit is unverified.`,'info',false);}}
 v.style.opacity=r.original.opacity;note('Video ended. Waiting up to 30 seconds for an enabled claim button.');
}
function buttons(scope){return [...scope.querySelectorAll('button,[role="button"]')].filter(b=>b.getClientRects().length&&!b.disabled&&b.getAttribute('aria-disabled')!=='true');}
async function collect(r){r.phase='collection';const until=Date.now()+30000;while(Date.now()<until){check(r);const error=[...r.scope.querySelectorAll('[role="alert"]')].find(e=>e.getClientRects().length&&/error|failed|try again|something went wrong/i.test(e.textContent||''));if(error)throw Error(error.textContent.trim().slice(0,240));const b=buttons(r.scope).find(b=>/^(claim(?: reward| orbs?)?|collect(?: reward| orbs?)?)$/i.test((b.getAttribute('aria-label')||b.textContent||'').trim()));if(b){if($('autoclaim').checked){b.click();note('Claim clicked once. Checking for CAPTCHA or errors.');await wait(3500,r);const err=r.scope.querySelector('[role="alert"]');if(err&&/error|failed|try again/i.test(err.textContent||''))throw Error(err.textContent.trim().slice(0,240));}note('Claim control reached. Reward receipt is unverified; confirm in Discord before recording orbs.');return true;}await wait(500,r);}return false;}
async function start({auto=false,index=0,claimOnly=false}={}){
 note(claimOnly?'Retry claim pressed.':auto?'Start auto fallback pressed.':`Manual tool pressed: ${plans[index].name}.`);
 if(run){note('A run is already active.','error');return;}if(!selected?.video.isConnected){note('Press I started watching to select the quest player first.','error');return;}
 const v=selected.video;const r={...selected,auto,index,phase:claimOnly?'collection':'playback',original:{rate:v.playbackRate,muted:v.muted,opacity:v.style.opacity},cancelled:false};run=r;pending=null;ui();
 try{
  if(claimOnly){if(!await collect(r))note('No enabled claim button found. Collection not confirmed.','error');return;}
  const end=auto?5:index+1;
  for(let i=index;i<end;i++){r.index=i;try{await play(r,plans[i]);if(await collect(r))return;note('No enabled claim button appeared.','warning');}catch(e){if(['CANCELLED','CAPTCHA','PLAYER_CHANGED'].includes(e.message))throw e;note(`Attempt failed: ${e.message}`,'error');if(e.name==='NotAllowedError')throw Error('Browser blocked playback. Press Play in Discord and retry.');}restore(r);if(i+1<end){note('Automatically trying the next fallback.');await wait(2000,r);}}
  note(auto?'Fast fallback attempts exhausted. Try Normal 1x and keep Discord visible.':'Manual attempt did not establish a claimable result.','warning');
 }catch(e){if(run===r){if(e.message==='CAPTCHA'){pending={auto:r.auto,index:r.index,claimOnly:r.phase==='collection'};note('CAPTCHA — not an error. Complete it manually, then Resume after CAPTCHA.','captcha');}else if(e.message!=='CANCELLED')note(e.message==='PLAYER_CHANGED'?'Selected player was removed or changed. Select the quest player again.':e.message,'error');}}
 finally{if(run===r){restore(r);run=null;ui();}}
}
$('select').onclick=select;$('start').onclick=()=>start({auto:true});$('stop').onclick=stop;$('claim').onclick=()=>start({claimOnly:true});
plans.forEach((plan,index)=>{const b=document.createElement('button');b.textContent=plan.name;b.disabled=true;b.onclick=()=>start({index});$('tools').append(b);});
$('resume').onclick=()=>{if(run){note('A run is already active.','error');return;}if(captcha()){note('CAPTCHA still appears present. Complete or dismiss it first.','captcha');return;}if(!pending){note('No CAPTCHA-paused run.');return;}start(pending);};
$('confirm').onclick=()=>{if(run){note('Wait for the attempt to finish before recording receipt.','error');return;}count();const id=prompt('Unique quest name or ID — only record rewards actually received:')?.trim().toLowerCase();if(!id)return;if(ledger.completedQuestIds.includes(id)){note('Quest already recorded.','warning');return;}const raw=prompt('Exact number of orbs Discord confirmed you received:');if(raw===null)return;const n=Number(raw);if(!Number.isSafeInteger(n)||n<=0||n>100000){note('Enter a positive whole number.','error');return;}ledger.completedQuestIds.push(id);ledger.confirmedOrbs+=n;save();count();note(`Recorded ${n} manually confirmed orbs.`);};
$('copy').onclick=async()=>{const text=lines.join('\n');try{await navigator.clipboard.writeText(text);note('Logs copied.');}catch{const t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch{}t.remove();note(ok?'Logs copied.':'Clipboard blocked. Use Export logs.',ok?'info':'error');}};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='discord-orbs-video-skip-log.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
$('close').onclick=()=>{panel.hidden=true;$('launcher').hidden=false;};$('launcher').onclick=()=>{panel.hidden=false;$('launcher').hidden=true;requestAnimationFrame(clamp);};
function clamp(){if(panel.hidden)return;const w=innerWidth,h=innerHeight;panel.style.maxWidth=`${Math.max(1,w-16)}px`;panel.style.maxHeight=`${Math.max(1,h-16)}px`;const r=panel.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(r.left,w-r.width-8))}px`;panel.style.top=`${Math.max(8,Math.min(r.top,h-r.height-8))}px`;panel.style.right='auto';panel.style.bottom='auto';}
let drag=null;const handle=$('drag');handle.onpointerdown=e=>{if(e.target.closest('button')||e.button!==0)return;const r=panel.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};handle.setPointerCapture(e.pointerId);e.preventDefault();};handle.onpointermove=e=>{if(!drag)return;const r=panel.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(drag.left+e.clientX-drag.x,innerWidth-r.width-8))}px`;panel.style.top=`${Math.max(8,Math.min(drag.top+e.clientY-drag.y,innerHeight-r.height-8))}px`;panel.style.right='auto';panel.style.bottom='auto';};handle.onpointerup=handle.onpointercancel=()=>{drag=null;clamp();};
new ResizeObserver(()=>requestAnimationFrame(clamp)).observe(panel);addEventListener('resize',clamp);addEventListener('pagehide',()=>{if(run){run.cancelled=true;restore(run);run=null;}});
setInterval(()=>{count();if(selected&&!selected.video.isConnected&&!run){selected=null;pending=null;note('Selected player closed. Press I started watching after opening the next quest.','info',false);}ui();},1000);
count();ui();requestAnimationFrame(clamp);note('Ready. Open the Orbs player and press I started watching.');
})();
