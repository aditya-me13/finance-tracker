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
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&(e.target.id==='auth-email'||e.target.id==='auth-pass'))doSignIn();
});
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
const fmtDMY=iso=>{if(!iso)return'Select date';const[y,m,d]=iso.split('-');return`${d}.${m}.${y}`;};
function setDateVal(id,iso){
  const el=document.getElementById(id);if(el)el.value=iso||'';
  const disp=document.getElementById(id+'-disp');
  if(disp)disp.textContent=fmtDMY(iso);
}
function daysInMonth(year,monthIdx){return new Date(year,monthIdx+1,0).getDate();}
function buildWheelCol(el,items,selIdx){
  const spacer='<div class="wheel-spacer"></div>';
  el.innerHTML=spacer+items.map((label,i)=>`<div class="wheel-item${i===selIdx?' sel':''}">${label}</div>`).join('')+spacer;
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
  },120);
}
function syncDayWheel(){
  const dEl=document.getElementById('wheel-day'),mEl=document.getElementById('wheel-month'),yEl=document.getElementById('wheel-year');
  const monthIdx=wheelIndex(mEl),year=Number(yEl._items[wheelIndex(yEl)]);
  const curDay=Number(dEl._items[wheelIndex(dEl)]);
  const dc=daysInMonth(year,monthIdx);
  if(dEl._items.length!==dc||curDay>dc){
    const newDay=Math.min(curDay,dc);
    buildWheelCol(dEl,Array.from({length:dc},(_,i)=>String(i+1).padStart(2,'0')),newDay-1);
  }
}
let _dateTargetId=null;
function openDatePicker(targetId){
  _dateTargetId=targetId;
  const cur=document.getElementById(targetId).value;
  const base=cur?new Date(cur+'T00:00:00'):new Date();
  const year=base.getFullYear(),monthIdx=base.getMonth(),day=base.getDate();
  const dc=daysInMonth(year,monthIdx);
  const years=[];for(let y=year-7;y<=year+3;y++)years.push(String(y));
  openModal('modal-datewheel');
  requestAnimationFrame(()=>{
    buildWheelCol(document.getElementById('wheel-day'),Array.from({length:dc},(_,i)=>String(i+1).padStart(2,'0')),Math.min(day,dc)-1);
    buildWheelCol(document.getElementById('wheel-month'),MONTH_NAMES,monthIdx);
    buildWheelCol(document.getElementById('wheel-year'),years,years.indexOf(String(year)));
    document.getElementById('wheel-day').focus();
  });
}
function confirmDatePicker(){
  syncDayWheel(); // e.g. month changed to Feb just before confirming: clamp the day first
  const dEl=document.getElementById('wheel-day'),mEl=document.getElementById('wheel-month'),yEl=document.getElementById('wheel-year');
  const day=dEl._items[wheelIndex(dEl)],monthIdx=wheelIndex(mEl),year=yEl._items[wheelIndex(yEl)];
  const iso=`${year}-${pad(monthIdx+1)}-${day}`;
  if(_dateTargetId){
    setDateVal(_dateTargetId,iso);
    if(_dateTargetId==='rng-from'||_dateTargetId==='rng-to')applyCustomRange();
    if(_dateTargetId==='txn-filter-from'||_dateTargetId==='txn-filter-to')applyTxnFilter();
  }
  closeModal('modal-datewheel');
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

