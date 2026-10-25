/* ── Helpers ──────────────────────────────────────────────── */
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const mkOf=s=>s.slice(0,7);
const curMK=()=>today().slice(0,7);
const mkLabel=k=>{const[y,m]=k.split('-');return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});};
const fyOf=s=>{const y=Number(s.slice(0,4)),m=Number(s.slice(5,7));return String(m>=4?y:y-1);};
const curFY=()=>fyOf(today());
const fyLabel=fy=>`FY ${fy}-${String(Number(fy)+1).slice(-2)}`;
const fyRange=fy=>({from:`${fy}-04-01`,to:`${Number(fy)+1}-03-31`});
const fmt=n=>'₹'+Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const dateToStr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
/* Shared-expense helpers:
   realAmount  = money that actually left a real bank/cash/CC account (for balances & cash flow)
   shareAmount = your true personal cost regardless of who paid (for category charts & budgets) */
const realAmount=t=>t.type==='expense'?(t.acType==='shared'?0:Number(t.amount)||0):Number(t.amount)||0;
const shareAmount=t=>t.type==='expense'?Number(t.myShare!==undefined&&t.myShare!==null&&t.myShare!==''?t.myShare:t.amount)||0:Number(t.amount)||0;

/* ── Toast ────────────────────────────────────────────────── */
let _tt;
function toast(msg,ms=2400,action=null){
  const el=document.getElementById('toast');document.getElementById('toast-msg').textContent=msg;
  const actionBtn=document.getElementById('toast-action');
  if(action&&actionBtn){
    actionBtn.textContent=action.label;
    actionBtn.classList.remove('hidden');
    actionBtn.onclick=()=>{action.onClick();el.classList.add('hiding');setTimeout(()=>el.classList.add('hidden'),200);clearTimeout(_tt);};
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
const openModal=id=>document.getElementById(id).classList.remove('hidden');
const closeModal=id=>document.getElementById(id).classList.add('hidden');

