/* ── Loans / EMI Tracker ──────────────────────────────────── */
function openLoanModal(id){
  document.getElementById('loan-id').value=id||'';
  const isEdit=!!id;
  document.getElementById('modal-loan-title').textContent=isEdit?'Edit Loan / EMI':'Add Loan / EMI';
  document.getElementById('loan-save-btn').textContent=isEdit?'Save Changes':'Add';
  ['loan-name','loan-principal','loan-outstanding','loan-emi','loan-tenure','loan-dueday','loan-reminddays'].forEach(id=>document.getElementById(id).value='');
  if(isEdit){
    const l=state.loans.find(x=>x.id===id);
    if(!l)return;
    document.getElementById('loan-name').value=l.name;
    document.getElementById('loan-principal').value=l.principal||'';
    document.getElementById('loan-outstanding').value=l.outstanding||'';
    document.getElementById('loan-emi').value=l.emiAmount||'';
    document.getElementById('loan-tenure').value=l.tenureMonths||'';
    document.getElementById('loan-dueday').value=l.dueDay||'';
    document.getElementById('loan-reminddays').value=l.remindDays||'';
  }
  openModal('modal-loan');
}
function saveLoan(){
  const id=document.getElementById('loan-id').value;
  const name=document.getElementById('loan-name').value.trim();
  if(!name){toast('Enter a loan name');return;}
  const obj={
    name,
    principal:Number(document.getElementById('loan-principal').value)||0,
    outstanding:Number(document.getElementById('loan-outstanding').value)||0,
    emiAmount:Number(document.getElementById('loan-emi').value)||0,
    tenureMonths:Number(document.getElementById('loan-tenure').value)||0,
    dueDay:Number(document.getElementById('loan-dueday').value)||0,
    remindDays:Number(document.getElementById('loan-reminddays').value)||5,
  };
  if(id){
    const l=state.loans.find(x=>x.id===id);
    if(l)Object.assign(l,obj);
  }else{
    state.loans.push({id:uid(),...obj});
  }
  saveState();closeModal('modal-loan');rebuildAll();
  toast(`Loan ${id?'updated':'added'}`);
}
function confirmDeleteLoan(id){
  const l=state.loans.find(x=>x.id===id);
  const name=l?l.name:'loan';
  document.getElementById('confirm-body').textContent=`Delete "${name}"? You can undo this right after.`;
  document.getElementById('confirm-ok-btn').onclick=()=>{
    state.loans=state.loans.filter(x=>x.id!==id);
    saveState();rebuildAll();
    if(l)showUndoToast('Loan deleted',()=>{
      state.loans.push(l);
      saveState();rebuildAll();toast('Restored');
    });
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}
function renderLoansWidget(){
  const wrap=document.getElementById('sb-loans');
  if(!state.loans.length){wrap.innerHTML='<div style="font-size:.74rem;color:#c4bfba;padding:3px 8px">No loans yet</div>';return;}
  wrap.innerHTML=state.loans.map((l,i)=>{
    const ds=getDueDateStatus(l);
    const badgeCls={ok:'due-ok',soon:'due-soon',urgent:'due-urgent',overdue:'due-overdue'}[ds?.status||'ok'];
    const pct=l.principal>0?Math.min((l.outstanding/l.principal)*100,100):0;
    const cls=pct>80?'po':pct>50?'pw':'ps';
    return`<div class="sb-item" style="flex-direction:column;align-items:flex-start;gap:5px">
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <span class="sb-dot" style="background:${IDOTS[i%IDOTS.length]};flex-shrink:0"></span>
        <span class="sb-name" style="flex:1" title="${esc(l.name)}">${esc(l.name)}</span>
        <span class="sb-amt neg">${fmt(l.outstanding)}</span>
        <button class="btn-i" onclick="openLoanModal('${l.id}')" title="Edit" style="padding:2px;flex-shrink:0"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
        <button class="btn-i" onclick="confirmDeleteLoan('${l.id}')" title="Delete" style="padding:2px;flex-shrink:0" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#c4bfba'"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
      </div>
      ${ds?`<div style="padding-left:15px"><span class="due-badge ${badgeCls}">${ds.label}</span> <span style="font-size:.68rem;color:#a8a29e">EMI ${fmt(l.emiAmount)}${l.tenureMonths?` &middot; ${l.tenureMonths} mo left`:''}</span></div>`:''}
      ${l.principal>0?`<div style="padding-left:15px;width:100%">
        <div class="pt" style="height:3px"><div class="pf ${cls}" style="width:${pct}%"></div></div>
        <div style="font-size:.65rem;color:#c4bfba;margin-top:2px">${fmt(l.outstanding)} of ${fmt(l.principal)} remaining</div>
      </div>`:''}
      <button class="sb-add" style="width:auto;height:auto;padding:4px 9px;border-radius:7px;display:inline-flex;gap:5px;align-items:center;border-style:dashed;margin-left:15px" onclick="openEmiPayModal('${l.id}')">
        <span style="font-size:.72rem;font-weight:500">Record EMI Payment</span>
      </button>
    </div>`;
  }).join('');
}

/* ── Record EMI Payment ───────────────────────────────────── */
function fillEmiPayAccOpts(){
  let html='<option value="cash">Cash</option>';
  state.banks.forEach(b=>html+=`<option value="bank:${b.id}">${esc(b.name)} (Bank)</option>`);
  document.getElementById('emi-pay-acc').innerHTML=html;
}
function openEmiPayModal(loanId){
  const l=state.loans.find(x=>x.id===loanId);
  if(!l)return;
  document.getElementById('emi-loan-id').value=loanId;
  document.getElementById('emi-pay-info').textContent=`${l.name} — outstanding ${fmt(l.outstanding)}`;
  document.getElementById('emi-pay-amount').value=l.emiAmount||'';
  setDateVal('emi-pay-date',today());
  fillEmiPayAccOpts();
  openModal('modal-emi-pay');
}
function confirmEmiPayment(){
  const loanId=document.getElementById('emi-loan-id').value;
  const l=state.loans.find(x=>x.id===loanId);
  if(!l){toast('Loan not found');return;}
  const amount=Number(document.getElementById('emi-pay-amount').value);
  const date=document.getElementById('emi-pay-date').value;
  const accKey=document.getElementById('emi-pay-acc').value;
  if(!(amount>0)){toast('Enter a valid amount');return;}
  if(!date){toast('Select a payment date');return;}
  const isCash=accKey==='cash';
  const bankId=isCash?null:accKey.split(':')[1];
  if(!isCash&&!bankId){toast('Select an account');return;}
  if(!state.categories.expense.includes('Loan EMI'))state.categories.expense.push('Loan EMI');
  state.transactions.push({id:uid(),date,type:'expense',amount,myShare:amount,acType:isCash?'cash':'bank',acId:isCash?'cash':bankId,category:'Loan EMI',desc:`EMI — ${l.name}`,tags:[],loanId:l.id});
  l.outstanding=Math.max(0,(Number(l.outstanding)||0)-amount);
  if(l.tenureMonths>0)l.tenureMonths=Math.max(0,l.tenureMonths-1);
  saveState();closeModal('modal-emi-pay');rebuildAll();
  toast('EMI payment recorded');
}
