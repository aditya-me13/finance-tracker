/* ── Export / Import ──────────────────────────────────────── */
function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`finance-backup-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Exported');
}
function importData(ev){
  const file=ev.target.files[0];if(!file)return;
  new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsText(file);}).then(txt=>{
    let imp;
    try{
      imp=JSON.parse(txt);
      if(!imp||typeof imp!=='object'||(!Array.isArray(imp.transactions)&&!Array.isArray(imp.expenses)))throw 0;
      if(!Array.isArray(imp.transactions))imp.transactions=imp.expenses.map(e=>({...e,type:'expense',acType:imp.banks?.[0]?.id?'bank':'cash',acId:imp.banks?.[0]?.id||'cash'}));
      if(!imp.categories||!imp.categories.expense)imp.categories={expense:[...DEF_EXP],income:[...DEF_INC]};
      if(!Array.isArray(imp.banks))imp.banks=[];if(!Array.isArray(imp.cards))imp.cards=[];
      if(!imp.cash)imp.cash={startBalance:imp.config?.cashBase||0};
      if(!imp.categoryBudgets)imp.categoryBudgets={};
      if(!imp.investments)imp.investments={accounts:[],holdings:[]};
      // Normalize a candidate before touching live state, so a bad file can't corrupt it
      const live=state;
      state=imp;
      try{normalizeState();}catch(err){state=live;throw err;}
      state=live;
    }catch{toast('Import failed: invalid file');return;}
    prepConfirm('Replace all data?','Replace data','warn');
    document.getElementById('confirm-body').textContent=
      `Replace ALL current data with this file (${imp.transactions.length} transactions, ${imp.banks.length} banks, ${imp.cards.length} cards)? A backup of your current data will be downloaded first.`;
    document.getElementById('confirm-ok-btn').onclick=()=>{
      exportData();
      state=imp;normalizeState();saveState();rebuildAll();
      closeModal('modal-confirm');toast('Data imported');
    };
    openModal('modal-confirm');
  });
  ev.target.value='';
}

/* ── Top-bar "Data & account" menu ────────────────────────── */
function closeAcctMenu(focusBtn){
  const l=document.getElementById('acct-menu-list');if(!l||l.classList.contains('hidden'))return false;
  l.classList.add('hidden');const b=document.getElementById('acct-menu-btn');b.setAttribute('aria-expanded','false');
  if(focusBtn)b.focus();return true;
}
function toggleAcctMenu(){
  const l=document.getElementById('acct-menu-list');
  if(!l.classList.contains('hidden')){closeAcctMenu();return;}
  l.classList.remove('hidden');document.getElementById('acct-menu-btn').setAttribute('aria-expanded','true');
  const first=l.querySelector('.menu-item');if(first)first.focus();
}
document.addEventListener('click',e=>{if(!e.target.closest('#acct-menu'))closeAcctMenu();});
document.addEventListener('keydown',e=>{
  const l=document.getElementById('acct-menu-list');if(!l||l.classList.contains('hidden'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeAcctMenu(true);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();const items=[...l.querySelectorAll('.menu-item')],i=items.indexOf(document.activeElement);
    items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
  }
  if(e.key==='Tab')closeAcctMenu();
},true);

/* Scrolling the page over a focused number field must not change the amount */
document.addEventListener('wheel',e=>{
  const a=document.activeElement;
  if(a&&a.type==='number'&&e.target===a)a.blur();
},{passive:true});

/* ── Sidebar: collapse (title button / Ctrl+B) and drag-to-resize, both remembered ── */
const SB_MIN=200,SB_MAX=480,SB_DEFAULT=264;
function _shell(){return document.querySelector('.shell');}
function setSidebarWidth(px,save=true){
  const w=Math.round(Math.min(SB_MAX,Math.max(SB_MIN,px)));
  _shell().style.setProperty('--sb-w',w+'px');
  const h=document.getElementById('sb-resizer');if(h){h.setAttribute('aria-valuenow',w);h.setAttribute('aria-valuemin',SB_MIN);h.setAttribute('aria-valuemax',SB_MAX);}
  if(save)try{localStorage.setItem('ft-sb-w',String(w));}catch(e){}
  return w;
}
function setSidebarCollapsed(collapsed,save=true){
  _shell().classList.toggle('sb-collapsed',collapsed);
  const sb=document.getElementById('sidebar');sb.inert=collapsed; // hidden sidebar is skipped by Tab and screen readers
  const b=document.getElementById('sb-toggle');
  b.setAttribute('aria-expanded',String(!collapsed));
  b.title=(collapsed?'Show':'Hide')+' sidebar (Ctrl+B)';
  if(save)try{localStorage.setItem('ft-sb-collapsed',collapsed?'1':'0');}catch(e){}
}
function toggleSidebar(){setSidebarCollapsed(!_shell().classList.contains('sb-collapsed'));}
(()=>{
  let w=SB_DEFAULT,c=false;
  try{w=Number(localStorage.getItem('ft-sb-w'))||SB_DEFAULT;c=localStorage.getItem('ft-sb-collapsed')==='1';}catch(e){}
  setSidebarWidth(w,false);setSidebarCollapsed(c,false);
  const h=document.getElementById('sb-resizer');if(!h)return;
  h.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();
    h.setPointerCapture(e.pointerId);_shell().classList.add('sb-resizing');
    const move=ev=>setSidebarWidth(ev.clientX,false);
    const up=ev=>{
      h.releasePointerCapture(ev.pointerId);_shell().classList.remove('sb-resizing');
      h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);
      setSidebarWidth(ev.clientX);
    };
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
  });
  h.addEventListener('dblclick',()=>setSidebarWidth(SB_DEFAULT));
  h.addEventListener('keydown',e=>{
    const cur=parseInt(getComputedStyle(_shell()).getPropertyValue('--sb-w'))||SB_DEFAULT,step=e.shiftKey?48:16;
    if(e.key==='ArrowLeft'){e.preventDefault();setSidebarWidth(cur-step);}
    else if(e.key==='ArrowRight'){e.preventDefault();setSidebarWidth(cur+step);}
    else if(e.key==='Home'){e.preventDefault();setSidebarWidth(SB_MIN);}
    else if(e.key==='End'){e.preventDefault();setSidebarWidth(SB_MAX);}
    else if(e.key==='Enter'){e.preventDefault();toggleSidebar();}
  });
})();

/* Stat tiles: shrink a figure (never below 0.85rem) until it fits its tile, instead of truncating it */
function fitStatValues(root=document){
  root.querySelectorAll('.stat-tile .val').forEach(v=>{
    if(v.offsetParent===null)return;
    if(v.dataset.fs===undefined)v.dataset.fs=v.style.fontSize; // keep any size set by the renderer
    v.style.fontSize=v.dataset.fs;
    const max=parseFloat(getComputedStyle(v).fontSize),min=13.6;
    let size=max;
    while(v.scrollWidth>v.clientWidth+0.5&&size>min){size-=0.5;v.style.fontSize=size+'px';}
  });
}
(()=>{
  let raf=0;const later=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>fitStatValues());};
  const grids=document.querySelectorAll('.stat-grid');
  const mo=new MutationObserver(later);grids.forEach(g=>mo.observe(g,{childList:true,subtree:true,characterData:true}));
  if(window.ResizeObserver){const ro=new ResizeObserver(later);grids.forEach(g=>ro.observe(g));}
})();

/* ── Rebuild All ──────────────────────────────────────────── */
function rebuildAll(){
  resetSplitAllocMemo();
  buildMonthList();
  renderSidebar();
  renderBudget();
  renderCumulativeCategoryWidget();
  renderWeekly();
  fillTxnFilterCatOpts();
  fillTxnFilterTagOpts();
  fillTxnFilterAccOpts();
  renderTxnLog();
  fillExpInst();fillIncInst();fillTransferOpts();
  renderChips('expense');renderChips('income');
  renderTagChips('expense');renderTagChips('income');
  if(activeTab==='charts')renderQuickCharts();
  if(activeView==='analytics')renderAnalytics();
  if(activeView==='invest')renderInvestments();
}

/* ── Theme Toggle ─────────────────────────────────────────── */
const SUN_PATH='M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.02 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z';
const MOON_PATH='M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z';
function applyTheme(mode){
  document.documentElement.classList.toggle('dark',mode==='dark');
  document.getElementById('theme-icon').setAttribute('d',mode==='dark'?MOON_PATH:SUN_PATH);
  // Browser / phone status bar colour follows the app theme (dark mode inverts the white top bar)
  const tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.setAttribute('content',mode==='dark'?'#000000':'#ffffff');
}
function toggleTheme(){
  // brief colour transition on toggle only, so normal interactions stay snappy
  document.documentElement.classList.add('theme-anim');
  setTimeout(()=>document.documentElement.classList.remove('theme-anim'),400);
  const mode=document.documentElement.classList.contains('dark')?'light':'dark';
  applyTheme(mode);
  localStorage.setItem('ft-theme',mode);
}
applyTheme(localStorage.getItem('ft-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));

/* ── Boot (runs once per successful sign-in) ─────────────── */
function boot(){
  const t=today();
  ['e-date','i-date','t-date'].forEach(id=>setDateVal(id,t));
  restoreLastEntries(); // pre-fill account/instrument/category/date from the last saved entry
  const[y,m]=t.split('-');
  document.getElementById('rng-from').value=`${y}-${m}-01`;
  document.getElementById('rng-to').value=t;
  const mq=window.matchMedia('(max-width:860px)');
  const setGrid=()=>{document.getElementById('dash-grid').style.gridTemplateColumns=mq.matches?'minmax(0,1fr)':'360px minmax(0,1fr)';};
  mq.addEventListener('change',setGrid);setGrid();
  generateDueRecurring();
  generateDueAutoDebits();
  rebuildAll();
  updateRangeDisplay();
  _appBooted=true; // live sync may redraw from now on
}

/* ── PWA: register service worker (safe no-op if unsupported) ── */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
