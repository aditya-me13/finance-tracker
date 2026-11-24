/* ── Helpers ──────────────────────────────────────────────── */
const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
/* Month cycles: state.monthStartDay (1–28) is the day each "month" begins (e.g. 23 → 23 Nov–22 Dec).
   A month key 'YYYY-MM' names the calendar month the cycle STARTS in. With start day 1 this is the
   plain calendar month. */
const monthStartDay=()=>{const d=Math.floor(Number(typeof state!=='undefined'&&state&&state.monthStartDay));return d>=1&&d<=28?d:1;};
const mkOf=s=>{
  const sd=monthStartDay();
  if(sd===1||Number(s.slice(8,10))>=sd)return s.slice(0,7);
  const y=Number(s.slice(0,4)),m=Number(s.slice(5,7));
  return m===1?`${y-1}-12`:`${y}-${pad(m-1)}`;
};
const curMK=()=>mkOf(today());
const shiftMK=(k,n)=>{const[y,m]=k.split('-').map(Number);const d=new Date(y,m-1+n,1);return`${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
const mkRange=k=>{const[y,m]=k.split('-').map(Number),sd=monthStartDay();return{from:dateToStr(new Date(y,m-1,sd)),to:dateToStr(new Date(y,m,sd-1))};};
const mkLabel=k=>{
  const[y,m]=k.split('-');
  if(monthStartDay()===1)return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const{from,to}=mkRange(k),f=new Date(from+'T00:00:00'),t=new Date(to+'T00:00:00');
  const dm=d=>d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  return f.getFullYear()===t.getFullYear()?`${dm(f)} – ${dm(t)} ${t.getFullYear()}`:`${dm(f)} ${f.getFullYear()} – ${dm(t)} ${t.getFullYear()}`;
};
/* Compact label for chart axes: "Nov 26", or "23 Nov 26" when months start on a custom day */
const mkShortLabel=k=>{
  const[y,m]=k.split('-').map(Number),sd=monthStartDay();
  const s=new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
  return sd===1?s:`${sd} ${s}`;
};
/* Years are built from the same month cycles: the FY is the April cycle through the March cycle,
   a calendar year the January cycle through the December cycle (plain dates when months start on 1st) */
const fyOf=s=>{const k=mkOf(s),y=Number(k.slice(0,4)),m=Number(k.slice(5,7));return String(m>=4?y:y-1);};
const curFY=()=>fyOf(today());
const fyLabel=fy=>`FY ${fy}-${String(Number(fy)+1).slice(-2)}`;
const fyRange=fy=>({from:mkRange(`${fy}-04`).from,to:mkRange(`${Number(fy)+1}-03`).to});
const yearRange=y=>({from:mkRange(`${y}-01`).from,to:mkRange(`${y}-12`).to});
/* How many budget months a date range covers. Whole cycles count 1 each; a partly covered cycle
   counts the share of its days, so monthly budgets scale correctly for any range. */
function monthsInRange(from,to){
  if(!from||!to||from>to)return 0;
  const days=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)+1;
  let n=0;
  for(let k=mkOf(from),end=mkOf(to);k<=end;k=shiftMK(k,1)){
    const r=mkRange(k),a=from>r.from?from:r.from,b=to<r.to?to:r.to;
    n+=days(a,b)/days(r.from,r.to);
  }
  return Math.round(n*1000)/1000;
}
const fmt=n=>'₹'+Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const ordSuffix=n=>{const v=n%100;return(v>=11&&v<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');};
const dateToStr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
/* Shared-expense helpers:
   realAmount  = money that actually left a real bank/cash/CC account (for balances & cash flow)
   shareAmount = your true personal cost regardless of who paid (for category charts & budgets) */
const realAmount=t=>t.type==='expense'?(t.acType==='shared'?0:Number(t.amount)||0):Number(t.amount)||0;
/* Spread expenses: t.spreadMonths = N (2–24) splits one expense's cost evenly across N consecutive
   month cycles in analytics & budgets (e.g. quarterly maintenance → 3). Balances, cash flow of real
   accounts and the transaction log still use the real date and full amount. */
const spreadN=t=>{const n=Math.floor(Number(t.spreadMonths));return(t.type==='expense'||t.type==='income')&&n>=2&&n<=24?n:1;};
const shiftDateMonths=(s,n)=>{
  const y=Number(s.slice(0,4)),m=Number(s.slice(5,7))-1+n,d=Number(s.slice(8,10));
  return dateToStr(new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate())));
};
/* Replace each spread expense/income with N virtual parts (one per month, amount/N each). Read-only: never save these. */
function expandSpread(list){
  const out=[];
  list.forEach(t=>{
    const n=spreadN(t);
    if(n===1){out.push(t);return;}
    const amt=Number(t.amount)||0,sh=shareAmount(t);
    for(let i=0;i<n;i++)out.push({...t,date:shiftDateMonths(t.date,i),amount:amt/n,...(t.type==='expense'?{myShare:sh/n}:{}),spreadPart:i+1});
  });
  return out;
}
const shareAmount=t=>t.type==='expense'?Number(t.myShare!==undefined&&t.myShare!==null&&t.myShare!==''?t.myShare:t.amount)||0:Number(t.amount)||0;

/* ── Toast ────────────────────────────────────────────────── */
let _tt;
function toast(msg,ms=2400,action=null){
  const el=document.getElementById('toast');document.getElementById('toast-msg').textContent=msg;
  const actionBtn=document.getElementById('toast-action');
  if(action&&actionBtn){
    actionBtn.textContent=action.label;
    actionBtn.classList.remove('hidden');
    actionBtn.onclick=()=>{clearTimeout(_tt);el.classList.add('hidden');action.onClick();}; // onClick may show its own toast, so hide first
  }else if(actionBtn){
    actionBtn.classList.add('hidden');
    actionBtn.onclick=null;
  }
  el.classList.remove('hidden','hiding');clearTimeout(_tt);
  _tt=setTimeout(()=>{el.classList.add('hiding');setTimeout(()=>el.classList.add('hidden'),200);},ms);
}
/* Generic "Deleted. Undo?" pattern — the item is already removed & saved;
   restoreFn puts it back if the user clicks Undo within the toast window. */
function showUndoToast(msg,restoreFn){
  toast(msg,5000,{label:'Undo',onClick:restoreFn});
}
/* ── Confirm dialog: one modal, re-labelled per use so the title and button
   always name the action that will actually happen ─────────────────────── */
const _CONFIRM_ICONS={
  danger:'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  warn:'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
};
function prepConfirm(title,okLabel,tone='danger'){
  document.getElementById('confirm-title').textContent=title;
  const ok=document.getElementById('confirm-ok-btn');ok.textContent=okLabel;
  document.getElementById('confirm-icon').className='confirm-icon '+tone;
  document.getElementById('confirm-icon-path').setAttribute('d',_CONFIRM_ICONS[tone]||_CONFIRM_ICONS.danger);
}

/* ── Inline field errors: message sits under the field, field is marked invalid
   and focused; cleared as soon as the user edits it ──────────────────────── */
function _fieldBox(el){return el.closest('.fw')||(el.type==='hidden'?el.previousElementSibling:null)||el;}
function clearFieldError(el){
  if(typeof el==='string')el=document.getElementById(el);if(!el)return;
  const box=_fieldBox(el);box.classList.remove('is-invalid');el.removeAttribute('aria-invalid');
  const msg=el.id&&document.getElementById(el.id+'-err');if(msg)msg.remove();
  if(el.getAttribute('aria-describedby')===el.id+'-err')el.removeAttribute('aria-describedby');
}
function fieldError(id,msg){
  const el=document.getElementById(id);
  if(!el||el.offsetParent===null&&el.type!=='hidden'){toast(msg);return false;}
  clearFieldError(el);
  const box=_fieldBox(el);
  box.classList.add('is-invalid');el.setAttribute('aria-invalid','true');
  const p=document.createElement('p');p.className='field-err';p.setAttribute('role','alert');p.id=id+'-err';p.textContent=msg;
  // In a horizontal row (input + button) put the message under the whole row
  const par=box.parentElement,cs=par&&getComputedStyle(par);
  const anchor=cs&&cs.display==='flex'&&cs.flexDirection==='row'&&par.children.length>1?par:box;
  anchor.insertAdjacentElement('afterend',p);
  el.setAttribute('aria-describedby',p.id);
  const off=()=>{clearFieldError(el);box.removeEventListener('input',off);box.removeEventListener('change',off);box.removeEventListener('click',off);};
  box.addEventListener('input',off);box.addEventListener('change',off);
  if(box!==el||el.classList.contains('ef-chips'))box.addEventListener('click',off);
  const focusEl=box.matches('input,select,textarea,[tabindex]')?box:box.querySelector('input:not([type=hidden]),select,button,[tabindex]');
  if(focusEl&&focusEl.focus)focusEl.focus();
  return false;
}
/* Close the dialog-specific errors when a modal is reopened */
function clearErrorsIn(root){root.querySelectorAll('.field-err').forEach(p=>p.remove());root.querySelectorAll('.is-invalid').forEach(b=>b.classList.remove('is-invalid'));root.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));}

let _modalReturnFocus=[];
function openModal(id){
  const el=document.getElementById(id);
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  if(!el.hasAttribute('aria-labelledby')&&!el.hasAttribute('aria-label')){
    const h=el.querySelector('h3');if(h){if(!h.id)h.id=id+'-title';el.setAttribute('aria-labelledby',h.id);}
  }
  _modalReturnFocus.push({id,el:document.activeElement});
  clearErrorsIn(el);
  el.classList.remove('hidden');
  const first=el.querySelector('input:not([type=hidden]),select,textarea,button.btn-p');
  if(first&&first.focus)setTimeout(()=>first.focus(),30);
}
function closeModal(id){
  document.getElementById(id).classList.add('hidden');
  const i=_modalReturnFocus.map(m=>m.id).lastIndexOf(id);
  if(i>=0){const[{el}]=_modalReturnFocus.splice(i,1);if(el&&el.focus&&document.contains(el))el.focus();}
}
/* Keep Tab / Shift+Tab inside the top-most open dialog */
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const open=[...document.querySelectorAll('.mo:not(.hidden)')];if(!open.length)return;
  const box=open[open.length-1].querySelector('.mb,.confirm-box')||open[open.length-1];
  const f=[...box.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[tabindex]:not([tabindex="-1"]),summary')].filter(x=>!x.disabled&&x.offsetParent!==null);
  if(!f.length)return;
  const first=f[0],last=f[f.length-1];
  if(!box.contains(document.activeElement)){e.preventDefault();first.focus();}
  else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
