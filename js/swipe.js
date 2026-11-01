/* ── Swipe gestures on transaction rows (touch devices) ───────
   Swipe right = edit, swipe left = delete (both open their normal dialog, so nothing
   happens without a confirmation). Vertical scrolling is left alone. */
(function(){
  const list=document.getElementById('txn-list');
  if(!list)return;
  let row=null,x0=0,y0=0,dx=0,dragging=false,decided=false;
  const THRESH=80;
  list.addEventListener('touchstart',e=>{
    const r=e.target.closest('.txnrow');
    if(!r||!r.dataset.id||e.target.closest('input,button,a,select'))return;
    row=r;x0=e.touches[0].clientX;y0=e.touches[0].clientY;dx=0;dragging=false;decided=false;
  },{passive:true});
  list.addEventListener('touchmove',e=>{
    if(!row)return;
    const mx=e.touches[0].clientX-x0,my=e.touches[0].clientY-y0;
    if(!decided&&(Math.abs(mx)>8||Math.abs(my)>8)){decided=true;dragging=Math.abs(mx)>Math.abs(my)*1.5;}
    if(!dragging)return;
    dx=mx;
    row.style.transition='none';
    row.style.transform=`translateX(${Math.max(-120,Math.min(120,dx))}px)`;
    row.style.background=dx>0?'#eff6ff':'#fff1f2';
  },{passive:true});
  const end=()=>{
    if(!row)return;
    const r=row,id=r.dataset.id,fire=dragging&&Math.abs(dx)>=THRESH,dir=dx>0?'edit':'delete';
    r.style.transition='transform .2s ease, background .2s ease';
    r.style.transform='';r.style.background='';
    row=null;dragging=false;
    if(fire)setTimeout(()=>{dir==='edit'?openEditTxn(id):confirmDelete(id);},120);
  };
  list.addEventListener('touchend',end);
  list.addEventListener('touchcancel',end);
})();
