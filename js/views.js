/* ── Month list ───────────────────────────────────────────── */
function buildMonthList(){
  const keys=new Set([curMK()]);
  state.transactions.forEach(t=>keys.add(mkOf(t.date)));
  const sorted=Array.from(keys).sort().reverse();
  const sel=document.getElementById('month-sel'),prev=sel.value;
  sel.innerHTML=sorted.map(k=>`<option value="${k}">${mkLabel(k)}</option>`).join('');
  sel.value=(prev&&sorted.includes(prev))?prev:curMK();
  viewMK=sel.value;
  buildFYList();
  updateViewLabel();
}
function buildFYList(){
  const cur=Number(curFY());
  const keys=new Set();
  for(let y=cur-5;y<=cur;y++)keys.add(String(y));
  state.transactions.forEach(t=>keys.add(fyOf(t.date)));
  const sorted=Array.from(keys).sort().reverse();
  const sel=document.getElementById('fy-sel'),prev=sel.value;
  sel.innerHTML=sorted.map(k=>`<option value="${k}">${fyLabel(k)}</option>`).join('');
  sel.value=(prev&&sorted.includes(prev))?prev:curFY();
  viewFY=sel.value;
}
function updateViewLabel(){
  document.getElementById('log-month-label').textContent=viewMode==='fy'?fyLabel(viewFY):mkLabel(viewMK);
}
function onMonthChange(){
  viewMK=document.getElementById('month-sel').value;
  updateViewLabel();
  renderCumulativeCategoryWidget();
  renderTxnLog();if(activeTab==='charts')renderQuickCharts();
}
function onFYChange(){
  viewFY=document.getElementById('fy-sel').value;
  updateViewLabel();
  renderCumulativeCategoryWidget();
  renderTxnLog();if(activeTab==='charts')renderQuickCharts();
}
function setViewMode(mode){
  viewMode=mode;
  document.getElementById('vmode-month').classList.toggle('active',mode==='month');
  document.getElementById('vmode-fy').classList.toggle('active',mode==='fy');
  document.getElementById('month-sel').classList.toggle('hidden',mode!=='month');
  document.getElementById('fy-sel').classList.toggle('hidden',mode!=='fy');
  updateViewLabel();
  renderCumulativeCategoryWidget();
  renderTxnLog();if(activeTab==='charts')renderQuickCharts();
}

/* ── View switching ───────────────────────────────────────── */
function switchView(v){
  activeView=v;
  document.getElementById('view-dashboard').classList.toggle('hidden',v!=='dashboard');
  document.getElementById('view-invest').classList.toggle('hidden',v!=='invest');
  document.getElementById('view-analytics').classList.toggle('hidden',v!=='analytics');
  document.getElementById('nav-dash').classList.toggle('active',v==='dashboard');
  document.getElementById('nav-invest').classList.toggle('active',v==='invest');
  document.getElementById('nav-analytics').classList.toggle('active',v==='analytics');
  if(v==='analytics')renderAnalytics();
  if(v==='invest')renderInvestments();
}
function switchTab(tab){
  activeTab=tab;
  document.getElementById('tab-log').classList.toggle('active',tab==='log');
  document.getElementById('tab-charts').classList.toggle('active',tab==='charts');
  document.getElementById('view-log').style.display=tab==='log'?'':'none';
  const cv=document.getElementById('view-charts');
  cv.style.display=tab==='charts'?'flex':'none';cv.style.flexDirection='column';
  if(tab==='charts')renderQuickCharts();
}

/* ── Txn Log ──────────────────────────────────────────────── */
function txnsForMK(mk){return state.transactions.filter(t=>mkOf(t.date)===mk);}
function txnsForFY(fy){const{from,to}=fyRange(fy);return state.transactions.filter(t=>t.date>=from&&t.date<=to);}
function txnsInRange(from,to){return state.transactions.filter(t=>t.date>=from&&t.date<=to);}
function curViewTxns(){return viewMode==='fy'?txnsForFY(viewFY):txnsForMK(viewMK);}

/* Category + date-range filter for the transaction log */
function fillTxnFilterCatOpts(){
  const sel=document.getElementById('txn-filter-cat');
  if(!sel)return;
  const prev=sel.value;
  let html='<option value="">All Categories</option>';
  if(state.categories.expense.length)html+='<optgroup label="Expense">'+state.categories.expense.map(c=>`<option value="exp:${esc(c)}">${esc(c)}</option>`).join('')+'</optgroup>';
  if(state.categories.income.length)html+='<optgroup label="Income">'+state.categories.income.map(c=>`<option value="inc:${esc(c)}">${esc(c)}</option>`).join('')+'</optgroup>';
  sel.innerHTML=html;
  if(prev&&Array.from(sel.options).some(o=>o.value===prev))sel.value=prev;
}
function isTxnFilterActive(){return!!(txnFilter.category||txnFilter.from||txnFilter.to);}
function txnMatchesFilter(t){
  const{category,from,to}=txnFilter;
  if(category){
    const idx=category.indexOf(':'),kind=category.slice(0,idx),name=category.slice(idx+1);
    if(kind==='exp'){if(t.type!=='expense'||t.category!==name)return false;}
    else if(kind==='inc'){if(t.type!=='income'||t.category!==name)return false;}
  }
  if(from&&t.date<from)return false;
  if(to&&t.date>to)return false;
  return true;
}
function applyTxnFilter(){
  txnFilter={
    category:document.getElementById('txn-filter-cat').value,
    from:document.getElementById('txn-filter-from').value,
    to:document.getElementById('txn-filter-to').value,
  };
  renderTxnLog();
}
function clearTxnFilter(){
  document.getElementById('txn-filter-cat').value='';
  setDateVal('txn-filter-from','');
  document.getElementById('txn-filter-from-disp').textContent='From';
  setDateVal('txn-filter-to','');
  document.getElementById('txn-filter-to-disp').textContent='To';
  txnFilter={category:'',from:'',to:''};
  renderTxnLog();
}

function renderTxnLog(){
  const list=document.getElementById('txn-list');
  const filterActive=isTxnFilterActive();
  const summaryEl=document.getElementById('txn-filter-summary');
  const label=document.getElementById('log-month-label');
  let txns;
  if(filterActive){
    txns=state.transactions.filter(txnMatchesFilter).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
    const catSel=document.getElementById('txn-filter-cat');
    const catText=txnFilter.category?catSel.options[catSel.selectedIndex].textContent:'All Categories';
    const rangeText=(txnFilter.from||txnFilter.to)?`${txnFilter.from?fmtDate(txnFilter.from):'…'} – ${txnFilter.to?fmtDate(txnFilter.to):'…'}`:'All time';
    label.textContent=`Filtered: ${catText} · ${rangeText}`;
    const expSum=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const incSum=txns.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const parts=[];
    if(expSum)parts.push(`Expenses: ${fmt(expSum)}`);
    if(incSum)parts.push(`Income: ${fmt(incSum)}`);
    summaryEl.textContent=`${txns.length} transaction(s) found`+(parts.length?' · '+parts.join(' · '):'');
    summaryEl.classList.remove('hidden');
  }else{
    txns=curViewTxns().slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
    label.textContent=viewMode==='fy'?fyLabel(viewFY):mkLabel(viewMK);
    summaryEl.classList.add('hidden');
  }
  if(!txns.length){
    list.innerHTML=`<div style="text-align:center;padding:26px 0;font-size:.83rem;color:#a8a29e">No transactions ${filterActive?'match this filter':`this ${viewMode==='fy'?'financial year':'month'}`}.</div>`;
    return;
  }
  const grouped={};txns.forEach(t=>{if(!grouped[t.date])grouped[t.date]=[];grouped[t.date].push(t);});
  const dates=Object.keys(grouped).sort().reverse();
  list.innerHTML='';
  dates.forEach(date=>{
    const dayExps=grouped[date].filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const dayInc=grouped[date].filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:5px 11px 3px';
    hdr.innerHTML=`<span class="slabel">${fmtDate(date)}</span><div style="display:flex;gap:8px">
      ${dayInc?`<span class="num" style="font-size:.7rem;color:#166534">+${fmt(dayInc)}</span>`:''}
      ${dayExps?`<span class="num" style="font-size:.7rem;color:#a8a29e">${fmt(dayExps)}</span>`:''}
    </div>`;
    list.appendChild(hdr);
    grouped[date].forEach(t=>list.appendChild(buildRow(t,true)));
  });
}

function buildRow(t,canDel){
  const row=document.createElement('div');row.className='txnrow';
  let iconBg,iconTxt,mainLabel,subLabel,amtStr,amtCol;
  if(t.type==='expense'){
    const ci=state.categories.expense.indexOf(t.category),col=cpal(ci>=0?ci:0);
    iconBg=col.bg;iconTxt=t.category.slice(0,2).toUpperCase();mainLabel=esc(t.category);
    let splitNote='';
    let displayAmt=t.amount;
    const settledNote=t.shared?(t.settled?` <span style="color:#a8a29e">(settled)</span>`:''):'';
    if(t.acType==='shared'){
      const totalNote=Number(t.amount)&&Number(t.amount)!==Number(t.myShare)?` &middot; total bill ${fmt(t.amount)}`:'';
      splitNote=` &middot; <span style="color:#7c3aed;font-weight:600">Owed via Splitwise</span>${totalNote}${settledNote}`;
      displayAmt=t.myShare;
    }else if(t.shared&&Number(t.myShare)<Number(t.amount)){
      splitNote=` &middot; <span style="color:#7c3aed;font-weight:600">your share ${fmt(t.myShare)}</span>${settledNote}`;
    }
    subLabel=acLabel(t.acType,t.acId)+splitNote+(t.desc?' &middot; '+esc(t.desc):'');
    amtStr='&minus;'+fmt(displayAmt);amtCol='#ef4444';
  }else if(t.type==='income'){
    iconBg='#f0fdf4';iconTxt='IN';mainLabel=esc(t.category);
    subLabel=acLabel(t.destType,t.destId)+(t.desc?' &middot; '+esc(t.desc):'');
    amtStr='+'+fmt(t.amount);amtCol='#166534';
  }else if(t.type==='invest'){
    iconBg='#ede9fe';iconTxt='IV';mainLabel='Invested — '+esc(t.name||'Holding');
    subLabel=trLabel('inv:'+t.accountId)+(t.sourceKey?` &middot; paid from ${trLabel(t.sourceKey)}`:'')+(t.units?` &middot; ${t.units} units @ ${fmt(t.buyPrice)}`:'');
    amtStr=fmt(t.amount);amtCol='#7c3aed';canDel=false;
  }else if(t.type==='divest'){
    iconBg='#dcfce7';iconTxt='SL';mainLabel='Sold — '+esc(t.name||'Holding');
    subLabel=`${t.units} units @ ${fmt(t.sellPrice)} &middot; credited to ${trLabel(t.destKey)}`+(typeof t.costBasis==='number'?` &middot; ${(t.amount-t.costBasis)>=0?'gain':'loss'} ${fmt(Math.abs(t.amount-t.costBasis))}`:'');
    amtStr='+'+fmt(t.amount);amtCol='#166534';canDel=false;
  }else{
    iconBg='#eff6ff';iconTxt='TR';mainLabel='Transfer';
    subLabel=trLabel(t.fromKey)+' &rarr; '+trLabel(t.toKey)+(t.note?' &middot; '+esc(t.note):'');
    amtStr=fmt(t.amount);amtCol='#1d4ed8';
  }
  row.innerHTML=`
    <div class="txnico" style="background:${iconBg};color:#57534e">${iconTxt}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.82rem;color:#292524;font-weight:500">${mainLabel}</div>
      <div style="font-size:.72rem;color:#a8a29e;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subLabel}</div>
    </div>
    <span class="num" style="font-size:.83rem;font-weight:500;color:${amtCol};flex-shrink:0">${amtStr}</span>
    ${canDel?`<button class="btn-i" onclick="confirmDelete('${t.id}')" title="Delete" style="flex-shrink:0;margin-left:2px">
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>`:''}`;
  return row;
}

function acLabel(type,id){
  if(type==='cash')return'Cash';
  if(type==='bank'){const b=state.banks.find(x=>x.id===id);return b?esc(b.name):'Bank';}
  if(type==='cc'){const c=state.cards.find(x=>x.id===id);return c?esc(c.name):'Card';}
  if(type==='shared')return'Roommate Split';
  return'';
}
function trLabel(key){
  if(!key)return'?';if(key==='cash')return'Cash';
  const[k,id]=key.split(':');
  if(k==='bank'){const b=state.banks.find(x=>x.id===id);return b?esc(b.name):'Bank';}
  if(k==='cc'){const c=state.cards.find(x=>x.id===id);return c?esc(c.name):'Card';}
  if(k==='inv'){const a=state.investments.accounts.find(x=>x.id===id);return a?esc(a.name):'Investment';}
  return key;
}
function fmtDate(s){
  const td=today();if(s===td)return'Today';
  const yd=new Date();yd.setDate(yd.getDate()-1);
  const ys=`${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;
  if(s===ys)return'Yesterday';
  return new Date(s+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
}

