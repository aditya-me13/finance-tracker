/* ── Auth ─────────────────────────────────────────────────── */
function showAuthErr(msg){
  const el=document.getElementById('auth-err');
  el.textContent=msg;el.style.display='block';
}
function doSignIn(){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  if(!email||!pass){showAuthErr('Enter email and password');return;}
  document.getElementById('auth-err').style.display='none';
  _signedInThisLoad=true;authReady.then(()=>auth.signInWithEmailAndPassword(email,pass)).catch(e=>{_signedInThisLoad=false;showAuthErr(e.message);});
}
function doSignUp(){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-pass').value;
  if(!email||!pass){showAuthErr('Enter email and password');return;}
  if(pass.length<6){showAuthErr('Password must be at least 6 characters');return;}
  document.getElementById('auth-err').style.display='none';
  _signedInThisLoad=true;authReady.then(()=>auth.createUserWithEmailAndPassword(email,pass)).catch(e=>{_signedInThisLoad=false;showAuthErr(e.message);});
}
/* No auto-login: auth lives in memory only, so every reload asks for credentials */
const authReady=auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(()=>{});
let _signedInThisLoad=false;
async function doSignOut(){
  try{
    if(_saveTimer&&currentUid){clearTimeout(_saveTimer);_saveTimer=null;await pushToCloud();}
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
    await loadStateFromCloud();
    boot();
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
  el.scrollTop=selIdx*WHEEL_ITEM_H;
  markSelected(el,selIdx);
}
function markSelected(el,idx){
  el.querySelectorAll('.wheel-item').forEach((c,i)=>c.classList.toggle('sel',i===idx));
}
function wheelIndex(el){return Math.max(0,Math.min(el._items.length-1,Math.round(el.scrollTop/WHEEL_ITEM_H)));}
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
  });
}
function confirmDatePicker(){
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
      saveState();rebuildAll();
      if(removed)showUndoToast('Transaction deleted',()=>{
        state.transactions.push(removed);
        saveState();rebuildAll();
        toast('Restored');
      });
    }
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}

