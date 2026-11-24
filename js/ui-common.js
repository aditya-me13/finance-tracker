/* ── Auth ─────────────────────────────────────────────────── */
const AUTH_ERRORS={
  'auth/invalid-credential':'Incorrect email or password.','auth/wrong-password':'Incorrect email or password.','auth/user-not-found':'No account found for this email.',
  'auth/invalid-email':'Enter a valid email address.','auth/email-already-in-use':'An account with this email already exists. Try signing in.',
  'auth/weak-password':'Password must be at least 6 characters.','auth/too-many-requests':'Too many attempts. Wait a bit and try again.','auth/network-request-failed':'Network error. Check your connection.'
};
const authMsg=e=>AUTH_ERRORS[e&&e.code]||(e&&e.message)||'Something went wrong.';
function doResetPassword(){
  const email=document.getElementById('auth-email').value.trim();
  if(!email){showAuthErr('Enter your email above, then click "Forgot password?"');return;}
  auth.sendPasswordResetEmail(email).then(()=>{document.getElementById('auth-err').style.display='none';toast('Password reset email sent',3500);}).catch(e=>showAuthErr(authMsg(e)));
}
function showAuthErr(msg){
  const el=document.getElementById('auth-err');
  el.textContent=msg;el.style.display='block';
}
function doSignIn(){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  if(!email||!pass){showAuthErr('Enter email and password');return;}
  document.getElementById('auth-err').style.display='none';
  _signedInThisLoad=true;authReady.then(()=>auth.signInWithEmailAndPassword(email,pass)).catch(e=>{_signedInThisLoad=false;showAuthErr(authMsg(e));});
}
function doSignUp(){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  if(!email||!pass){showAuthErr('Enter email and password');return;}
  if(pass.length<6){showAuthErr('Password must be at least 6 characters');return;}
  document.getElementById('auth-err').style.display='none';
  _signedInThisLoad=true;authReady.then(()=>auth.createUserWithEmailAndPassword(email,pass)).catch(e=>{_signedInThisLoad=false;showAuthErr(authMsg(e));});
}
/* No auto-login: auth lives in memory only, so every reload asks for credentials */
const authReady=auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(()=>{});
let _signedInThisLoad=false;
async function doSignOut(){
  try{
    if(_saveTimer&&currentUid&&_cloudReady){clearTimeout(_saveTimer);_saveTimer=null;await pushToCloud();}
  }catch(e){}
  try{await auth.signOut();}catch(e){}
  location.reload();
}
auth.onAuthStateChanged(async user=>{
  if(user&&!_signedInThisLoad){
    /* leftover session from earlier persistence mode: drop it */
    try{await auth.signOut();}catch(e){}
    return;
  }
  if(user){
    currentUid=user.uid;
    const me=document.getElementById('acct-menu-email');if(me)me.textContent=user.email||'';
    document.getElementById('auth-gate').classList.add('hidden');
    document.querySelector('.shell').style.display='grid';
    const shell=document.querySelector('.shell');
    shell.classList.add('loading'); // skeleton shimmer until data has arrived
    await loadStateFromCloud();
    boot();
    shell.classList.remove('loading');
  }else{
    currentUid=null;
    document.getElementById('auth-gate').classList.remove('hidden');
    document.querySelector('.shell').style.display='none';
  }
});

/* ── Date Wheel Picker ────────────────────────────────────── */
const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
const WHEEL_ITEM_H=36;
const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const isoAddDays=(iso,n)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return dateToStr(d);};
// Relative label for nearby dates ("Today", "Yesterday", "Tomorrow"), else ''
const relDayLabel=iso=>{const t=today();if(iso===t)return'Today';if(iso===isoAddDays(t,-1))return'Yesterday';if(iso===isoAddDays(t,1))return'Tomorrow';return'';};
// Compact field display with weekday, e.g. "Mon, 23 Nov" (year added when not the current year)
const fmtDMY=iso=>{
  if(!iso)return'Select date';
  const d=new Date(iso+'T00:00:00');
  const yr=d.getFullYear()!==new Date().getFullYear()?` '${String(d.getFullYear()).slice(-2)}`:'';
  return`${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)}${yr}`;
};
function setDateVal(id,iso){
  const el=document.getElementById(id);if(el)el.value=iso||'';
  const disp=document.getElementById(id+'-disp');
  if(disp){
    disp.textContent=fmtDMY(iso);
    const rel=iso?relDayLabel(iso):'';
    const d=iso?new Date(iso+'T00:00:00'):null;
    const off=iso?marketClosedReason(iso):'';
    disp.parentElement.title=d?`${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}${rel?' · '+rel:''}${off?' · market closed':''}`:'';
  }
}
function daysInMonth(year,monthIdx){return new Date(year,monthIdx+1,0).getDate();}
function buildWheelCol(el,items,selIdx,classes){
  const spacer='<div class="wheel-spacer"></div>';
  el.innerHTML=spacer+items.map((label,i)=>`<div class="wheel-item${classes&&classes[i]?' '+classes[i]:''}${i===selIdx?' sel':''}">${label}</div>`).join('')+spacer;
  el._items=items;
  el._kbIdx=undefined;
  el.scrollTop=selIdx*WHEEL_ITEM_H;
  markSelected(el,selIdx);
}
function markSelected(el,idx){
  el.querySelectorAll('.wheel-item').forEach((c,i)=>c.classList.toggle('sel',i===idx));
  if(el._items)el.setAttribute('aria-valuetext',el._items[idx]);
}
/* Keyboard control for the wheel: Up/Down +-1, PageUp/PageDown +-5, Home/End, Left/Right between
   columns, Enter confirms. The wheels stay scrollable by mouse/touch exactly as before. */
function wheelMove(el,idx){
  if(!el._items)return;
  idx=Math.max(0,Math.min(el._items.length-1,idx));
  markSelected(el,idx);
  el._kbIdx=idx;el._kbT=Date.now();
  if(el.id==='wheel-month'||el.id==='wheel-year')setTimeout(syncDayWheel,0);
  el.scrollTo({top:idx*WHEEL_ITEM_H,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  if(el.id==='wheel-day')updateDwPreview();
}
document.addEventListener('keydown',e=>{
  const el=e.target;
  if(el.classList&&el.classList.contains('date-trigger')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.click();return;}
  if(!el.classList||!el.classList.contains('wheel-col'))return;
  const cols=['wheel-day','wheel-month','wheel-year'].map(id=>document.getElementById(id));
  const cur=wheelIndex(el);
  const step={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[e.key];
  if(step){e.preventDefault();wheelMove(el,cur+step);}
  else if(e.key==='Home'){e.preventDefault();wheelMove(el,0);}
  else if(e.key==='End'){e.preventDefault();wheelMove(el,el._items.length-1);}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
    e.preventDefault();
    const i=cols.indexOf(el)+(e.key==='ArrowRight'?1:-1);
    if(cols[i])cols[i].focus();
  }else if(e.key==='Enter'){e.preventDefault();confirmDatePicker();}
  else if(e.key==='t'||e.key==='T'){e.preventDefault();setWheelsTo(today());}
  else if(e.key==='['||e.key===']'){e.preventDefault();shiftWeek(e.key===']'?1:-1);}
});
// Make every date field a real keyboard-reachable button
document.querySelectorAll('.date-trigger').forEach(t=>{
  t.setAttribute('tabindex','0');t.setAttribute('role','button');
  const lbl=t.previousElementSibling;
  t.setAttribute('aria-label',(lbl&&lbl.classList.contains('slabel')?lbl.textContent.trim():'Date')+' – choose date');
});
function wheelIndex(el){
  // Right after a keyboard move the smooth scroll is still animating, so trust the target index
  if(el._kbIdx!==undefined&&Date.now()-el._kbT<700)return el._kbIdx;
  return Math.max(0,Math.min(el._items.length-1,Math.round(el.scrollTop/WHEEL_ITEM_H)));
}
function onWheelScroll(el){
  clearTimeout(el._st);
  el._st=setTimeout(()=>{
    const idx=wheelIndex(el);
    markSelected(el,idx);
    if(el.id==='wheel-month'||el.id==='wheel-year')syncDayWheel();
    else updateDwPreview();
  },120);
}
// Day wheel items carry their weekday ("23 Mon"); the value is always index+1
function buildDayWheel(year,monthIdx,day){
  const dc=daysInMonth(year,monthIdx);
  const items=Array.from({length:dc},(_,i)=>`${pad(i+1)} ${DAY_SHORT[new Date(year,monthIdx,i+1).getDay()]}`);
  // Days the stock market is shut (weekends + NSE holidays) are tinted
  const cls=Array.from({length:dc},(_,i)=>marketClosedReason(`${year}-${pad(monthIdx+1)}-${pad(i+1)}`)?'mkt-off':'');
  buildWheelCol(document.getElementById('wheel-day'),items,Math.min(day,dc)-1,cls);
}
function syncDayWheel(){
  const dEl=document.getElementById('wheel-day'),mEl=document.getElementById('wheel-month'),yEl=document.getElementById('wheel-year');
  const monthIdx=wheelIndex(mEl),year=Number(yEl._items[wheelIndex(yEl)]);
  const curDay=wheelIndex(dEl)+1;
  // Rebuild whenever month/year moves: day count and weekday labels both change
  if(dEl._y!==year||dEl._m!==monthIdx){buildDayWheel(year,monthIdx,curDay);dEl._y=year;dEl._m=monthIdx;}
  updateDwPreview();
}
function getWheelISO(){
  const dEl=document.getElementById('wheel-day'),mEl=document.getElementById('wheel-month'),yEl=document.getElementById('wheel-year');
  if(!dEl._items||!mEl._items||!yEl._items)return null;
  const year=Number(yEl._items[wheelIndex(yEl)]),monthIdx=wheelIndex(mEl);
  const day=Math.min(wheelIndex(dEl)+1,daysInMonth(year,monthIdx));
  return`${year}-${pad(monthIdx+1)}-${pad(day)}`;
}
// Big "Monday, 23 November 2026 · Today" header + highlight the matching quick-pick chip
function updateDwPreview(){
  const iso=getWheelISO();if(!iso)return;
  const d=new Date(iso+'T00:00:00'),rel=relDayLabel(iso);
  const p=document.getElementById('dw-preview');
  // Keep the Mon–Sun strip on the selected date's week: jump only when the date falls outside it
  if(!_dwEnd||iso>_dwEnd||iso<isoAddDays(_dwEnd,-6)){_dwEnd=sundayOf(iso);renderDwQuick();}
  // Header describes the week shown, e.g. "17th Monday to 23rd Sunday", with the picked day below
  const s=new Date(isoAddDays(_dwEnd,-6)+'T00:00:00'),e=new Date(_dwEnd+'T00:00:00');
  const nth=x=>`${x.getDate()}${ordSuffix(x.getDate())}`;
  const mon=x=>MONTH_NAMES[x.getMonth()];
  const span=s.getMonth()===e.getMonth()?`${mon(e)} ${e.getFullYear()}`
    :s.getFullYear()===e.getFullYear()?`${mon(s).slice(0,3)} – ${mon(e).slice(0,3)} ${e.getFullYear()}`
    :`${mon(s).slice(0,3)} ${s.getFullYear()} – ${mon(e).slice(0,3)} ${e.getFullYear()}`;
  const off=marketClosedReason(iso),wkday=d.getDay()===0||d.getDay()===6;
  const sipHint=_dateTargetId==='inv-hold-date'?` — SIP buys on ${fmtDMY(nextMarketDay(iso))}`:'';
  const offNote=off?`<div class="dw-mkt">Market closed${wkday?'':' · '+esc(off)}${sipHint}</div>`:'';
  if(p)p.innerHTML=`<div class="dw-dow">${nth(s)} Mon to ${nth(e)} Sun</div><div class="dw-full">${span} · <b>${DAY_SHORT[d.getDay()]} ${d.getDate()}</b>${rel?` <span class="dw-rel">${rel}</span>`:''}</div>${offNote}`;
  document.querySelectorAll('#dw-quick .dw-q').forEach(b=>b.classList.toggle('sel',b.dataset.iso===iso));
}
// Sunday that ends the Monday-first week containing iso
const sundayOf=iso=>{const wd=new Date(iso+'T00:00:00').getDay();return isoAddDays(iso,(7-wd)%7);};
// Quick picks: a Monday–Sunday strip ending on _dwEnd; one tap selects and closes
let _dwEnd=null;
function renderDwQuick(){
  const wrap=document.getElementById('dw-quick');if(!wrap||!_dwEnd)return;
  const t=today(),y=isoAddDays(t,-1);
  wrap.innerHTML=Array.from({length:7},(_,i)=>{
    const iso=isoAddDays(_dwEnd,i-6),d=new Date(iso+'T00:00:00');
    const top=iso===t?'Today':iso===y?'Yest':DAY_SHORT[d.getDay()];
    // Show the month on the first chip and wherever a new month starts, so a shifted week is easy to read
    const mon=(i===0||d.getDate()===1)?`<i>${MONTH_NAMES[d.getMonth()].slice(0,3)}</i>`:'<i>&nbsp;</i>';
    const off=marketClosedReason(iso),hol=off&&off!=='Saturday'&&off!=='Sunday';
    const tip=off?` · market closed${hol?' ('+esc(off)+')':''}`:'';
    return`<button type="button" class="dw-q${off?' mkt-off':''}${hol?' mkt-hol':''}" data-iso="${iso}" onclick="pickQuickDate('${iso}')" title="${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${tip}" aria-label="${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${tip}">${mon}<span>${top}</span><b>${d.getDate()}</b></button>`;
  }).join('');
}
// ‹ › buttons: slide the whole strip (and the selected date) by one week
function shiftWeek(n){
  const iso=getWheelISO();if(!iso)return;
  _dwEnd=isoAddDays(_dwEnd||today(),7*n);renderDwQuick();
  setWheelsTo(isoAddDays(iso,7*n));
}
function pickQuickDate(iso){applyPickedDate(iso);}
let _dateTargetId=null;
function setWheelsTo(iso){
  const base=new Date(iso+'T00:00:00');
  const year=base.getFullYear(),monthIdx=base.getMonth(),day=base.getDate();
  const yEl=document.getElementById('wheel-year'),dEl=document.getElementById('wheel-day');
  let years=yEl._items;
  if(!years||!years.includes(String(year))){years=[];for(let y=year-7;y<=year+3;y++)years.push(String(y));}
  buildDayWheel(year,monthIdx,day);dEl._y=year;dEl._m=monthIdx;
  buildWheelCol(document.getElementById('wheel-month'),MONTH_NAMES,monthIdx);
  buildWheelCol(yEl,years,years.indexOf(String(year)));
  updateDwPreview();
}
function openDatePicker(targetId){
  _dateTargetId=targetId;
  const cur=document.getElementById(targetId).value;
  openModal('modal-datewheel');
  _dwEnd=sundayOf(cur||today());renderDwQuick(); // the Mon–Sun week of the shown date
  requestAnimationFrame(()=>{
    document.getElementById('wheel-year')._items=null; // fresh year range around the shown date
    setWheelsTo(cur||today());
    document.getElementById('wheel-day').focus();
  });
}
function applyPickedDate(iso){
  if(_dateTargetId){
    setDateVal(_dateTargetId,iso);
    if(_dateTargetId==='rng-from'||_dateTargetId==='rng-to')applyCustomRange();
    if(_dateTargetId==='txn-filter-from'||_dateTargetId==='txn-filter-to')applyTxnFilter();
  }
  closeModal('modal-datewheel');
}
function confirmDatePicker(){
  syncDayWheel(); // e.g. month changed to Feb just before confirming: clamp the day first
  const iso=getWheelISO();if(iso)applyPickedDate(iso);
}

/* ── Delete Confirmation ──────────────────────────────────── */
function confirmDelete(id){
  const t=state.transactions.find(x=>x.id===id);
  if(!t)return;
  if(t.type==='invest'||t.type==='divest'){toast('Manage this from the Investments tab');return;}
  _pendingDeleteId=id;
  let desc='';
  if(t.type==='expense')desc=`${t.category} — ${fmt(t.amount)} on ${fmtDate(t.date)}`;
  else if(t.type==='income')desc=`${t.category} income — ${fmt(t.amount)} on ${fmtDate(t.date)}`;
  else desc=`Transfer of ${fmt(t.amount)} on ${fmtDate(t.date)}`;
  prepConfirm('Delete transaction?','Delete');
  document.getElementById('confirm-body').textContent=`Delete "${desc}"? You can undo this right after.`;
  document.getElementById('confirm-ok-btn').onclick=()=>{
    if(_pendingDeleteId){
      const removed=state.transactions.find(x=>x.id===_pendingDeleteId);
      state.transactions=state.transactions.filter(x=>x.id!==_pendingDeleteId);
      _pendingDeleteId=null;
      let tenureBumped=false;
      const loan=removed&&removed.loanId?state.loans.find(l=>l.id===removed.loanId):null;
      if(loan){ // an EMI entry reduced the loan when logged, so give that back
        loan.outstanding=(Number(loan.outstanding)||0)+(Number(removed.amount)||0);
        if(loan.tenureMonths>0){loan.tenureMonths+=1;tenureBumped=true;}
      }
      saveState();rebuildAll();
      if(removed)showUndoToast('Transaction deleted',()=>{
        state.transactions.push(removed);
        if(loan){loan.outstanding=Math.max(0,(Number(loan.outstanding)||0)-(Number(removed.amount)||0));if(tenureBumped)loan.tenureMonths=Math.max(0,loan.tenureMonths-1);}
        saveState();rebuildAll();
        toast('Restored');
      });
    }
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}

