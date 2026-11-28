/* ── Recurring Transactions ───────────────────────────────── */
function toggleRecurPanel(ctx){
  const on=document.getElementById(ctx==='expense'?'e-recur-toggle':'i-recur-toggle').checked;
  document.getElementById(ctx==='expense'?'e-recur-panel':'i-recur-panel').classList.toggle('hidden',!on);
  if(typeof updateMoreOptsSummary==='function')updateMoreOptsSummary(ctx);
}
function resetRecurToggle(ctx){
  const toggle=document.getElementById(ctx==='expense'?'e-recur-toggle':'i-recur-toggle');
  toggle.checked=false;
  resetRecurRemind(ctx);
  document.getElementById(ctx==='expense'?'e-recur-panel':'i-recur-panel').classList.add('hidden');
  if(typeof updateMoreOptsSummary==='function')updateMoreOptsSummary(ctx);
}
/* How many days before a scheduled occurrence it shows under "Due This Month" (0 = never).
   Rules saved before this setting existed use the default. Daily rules never remind. */
const RECUR_REMIND_DEFAULT=2;
const recurRemindDays=r=>r.frequency==='daily'?0:(Number.isFinite(Number(r.remindDays))&&r.remindDays!==''&&r.remindDays!==null&&r.remindDays!==undefined?Number(r.remindDays):RECUR_REMIND_DEFAULT);
function setRecurRemind(id,val){
  const r=(state.recurring||[]).find(x=>x.id===id);if(!r)return;
  r.remindDays=Number(val);saveState();rebuildAll();
  toast(r.remindDays?`Reminder set ${r.remindDays} day${r.remindDays>1?'s':''} before`:'Reminder turned off');
}
function resetRecurRemind(ctx){const el=document.getElementById(ctx==='expense'?'e-recur-remind':'i-recur-remind');if(el)el.value=String(RECUR_REMIND_DEFAULT);}
function createRecurringFromEntry(opts){
  const d=new Date(opts.anchorDate+'T00:00:00');
  state.recurring.push({
    id:uid(),
    name:opts.desc||opts.category,
    type:opts.type,
    amount:opts.amount,
    myShare:opts.myShare,
    acType:opts.acType,acId:opts.acId,
    shared:!!opts.shared,sharedMode:opts.sharedMode,
    destType:opts.destType,destId:opts.destId,
    category:opts.category,
    desc:opts.desc,
    tags:(opts.tags||[]).slice(),
    frequency:opts.frequency,
    remindDays:Number.isFinite(opts.remindDays)?opts.remindDays:RECUR_REMIND_DEFAULT,
    dayOfMonth:d.getDate(),
    weekday:d.getDay(),
    startDate:opts.anchorDate,
    lastGeneratedDate:opts.anchorDate,
    active:true,
  });
}
function nextRecurDate(r,fromDateStr){
  const d=new Date(fromDateStr+'T00:00:00');
  if(r.frequency==='daily'){d.setDate(d.getDate()+1);}
  else if(r.frequency==='weekly'){d.setDate(d.getDate()+7);}
  else{
    d.setDate(1); // reset to day 1 first so setMonth can't overflow into a later month
    d.setMonth(d.getMonth()+1);
    const dim=daysInMonth(d.getFullYear(),d.getMonth());
    d.setDate(Math.min(r.dayOfMonth||1,dim));
  }
  return dateToStr(d);
}
/* Generated entries get an id made from their source and date, so if two devices both generate the
   same due payment before syncing, the merge sees one transaction instead of two. A random id is
   used only if that id is somehow taken already. */
function recTxnId(kind,srcId,date){
  const id=`${kind}_${srcId}_${date}`;
  return state.transactions.some(t=>t.id===id)?uid():id;
}
function generateDueRecurring(){
  const todayStr=today();
  let count=0;
  (state.recurring||[]).forEach(r=>{
    if(!r.active)return;
    let cursor=nextRecurDate(r,r.lastGeneratedDate||r.startDate);
    let guard=0;
    while(cursor<=todayStr&&guard<500){
      if(r.type==='expense'){
        state.transactions.push({id:recTxnId('rec',r.id,cursor),date:cursor,type:'expense',amount:r.amount,acType:r.acType,acId:r.acId,category:r.category,desc:r.desc||r.name,myShare:r.myShare!==undefined?r.myShare:r.amount,tags:(r.tags||[]).slice(),recurringId:r.id,...(r.shared?{shared:true,sharedMode:r.sharedMode,settled:false}:{})});
      }else{
        state.transactions.push({id:recTxnId('rec',r.id,cursor),date:cursor,type:'income',amount:r.amount,destType:r.destType,destId:r.destId,category:r.category,desc:r.desc||r.name,tags:(r.tags||[]).slice(),recurringId:r.id});
      }
      r.lastGeneratedDate=cursor;
      count++;
      cursor=nextRecurDate(r,cursor);
      guard++;
    }
  });
  if(count>0){saveState();toast(`${count} recurring transaction${count>1?'s':''} auto-logged`);}
}

/* ── Credit card auto-debit ───────────────────────────────── */
/* Logs a bank -> card transfer on each configured debit day. Runs on app open and catches up
   on every missed occurrence since lastRunDate (oldest first, so earlier debits reduce what
   is owed for later ones). Nothing runs while the app is closed. */
function nextAutoDebitDate(day,fromDateStr){
  const d=new Date(fromDateStr+'T00:00:00');
  let y=d.getFullYear(),m=d.getMonth();
  let cand=dateToStr(new Date(y,m,Math.min(day,daysInMonth(y,m))));
  if(cand<=fromDateStr){m++;cand=dateToStr(new Date(y,m,Math.min(day,daysInMonth(y,m))));}
  return cand;
}
function generateDueAutoDebits(){
  const todayStr=today();
  let count=0,overdrawn=false,changed=false;
  state.cards.forEach(c=>{
    const ad=c.autoDebit;
    if(!ad||!ad.enabled||!ad.day||!state.banks.some(b=>b.id===ad.bankId))return;
    if(!ad.lastRunDate)ad.lastRunDate=todayStr;
    let cursor=nextAutoDebitDate(ad.day,ad.lastRunDate);
    let guard=0;
    while(cursor<=todayStr&&guard<60){
      const owed=cardDueAsOf(c.id,cursor);
      const amount=ad.mode==='fixed'?Math.min(Number(ad.fixedAmount)||0,owed):owed;
      const amt=Math.round(amount*100)/100;
      if(amt>0){
        state.transactions.push({id:recTxnId('ad',c.id,cursor),date:cursor,type:'transfer',amount:amt,fromKey:'bank:'+ad.bankId,toKey:'cc:'+c.id,note:'Auto-debit: '+c.name,autoDebitCardId:c.id,tags:[]});
        count++;
      }
      ad.lastRunDate=cursor;
      changed=true;
      cursor=nextAutoDebitDate(ad.day,cursor);
      guard++;
    }
  });
  if(!changed)return;
  saveState(); // also persists lastRunDate when nothing was owed, so we don't rescan next time
  if(count>0){
    const bal=computeBal();
    overdrawn=state.cards.some(c=>c.autoDebit&&c.autoDebit.enabled&&(bal.bk[c.autoDebit.bankId]||0)<0);
    toast(`${count} card auto-debit${count>1?'s':''} logged${overdrawn?' – a bank balance is now negative':''}`);
  }
}

/* ── Manage Recurring modal ───────────────────────────────── */
function renderRecurringWidget(){
  const sec=document.getElementById('sb-recurring-sec'),body=document.getElementById('sb-recurring-body');
  if(!sec||!body)return;
  const list=state.recurring||[];
  if(!list.length){sec.style.display='none';return;}
  sec.style.display='block';
  const activeCount=list.filter(r=>r.active).length;
  if(typeof setFoldSum==='function')setFoldSum('recurring',`${activeCount} active`);
  body.innerHTML=`
    <div style="padding:3px 8px 2px">
      <div style="font-size:.78rem;color:#57534e">${activeCount} active rule${activeCount===1?'':'s'}${list.length>activeCount?` (${list.length-activeCount} paused)`:''}</div>
      <button class="btn-g" style="width:100%;margin-top:8px;padding:6px 0;font-size:.78rem" onclick="openRecurringModal()">Manage Recurring</button>
    </div>`;
}
function recurFreqLabel(r){
  if(r.frequency==='daily')return'Daily';
  if(r.frequency==='weekly')return'Weekly (every '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.weekday]+')';
  return`Monthly (day ${r.dayOfMonth})`;
}
function openRecurringModal(){
  const wrap=document.getElementById('recurring-list');
  const list=state.recurring||[];
  if(!list.length){wrap.innerHTML='<div style="text-align:center;padding:20px 0;font-size:.82rem;color:var(--text-muted)">No recurring transactions yet — check "Repeat this automatically" on an Expense/Income entry to create one.</div>';}
  else{
    wrap.innerHTML=list.map(r=>{
      const nextDue=nextRecurDate(r,r.lastGeneratedDate||r.startDate);
      const amtDisplay=r.type==='expense'?fmt(r.myShare!==undefined?r.myShare:r.amount):fmt(r.amount);
      const amtColor=r.type==='expense'?'#ef4444':'#166534';
      return`<div class="bud-row" style="align-items:flex-start;padding:9px 0">
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:500;color:#292524">${esc(r.name)} ${!r.active?'<span class="badge-sm" style="background:#f4f3f0;color:var(--text-muted);margin-left:4px">Paused</span>':''}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${esc(r.category)} &middot; ${recurFreqLabel(r)} &middot; next ${fmtDate(nextDue)}</div>
          ${r.frequency==='daily'?'':`<label style="display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:.72rem;color:var(--text-muted)">Remind
            <select class="pl" style="width:auto;padding:3px 8px;font-size:.72rem" aria-label="Reminder for ${esc(r.name)}" onchange="setRecurRemind('${r.id}',this.value)">
              ${[[0,"Don't remind me"],[1,'1 day before'],[2,'2 days before'],[3,'3 days before'],[5,'5 days before'],[7,'7 days before']].map(([v,l])=>`<option value="${v}"${recurRemindDays(r)===v?' selected':''}>${l}</option>`).join('')}
            </select></label>`}
        </div>
        <span class="num" style="font-size:.82rem;font-weight:500;color:${amtColor};flex-shrink:0;margin-left:8px">${amtDisplay}</span>
        <button class="btn-i" title="Edit" aria-label="Edit ${esc(r.name)}" style="margin-left:6px" onclick="openRecurringEdit('${r.id}')">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button class="btn-i" title="${r.active?'Pause':'Resume'}" style="margin-left:2px" onclick="toggleRecurringActive('${r.id}')">
          ${r.active?'<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>':'<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-6.518-3.76A1 1 0 007 8.24v7.52a1 1 0 001.234.97l6.518-1.762a1 1 0 00.748-.968v-2.832a1 1 0 00-.748-.968z"/></svg>'}
        </button>
        <button class="btn-i danger" title="Delete" style="margin-left:2px" onclick="deleteRecurring('${r.id}')">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>`;
    }).join('');
  }
  openModal('modal-recurring');
}
/* ── Edit a rule: amount, next payment date, description ──── */
/* The date before `dateStr` by one period of rule r, chosen so that nextRecurDate(r, result) === dateStr */
function prevRecurDate(r,dateStr){
  const d=new Date(dateStr+'T00:00:00');
  if(r.frequency==='daily')d.setDate(d.getDate()-1);
  else if(r.frequency==='weekly')d.setDate(d.getDate()-7);
  else{const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()-1);d.setDate(Math.min(day,daysInMonth(d.getFullYear(),d.getMonth())));}
  return dateToStr(d);
}
function openRecurringEdit(id){
  const r=(state.recurring||[]).find(x=>x.id===id);if(!r)return;
  const isExp=r.type==='expense',isShared=isExp&&r.shared;
  document.getElementById('re-id').value=id;
  document.getElementById('re-meta').textContent=`${r.type==='income'?'Income':'Expense'} · ${recurFreqLabel(r)}${r.active?'':' · Paused'}`;
  document.getElementById('re-amt-label').textContent=isShared?'Total Bill (INR)':'Amount (INR)';
  document.getElementById('re-amt').value=r.amount;
  document.getElementById('re-share-wrap').classList.toggle('hidden',!isShared);
  document.getElementById('re-share').value=isShared?(r.myShare!==undefined?r.myShare:r.amount):'';
  const cats=state.categories[r.type==='income'?'income':'expense']||[];
  const opts=cats.includes(r.category)?cats:[r.category,...cats]; // keep a category that was since removed
  document.getElementById('re-cat').innerHTML=opts.map(c=>`<option value="${esc(c)}"${c===r.category?' selected':''}>${esc(c)}</option>`).join('');
  document.getElementById('re-desc').value=r.desc||'';
  document.getElementById('re-desc').placeholder=r.category;
  setDateVal('re-date',nextRecurDate(r,r.lastGeneratedDate||r.startDate));
  openModal('modal-recurring-edit');
}
function saveRecurringEdit(){
  const r=(state.recurring||[]).find(x=>x.id===document.getElementById('re-id').value);
  if(!r){closeModal('modal-recurring-edit');return;}
  const amt=Number(document.getElementById('re-amt').value);
  if(!(amt>0)){fieldError('re-amt','Enter a valid amount');return;}
  const isShared=r.type==='expense'&&r.shared;
  let share=amt;
  if(isShared){
    share=Number(document.getElementById('re-share').value);
    if(!(share>0)){fieldError('re-share','Enter your share amount');return;}
    if(share>amt){fieldError('re-share','Your share cannot exceed the total bill');return;}
  }
  const next=document.getElementById('re-date').value;
  if(!next){fieldError('re-date','Select the next payment date');return;}
  if(next<=today()){fieldError('re-date','Pick a date after today');return;}
  const desc=document.getElementById('re-desc').value.trim();
  const cat=document.getElementById('re-cat').value;
  if(!cat){fieldError('re-cat','Select a category');return;}

  r.amount=amt;r.category=cat;
  if(r.type==='expense')r.myShare=share;
  r.desc=desc;r.name=desc||r.category;
  // Re-anchor the schedule on the chosen date: monthly keeps that day of the month, weekly that weekday
  const nd=new Date(next+'T00:00:00');
  r.dayOfMonth=nd.getDate();r.weekday=nd.getDay();
  r.lastGeneratedDate=prevRecurDate(r,next);
  if(!r.startDate||r.startDate>r.lastGeneratedDate)r.startDate=r.lastGeneratedDate;

  saveState();closeModal('modal-recurring-edit');
  openRecurringModal();rebuildAll();
  toast('Recurring payment updated');
}
function toggleRecurringActive(id){
  const r=state.recurring.find(x=>x.id===id);
  if(!r)return;
  r.active=!r.active;
  if(r.active){
    // Skip occurrences that fell due while paused instead of back-filling them all on the next load
    const t=today();let c=r.lastGeneratedDate||r.startDate,g=0;
    for(let n=nextRecurDate(r,c);n<=t&&g<1000;n=nextRecurDate(r,n),g++)c=n;
    r.lastGeneratedDate=c;
  }
  saveState();openRecurringModal();renderRecurringWidget();
  toast(r.active?'Resumed':'Paused');
}
function deleteRecurring(id){
  const idx=state.recurring.findIndex(x=>x.id===id);
  if(idx<0)return;
  const removed=state.recurring[idx];
  state.recurring=state.recurring.filter(x=>x.id!==id);
  saveState();openRecurringModal();renderRecurringWidget();
  showUndoToast('Recurring rule deleted',()=>{
    state.recurring.push(removed);
    saveState();renderRecurringWidget();
    if(!document.getElementById('modal-recurring').classList.contains('hidden'))openRecurringModal();
    toast('Restored');
  });
}
