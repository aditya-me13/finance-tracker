/* ── Export / Import ──────────────────────────────────────── */
function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`finance-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast('Exported');
}
function importData(ev){
  const file=ev.target.files[0];if(!file)return;
  new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsText(file);}).then(txt=>{
    try{
      const imp=JSON.parse(txt);
      if(!imp.transactions&&!imp.expenses)throw 0;
      if(!imp.transactions)imp.transactions=(imp.expenses||[]).map(e=>({...e,type:'expense',acType:'bank',acId:imp.banks?.[0]?.id||'cash'}));
      if(!imp.categories||!imp.categories.expense)imp.categories={expense:[...DEF_EXP],income:[...DEF_INC]};
      if(!imp.banks)imp.banks=[];if(!imp.cards)imp.cards=[];
      if(!imp.cash)imp.cash={startBalance:imp.config?.cashBase||0};
      if(!imp.categoryBudgets)imp.categoryBudgets={};
      if(!imp.investments)imp.investments={accounts:[],holdings:[]};
      state=imp;normalizeState();saveState();rebuildAll();toast('Data imported');
    }catch{toast('Import failed: invalid file');}
  });
  ev.target.value='';
}

/* ── Rebuild All ──────────────────────────────────────────── */
function rebuildAll(){
  buildMonthList();
  renderSidebar();
  renderBudget();
  renderCumulativeCategoryWidget();
  renderWeekly();
  fillTxnFilterCatOpts();
  fillTxnFilterTagOpts();
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
}
function toggleTheme(){
  const mode=document.documentElement.classList.contains('dark')?'light':'dark';
  applyTheme(mode);
  localStorage.setItem('ft-theme',mode);
}
applyTheme(localStorage.getItem('ft-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));

/* ── Boot (runs once per successful sign-in) ─────────────── */
function boot(){
  const t=today();
  ['e-date','i-date','t-date'].forEach(id=>document.getElementById(id).value=t);
  const[y,m]=t.split('-');
  document.getElementById('rng-from').value=`${y}-${m}-01`;
  document.getElementById('rng-to').value=t;
  const mq=window.matchMedia('(max-width:860px)');
  const setGrid=()=>{document.getElementById('dash-grid').style.gridTemplateColumns=mq.matches?'1fr':'360px 1fr';};
  mq.addEventListener('change',setGrid);setGrid();
  generateDueRecurring();
  rebuildAll();
  updateRangeDisplay();
}

/* ── PWA: register service worker (safe no-op if unsupported) ── */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
