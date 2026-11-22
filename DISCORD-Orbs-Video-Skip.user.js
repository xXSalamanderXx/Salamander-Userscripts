// ==UserScript==
// @name         Discord-Orbs-Video-Skip
// @namespace    https://github.com/xXSalamanderXx/Salamander-Userscripts
// @version      1.0.0
// @description  Attempts to speed up the rate of Orbs collection, with honest fallback handling.
// @author       xXSalamanderXx
// @match        https://discord.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
  IMPORTANT:
  - "Fast" playback asks the browser to increase playbackRate. Discord may ignore,
    clamp, or reject it. It cannot make a 60-second real-time watch requirement
    complete in less than 60 real seconds if Discord validates elapsed time.
  - "Hidden" only makes the selected video visually transparent. It does not hide
    the browser tab, spoof focus, or conceal playback state from Discord.
  - The script does not bypass CAPTCHAs. It detects likely CAPTCHA prompts and asks
    you to complete them manually.
  - The orb counter only increases when you manually confirm the orbs Discord
    actually credited to your account.
*/

(() => {
'use strict';
if (window.top !== window.self || document.getElementById('dqfa')) return;

const plans = [
 {name:'Muted + visually hidden + 16x + incremental seeks',rate:16,mute:true,hide:true,seek:true},
 {name:'Muted + visually hidden + 16x, no seeks',rate:16,mute:true,hide:true},
 {name:'Visible + audible + 16x',rate:16},
 {name:'Visible + audible + 4x',rate:4},
 {name:'Visible + audible + 2x',rate:2}
];

const key='dqfa.session.v1';
let ledger;
try {ledger=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
if(!ledger) ledger={since:Date.now(),total:0,ids:[]};

let run=null, chosen=null, chosenScope=null, lastMode=0, waiting=null;

const root=document.createElement('section');
root.id='dqfa';
root.style.cssText='position:fixed;right:18px;bottom:18px;width:325px;z-index:2147483647;background:#202127;color:#eee;padding:14px;border:1px solid #666;border-radius:12px;font:13px/1.45 system-ui;box-shadow:0 8px 30px #0008';

root.innerHTML=`
<b>Discord Orbs Video Skip</b> <button data-a="collapse">−</button>
<div id="dqbody">
<div id="dqcount"></div>
<p id="dqstatus" role="status">Open one quest video, then Select video.</p>
<div style="display:flex;flex-wrap:wrap;gap:5px">
<button data-a="select">Select video</button>
<button data-a="start">Start fallbacks</button>
<button data-a="normal">Normal 1x</button>
<button data-a="stop">Stop</button>
<button data-a="continue">Resume after CAPTCHA</button>
<button data-a="claim">Retry claim</button>
<button data-a="confirm">Confirm orbs received</button>
<button data-a="export">Export log</button>
</div>
<label style="display:block;margin-top:8px">
<input id="dqauto" type="checkbox"> Click enabled claim button in selected dialog
</label>
<small>
Fast modes may fail. Stage 3 turns sound ON. Hidden means visually hidden, not undetectable.
CAPTCHA needs manual completion. Counter is manually confirmed.
</small>
<details>
<summary>Activity log</summary>
<pre id="dqlog" style="white-space:pre-wrap;max-height:160px;overflow:auto;font-size:11px"></pre>
</details>
</div>`;

document.body.append(root);

const $=id=>root.querySelector('#'+id), logs=[];
const toastbox=document.createElement('div');
toastbox.style.cssText='position:fixed;right:18px;top:18px;z-index:2147483647;max-width:350px;pointer-events:none';
document.body.append(toastbox);

function say(text,kind='info',toast=true){
 const line=`${new Date().toLocaleTimeString()} [${kind}] ${text}`;
 logs.push(line);
 if(logs.length>200) logs.shift();
 $('dqstatus').textContent=text;
 $('dqlog').textContent=logs.join('\n');
 if(toast){
  const el=document.createElement('div');
  el.style.cssText=`background:${kind==='error'?'#8b2531':kind==='captcha'?'#765018':'#343b75'};color:white;padding:12px;margin-bottom:8px;border-radius:8px`;
  el.textContent=text;
  toastbox.append(el);
  setTimeout(()=>el.remove(),7500);
  while(toastbox.children.length>4) toastbox.firstChild.remove();
 }
}

function save(){
 try{sessionStorage.setItem(key,JSON.stringify(ledger));}catch{}
}

function counter(){
 if(Date.now()-ledger.since>=86400000){
  ledger={since:Date.now(),total:0,ids:[]};
  save();
 }
 $('dqcount').textContent=`Orbs collected today = ${ledger.total} (confirmed)`;
}

counter();
setInterval(counter,30000);

function visible(el){
 return !!el?.isConnected && !!el.getClientRects().length &&
  getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none';
}

function scopeFor(v){
 return v.closest('[role="dialog"],dialog')||v.parentElement;
}

function select(){
 if(run){say('Stop the active run before selecting another video.','error');return false;}
 const vs=[...document.querySelectorAll('video')].filter(v=>visible(v)&&!root.contains(v));
 if(vs.length!==1){
  say(`Found ${vs.length} visible videos. Open exactly one quest video. No video selected.`,'error');
  return false;
 }
 chosen=vs[0];
 chosenScope=scopeFor(chosen);
 say('Selected the video and its containing dialog.');
 return true;
}

function valid(){
 return chosen?.isConnected&&chosenScope?.isConnected;
}

function captcha(){
 return [...document.querySelectorAll('iframe')].find(f=>visible(f)&&/hcaptcha|recaptcha|captcha|challenges\.cloudflare/i.test(f.src+' '+f.title)) ||
 [...document.querySelectorAll('[role="dialog"],[role="alert"]')].find(el=>visible(el)&&!root.contains(el)&&/verify (?:that )?you are human|complete (?:the )?captcha|human verification/i.test(el.textContent||''));
}

function claimButton(){
 if(!valid())return null;
 return [...chosenScope.querySelectorAll('button,[role="button"]')].find(b=>
  visible(b)&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&
  /^(claim(?: reward| orbs?)?|collect(?: reward| orbs?)?)$/i.test((b.textContent||'').trim())
 );
}

function errorText(){
 if(!valid())return '';
 return [...chosenScope.querySelectorAll('[role="alert"]')].filter(visible)
  .map(e=>e.textContent.trim())
  .find(t=>/error|failed|try again|something went wrong/i.test(t))||'';
}

function check(r){
 if(run!==r||r.abort.signal.aborted)throw new Error('CANCELLED');
 if(!valid())throw new Error('VIDEO_REMOVED');
 if(captcha())throw new Error('CAPTCHA');
}

async function sleep(ms,r){
 const end=Date.now()+ms;
 while(Date.now()<end){
  check(r);
  await new Promise(ok=>setTimeout(ok,Math.min(250,end-Date.now())));
 }
 check(r);
}

function restore(r){
 if(!r?.original)return;
 const o=r.original,v=r.video;
 try{
  v.pause();
  v.playbackRate=o.rate;
  v.muted=o.mute;
  v.style.opacity=o.opacity;
 }catch{}
}

function stop(quiet=false){
 if(run){
  const r=run;
  run=null;
  r.abort.abort();
  restore(r);
 }
 waiting=null;
 if(!quiet)say('Stopped. Original speed, mute and opacity restored; playback paused.');
}

function interrupt(r,e){
 if(run!==r)return;
 restore(r);
 run=null;
 if(e.message==='CAPTCHA'){
  waiting={index:r.index,normal:r.normal,phase:r.phase};
  say('CAPTCHA — not a failure. Complete it in Discord, then press Resume after CAPTCHA.','captcha');
  const c=captcha();
  c?.scrollIntoView?.({block:'center'});
 } else if(e.message!=='CANCELLED'){
  say(e.message==='VIDEO_REMOVED'
   ?'Selected video/dialog was removed. Reopen the quest and select its video.'
   :e.message,'error');
 }
}

async function playback(r,plan){
 const v=r.video;
 check(r);
 r.phase='play';
 v.style.opacity=plan.hide?'0':r.original.opacity;
 v.muted=!!plan.mute;
 v.playbackRate=plan.rate;

 if(v.readyState<1){
  const until=Date.now()+20000;
  while(v.readyState<1){
   if(Date.now()>until)throw new Error('Metadata timed out.');
   await sleep(250,r);
  }
 }

 if(!Number.isFinite(v.duration)||v.duration<=0)throw new Error('Video has no finite duration.');

 v.currentTime=0;
 await v.play();
 check(r);
 say(`Stage ${r.index+1}: ${plan.name}. Actual speed: ${v.playbackRate}x.`);

 const deadline=Date.now()+Math.max(90000,(v.duration+60)*1000);
 let last=v.currentTime,lastMove=Date.now(),nextSeek=Date.now()+4000,lastPauseTry=0,lastProgress=0;

 while(!v.ended){
  await sleep(500,r);
  if(v.error)throw new Error(`Media error ${v.error.code}.`);
  if(Date.now()>deadline)throw new Error('Playback watchdog expired.');
  if(v.currentTime>last+0.02){
   lastMove=Date.now();
   last=v.currentTime;
  }
  if(Date.now()-lastMove>20000)throw new Error('Playback stalled for 20 seconds.');
  if(v.paused&&!v.ended&&Date.now()-lastPauseTry>4000){
   lastPauseTry=Date.now();
   say('Playback paused; trying to resume.','info',false);
   await v.play();
  }
  if(plan.seek&&Date.now()>nextSeek&&v.duration-v.currentTime>5){
   v.currentTime=Math.min(v.duration-3,v.currentTime+Math.min(8,v.duration/10));
   nextSeek=Date.now()+4000;
  }
  if(Date.now()-lastProgress>5000){
   lastProgress=Date.now();
   say(`${plan.name}: ${Math.round(v.currentTime/v.duration*100)}% media position (not verified quest credit).`,'info',false);
  }
 }

 v.style.opacity=r.original.opacity;
 say('Video ended. Waiting for an enabled claim control; playback end is not reward confirmation.');
}

async function collection(r){
 r.phase='claim';
 const end=Date.now()+25000;
 while(Date.now()<end){
  check(r);
  const err=errorText();
  if(err)throw new Error('Collection error: '+err);
  const b=claimButton();
  if(b){
   if($('dqauto').checked){
    b.click();
    say('Claim clicked once. Checking for CAPTCHA or errors…');
    await sleep(3500,r);
    const e=errorText();
    if(e)throw new Error('Collection error: '+e);
   } else {
    b.scrollIntoView({block:'center'});
    say('Enabled claim button found. Click it in Discord.');
   }
   say('Collection outcome is unverified. Check Discord; use Confirm orbs received only after actual receipt.');
   return true;
  }
  await sleep(500,r);
 }
 return false;
}

async function start(index=0,normal=false,claimOnly=false){
 if(run){say('A run is already active. Stop it before starting another.','error');return;}
 if(!valid()&&!select())return;
 const v=chosen;
 const r={
  video:v,index,normal,
  phase:claimOnly?'claim':'play',
  abort:new AbortController(),
  original:{rate:v.playbackRate,mute:v.muted,opacity:v.style.opacity}
 };
 run=r;
 waiting=null;

 try{
  if(claimOnly){
   if(!await collection(r))say('No enabled claim button found. Collection was not confirmed.','error');
   return;
  }

  const modes=normal?[{name:'Normal 1x, visible and audible',rate:1}]:plans;

  for(let i=normal?0:index;i<modes.length;i++){
   r.index=i;
   lastMode=i;
   try{
    await playback(r,modes[i]);
    if(await collection(r))return;
    say('No enabled claim control after 25 seconds. This attempt did not establish completion.','error');
   }catch(e){
    if(['CAPTCHA','CANCELLED','VIDEO_REMOVED'].includes(e.message))throw e;
    if(e.name==='NotAllowedError')throw new Error('Playback blocked. Press Play in Discord, then retry.');
    say('Attempt failed: '+e.message,'error');
   }
   if(normal)break;
   if(i<modes.length-1){
    say('Falling back to: '+modes[i+1].name);
    await sleep(2500,r);
   }
  }

  say('All requested attempts failed or stayed unverified. Use Normal 1x and keep Discord visible.','error');
 }catch(e){
  interrupt(r,e);
 } finally{
  if(run===r){
   restore(r);
   run=null;
  }
 }
}

root.addEventListener('click',async e=>{
 const a=e.target.closest('button')?.dataset.a;
 if(!a)return;

 if(a==='collapse'){
  $('dqbody').hidden=!$('dqbody').hidden;
  return;
 }

 if(a==='select')select();
 if(a==='start')start();
 if(a==='normal')start(0,true);
 if(a==='stop')stop();
 if(a==='claim')start(lastMode,false,true);

 if(a==='continue'){
  if(captcha()){
   say('CAPTCHA still appears present. Complete or dismiss it first.','captcha');
   return;
  }
  if(waiting){
   const w=waiting;
   start(w.index,w.normal,w.phase==='claim');
  } else {
   say('No CAPTCHA-paused run to resume.');
  }
 }

 if(a==='confirm'){
  if(run){
   say('Stop the run or wait for it to finish before recording receipt.','error');
   return;
  }
  const id=prompt('Enter a unique quest identifier/name. Only record rewards actually received:');
  if(!id?.trim())return;
  counter();
  const normalized=id.trim().toLowerCase();
  if(ledger.ids.includes(normalized)){
   say('Already recorded this quest in this session/window.','error');
   return;
  }
  const value=prompt('Exact number of orbs Discord confirmed you received (not number of claims):');
  if(value===null)return;
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<=0||n>100000){
   say('Enter a positive whole-number orb amount.','error');
   return;
  }
  ledger.ids.push(normalized);
  ledger.total+=n;
  save();
  counter();
  say(`Recorded ${n} manually confirmed orbs.`);
 }

 if(a==='export'){
  const blob=new Blob([logs.join('\n')],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='discord-orbs-video-skip-log.txt';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
});

addEventListener('pagehide',()=>stop(true));
say('Ready. Disable the previous userscript first. Open exactly one quest video and select it.');
})();
