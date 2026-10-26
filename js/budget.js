/* ── Budget ───────────────────────────────────────────────── */
function renderBudget(){
  const mk=curMK(),exps=txnsForMK(mk).filter(t=>t.type==='expense'&&!t.splitSettle);
  const spent=exps.reduce((s,t)=>s+shareAmount(t),0);
  const bud=Number(state.monthlyBudget)||0,pct=bud>0?Math.min((spent/bud)*100,100):0;
  const warn=bud>0&&spent>=bud*.8,over=bud>0&&spent>=bud;
  document.getElementById('b-spent').textContent=fmt(spent);
  document.getElementById('b-spent').style.color=over?'#ef4444':warn?'#d97706':'#1c1917';
  document.getElementById('b-label').textContent=`Overall: ${fmt(bud)}`;
  document.getElementById('b-pct').textContent=`${pct.toFixed(0)}%`;
  document.getElementById('b-pct').style.color=over?'#ef4444':warn?'#d97706':'#a8a29e';
  const bar=document.getElementById('b-bar');
  bar.style.width=pct+'%';bar.className='pf '+(over?'po':warn?'pw':'ps');

  const catList=document.getElementById('cat-bud-list');
  const budCats=Object.keys(state.categoryBudgets).filter(k=>state.categoryBudgets[k]>0);
  if(!budCats.length){catList.innerHTML='<div style="font-size:.78rem;color:#c4bfba;text-align:center;padding:12px 0">No category budgets — click Edit to configure</div>';return;}
  catList.innerHTML='';
  budCats.forEach(cat=>{
    const catBud=state.categoryBudgets[cat]||0;
    const catSpent=exps.filter(e=>e.category===cat).reduce((s,e)=>s+shareAmount(e),0);
    const cpct=catBud>0?Math.min((catSpent/catBud)*100,100):0;
    const cw=catBud>0&&catSpent>=catBud*.8,co=catBud>0&&catSpent>=catBud;
    const ci=state.categories.expense.indexOf(cat),col=cpal(ci>=0?ci:0);
    const card=document.createElement('div');card.className='cat-bud-card'+(co?' over':cw?' warn':'');
    card.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex-shrink:1">
          <span style="width:7px;height:7px;border-radius:50%;background:${col.fg};flex-shrink:0;display:inline-block"></span>
          <span style="font-size:.82rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0" title="${esc(cat)}">${esc(cat)}</span>
          ${cw&&!co?'<span style="font-size:.67rem;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:99px;font-weight:500;flex-shrink:0">Warning</span>':''}
          ${co?'<span style="font-size:.67rem;background:#fee2e2;color:#be123c;padding:1px 6px;border-radius:99px;font-weight:500;flex-shrink:0">Over Budget</span>':''}
        </div>
        <span class="num" style="font-size:.73rem;color:${co?'#ef4444':cw?'#d97706':'#78716c'};flex-shrink:0">${fmt(catSpent)} / ${fmt(catBud)}</span>
      </div>
      <div class="pt"><div class="pf ${co?'po':cw?'pw':'ps'}" style="width:${cpct}%"></div></div>`;
    catList.appendChild(card);
  });
}

function openBudgetModal(){
  document.getElementById('inp-bud').value=state.monthlyBudget||'';
  const list=document.getElementById('cat-bud-modal-list');list.innerHTML='';
  state.categories.expense.forEach(cat=>{
    const existing=state.categoryBudgets[cat]||'',ci=state.categories.expense.indexOf(cat),col=cpal(ci>=0?ci:0);
    const row=document.createElement('div');row.className='bud-row';
    row.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${col.fg};flex-shrink:0;display:inline-block"></span>
      <span style="font-size:.83rem;flex:1">${esc(cat)}</span>
      <div class="fw" style="width:150px;flex-shrink:0"><div class="fp">₹</div>
        <input class="fi cat-bud-inp" data-cat="${esc(cat)}" type="number" min="0" step="100" placeholder="No cap" value="${existing}" style="padding:6px 10px;font-size:.8rem"/></div>`;
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
  saveState();renderBudget();closeModal('modal-bud');toast('Budgets saved');
}

/* ── Weekly ───────────────────────────────────────────────── */
function renderWeekly(){
  const d=new Date(),dow=d.getDay(),toMon=dow===0?-6:1-dow;
  const mon=new Date(d);mon.setDate(d.getDate()+toMon);
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
      <span class="num" style="font-size:.7rem;color:${isFut?'#e7e5e4':'#78716c'};width:68px;text-align:right;flex-shrink:0">${isFut?'—':fmt(total)}</span>`;
    wrap.appendChild(row);
  });
}

