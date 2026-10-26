/* ── Investments ──────────────────────────────────────────── */
const invAccTypeLabel=t=>t==='demat'?'Demat Account':'Mutual Fund Platform';
const invHoldTypeLabel=t=>t==='mf'?'Mutual Fund':'Stock';

/* Non-SIP holdings can be entered by units or by rupee amount (units = amount / price) */
function holdEntryMode(){
  const t=document.getElementById('inv-hold-type').value;
  return t==='sip'?'units':(document.getElementById('inv-hold-entry-mode').value||'units');
}
function toggleHoldEntryMode(){
  const t=document.getElementById('inv-hold-type').value;
  const m=holdEntryMode();
  document.getElementById('inv-hold-entry-mode-wrap').classList.toggle('hidden',t==='sip');
  if(t!=='sip'){
    document.getElementById('inv-hold-units-label').textContent=m==='amount'?'Amount Invested (₹)':'Units / Quantity';
    const ui=document.getElementById('inv-hold-units');
    ui.step=m==='amount'?'0.01':'0.001';
  }
  updateHoldUnitsPreview();
}
function updateHoldUnitsPreview(){
  const el=document.getElementById('inv-hold-units-preview');
  if(!el)return;
  if(holdEntryMode()!=='amount'){el.textContent='';return;}
  const amt=Number(document.getElementById('inv-hold-units').value)||0;
  const price=Number(document.getElementById('inv-hold-buy').value)||0;
  el.textContent=amt>0&&price>0?`≈ ${(amt/price).toFixed(4)} units at ${fmt(price)}/unit`:'Enter the price/NAV (or use Fetch) to calculate units.';
}

function toggleHoldLookupFields(){
  const t=document.getElementById('inv-hold-type').value;
  document.getElementById('inv-hold-stock-wrap').classList.toggle('hidden',t!=='stock');
  document.getElementById('inv-hold-mf-wrap').classList.toggle('hidden',t==='stock');
  document.getElementById('inv-hold-buy-mode-wrap').classList.toggle('hidden',t==='sip');
  const unitsLabel=document.getElementById('inv-hold-units-label');
  const buyLabel=document.getElementById('inv-hold-buy-label');
  const unitsInput=document.getElementById('inv-hold-units');
  const buyInput=document.getElementById('inv-hold-buy');
  if(t==='sip'){
    unitsLabel.textContent='Monthly SIP Amount (₹)';
    buyLabel.textContent='Duration (months)';
    unitsInput.step='0.01';
    unitsInput.placeholder='2500';
    buyInput.step='1';
    buyInput.placeholder='36';
    document.getElementById('inv-hold-mf-wrap').classList.remove('hidden');
  }else{
    unitsLabel.textContent=holdEntryMode()==='amount'?'Amount Invested (₹)':'Units / Quantity';
    buyLabel.textContent='Avg. Buy Price (₹/unit)';
    unitsInput.step=holdEntryMode()==='amount'?'0.01':'0.001';
    unitsInput.placeholder='0';
    buyInput.step='0.01';
    buyInput.placeholder='0.00';
    document.getElementById('inv-hold-mf-wrap').classList.toggle('hidden',t!=='mf');
  }
  toggleHoldPriceMode();
  document.getElementById('inv-hold-entry-mode-wrap').classList.toggle('hidden',t==='sip');
  updateHoldUnitsPreview();
}

function toggleHoldPriceMode(){
  const type=document.getElementById('inv-hold-type').value;
  const modeWrap=document.getElementById('inv-hold-buy-mode-wrap');
  const mode=document.getElementById('inv-hold-buy-mode').value;
  const hint=document.getElementById('inv-hold-buy-hint');
  const fetchBtn=document.getElementById('inv-hold-buy-fetch-btn');
  const buyInput=document.getElementById('inv-hold-buy');
  if(type==='sip'){
    modeWrap.classList.add('hidden');
    hint.textContent='';
    fetchBtn.textContent='Fetch';
    buyInput.readOnly=false;
    return;
  }
  modeWrap.classList.remove('hidden');
  buyInput.readOnly=false;
  fetchBtn.textContent=mode==='auto'?'Fetch now':'Fetch';
  hint.textContent=mode==='auto'
    ?'Auto fetch uses the purchase date to fill this price. You can still edit it manually before saving.'
    :'Manual entry is enabled. Use Fetch if you want to populate the price from the purchase date.';
}

async function resolveHoldPurchasePrice(type,date,symbol,schemeCode){
  if(type==='stock'){
    if(!symbol)throw new Error('Enter an NSE symbol first');
    return await fetchStockPrice(symbol,date);
  }
  if(type==='mf'){
    if(!schemeCode)throw new Error('Select an AMFI scheme first');
    return await fetchMFNav(schemeCode,date);
  }
  throw new Error('Price fetch is only available for stocks and mutual funds');
}

async function fetchHoldPurchasePrice(){
  const type=document.getElementById('inv-hold-type').value;
  const date=document.getElementById('inv-hold-date').value;
  const symbol=document.getElementById('inv-hold-symbol').value.trim().toUpperCase();
  const schemeCode=document.getElementById('inv-hold-schemecode').value.trim();
  if(type==='sip'){toast('Price fetch is not used for SIP series');return;}
  if(!date){toast('Select a purchase date');return;}
  try{
    const price=await resolveHoldPurchasePrice(type,date,symbol,schemeCode);
    document.getElementById('inv-hold-buy').value=price;
    updateHoldUnitsPreview();
    toast(`Fetched ${type==='mf'?'NAV':'price'} for ${date}`);
  }catch(e){
    toast(e?.message||'Could not fetch price');
  }
}

async function searchMF(){
  const q=document.getElementById('inv-hold-mfsearch').value.trim();
  const wrap=document.getElementById('inv-hold-mfresults');
  if(!q){wrap.innerHTML='';return;}
  wrap.innerHTML='<div style="font-size:.75rem;color:#a8a29e;padding:4px 2px">Searching…</div>';
  try{
    const res=await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
    const list=await res.json();
    if(!Array.isArray(list)||!list.length){wrap.innerHTML='<div style="font-size:.75rem;color:#a8a29e;padding:4px 2px">No matches</div>';return;}
    wrap.innerHTML=list.slice(0,8).map(f=>{
      const code=esc(String(f.schemeCode||''));
      const name=esc(String(f.schemeName||''));
      return `<div class="sb-item" style="cursor:pointer" role="button" tabindex="0" data-mf-code="${code}" data-mf-name="${name}"><span class="sb-name">${name}</span></div>`;
    }).join('');
    wrap.querySelectorAll('[data-mf-code]').forEach(el=>{
      el.addEventListener('click',()=>pickMF(el.dataset.mfCode||'',el.dataset.mfName||''));
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickMF(el.dataset.mfCode||'',el.dataset.mfName||'');}});
    });
  }catch(e){
    wrap.innerHTML='<div style="font-size:.75rem;color:#ef4444;padding:4px 2px">Search failed — try again</div>';
  }
}
function pickMF(code,name){
  document.getElementById('inv-hold-schemecode').value=code;
  if(!document.getElementById('inv-hold-name').value.trim())document.getElementById('inv-hold-name').value=name;
  document.getElementById('inv-hold-mfresults').innerHTML='';
  document.getElementById('inv-hold-mfpicked').textContent=`Linked to scheme ${code} — ${name}`;
}

function openInvAccModal(id){
  document.getElementById('inv-acc-id').value=id||'';
  const isEdit=!!id;
  document.getElementById('modal-inv-acc-title').textContent=isEdit?'Edit Investment Account':'Add Investment Account';
  document.getElementById('inv-acc-save-btn').textContent=isEdit?'Save Changes':'Add';
  if(isEdit){
    const a=state.investments.accounts.find(x=>x.id===id);
    if(!a)return;
    document.getElementById('inv-acc-type').value=a.type;
    document.getElementById('inv-acc-name').value=a.name;
  }else{
    document.getElementById('inv-acc-type').value='demat';
    document.getElementById('inv-acc-name').value='';
  }
  openModal('modal-inv-acc');
}

function saveInvAccount(){
  const id=document.getElementById('inv-acc-id').value;
  const type=document.getElementById('inv-acc-type').value;
  const name=document.getElementById('inv-acc-name').value.trim();
  if(!name){toast('Enter an account name');return;}
  if(id){
    const a=state.investments.accounts.find(x=>x.id===id);
    if(a){a.type=type;a.name=name;}
  }else{
    state.investments.accounts.push({id:uid(),type,name});
  }
  saveState();closeModal('modal-inv-acc');rebuildAll();
  toast(`Investment account ${id?'updated':'added'}`);
}

function confirmDeleteInvAccount(id){
  const a=state.investments.accounts.find(x=>x.id===id);
  const name=a?a.name:'account';
  const holdCount=state.investments.holdings.filter(h=>h.accountId===id).length;
  document.getElementById('confirm-body').textContent=`Delete "${name}"? This will also delete ${holdCount} holding(s) and their linked transactions. You can undo this right after.`;
  document.getElementById('confirm-ok-btn').onclick=()=>{
    const removedAccount=a;
    const removedHoldings=state.investments.holdings.filter(h=>h.accountId===id);
    const removedTxns=state.transactions.filter(t=>t.type==='invest'&&t.accountId===id);
    state.investments.accounts=state.investments.accounts.filter(x=>x.id!==id);
    state.investments.holdings=state.investments.holdings.filter(h=>h.accountId!==id);
    state.transactions=state.transactions.filter(t=>!(t.type==='invest'&&t.accountId===id));
    saveState();rebuildAll();
    if(removedAccount)showUndoToast('Investment account deleted',()=>{
      state.investments.accounts.push(removedAccount);
      state.investments.holdings.push(...removedHoldings);
      state.transactions.push(...removedTxns);
      saveState();rebuildAll();toast('Restored');
    });
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}

function fillInvHoldAccOpts(selectedId){
  const s=document.getElementById('inv-hold-acc');
  if(!state.investments.accounts.length){s.innerHTML='<option value="">No accounts — add one first</option>';return;}
  s.innerHTML=state.investments.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} (${invAccTypeLabel(a.type)})</option>`).join('');
  if(selectedId)s.value=selectedId;
}

function fillInvHoldBankOpts(selectedId){
  const s=document.getElementById('inv-hold-bank');
  if(!state.banks.length){s.innerHTML='<option value="">No banks added</option>';return;}
  s.innerHTML=state.banks.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  if(selectedId)s.value=selectedId;
}

function toggleHoldFundingFields(){
  const fundMode=document.getElementById('inv-hold-fund-mode').value;
  document.getElementById('inv-hold-bank-wrap').classList.toggle('hidden',fundMode!=='bank');
  updateInvHoldCashHint();
}

function renderInvTopSummary(){
  const wrap=document.getElementById('inv-top-summary');
  if(!wrap)return;
  const holdings=state.investments.holdings||[];
  const buckets={MF:{invested:0,current:0},Stock:{invested:0,current:0}};
  holdings.forEach(h=>{
    const key=h.type==='stock'?'Stock':'MF';
    const m=holdMetrics(h);
    buckets[key].invested+=m.invested;
    buckets[key].current+=m.currentValue;
  });
  const bal=computeBal();
  const totalInvested=buckets.MF.invested+buckets.Stock.invested;
  const totalCurrent=buckets.MF.current+buckets.Stock.current;
  const cashValue=bal.totInvCash+bal.ca+bal.totBank-bal.totCC;
  const mode=invSummaryMode;
  const mainLabel=mode==='cash'?'Overall Cash':'Total Amount Invested';
  const mainValue=mode==='cash'?fmt(cashValue):fmt(totalInvested);
  const subLine=mode==='cash'?'Across bank, cash and investment balances':'MF + Stocks';
  const rows=mode==='cash'
    ?[`<div class="row"><span>Investment cash</span><span class="num">${fmt(bal.totInvCash)}</span></div>`,`<div class="row"><span>Bank + cash</span><span class="num">${fmt(bal.totBank+bal.ca)}</span></div>`]
    :[`<div class="row"><span>Stocks (Equity)</span><span class="num">${fmt(buckets.Stock.invested)}</span></div>`,`<div class="row"><span>Mutual Funds</span><span class="num">${fmt(buckets.MF.invested)}</span></div>`];
  wrap.innerHTML=`
    <div class="stat-tile" style="padding:10px 12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <div class="slabel" style="margin:0">${mainLabel}</div>
          <div class="val" style="color:#1c1917;font-size:clamp(.96rem,3.8vw,1.15rem);margin-top:2px">${mainValue}</div>
        </div>
        <button type="button" class="btn-g" style="padding:6px 9px;font-size:.74rem;white-space:nowrap" onclick="toggleInvSummaryMode()">${mode==='cash'?'Show invested':'Show cash'}</button>
      </div>
      <div class="delta" style="color:#a8a29e">${subLine}</div>
      ${mode==='cash'?'':`<div class="stat-breakdown">${rows.join('')}</div>`}
    </div>`;
}

function toggleInvSummaryMode(){
  invSummaryMode=invSummaryMode==='cash'?'invested':'cash';
  renderInvTopSummary();
}

function updateInvHoldCashHint(){
  const accId=document.getElementById('inv-hold-acc').value;
  const hint=document.getElementById('inv-hold-cash-hint');
  const bal=computeBal();
  const editId=document.getElementById('inv-hold-id').value;
  const fundMode=document.getElementById('inv-hold-fund-mode')?.value||'inv';
  const bankId=document.getElementById('inv-hold-bank')?.value||'';
  const h=editId?state.investments.holdings.find(x=>x.id===editId):null;
  if(!accId){hint.textContent='';return;}
  let avail=0,label='';
  if(fundMode==='bank'){
    if(!bankId){hint.textContent='Select a bank account';hint.style.color='#a8a29e';return;}
    avail=bal.bk[bankId]||0;
    label='Available cash in this bank account';
    if(h&&h.sourceKey===`bank:${bankId}`)avail+=(Number(h.units)||0)*(Number(h.buyPrice)||0);
  }else{
    avail=bal.iv[accId]||0;
    label='Available cash in this investment account';
    if(h&&h.accountId===accId&&(!h.sourceKey||h.sourceKey===`inv:${accId}`))avail+=(Number(h.units)||0)*(Number(h.buyPrice)||0);
  }
  hint.innerHTML=`${label}: <b>${fmt(avail)}</b>`;
  hint.style.color=avail>0?'#a8a29e':'#ef4444';
}

function openInvHoldModal(accId, holdId){
  if(!state.investments.accounts.length){toast('Add an investment account first');return;}
  document.getElementById('inv-hold-id').value=holdId||'';
  const isEdit=!!holdId;
  document.getElementById('modal-inv-hold-title').textContent=isEdit?'Edit Holding':'Add Holding';
  document.getElementById('inv-hold-save-btn').textContent=isEdit?'Save Changes':'Add';
  document.getElementById('inv-hold-mfresults').innerHTML='';
  document.getElementById('inv-hold-mfpicked').textContent='';
  document.getElementById('inv-hold-mfsearch').value='';
  document.getElementById('inv-hold-schemecode').value='';
  document.getElementById('inv-hold-symbol').value='';
  if(isEdit){
    const h=state.investments.holdings.find(x=>x.id===holdId);
    if(!h)return;
    fillInvHoldAccOpts(h.accountId);
    const fundMode=h.sourceKey&&h.sourceKey.startsWith('bank:')?'bank':'inv';
    document.getElementById('inv-hold-fund-mode').value=fundMode;
    fillInvHoldBankOpts(h.sourceKey&&h.sourceKey.startsWith('bank:')?h.sourceKey.split(':')[1]:'');
    document.getElementById('inv-hold-type').value=h.type;
    document.getElementById('inv-hold-buy-mode').value=h.buyPriceMode||'manual';
    setDateVal('inv-hold-date',h.date||'');
    document.getElementById('inv-hold-name').value=h.name;
    document.getElementById('inv-hold-units').value=h.units;
    document.getElementById('inv-hold-buy').value=h.buyPrice;
    document.getElementById('inv-hold-nav').value=h.nav;
    document.getElementById('inv-hold-symbol').value=h.symbol||'';
    if(h.schemeCode){
      document.getElementById('inv-hold-schemecode').value=h.schemeCode;
      document.getElementById('inv-hold-mfpicked').textContent=`Linked to scheme ${h.schemeCode}`;
    }
    if(h.type==='sip'){
      document.getElementById('inv-hold-units').value=h.monthlyAmount||'';
      document.getElementById('inv-hold-buy').value=h.durationMonths||'';
    }
  }else{
    fillInvHoldAccOpts(accId);
    document.getElementById('inv-hold-fund-mode').value='inv';
    fillInvHoldBankOpts(state.banks[0]?.id||'');
    document.getElementById('inv-hold-type').value='stock';
    document.getElementById('inv-hold-buy-mode').value='manual';
    setDateVal('inv-hold-date',today());
    document.getElementById('inv-hold-name').value='';
    document.getElementById('inv-hold-units').value='';
    document.getElementById('inv-hold-buy').value='';
    document.getElementById('inv-hold-nav').value='';
  }
  document.getElementById('inv-hold-entry-mode').value='units';
  toggleHoldLookupFields();
  toggleHoldFundingFields();
  openModal('modal-inv-hold');
  updateInvHoldCashHint();
}

async function saveInvHolding(){
  const id=document.getElementById('inv-hold-id').value;
  const accountId=document.getElementById('inv-hold-acc').value;
  const type=document.getElementById('inv-hold-type').value;
  const date=document.getElementById('inv-hold-date').value;
  const name=document.getElementById('inv-hold-name').value.trim();
  const units=Number(document.getElementById('inv-hold-units').value)||0;
  const buyPrice=Number(document.getElementById('inv-hold-buy').value)||0;
  const nav=Number(document.getElementById('inv-hold-nav').value)||0;
  const symbol=document.getElementById('inv-hold-symbol').value.trim().toUpperCase();
  const schemeCode=document.getElementById('inv-hold-schemecode').value.trim();
  const buyMode=document.getElementById('inv-hold-buy-mode').value;
  const fundMode=document.getElementById('inv-hold-fund-mode').value;
  const bankId=document.getElementById('inv-hold-bank').value;
  const sourceKey=fundMode==='bank'?`bank:${bankId}`:`inv:${accountId}`;
  if(!accountId){toast('Select an account');return;}
  if(!name){toast('Enter a name');return;}
  if(units<=0){toast(type==='sip'?'Enter monthly SIP amount':(holdEntryMode()==='amount'?'Enter the amount invested':'Enter units/quantity'));return;}
  if(!date){toast('Select a purchase date');return;}
  const isSip=type==='sip';
  const sipAmount=isSip?units:0;
  const sipMonths=isSip?Math.max(0,Math.floor(buyPrice)):0;
  let buyPriceToSave=buyPrice;
  if(!isSip&&buyMode==='auto'){
    try{
      buyPriceToSave=await resolveHoldPurchasePrice(type,date,symbol,schemeCode);
      document.getElementById('inv-hold-buy').value=buyPriceToSave;
    }catch(e){
      toast(e?.message||'Could not fetch price');
      return;
    }
  }
  const amountMode=!isSip&&holdEntryMode()==='amount';
  if(amountMode&&!(buyPriceToSave>0)){toast('Enter the price/NAV per unit (or use Fetch) so units can be calculated');return;}
  const unitsFinal=amountMode?units/buyPriceToSave:units;
  const newAmount=isSip?sipAmount*sipMonths:(amountMode?units:units*buyPriceToSave);
  const bal=computeBal();
  if(id){
    const h=state.investments.holdings.find(x=>x.id===id);
    if(!h)return;
    const oldAmount=h.type==='sip'
      ?((Number(h.monthlyAmount)||0)*(Number(h.durationMonths)||0))
      :(Number(h.units)||0)*(Number(h.buyPrice)||0);
    const sameSource=(h.sourceKey||`inv:${h.accountId}`)===sourceKey;
    const availForThis=(fundMode==='bank'?(bal.bk[bankId]||0):(bal.iv[accountId]||0))+(sameSource?oldAmount:0);
    if(newAmount>availForThis){toast(`Insufficient cash — only ${fmt(availForThis)} available in this account`);return;}
    if(h.type==='sip'&&h.seriesTxnIds?.length){
      state.transactions=state.transactions.filter(x=>!h.seriesTxnIds.includes(x.id));
    }else if(h.txnId){
      state.transactions=state.transactions.filter(x=>x.id!==h.txnId);
    }
    Object.assign(h,{accountId,type,date,name,units:isSip?sipAmount:unitsFinal,buyPrice:isSip?sipMonths:buyPriceToSave,nav,symbol,schemeCode,monthlyAmount:isSip?sipAmount:undefined,durationMonths:isSip?sipMonths:undefined,buyPriceMode:isSip?undefined:buyMode,sourceKey});
    if(isSip){
      if(!schemeCode){toast('Select an AMFI scheme for SIP series');return;}
      if(!sipMonths){toast('Enter a valid SIP duration');return;}
      const liveNav=nav||await fetchMFNav(schemeCode);
      const start=new Date(date+'T00:00:00');
      const series=[];
      let totalUnits=0;
      for(let i=0;i<sipMonths;i++){
        const d=new Date(start);
        d.setMonth(d.getMonth()-i);
        const txnDate=dateToStr(d);
        const invested=sipAmount;
        const unitsBought=invested/liveNav;
        totalUnits+=unitsBought;
        series.push({id:uid(),type:'invest',date:txnDate,accountId,amount:invested,name,units:unitsBought,buyPrice:liveNav,holdingId:h.id,schemeCode,sipMonth:i+1,sourceKey});
      }
      series.sort((a,b)=>a.date.localeCompare(b.date));
      state.transactions.push(...series);
      Object.assign(h,{units:totalUnits,buyPrice:sipAmount,nav:liveNav,txnId:series[series.length-1]?.id||'',seriesTxnIds:series.map(t=>t.id),monthlyAmount:sipAmount,durationMonths:sipMonths,sipSeries:true,sourceKey});
    }else{
      const txn=state.transactions.find(x=>x.id===h.txnId);
      if(txn)Object.assign(txn,{date,accountId,amount:newAmount,name,units:unitsFinal,buyPrice:buyPriceToSave,sourceKey});
      else{const tx={id:uid(),type:'invest',date,accountId,amount:newAmount,name,units:unitsFinal,buyPrice:buyPriceToSave,holdingId:h.id,sourceKey};state.transactions.push(tx);h.txnId=tx.id;}
    }
  }else{
    const avail=bal.iv[accountId]||0;
    const directAvail=fundMode==='bank'?(bal.bk[bankId]||0):avail;
    if(newAmount>directAvail){toast(`Insufficient cash — only ${fmt(directAvail)} available in this account${fundMode==='bank'?' / bank account':''}.`);return;}
    if(isSip){
      if(!schemeCode){toast('Select an AMFI scheme for SIP series');return;}
      if(!sipMonths){toast('Enter a valid SIP duration');return;}
      const liveNav=nav||await fetchMFNav(schemeCode);
      const start=new Date(date+'T00:00:00');
      const hid=uid();
      const series=[];
      let totalUnits=0;
      for(let i=0;i<sipMonths;i++){
        const d=new Date(start);
        d.setMonth(d.getMonth()-i);
        const txnDate=dateToStr(d);
        const invested=sipAmount;
        const unitsBought=invested/liveNav;
        totalUnits+=unitsBought;
        series.push({id:uid(),type:'invest',date:txnDate,accountId,amount:invested,name,units:unitsBought,buyPrice:liveNav,holdingId:hid,schemeCode,sipMonth:i+1,sourceKey});
      }
      series.sort((a,b)=>a.date.localeCompare(b.date));
      state.transactions.push(...series);
      state.investments.holdings.push({id:hid,accountId,type,date,name,units:totalUnits,buyPrice:sipAmount,nav:liveNav,symbol,schemeCode,txnId:series[series.length-1]?.id||'',seriesTxnIds:series.map(t=>t.id),monthlyAmount:sipAmount,durationMonths:sipMonths,sipSeries:true,sourceKey});
    }else{
      const hid=uid(),tid=uid();
      state.investments.holdings.push({id:hid,accountId,type,date,name,units:unitsFinal,buyPrice:buyPriceToSave,nav,symbol,schemeCode,txnId:tid,buyPriceMode:buyMode,sourceKey});
      state.transactions.push({id:tid,type:'invest',date,accountId,amount:newAmount,name,units:unitsFinal,buyPrice:buyPriceToSave,holdingId:hid,sourceKey});
    }
  }
  saveState();closeModal('modal-inv-hold');rebuildAll();
  toast(`Holding ${id?'updated':'added'}`);
}

function confirmDeleteInvHolding(id){
  const h=state.investments.holdings.find(x=>x.id===id);
  document.getElementById('confirm-body').textContent=`Delete "${h?h.name:'holding'}"? The invested amount will be returned to the account's available cash. You can undo this right after.`;
  document.getElementById('confirm-ok-btn').onclick=()=>{
    let removedTxns=[];
    if(h){
      const ids=h.seriesTxnIds?.length?h.seriesTxnIds:[h.txnId];
      removedTxns=state.transactions.filter(x=>ids.includes(x.id));
      state.transactions=state.transactions.filter(x=>!ids.includes(x.id));
    }
    state.investments.holdings=state.investments.holdings.filter(x=>x.id!==id);
    saveState();rebuildAll();
    if(h)showUndoToast('Holding deleted',()=>{
      state.investments.holdings.push(h);
      state.transactions.push(...removedTxns);
      saveState();rebuildAll();toast('Restored');
    });
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}

function holdMetrics(h){
  const invested=h.units*h.buyPrice, currentValue=h.units*h.nav;
  const gain=currentValue-invested, gainPct=invested>0?(gain/invested)*100:0;
  return{invested,currentValue,gain,gainPct};
}

/* ── Sell Holding (cash out to bank / cash / investment account) ── */
function fillSellDestOpts(defaultVal){
  let html='<option value="cash">Cash</option>';
  state.banks.forEach(b=>html+=`<option value="bank:${b.id}">${esc(b.name)} (Bank)</option>`);
  state.investments.accounts.forEach(a=>html+=`<option value="inv:${a.id}">${esc(a.name)} (Investment Cash)</option>`);
  document.getElementById('inv-sell-dest').innerHTML=html;
  if(defaultVal)document.getElementById('inv-sell-dest').value=defaultVal;
}

function openInvSellModal(holdId){
  const h=state.investments.holdings.find(x=>x.id===holdId);
  if(!h){toast('Holding not found');return;}
  if(!(Number(h.units)>0)){toast('No units available to sell');return;}
  document.getElementById('inv-sell-hold-id').value=holdId;
  document.getElementById('inv-sell-name').textContent=`${h.name} (${h.type==='stock'?'Stock':'Mutual Fund'})`;
  document.getElementById('inv-sell-avail').textContent=`Available: ${h.units} units · Avg buy price ${fmt(h.buyPrice)} · Current NAV ${fmt(h.nav)}`;
  document.getElementById('inv-sell-units').value=h.units;
  document.getElementById('inv-sell-units').max=h.units;
  document.getElementById('inv-sell-price').value=h.nav||'';
  setDateVal('inv-sell-date',today());
  fillSellDestOpts(`inv:${h.accountId}`);
  updateSellPreview();
  openModal('modal-inv-sell');
}

function sellAllUnits(){
  const h=state.investments.holdings.find(x=>x.id===document.getElementById('inv-sell-hold-id').value);
  if(h)document.getElementById('inv-sell-units').value=h.units;
  updateSellPreview();
}

function updateSellPreview(){
  const h=state.investments.holdings.find(x=>x.id===document.getElementById('inv-sell-hold-id').value);
  const units=Number(document.getElementById('inv-sell-units').value)||0;
  const price=Number(document.getElementById('inv-sell-price').value)||0;
  const box=document.getElementById('inv-sell-preview');
  if(!h||!units||!price){box.textContent='Enter units and price to see a preview.';box.style.background='#f4f3f0';box.style.color='#57534e';return;}
  const proceeds=units*price;
  const cost=units*(Number(h.buyPrice)||0);
  const gain=proceeds-cost;
  box.style.background='#f4f3f0';box.style.color='#57534e';
  box.innerHTML=`Proceeds: <b>${fmt(proceeds)}</b> &nbsp;·&nbsp; Realized ${gain>=0?'gain':'loss'}: <b style="color:${gain>=0?'#166534':'#ef4444'}">${gain>=0?'+':''}${fmt(gain)}</b>`;
}

function saveInvSell(){
  const holdId=document.getElementById('inv-sell-hold-id').value;
  const h=state.investments.holdings.find(x=>x.id===holdId);
  if(!h){toast('Holding not found');return;}
  const units=Number(document.getElementById('inv-sell-units').value)||0;
  const price=Number(document.getElementById('inv-sell-price').value)||0;
  const date=document.getElementById('inv-sell-date').value;
  const dest=document.getElementById('inv-sell-dest').value;
  if(units<=0){toast('Enter units to sell');return;}
  if(units>Number(h.units)+1e-6){toast(`Only ${h.units} units available`);return;}
  if(price<=0){toast('Enter a valid sell price');return;}
  if(!date){toast('Select a sale date');return;}
  if(!dest){toast('Select where to credit proceeds');return;}
  const amount=units*price;
  const costBasis=units*(Number(h.buyPrice)||0);
  state.transactions.push({id:uid(),type:'divest',date,accountId:h.accountId,holdingId:h.id,name:h.name,units,sellPrice:price,amount,costBasis,destKey:dest});
  h.units=Math.max(0,Number((Number(h.units)-units).toFixed(6)));
  saveState();closeModal('modal-inv-sell');rebuildAll();
  const gain=amount-costBasis;
  toast(`Sold ${units} units for ${fmt(amount)} (${gain>=0?'+':''}${fmt(gain)})`);
}

/* ── Live price fetching ──────────────────────────────────── */
function isoToDmy(iso){
  const [y,m,d]=iso.split('-');
  return `${d}-${m}-${y}`;
}

function timestampToIsoIndia(ts){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts*1000));
}

async function fetchMFNav(schemeCode,date=''){
  if(!date){
    const res=await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}`);
    if(!res.ok)throw new Error('MF history request failed');
    const j=await res.json();
    const nav=Number(j?.data?.[0]?.nav);
    if(!nav)throw new Error('No NAV returned');
    return nav;
  }
  const res=await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}`);
  if(!res.ok)throw new Error('MF history request failed');
  const j=await res.json();
  const target=Date.parse(`${date}T00:00:00`);
  const history=Array.isArray(j?.data)?j.data:[];
  const match=history.find(item=>Date.parse(`${item.date.split('-').reverse().join('-')}T00:00:00`)<=target);
  const nav=Number(match?.nav);
  if(!nav)throw new Error('No NAV returned for the selected date');
  return nav;
}
async function fetchStockPrice(symbol,date=''){
  if(!date){
    if(!STOCK_PROXY_URL||STOCK_PROXY_URL.includes('PASTE-YOUR'))throw new Error('Stock price proxy not configured yet');
    const res=await fetch(`${STOCK_PROXY_URL}?symbol=${encodeURIComponent(symbol)}`);
    if(!res.ok)throw new Error('Price proxy request failed');
    const j=await res.json();
    const price=Number(j.price);
    if(!price)throw new Error('No price returned');
    return price;
  }
  const target=Date.parse(`${date}T00:00:00`);
  const start=Math.floor((target-10*24*60*60*1000)/1000);
  const end=Math.floor((target+24*60*60*1000)/1000);
  const res=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?period1=${start}&period2=${end}&interval=1d&includePrePost=false&events=div%2Csplits`);
  if(!res.ok)throw new Error('Historical price request failed');
  const j=await res.json();
  const result=j?.chart?.result?.[0];
  const timestamps=result?.timestamp||[];
  const closes=result?.indicators?.quote?.[0]?.close||[];
  const points=timestamps
    .map((ts,i)=>({date:timestampToIsoIndia(ts),close:Number(closes[i])}))
    .filter(p=>p.date&&Number.isFinite(p.close))
    .filter(p=>Date.parse(`${p.date}T00:00:00`)<=target);
  const price=points.length?points[points.length-1].close:NaN;
  if(!price)throw new Error('No price returned for the selected date');
  return price;
}
async function refreshAllPrices(){
  const holdings=state.investments.holdings;
  if(!holdings.length){toast('No holdings to refresh');return;}
  const btn=document.getElementById('refresh-prices-btn');
  if(btn){btn.disabled=true;btn.textContent='Refreshing…';}
  let ok=0,fail=0;
  for(const h of holdings){
    try{
      let price=null;
      if(h.type==='mf'&&h.schemeCode)price=await fetchMFNav(h.schemeCode);
      else if(h.type==='stock'&&h.symbol)price=await fetchStockPrice(h.symbol);
      if(price){h.nav=price;ok++;}else fail++;
    }catch(e){fail++;}
  }
  saveState();rebuildAll();
  if(btn){btn.disabled=false;btn.textContent='↻ Refresh Prices';}
  toast(fail?`Updated ${ok} price(s), ${fail} failed (missing symbol/scheme or lookup error)`:`Updated ${ok} price(s)`,3200);
}

function renderInvestments(){
  const accounts=state.investments.accounts, holdings=state.investments.holdings;
  const bal=computeBal();

  let totInvested=0, totCurrent=0;
  holdings.forEach(h=>{const m=holdMetrics(h);totInvested+=m.invested;totCurrent+=m.currentValue;});
  const totGain=totCurrent-totInvested, totGainPct=totInvested>0?(totGain/totInvested)*100:0;
  const gc=totGain>=0?'#166534':'#ef4444';
  const invBuckets={MF:{invested:0,current:0,profit:0},Stock:{invested:0,current:0,profit:0}};
  holdings.forEach(h=>{
    const key=h.type==='stock'?'Stock':'MF';
    const m=holdMetrics(h);
    invBuckets[key].invested+=m.invested;
    invBuckets[key].current+=m.currentValue;
    invBuckets[key].profit+=m.gain;
  });
  const bucketReturnPct=v=>v.invested>0?(v.profit/v.invested)*100:0;
  document.getElementById('inv-stat-tiles').innerHTML=[
    {label:'Available Cash',val:fmt(bal.totInvCash),color:'#1d4ed8',sub:'Transferred, not yet invested'},
    {label:'Invested Value',val:fmt(totInvested),color:'#1c1917',sub:`${holdings.length} holding(s)`,breakdown:[['Stocks (Equity)',fmt(invBuckets.Stock.invested)],['Mutual Funds',fmt(invBuckets.MF.invested)]]},
    {label:'Current Value',val:fmt(totCurrent),color:'#1c1917',sub:`${holdings.length} holding(s)`,breakdown:[['Stocks (Equity)',fmt(invBuckets.Stock.current)],['Mutual Funds',fmt(invBuckets.MF.current)]]},
    {label:'Total Gain / Loss',val:fmt(totGain),color:gc,sub:totGain>=0?'Unrealized profit':'Unrealized loss',breakdown:[['Stocks (Equity)',`${invBuckets.Stock.profit>=0?'+':''}${fmt(invBuckets.Stock.profit)}`],['Mutual Funds',`${invBuckets.MF.profit>=0?'+':''}${fmt(invBuckets.MF.profit)}`]]},
    {label:'Overall Return',val:`${totGainPct>=0?'+':''}${totGainPct.toFixed(2)}%`,color:gc,sub:'Since purchase',breakdown:[['Stocks (Equity)',`${bucketReturnPct(invBuckets.Stock)>=0?'+':''}${bucketReturnPct(invBuckets.Stock).toFixed(2)}%`],['Mutual Funds',`${bucketReturnPct(invBuckets.MF)>=0?'+':''}${bucketReturnPct(invBuckets.MF).toFixed(2)}%`]]},
  ].map(({label,val,color,sub,breakdown})=>`
    <div class="stat-tile">
      <div class="slabel">${label}</div>
      <div class="val" style="color:${color}">${val}</div>
      <div class="delta" style="color:#a8a29e">${sub}</div>
      ${breakdown?`<div class="stat-breakdown">${breakdown.map(([name,value])=>`<div class="row"><span>${esc(name)}</span><span class="num">${value}</span></div>`).join('')}</div>`:''}
    </div>`).join('');

  const profitData=[
    {label:`MF ${invBuckets.MF.profit<0?'Loss':'Profit'}`,value:Math.abs(invBuckets.MF.profit),raw:invBuckets.MF.profit},
    {label:`Stock ${invBuckets.Stock.profit<0?'Loss':'Profit'}`,value:Math.abs(invBuckets.Stock.profit),raw:invBuckets.Stock.profit},
  ].filter(x=>x.value>0);
  const profitEmpty=!profitData.length;
  document.getElementById('inv-profit-empty').classList.toggle('hidden',!profitEmpty);
  if(profitEmpty){
    destroyChart('invProfit');
    document.getElementById('inv-profit-leg').innerHTML='';
  }else{
    const profitBgs=['#dcfce7','#dbeafe'];
    const profitFgs=['#16a34a','#2563eb'];
    destroyChart('invProfit');
    CH.invProfit=new Chart(document.getElementById('inv-profit-donut').getContext('2d'),{
      type:'doughnut',
      data:{labels:profitData.map(d=>d.label),datasets:[{data:profitData.map(d=>d.value),backgroundColor:profitBgs.slice(0,profitData.length),borderColor:profitFgs.slice(0,profitData.length),borderWidth:2,hoverOffset:4}]},
      options:{cutout:'67%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${fmt(c.raw)}`}}},responsive:true,maintainAspectRatio:true}
    });
    const totalProfit=profitData.reduce((s,d)=>s+d.value,0);
    document.getElementById('inv-profit-leg').innerHTML=profitData.map((d,i)=>`<div style="display:flex;align-items:center;gap:5px;min-width:0"><span style="width:8px;height:8px;border-radius:2px;background:${profitFgs[i]};flex-shrink:0"></span><span style="font-size:.75rem;color:#57534e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.label)}</span><span class="num" style="font-size:.7rem;color:#a8a29e">${((d.value/totalProfit)*100).toFixed(0)}%</span></div>`).join('');
  }

  const allocData=[
    {label:'MF',value:invBuckets.MF.current},
    {label:'Stock',value:invBuckets.Stock.current},
  ].filter(x=>x.value>0);
  const allocEmpty=!allocData.length;
  document.getElementById('inv-alloc-empty').classList.toggle('hidden',!allocEmpty);
  if(allocEmpty){
    destroyChart('invAlloc');
    document.getElementById('inv-alloc-leg').innerHTML='';
  }else{
    const allocBgs=['#f0fdf4','#eff6ff'];
    const allocFgs=['#16a34a','#2563eb'];
    destroyChart('invAlloc');
    CH.invAlloc=new Chart(document.getElementById('inv-alloc-donut').getContext('2d'),{
      type:'doughnut',
      data:{labels:allocData.map(d=>d.label),datasets:[{data:allocData.map(d=>d.value),backgroundColor:allocBgs.slice(0,allocData.length),borderColor:allocFgs.slice(0,allocData.length),borderWidth:2,hoverOffset:4}]},
      options:{cutout:'67%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)}}},responsive:true,maintainAspectRatio:true}
    });
    const totalAlloc=allocData.reduce((s,d)=>s+d.value,0);
    document.getElementById('inv-alloc-leg').innerHTML=allocData.map((d,i)=>`<div style="display:flex;align-items:center;gap:5px;min-width:0"><span style="width:8px;height:8px;border-radius:2px;background:${allocFgs[i]};flex-shrink:0"></span><span style="font-size:.75rem;color:#57534e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.label)}</span><span class="num" style="font-size:.7rem;color:#a8a29e">${((d.value/totalAlloc)*100).toFixed(0)}%</span></div>`).join('');
  }

  const wrap=document.getElementById('inv-accounts-wrap');
  if(!accounts.length){
    wrap.innerHTML=`<div class="card" style="text-align:center;padding:32px 16px">
      <div style="font-size:.85rem;color:#78716c;margin-bottom:10px">No investment accounts yet</div>
      <button class="btn-p" onclick="openInvAccModal()">+ Add Your First Account</button>
    </div>`;
    return;
  }
  wrap.innerHTML=accounts.map((a,i)=>{
    const accHoldings=holdings.filter(h=>h.accountId===a.id);
    const invSum=accHoldings.reduce((s,h)=>s+holdMetrics(h).invested,0);
    const curSum=accHoldings.reduce((s,h)=>s+holdMetrics(h).currentValue,0);
    const gainSum=curSum-invSum, gainPctSum=invSum>0?(gainSum/invSum)*100:0;
    const color=IDOTS[i%IDOTS.length], gc2=gainSum>=0?'#166534':'#ef4444';
    const availCash=bal.iv[a.id]||0;
    const rows=!accHoldings.length?
      `<div style="font-size:.78rem;color:#c4bfba;padding:10px 4px">No holdings yet</div>`:
      accHoldings.map(h=>{
        const m=holdMetrics(h),hgc=m.gain>=0?'#166534':'#ef4444';
        const lookupTag=h.type==='mf'?(h.schemeCode?`<span class="badge-sm" style="background:#f0fdf4;color:#166534" title="AMFI scheme code">#${h.schemeCode}</span>`:''):(h.symbol?`<span class="badge-sm" style="background:#eff6ff;color:#1d4ed8" title="NSE symbol">${esc(h.symbol)}</span>`:'');
        return`<div class="hold-card">
          <div class="hold-card-top">
            <span class="badge-sm" style="background:${h.type==='mf'?'#ede9fe':'#dbeafe'};color:${h.type==='mf'?'#5b21b6':'#1e40af'}">${h.type==='mf'?'MF':'Stock'}</span>
            <span class="hold-name" title="${esc(h.name)}">${esc(h.name)}</span>
            ${lookupTag}
            <span class="hold-gain num" style="color:${hgc}">${m.gain>=0?'+':''}${m.gainPct.toFixed(1)}%</span>
          </div>
          <div class="hold-meta">
            <span>Units<b>${h.units}</b></span>
            <span>Buy<b>${fmt(h.buyPrice)}</b></span>
            <span>NAV<b>${fmt(h.nav)}</b></span>
            <span>Value<b style="color:#57534e">${fmt(m.currentValue)}</b></span>
          </div>
          <div class="hold-actions">
            ${h.units>0?`<button class="btn-i" onclick="openInvSellModal('${h.id}')" title="Sell" onmouseover="this.style.color='#166534'" onmouseout="this.style.color='#c4bfba'"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 7L7 17M7 17h10M7 17V7"/></svg></button>`:''}
            <button class="btn-i" onclick="openInvHoldModal(null,'${h.id}')" title="Edit"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
            <button class="btn-i" onclick="confirmDeleteInvHolding('${h.id}')" title="Delete" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#c4bfba'"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
          </div>
        </div>`;
      }).join('');
    return`<div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">
          <span class="sb-dot" style="background:${color};width:9px;height:9px;flex-shrink:0"></span>
          <span style="font-weight:600;font-size:.88rem">${esc(a.name)}</span>
          <span class="badge-sm" style="background:#f4f3f0;color:#78716c">${invAccTypeLabel(a.type)}</span>
          <span class="badge-sm" style="background:#eff6ff;color:#1d4ed8" title="Uninvested cash available">${fmt(availCash)} cash</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:right">
            <div class="num" style="font-size:.85rem;font-weight:600">${fmt(curSum)}</div>
            <div style="font-size:.68rem;color:${gc2}">${gainSum>=0?'+':''}${fmt(gainSum)} (${gainPctSum>=0?'+':''}${gainPctSum.toFixed(1)}%)</div>
          </div>
          <button class="btn-i" onclick="openInvAccModal('${a.id}')" title="Edit"><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
          <button class="btn-i" onclick="confirmDeleteInvAccount('${a.id}')" title="Delete" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#c4bfba'"><svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
      </div>
      <div>${rows}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="sb-add" style="width:auto;height:auto;padding:5px 10px;border-radius:7px;display:inline-flex;gap:5px;align-items:center;border-style:dashed" onclick="quickTransferIn('${a.id}')">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          <span style="font-size:.75rem;font-weight:500">Transfer In</span>
        </button>
        <button class="sb-add" style="width:auto;height:auto;padding:5px 10px;border-radius:7px;display:inline-flex;gap:5px;align-items:center;border-style:dashed" onclick="openInvHoldModal('${a.id}')">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          <span style="font-size:.75rem;font-weight:500">Add Holding</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

