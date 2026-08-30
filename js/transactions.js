/* ── Dropdowns ────────────────────────────────────────────── */
function fillExpInst(){
  const t=document.getElementById('e-actype').value,s=document.getElementById('e-inst');
  s.innerHTML='';
  if(t==='bank'){if(!state.banks.length){s.innerHTML='<option>No banks added</option>';return;}state.banks.forEach(b=>s.innerHTML+=`<option value="${b.id}">${esc(b.name)}</option>`);}
  else if(t==='cc'){if(!state.cards.length){s.innerHTML='<option>No cards added</option>';return;}state.cards.forEach(c=>s.innerHTML+=`<option value="${c.id}">${esc(c.name)}</option>`);}
  else s.innerHTML='<option value="cash">Cash</option>';
}
function fillIncInst(){
  const t=document.getElementById('i-actype').value,s=document.getElementById('i-inst');
  s.innerHTML='';
  if(t==='bank'){if(!state.banks.length)s.innerHTML='<option>No banks added</option>';else state.banks.forEach(b=>s.innerHTML+=`<option value="${b.id}">${esc(b.name)}</option>`);}
  else if(t==='cc'){if(!state.cards.length)s.innerHTML='<option>No cards added</option>';else state.cards.forEach(c=>s.innerHTML+=`<option value="${c.id}">${esc(c.name)}</option>`);}
  else s.innerHTML='<option value="cash">Cash</option>';
  document.getElementById('i-cc-hint')?.classList.toggle('hidden',t!=='cc');
}
function fillTransferOpts(){
  let html='';
  state.banks.forEach(b=>html+=`<option value="bank:${b.id}">${esc(b.name)} (Bank)</option>`);
  html+='<option value="cash">Cash</option>';
  state.cards.forEach(c=>html+=`<option value="cc:${c.id}">${esc(c.name)} (CC Bill)</option>`);
  state.investments.accounts.forEach(a=>html+=`<option value="inv:${a.id}">${esc(a.name)} (Investment)</option>`);
  document.getElementById('t-from').innerHTML=html;
  document.getElementById('t-to').innerHTML=html;
  if(document.getElementById('t-to').options.length>1)document.getElementById('t-to').selectedIndex=1;
}

/* ── Chips ────────────────────────────────────────────────── */
function renderChips(ctx){
  const id=ctx==='expense'?'e-chips':'i-chips',cats=state.categories[ctx];
  const sel=ctx==='expense'?selExpCat:selIncCat,wrap=document.getElementById(id);
  wrap.innerHTML='';
  cats.forEach((cat,i)=>{
    const col=cpal(i),btn=document.createElement('button');
    btn.className='chip'+(cat===sel?' selected':'');
    btn.style.background=col.bg;btn.style.color=col.fg;btn.textContent=cat;
    btn.onclick=()=>{if(ctx==='expense')selExpCat=selExpCat===cat?null:cat;else selIncCat=selIncCat===cat?null:cat;renderChips(ctx);};
    wrap.appendChild(btn);
  });
  const plus=document.createElement('button');
  plus.className='chip';plus.style.background='#f4f3f0';plus.style.color='#78716c';
  plus.innerHTML=`<svg style="width:10px;height:10px;margin-right:3px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Add`;
  plus.onclick=()=>{document.getElementById('cat-ctx').value=ctx;document.getElementById('cat-title').textContent=ctx==='expense'?'Add Expense Category':'Add Income Category';document.getElementById('inp-cat').value='';openModal('modal-cat');};
  wrap.appendChild(plus);
}
function saveCategory(){
  const ctx=document.getElementById('cat-ctx').value,name=document.getElementById('inp-cat').value.trim();
  if(!name){toast('Enter a name');return;}
  if(state.categories[ctx].map(c=>c.toLowerCase()).includes(name.toLowerCase())){toast('Already exists');return;}
  state.categories[ctx].push(name);saveState();renderChips(ctx);fillTxnFilterCatOpts();closeModal('modal-cat');toast('Category added');
}

/* ── Txn toggle ───────────────────────────────────────────── */
function setTxn(type){
  txnType=type;
  ['expense','income','transfer'].forEach(t=>{
    const btn=document.getElementById(`tt-${t}`);
    btn.className='ttb'+(t===type?(t==='expense'?' ae':t==='income'?' ai':' at'):'');
    document.getElementById(`form-${t}`)[t===type?'classList':'classList'][t===type?'remove':'add']('hidden');
  });
}

function calculateCumulativeTotal(selectedCats){
  return curViewTxns()
    .filter(t=>t.type==='expense'&&selectedCats.includes(t.category))
    .reduce((sum,t)=>sum+shareAmount(t),0);
}

function renderCumulativeCategoryWidget(){
  const wrap=document.getElementById('cumulative-cat-widget');
  if(!wrap)return;
  const cats=state.categories.expense||[];
  const activeCats=cumulativeCatSelection.length?cumulativeCatSelection:cats.slice(0,1);
  const total=calculateCumulativeTotal(activeCats);
  const scopeLabel=viewMode==='fy'?fyLabel(viewFY):mkLabel(viewMK);
  const scopeText=viewMode==='fy'?'Current FY total':'Current month total';
  wrap.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
      <span style="font-weight:600;font-size:.88rem">Cumulative Category Spend</span>
      <span class="slabel">${scopeLabel}</span>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:.72rem;color:#78716c;margin-bottom:6px">Select categories</div>
      <div id="cumulative-cat-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:.72rem;color:#a8a29e">${scopeText}</span>
      <span class="num" id="cumulative-cat-total" style="font-size:.92rem;font-weight:600;color:#1c1917">${fmt(total)}</span>
    </div>`;
  const list=document.getElementById('cumulative-cat-list');
  if(!cats.length){
    list.innerHTML='<div style="font-size:.78rem;color:#c4bfba">No expense categories available</div>';
    return;
  }
  cats.forEach((cat,i)=>{
    const col=cpal(i);
    const label=document.createElement('label');
    label.className='chip';
    label.style.background=col.bg;
    label.style.color=col.fg;
    label.style.display='inline-flex';
    label.style.alignItems='center';
    label.style.gap='6px';
    label.innerHTML=`<input type="checkbox" data-cat="${esc(cat)}" ${activeCats.includes(cat)?'checked':''} style="accent-color:${col.fg};margin:0"> <span>${esc(cat)}</span>`;
    label.querySelector('input').onchange=()=>{
      cumulativeCatSelection=Array.from(list.querySelectorAll('input[data-cat]:checked')).map(inp=>inp.dataset.cat);
      renderCumulativeCategoryWidget();
    };
    list.appendChild(label);
  });
}
function quickTransferIn(accountId){
  switchView('dashboard');
  setTxn('transfer');
  fillTransferOpts();
  document.getElementById('t-to').value='inv:'+accountId;
  setTimeout(()=>document.getElementById('form-transfer').scrollIntoView({behavior:'smooth',block:'center'}),50);
}

/* ── Submit ───────────────────────────────────────────────── */
/* ── Roommate Split (shared expenses) ─────────────────────── */
let expSplitMode='fronted';
function toggleSplitPanel(){
  const on=document.getElementById('e-split-toggle').checked;
  document.getElementById('e-split-panel').classList.toggle('hidden',!on);
  document.getElementById('e-amt-label').textContent=on?'Total Bill Amount (₹)':'Amount (INR)';
  if(on){
    setSplitMode(expSplitMode);
    const shareInp=document.getElementById('e-my-share');
    if(!shareInp.value)shareInp.value=document.getElementById('e-amt').value||'';
  }else{
    document.getElementById('e-acc-row').classList.remove('hidden');
  }
}
function setSplitMode(mode){
  expSplitMode=mode;
  document.getElementById('e-split-fronted-btn').classList.toggle('active',mode==='fronted');
  document.getElementById('e-split-owed-btn').classList.toggle('active',mode==='owed');
  document.getElementById('e-split-fronted-note').classList.toggle('hidden',mode!=='fronted');
  document.getElementById('e-split-owed-note').classList.toggle('hidden',mode!=='owed');
  document.getElementById('e-acc-row').classList.toggle('hidden',mode==='owed');
}
function onExpAmtInput(){
  if(!document.getElementById('e-split-toggle').checked)return;
  const shareInp=document.getElementById('e-my-share');
  // keep "My Share" in sync with the total until the user edits it manually
  if(shareInp.dataset.touched)return;
  shareInp.value=document.getElementById('e-amt').value||'';
}
function calcEqualShare(){
  const amt=Number(document.getElementById('e-amt').value)||0;
  const n=Number(document.getElementById('e-split-people').value)||4;
  if(amt<=0||n<=0){toast('Enter the total bill amount and number of people first');return;}
  const shareInp=document.getElementById('e-my-share');
  shareInp.value=(amt/n).toFixed(2);
  shareInp.dataset.touched='1';
}
function resetSplitPanel(){
  document.getElementById('e-split-toggle').checked=false;
  const shareInp=document.getElementById('e-my-share');
  shareInp.value='';delete shareInp.dataset.touched;
  document.getElementById('e-split-people').value='';
  expSplitMode='fronted';
  toggleSplitPanel();
}

function submitExpense(){
  const amt=Number(document.getElementById('e-amt').value),date=document.getElementById('e-date').value;
  const desc=document.getElementById('e-desc').value.trim();
  const isSplit=document.getElementById('e-split-toggle').checked;
  if(!amt||amt<=0){toast('Enter a valid amount');return;}
  if(!date){toast('Select a date');return;}
  if(!selExpCat){toast('Select a category');return;}

  let myShare=amt;
  if(isSplit){
    myShare=Number(document.getElementById('e-my-share').value);
    if(!(myShare>0)){toast('Enter your share amount');return;}
    if(myShare>amt){toast('Your share cannot exceed the total bill amount');return;}
  }

  if(isSplit&&expSplitMode==='owed'){
    state.transactions.push({id:uid(),date,type:'expense',amount:amt,acType:'shared',acId:null,category:selExpCat,desc,myShare,shared:true,sharedMode:'owed',settled:false});
  }else{
    const at=document.getElementById('e-actype').value,ai=document.getElementById('e-inst').value;
    if((at==='bank'||at==='cc')&&!ai){toast('No account selected');return;}
    state.transactions.push({id:uid(),date,type:'expense',amount:amt,acType:at,acId:at==='cash'?'cash':ai,category:selExpCat,desc,myShare,shared:isSplit,sharedMode:isSplit?'fronted':undefined,settled:isSplit?false:undefined});
  }
  saveState();
  document.getElementById('e-amt').value='';document.getElementById('e-desc').value='';
  resetSplitPanel();
  rebuildAll();toast(isSplit?'Shared expense logged':'Expense logged');
}
function submitIncome(){
  const amt=Number(document.getElementById('i-amt').value),date=document.getElementById('i-date').value;
  const dt=document.getElementById('i-actype').value,di=document.getElementById('i-inst').value;
  const desc=document.getElementById('i-desc').value.trim();
  if(!amt||amt<=0){toast('Enter a valid amount');return;}
  if(!date){toast('Select a date');return;}
  if(!selIncCat){toast('Select a source category');return;}
  if((dt==='bank'||dt==='cc')&&!di){toast('No account selected');return;}
  state.transactions.push({id:uid(),date,type:'income',amount:amt,destType:dt,destId:dt==='cash'?'cash':di,category:selIncCat,desc});
  saveState();document.getElementById('i-amt').value='';document.getElementById('i-desc').value='';
  rebuildAll();toast(dt==='cc'?'Income recorded — card due reduced':'Income recorded');
}
function submitTransfer(){
  const amt=Number(document.getElementById('t-amt').value),date=document.getElementById('t-date').value;
  const from=document.getElementById('t-from').value,to=document.getElementById('t-to').value;
  const note=document.getElementById('t-note').value.trim();
  if(!amt||amt<=0){toast('Enter a valid amount');return;}
  if(!date){toast('Select a date');return;}
  if(from===to){toast('From and To must differ');return;}
  state.transactions.push({id:uid(),date,type:'transfer',amount:amt,fromKey:from,toKey:to,note});
  saveState();document.getElementById('t-amt').value='';document.getElementById('t-note').value='';
  rebuildAll();toast('Transfer recorded');
}

