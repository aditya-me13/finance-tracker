/* ── Budget ───────────────────────────────────────────────── */
/* The period every spend widget measures: the month cycle (or FY) picked in the log's selector.
   Budgets are per month, so they scale by how many month cycles the period covers (FY → 12). */
function spendPeriod(){
  if(viewMode==='fy'&&viewFY){const r=fyRange(viewFY);return{...r,label:fyLabel(viewFY),months:monthsInRange(r.from,r.to),isFY:true};}
  const mk=viewMK||curMK(),r=mkRange(mk);
  return{...r,label:mkLabel(mk),months:1,isFY:false,isCurrent:mk===curMK()};
}
/* Expenses counted by budgets & category spend: your share (shareAmount), spread parts placed in
   their own cycle, Splitwise settlements excluded (their cost is already counted on the original bill).
   cats = null for all categories, else an array of category names. */
function spendExps(cats){const{from,to}=spendPeriod();return calcExps(cats,from,to);}
function calcExps(cats,from,to){
  return aTxnsInRange(from,to).filter(t=>t.type==='expense'&&!t.splitSettle&&(!cats||cats.includes(t.category)));
}
const sumShare=list=>list.reduce((s,t)=>s+shareAmount(t),0);
/* Small ↗ button that opens the transactions a figure was calculated from */
function calcSrcBtn(onclick,what){
  return`<button type="button" class="btn-i calc-src-btn" onclick="${onclick}" title="Show the transactions behind ${esc(what)} in the log" aria-label="Show the transactions behind ${esc(what)} in the log">
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M8 7h9v9"/></svg></button>`;
}
function renderBudget(){
  const per=spendPeriod(),exps=spendExps(null);
  const spent=sumShare(exps);
  const bud=(Number(state.monthlyBudget)||0)*per.months,pct=bud>0?Math.min((spent/bud)*100,100):0;
  const warn=bud>0&&spent>=bud*.8,over=bud>0&&spent>=bud;
  const sl=document.getElementById('b-spent-label');
  if(sl)sl.textContent=per.isFY?'Spent this FY':per.isCurrent?'Spent this month':'Spent in month';
  const pl=document.getElementById('b-period');if(pl)pl.textContent=per.label;
  const bs=document.getElementById('b-src');if(bs)bs.innerHTML=calcSrcBtn("showCalcInLog(null)",'the monthly budget total');
  const cbs=document.getElementById('cat-bud-src');if(cbs)cbs.textContent=per.label;
  document.getElementById('b-spent').textContent=fmt(spent);
  document.getElementById('b-spent').style.color=over?'#ef4444':warn?'#d97706':'';
  document.getElementById('b-label').textContent=`Overall: ${fmt(bud)}`+(per.isFY?` (${fmt(Number(state.monthlyBudget)||0)} × ${per.months})`:'');
  document.getElementById('b-pct').textContent=`${pct.toFixed(0)}%`;
  document.getElementById('b-pct').style.color=over?'#ef4444':warn?'#d97706':'#a8a29e';
  const bar=document.getElementById('b-bar');
  bar.style.width=pct+'%';bar.className='pf '+(over?'po':warn?'pw':'ps');

  const catList=document.getElementById('cat-bud-list');
  const budCats=Object.keys(state.categoryBudgets).filter(k=>state.categoryBudgets[k]>0);
  if(!budCats.length){catList.innerHTML='<div style="font-size:.78rem;color:var(--text-muted);text-align:center;padding:12px 0">No category budgets — click Edit to configure</div>';return;}
  catList.innerHTML='';
  budCats.forEach(cat=>{
    const catBud=(state.categoryBudgets[cat]||0)*per.months;
    const catSpent=sumShare(exps.filter(e=>e.category===cat));
    const cpct=catBud>0?Math.min((catSpent/catBud)*100,100):0;
    const cw=catBud>0&&catSpent>=catBud*.8,co=catBud>0&&catSpent>=catBud;
    const ci=state.categories.expense.indexOf(cat),col=cpal(ci>=0?ci:0);
    const card=document.createElement('div');card.className='cat-bud-card'+(co?' over':cw?' warn':'');
    card.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex-shrink:1">
          <span style="width:7px;height:7px;border-radius:50%;background:${col.fg};flex-shrink:0;display:inline-block"></span>
          <span style="font-size:.82rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0" title="${esc(cat)}">${esc(cat)}</span>
          ${cw&&!co?'<span style="font-size:.68rem;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:99px;font-weight:500;flex-shrink:0">Warning</span>':''}
          ${co?'<span style="font-size:.68rem;background:#fee2e2;color:#be123c;padding:1px 6px;border-radius:99px;font-weight:500;flex-shrink:0">Over Budget</span>':''}
        </div>
        <div style="display:flex;align-items:center;gap:2px;flex-shrink:0">
          <span class="num" style="font-size:.72rem;color:${co?'#ef4444':cw?'#d97706':'#78716c'}">${fmt(catSpent)} / ${fmt(catBud)}</span>
          <span class="cat-src"></span>
        </div>
      </div>
      <div class="pt"><div class="pf ${co?'po':cw?'pw':'ps'}" style="width:${cpct}%"></div></div>`;
    // Category names are user text: pass via a closure, not inline onclick
    const src=card.querySelector('.cat-src');src.innerHTML=calcSrcBtn('',cat+' spend');
    src.firstElementChild.onclick=()=>showCalcInLog([cat]);
    catList.appendChild(card);
  });
}

/* ── Calculation drill-down: filter the transaction log to exactly the expenses behind a figure.
   cats = null → every expense (monthly budget), else those categories. The log rows stay editable. */
function showCalcInLog(cats){
  const{from,to}=spendPeriod();
  document.getElementById('txn-filter-cat').value=cats&&cats.length===1?'exp:'+cats[0]:'';
  setDateVal('txn-filter-from',from);setDateVal('txn-filter-to',to);
  const tag=document.getElementById('txn-filter-tag');if(tag)tag.value='';
  const q=document.getElementById('txn-filter-search');if(q)q.value='';
  const acc=document.getElementById('txn-filter-acc');if(acc)acc.value='';
  txnFilter={category:cats&&cats.length===1?'exp:'+cats[0]:'',from,to,tag:'',search:'',account:'',calc:{cats:cats?cats.slice():null}};
  bulkSelectedIds.clear();
  if(activeView!=='dashboard')switchView('dashboard');
  if(activeTab!=='log')switchTab('log');
  renderTxnLog();
  const log=document.getElementById('view-log');if(log)log.scrollIntoView({behavior:'smooth',block:'start'});
}

function openBudgetModal(){
  document.getElementById('inp-bud').value=state.monthlyBudget||'';
  const ms=document.getElementById('inp-month-start');
  ms.innerHTML=Array.from({length:28},(_,i)=>`<option value="${i+1}">${i+1}${ordSuffix(i+1)}${i===0?' (calendar month)':''}</option>`).join('');
  ms.value=String(monthStartDay());
  const list=document.getElementById('cat-bud-modal-list');list.innerHTML='';
  state.categories.expense.forEach(cat=>{
    const existing=state.categoryBudgets[cat]||'',ci=state.categories.expense.indexOf(cat),col=cpal(ci>=0?ci:0);
    const row=document.createElement('div');row.className='bud-row';
    row.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${col.fg};flex-shrink:0;display:inline-block"></span>
      <span style="font-size:.82rem;flex:1">${esc(cat)}</span>
      <div class="fw" style="width:150px;flex-shrink:0"><div class="fp">₹</div>
        <input class="fi cat-bud-inp" data-cat="${esc(cat)}" type="number" min="0" step="100" placeholder="No cap" value="${existing}" style="padding:6px 10px;font-size:.82rem"/></div>`;
    list.appendChild(row);
  });
  openModal('modal-bud');
}
function saveBudgets(){
  state.monthlyBudget=Number(document.getElementById('inp-bud').value)||0;
  document.querySelectorAll('.cat-bud-inp').forEach(inp=>{
    const cat=inp.dataset.cat,val=Number(inp.value)||0;
    if(val>0)state.categoryBudgets[cat]=val;else delete state.categoryBudgets[cat];
  });
  const ms=Number(document.getElementById('inp-month-start').value)||1,msChanged=ms!==monthStartDay();
  state.monthStartDay=ms;
  saveState();closeModal('modal-bud');
  if(msChanged){
    // Month keys mean different date ranges now: jump the month view back to the current cycle
    const sel=document.getElementById('month-sel');if(sel)sel.value='';
    rebuildAll();toast('Saved — months now start on the '+ms+ordSuffix(ms));
  }else{renderBudget();toast('Budgets saved');}
}

/* ── Weekly ───────────────────────────────────────────────── */
function renderWeekly(){
  const d=new Date(),dow=d.getDay(),toMon=dow===0?-6:1-dow;
  const mon=new Date(d);mon.setDate(d.getDate()+toMon);mon.setHours(0,0,0,0);
  document.getElementById('week-range').textContent=
    mon.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' – '+
    new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+6).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  const rows=Array.from({length:7},(_,i)=>{
    const dd=new Date(mon);dd.setDate(mon.getDate()+i);
    const key=dateToStr(dd);
    const total=state.transactions.filter(t=>t.type==='expense'&&t.date===key).reduce((s,t)=>s+shareAmount(t),0);
    return{label:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],date:dd,total};
  });
  const maxV=Math.max(...rows.map(r=>r.total),1),now=new Date();now.setHours(0,0,0,0);
  const wrap=document.getElementById('weekly-rows');wrap.innerHTML='';
  rows.forEach(({label,date,total})=>{
    const isT=date.toDateString()===now.toDateString(),isFut=date>now;
    const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px';
    row.innerHTML=`<span style="font-size:.72rem;font-weight:${isT?'600':'400'};color:${isT?'#1c1917':'#a8a29e'};width:24px;flex-shrink:0">${label}</span>
      <div class="wbt"><div class="wbf${isT?' today':''}" style="width:${isFut?0:(total/maxV)*100}%"></div></div>
      <span class="num" style="font-size:.72rem;color:${isFut?'#e7e5e4':'#78716c'};width:68px;text-align:right;flex-shrink:0">${isFut?'—':fmt(total)}</span>`;
    wrap.appendChild(row);
  });
}

