/* ── Sidebar ──────────────────────────────────────────────── */
function renderDueThisMonthWidget(bal){
  const sec=document.getElementById('sb-duewidget-sec'),body=document.getElementById('sb-duewidget-body');
  if(!sec||!body)return;
  const items=[];
  state.cards.forEach(c=>{
    const ds=getDueDateStatus(c);
    if(ds&&(ds.status==='urgent'||ds.status==='soon'||ds.status==='overdue'))
      items.push({kind:'Credit Card',name:c.name,label:ds.label,status:ds.status,amount:bal.cd[c.id]||0,due:ds.due});
  });
  state.loans.forEach(l=>{
    const ds=getDueDateStatus(l);
    if(ds&&(ds.status==='urgent'||ds.status==='soon'||ds.status==='overdue'))
      items.push({kind:'Loan EMI',name:l.name,label:ds.label,status:ds.status,amount:l.emiAmount,due:ds.due});
  });
  (state.recurring||[]).forEach(r=>{
    if(!r.active)return;
    const nextDueStr=nextRecurDate(r,r.lastGeneratedDate||r.startDate);
    const nextDue=new Date(nextDueStr+'T00:00:00');
    const diffDays=Math.ceil((nextDue-new Date())/(1000*60*60*24));
    if(diffDays<=5){
      const status=diffDays<0?'overdue':diffDays===0?'urgent':'soon';
      const amt=r.type==='expense'?(r.myShare!==undefined?r.myShare:r.amount):r.amount;
      items.push({kind:'Recurring',name:r.name,label:`Auto-logs ${fmtDate(nextDueStr)}`,status,amount:amt,due:nextDue});
    }
  });
  if(!items.length){sec.style.display='none';return;}
  sec.style.display='block';
  items.sort((a,b)=>a.due-b.due);
  body.innerHTML=items.map(it=>`
    <div class="reminder-banner ${it.status==='overdue'||it.status==='urgent'?'urgent':'soon'}" style="margin:0 4px 6px;border-radius:9px">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-weight:600;font-size:.78rem">${esc(it.name)}</span>
          <span class="badge-sm" style="background:rgba(0,0,0,.06);color:inherit">${it.kind}</span>
        </div>
        <div style="font-size:.71rem;opacity:.85">${it.label}${it.amount?` &middot; ${fmt(it.amount)}`:''}</div>
      </div>
    </div>`).join('');
}

function renderSidebar(){
  const bal=computeBal();
  const liquid=document.getElementById('sb-liquid-focus');
  if(liquid){
    liquid.textContent=fmt(bal.liquid);
    liquid.style.color=bal.liquid>=0?'#86efac':'#fca5a5';
  }
  const nw=document.getElementById('sb-worth-secondary');
  if(nw){
    nw.textContent=fmt(bal.netWorth);
    nw.style.color=bal.netWorth>=0?'#f4f3f0':'#fecaca';
  }
  const inv=document.getElementById('sb-invest-secondary');
  if(inv){
    inv.textContent=fmt(bal.investWorth);
    inv.style.color='#f4f3f0';
  }

  renderDueThisMonthWidget(bal);

  const sbB=document.getElementById('sb-banks');
  sbB.innerHTML=!state.banks.length?'<div style="font-size:.74rem;color:#c4bfba;padding:3px 8px">No accounts yet</div>':
    state.banks.map((b,i)=>{const v=bal.bk[b.id]||0;const excluded=b.includeInNetWorth===false;return`<div class="sb-item" style="align-items:center;gap:6px">
      <span class="sb-dot" style="background:${BDOTS[i%BDOTS.length]};margin-top:0;flex-shrink:0"></span>
      <span class="sb-name" style="flex:${excluded?'0 1 auto':'1'}" title="${esc(b.name)}">${esc(b.name)}</span>
      ${excluded?'<span class="badge-sm" style="background:#f4f3f0;color:#a8a29e;flex-shrink:0" title="Not counted in Net Worth or Liquid Cash">Excluded</span>':''}
      <span class="sb-amt${v<0?' neg':''}" style="${excluded?'flex:1;text-align:right':''}">${fmt(v)}</span>
      <button class="btn-i" onclick="openEditModal('bank','${b.id}')" title="Edit" style="padding:2px;flex-shrink:0">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
      </button>
      <button class="btn-i" onclick="confirmDeleteAccount('bank','${b.id}')" title="Delete" style="padding:2px;flex-shrink:0" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#c4bfba'">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>`;}).join('');

  document.getElementById('sb-cash').innerHTML=`<div class="sb-item" style="align-items:center;gap:6px">
    <span class="sb-dot" style="background:${CASHDOT};margin-top:0;flex-shrink:0"></span>
    <span class="sb-name" style="flex:1">Cash</span>
    <span class="sb-amt${bal.ca<0?' neg':''}">${fmt(bal.ca)}</span>
    <button class="btn-i" onclick="openEditModal('cash','cash')" title="Edit" style="padding:2px;flex-shrink:0">
      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
    </button>
  </div>`;

  const sbC=document.getElementById('sb-cards');
  sbC.innerHTML=!state.cards.length?'<div style="font-size:.74rem;color:#c4bfba;padding:3px 8px">No cards yet</div>':
    state.cards.map((c,i)=>{
      const due=bal.cd[c.id]||0,lim=Number(c.limit)||0;
      const avail=lim>0?lim-due:null,pct=lim>0?Math.min((due/lim)*100,100):0;
      const cls=pct>80?'po':pct>50?'pw':'ps';
      const ds=getDueDateStatus(c);
      const badgeCls={ok:'due-ok',soon:'due-soon',urgent:'due-urgent',overdue:'due-overdue'}[ds?.status||'ok'];
      return`<div class="sb-item" style="flex-direction:column;align-items:flex-start;gap:5px">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <span class="sb-dot" style="background:${CDOTS[i%CDOTS.length]};flex-shrink:0"></span>
          <span class="sb-name" style="flex:1" title="${esc(c.name)}">${esc(c.name)}</span>
          <span class="sb-amt${due>0?' neg':''}">${fmt(due)}</span>
          <button class="btn-i" onclick="openEditModal('cc','${c.id}')" title="Edit" style="padding:2px;flex-shrink:0"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
          <button class="btn-i" onclick="confirmDeleteAccount('cc','${c.id}')" title="Delete" style="padding:2px;flex-shrink:0" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#c4bfba'"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
        ${ds?`<div style="padding-left:15px"><span class="due-badge ${badgeCls}">${ds.label}</span></div>`:''}
        ${avail!==null?`<div style="padding-left:15px;width:100%">
          <div class="pt" style="height:3px"><div class="pf ${cls}" style="width:${pct}%"></div></div>
          <div style="font-size:.65rem;color:#c4bfba;margin-top:2px">${fmt(avail)} available</div>
        </div>`:''}
      </div>`;
    }).join('');
  renderSplitwiseWidget();
  renderLoansWidget();
  renderRecurringWidget();
}

function renderSplitwiseWidget(){
  const sec=document.getElementById('sb-splitwise-sec'),body=document.getElementById('sb-splitwise-body');
  if(!sec||!body)return;
  const{owed,fronted,paid,received,net,pending}=computeSplitwiseBalance();
  if(pending<=0.004){sec.style.display='none';return;}
  sec.style.display='block';
  const netLabel=net>0.004?`You're owed ${fmt(net)}`:net<-0.004?`You owe ${fmt(-net)}`:'All settled up';
  const netColor=net>0.004?'#166534':net<-0.004?'#ef4444':'#78716c';
  body.innerHTML=`
    <div style="padding:3px 8px 2px">
      <div class="num" style="font-size:.92rem;font-weight:600;color:${netColor}">${netLabel}</div>
      <div style="font-size:.67rem;color:#a8a29e;margin-top:2px">Fronted: ${fmt(fronted)} &middot; Owed: ${fmt(owed)}</div>
      ${renderSplitPaymentsList()}
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-g" style="flex:1;padding:6px 0;font-size:.76rem" onclick="openSplitPayModal()">Record Payment</button>
        <button class="btn-g" style="flex:1;padding:6px 0;font-size:.76rem" onclick="openSettleModal()">Settle Up</button>
      </div>
    </div>`;
}

function fillSettleAccOpts(selId){
  let html='<option value="cash">Cash</option>';
  state.banks.forEach(b=>html+=`<option value="bank:${b.id}">${esc(b.name)} (Bank)</option>`);
  document.getElementById(selId||'settle-acc').innerHTML=html;
}

/* ── Split settlement payments (partial, per-entry) ──────────── */
function splitPaymentActive(p,alloc){
  if(p.settled)return false;
  const used=(p.allocations||[]).reduce((s,a)=>s+(Number(a.amt)||0),0);
  if((Number(p.amount)||0)-used>0.004)return true;           /* has unallocated credit */
  return (p.allocations||[]).some(a=>{                        /* or any entry it hit is still open */
    const e=state.transactions.find(x=>x.id===a.id);
    if(!e||e.settled)return false;
    const tot=e.acType==='shared'?splitShareOf(e):Math.max(0,(Number(e.amount)||0)-splitShareOf(e));
    return tot-(alloc[e.id]||0)>0.004;
  });
}
function renderSplitPaymentsList(){
  const alloc=buildSplitAllocMap();
  const pays=state.transactions.filter(t=>t.splitSettle&&splitPaymentActive(t,alloc)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  if(!pays.length)return'';
  return`<div style="margin-top:8px;border-top:1px solid #f0eeec;padding-top:6px">
    <div style="font-size:.64rem;color:#a8a29e;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">Payments recorded</div>
    ${pays.map(t=>{
      const isPaid=t.splitSettle==='paid';
      const n=(t.allocations||[]).length;
      return`<div style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:2px 0">
        <span style="flex:1;color:#78716c" title="${esc(t.desc||'')}">${fmtDate(t.date)} &middot; ${isPaid?'You paid':'You received'}${n?` &middot; ${n} entr${n>1?'ies':'y'}`:''}</span>
        <span class="num" style="color:${isPaid?'#ef4444':'#166534'}">${isPaid?'&minus;':'+'}${fmt(t.amount)}</span>
        <button class="btn-i" onclick="deleteSplitPayment('${t.id}')" title="Remove" style="padding:1px" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#c4bfba'"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>`;}).join('')}
  </div>`;
}
let splitPayDir='paid';
function setSplitPayDir(d){
  splitPayDir=d;
  document.getElementById('sp-dir-paid').className='ttb'+(d==='paid'?' ae':'');
  document.getElementById('sp-dir-received').className='ttb'+(d==='received'?' ai':'');
  document.getElementById('sp-acc-label').textContent=d==='paid'?'Paid From':'Received Into';
  updateSplitPayTotal();
}
const netLine=n=>n>0.004?`roommates owe you <b style="color:#166534">${fmt(n)}</b>`:n<-0.004?`you owe roommates <b style="color:#ef4444">${fmt(-n)}</b>`:'<b>all square</b>';
function updateSplitPayTotal(){
  const{net}=computeSplitwiseBalance();
  const amt=parseFloat(document.getElementById('sp-amt').value)||0;
  /* paying roommates moves net up; receiving from them moves it down */
  const after=net+(splitPayDir==='paid'?amt:-amt);
  document.getElementById('sp-summary').innerHTML=amt>0?`After this: ${netLine(after)}`:'';
}
function openSplitPayModal(){
  const{net}=computeSplitwiseBalance();
  setDateVal('sp-date',today());
  fillSettleAccOpts('sp-acc');
  document.getElementById('sp-note').value='';
  document.getElementById('sp-net').innerHTML='Current net: '+netLine(net);
  setSplitPayDir(net>0.004?'received':'paid');
  document.getElementById('sp-amt').value=Math.abs(net)>0.004?Math.abs(net).toFixed(2):'';
  updateSplitPayTotal();
  openModal('modal-splitpay');
}
function confirmSplitPay(){
  const amt=parseFloat(document.getElementById('sp-amt').value);
  if(!amt||amt<=0){toast('Enter an amount');return;}
  const date=document.getElementById('sp-date').value;
  if(!date){toast('Select a date');return;}
  const accKey=document.getElementById('sp-acc').value;
  const isCash=accKey==='cash';
  const bankId=isCash?null:accKey.split(':')[1];
  const note=document.getElementById('sp-note').value.trim();
  const desc='Split settlement'+(note?' — '+note:'');
  if(!state.categories.expense.includes('Settlement'))state.categories.expense.push('Settlement');
  if(!state.categories.income.includes('Settlement'))state.categories.income.push('Settlement');
  if(splitPayDir==='paid'){
    /* myShare 0: the cost was already counted when the owed entries were logged */
    state.transactions.push({id:uid(),date,type:'expense',amount:amt,myShare:0,acType:isCash?'cash':'bank',acId:isCash?'cash':bankId,category:'Settlement',desc,splitSettle:'paid',settled:false});
  }else{
    state.transactions.push({id:uid(),date,type:'income',amount:amt,destType:isCash?'cash':'bank',destId:isCash?'cash':bankId,category:'Settlement',desc,splitSettle:'received',settled:false});
  }
  saveState();closeModal('modal-splitpay');rebuildAll();
  const left=computeSplitwiseBalance();
  toast(`Payment of ${fmt(amt)} recorded`+(Math.abs(left.net)>0.004?'':' — all square'));
}
function deleteSplitPayment(id){
  const idx=state.transactions.findIndex(t=>t.id===id);if(idx<0)return;
  const removed=state.transactions[idx];
  state.transactions.splice(idx,1);saveState();rebuildAll();
  showUndoToast('Payment removed',()=>{state.transactions.push(removed);saveState();rebuildAll();});
}

function openSettleModal(){
  const{owed,fronted,paid,received,net,pending}=computeSplitwiseBalance();
  if(pending<=0.004){toast("Nothing to settle — you're all square");return;}
  const netColor=net>=0?'#166534':'#ef4444';
  document.getElementById('settle-summary').innerHTML=`
    <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:5px"><span>You fronted for others</span><span class="num" style="color:#166534">+${fmt(fronted)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:5px"><span>You owe others</span><span class="num" style="color:#ef4444">&minus;${fmt(owed)}</span></div>
    ${paid>0.004?`<div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:5px"><span>Payments you made</span><span class="num" style="color:#166534">+${fmt(paid)}</span></div>`:''}
    ${received>0.004?`<div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:5px"><span>Payments you received</span><span class="num" style="color:#ef4444">&minus;${fmt(received)}</span></div>`:''}
    <div style="margin-bottom:3px"></div>
    <div style="height:1px;background:#e7e5e4;margin-bottom:8px"></div>
    <div style="display:flex;justify-content:space-between;font-weight:600;font-size:.9rem"><span>Net</span><span class="num" style="color:${netColor}">${net>=0?'+':'-'}${fmt(Math.abs(net))}</span></div>
    <p style="font-size:.72rem;color:#a8a29e;margin-top:6px">${net>0.004?"You're owed money overall — this will record it as income.":net<-0.004?'You owe money overall — this will record it as an expense.':"You're exactly settled — no money needs to move."}</p>`;
  setDateVal('settle-date',today());
  fillSettleAccOpts();
  document.getElementById('settle-hint').textContent=Math.abs(net)>0.004
    ?'This will record the net amount as an income/expense in the selected account and mark all outstanding split entries as settled.'
    :'This will just mark all outstanding split entries as settled — no money needs to move.';
  openModal('modal-settle');
}

function confirmSettle(){
  const{net,pending}=computeSplitwiseBalance();
  if(pending<=0.004){toast('Nothing to settle');closeModal('modal-settle');return;}
  const date=document.getElementById('settle-date').value;
  if(!date){toast('Select a settlement date');return;}
  const accKey=document.getElementById('settle-acc').value;
  const isCash=accKey==='cash';
  const bankId=isCash?null:accKey.split(':')[1];

  if(Math.abs(net)>0.004){
    if(!state.categories.expense.includes('Settlement'))state.categories.expense.push('Settlement');
    if(!state.categories.income.includes('Settlement'))state.categories.income.push('Settlement');
    if(net>0){
      state.transactions.push({id:uid(),date,type:'income',amount:Math.abs(net),destType:isCash?'cash':'bank',destId:isCash?'cash':bankId,category:'Settlement',desc:'Splitwise settlement'});
    }else{
      state.transactions.push({id:uid(),date,type:'expense',amount:Math.abs(net),myShare:Math.abs(net),acType:isCash?'cash':'bank',acId:isCash?'cash':bankId,category:'Settlement',desc:'Splitwise settlement'});
    }
  }
  state.transactions.forEach(t=>{
    if((t.type==='expense'&&t.shared&&!t.settled)||(t.splitSettle&&!t.settled))t.settled=true;
  });
  saveState();closeModal('modal-settle');rebuildAll();
  toast(Math.abs(net)>0.004?`Settled — ${net>0?'income':'expense'} of ${fmt(Math.abs(net))} recorded`:'All settled — no money moved');
}

/* ── Account Modal ────────────────────────────────────────── */
let _editAcType=null, _editAcId=null;

function _configModal(type, isEdit){
  document.getElementById('ac-type').value=type;
  const isCash=type==='cash', isBank=type==='bank', isCC=type==='cc';
  document.getElementById('ac-name-lbl').textContent=isBank?'Account Name':isCC?'Card Name':'';
  document.getElementById('ac-name').placeholder=isBank?'e.g. HDFC Savings':isCC?'e.g. ICICI Amazon Pay':'';
  document.getElementById('ac-bal-wrap').classList.toggle('hidden', isCC||isCash);
  ['ac-lim-wrap','ac-due-wrap','ac-duedate-wrap'].forEach(id=>document.getElementById(id).classList.toggle('hidden',!isCC));
  document.getElementById('ac-nw-wrap').classList.toggle('hidden',!isBank);
  if(isCash){
    document.getElementById('ac-bal-wrap').classList.remove('hidden');
    document.getElementById('ac-bal-lbl').textContent='Cash Balance (INR)';
    document.getElementById('ac-name').closest('div').classList.add('hidden');
  } else {
    document.getElementById('ac-bal-lbl').textContent='Starting Balance (INR)';
    document.getElementById('ac-name').closest('div').classList.remove('hidden');
  }
  const label = isCash?'Edit Cash Balance': isEdit?(isBank?'Edit Bank Account':'Edit Credit Card'):(isBank?'Add Bank Account':'Add Credit Card');
  document.getElementById('modal-ac-title').textContent=label;
  document.getElementById('ac-save-btn').textContent=isEdit?'Save Changes':'Add';
}

function openAddModal(type){
  _editAcType=null; _editAcId=null;
  ['ac-name','ac-bal','ac-lim','ac-due','ac-dueday','ac-reminddays'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ac-include-nw').checked=true;
  _configModal(type, false);
  openModal('modal-ac');
}

function openEditModal(type, id){
  _editAcType=type; _editAcId=id;
  ['ac-name','ac-bal','ac-lim','ac-due','ac-dueday','ac-reminddays'].forEach(el=>document.getElementById(el).value='');
  document.getElementById('ac-include-nw').checked=true;
  _configModal(type, true);
  if(type==='bank'){
    const b=state.banks.find(x=>x.id===id);
    if(!b)return;
    document.getElementById('ac-name').value=b.name;
    document.getElementById('ac-bal').value=b.startBalance||'';
    document.getElementById('ac-include-nw').checked=b.includeInNetWorth!==false;
  } else if(type==='cc'){
    const c=state.cards.find(x=>x.id===id);
    if(!c)return;
    document.getElementById('ac-name').value=c.name;
    document.getElementById('ac-lim').value=c.limit||'';
    document.getElementById('ac-due').value=c.startDue||'';
    document.getElementById('ac-dueday').value=c.dueDay||'';
    document.getElementById('ac-reminddays').value=c.remindDays||'';
  } else if(type==='cash'){
    document.getElementById('ac-bal').value=state.cash.startBalance||'';
  }
  openModal('modal-ac');
}

function saveAccount(){
  const type=document.getElementById('ac-type').value;
  const isEdit=!!_editAcId;
  const name=document.getElementById('ac-name').value.trim();
  if(type!=='cash'&&!name){toast('Enter a name');return;}

  if(type==='bank'){
    const bal=Number(document.getElementById('ac-bal').value)||0;
    const includeInNetWorth=document.getElementById('ac-include-nw').checked;
    if(isEdit){
      const b=state.banks.find(x=>x.id===_editAcId);
      if(b){b.name=name;b.startBalance=bal;b.includeInNetWorth=includeInNetWorth;}
    } else {
      state.banks.push({id:uid(),name,startBalance:bal,includeInNetWorth});
    }
  } else if(type==='cc'){
    const obj={name,limit:Number(document.getElementById('ac-lim').value)||0,startDue:Number(document.getElementById('ac-due').value)||0,dueDay:Number(document.getElementById('ac-dueday').value)||0,remindDays:Number(document.getElementById('ac-reminddays').value)||5};
    if(isEdit){
      const ci=state.cards.findIndex(x=>x.id===_editAcId);
      if(ci>=0)state.cards[ci]={...state.cards[ci],...obj};
    } else {
      state.cards.push({id:uid(),...obj});
    }
  } else if(type==='cash'){
    state.cash.startBalance=Number(document.getElementById('ac-bal').value)||0;
  }

  saveState();closeModal('modal-ac');
  fillExpInst();fillIncInst();fillTransferOpts();renderSidebar();
  const label=type==='cash'?'Cash balance':type==='bank'?'Bank account':'Credit card';
  toast(`${label} ${isEdit?'updated':'added'}`);
}

function confirmDeleteAccount(type, id){
  let name='';
  if(type==='bank'){const b=state.banks.find(x=>x.id===id);name=b?b.name:'account';}
  else if(type==='cc'){const c=state.cards.find(x=>x.id===id);name=c?c.name:'card';}
  document.getElementById('confirm-body').textContent=`Delete "${name}"? Its transactions will remain but balances will be recalculated without this account.`;
  document.getElementById('confirm-ok-btn').onclick=()=>{
    let removed=null;
    if(type==='bank'){removed=state.banks.find(x=>x.id===id);state.banks=state.banks.filter(x=>x.id!==id);}
    else if(type==='cc'){removed=state.cards.find(x=>x.id===id);state.cards=state.cards.filter(x=>x.id!==id);}
    saveState();rebuildAll();
    if(removed)showUndoToast('Account deleted',()=>{
      if(type==='bank')state.banks.push(removed);else state.cards.push(removed);
      saveState();rebuildAll();toast('Restored');
    });
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}