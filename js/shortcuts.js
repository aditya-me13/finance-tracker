/* ── Keyboard Shortcuts ───────────────────────────────────── */
function isTypingContext(el){
  if(!el)return false;
  const tag=el.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||el.isContentEditable;
}
function anyModalOpen(){
  return document.querySelector('.mo:not(.hidden):not(#auth-gate)')!==null;
}
function closeTopModal(){
  const openModals=document.querySelectorAll('.mo:not(.hidden):not(#auth-gate)');
  if(!openModals.length)return false;
  openModals[openModals.length-1].classList.add('hidden');
  return true;
}
document.addEventListener('keydown',e=>{
  // Escape always closes the top-most open modal, regardless of focus context
  if(e.key==='Escape'){
    if(closeTopModal())e.preventDefault();
    return;
  }
  // Ignore other shortcuts while typing in a field or while a modal is open
  if(isTypingContext(e.target))return;
  if(anyModalOpen())return;
  if(e.key==='n'||e.key==='N'){
    e.preventDefault();
    switchView('dashboard');
    setTxn('expense');
    const amtField=document.getElementById('e-amt');
    if(amtField){amtField.focus();if(amtField.select)amtField.select();}
  }else if(e.key==='/'){
    e.preventDefault();
    switchView('dashboard');
    switchTab('log');
    const searchField=document.getElementById('txn-filter-search');
    if(searchField)searchField.focus();
  }
});
