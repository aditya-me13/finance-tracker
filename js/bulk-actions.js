/* ── Bulk Actions on Filtered Transactions ───────────────────
   Scope: only expense/income rows are selectable (they're the only
   types with a category + tags). Selection resets whenever the
   filter changes, since "select all" only ever means the current
   filtered set. ──────────────────────────────────────────── */
function bulkSelectableTxns(){
  return state.transactions.filter(txnMatchesFilter).filter(t=>t.type==='expense'||t.type==='income');
}
function toggleBulkSelect(id,checked){
  if(checked)bulkSelectedIds.add(id);else bulkSelectedIds.delete(id);
  updateBulkBar();
  syncSelectAllCheckbox();
}
function toggleSelectAllFiltered(){
  const checked=document.getElementById('txn-select-all').checked;
  const filtered=bulkSelectableTxns();
  if(checked)filtered.forEach(t=>bulkSelectedIds.add(t.id));
  else filtered.forEach(t=>bulkSelectedIds.delete(t.id));
  renderTxnLog();
}
function clearBulkSelection(){
  bulkSelectedIds.clear();
  renderTxnLog();
}
function updateBulkBar(){
  const bar=document.getElementById('txn-bulk-bar');
  if(!bar)return;
  const count=bulkSelectedIds.size;
  if(count>0){
    bar.classList.remove('hidden');
    document.getElementById('txn-bulk-count').textContent=`${count} selected`;
  }else{
    bar.classList.add('hidden');
  }
}
function syncSelectAllCheckbox(){
  const selAll=document.getElementById('txn-select-all');
  if(!selAll)return;
  const filtered=bulkSelectableTxns();
  selAll.checked=filtered.length>0&&filtered.every(t=>bulkSelectedIds.has(t.id));
}

/* ── Bulk Delete ──────────────────────────────────────────── */
function bulkDeleteSelected(){
  if(!bulkSelectedIds.size){toast('Select at least one transaction');return;}
  const ids=Array.from(bulkSelectedIds);
  document.getElementById('confirm-body').textContent=`Delete ${ids.length} selected transaction(s)? You can undo this right after.`;
  document.getElementById('confirm-ok-btn').onclick=()=>{
    const removed=state.transactions.filter(t=>ids.includes(t.id));
    state.transactions=state.transactions.filter(t=>!ids.includes(t.id));
    bulkSelectedIds.clear();
    saveState();rebuildAll();
    showUndoToast(`${removed.length} transaction(s) deleted`,()=>{
      state.transactions.push(...removed);
      saveState();rebuildAll();toast('Restored');
    });
    closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}

/* ── Bulk Recategorize ────────────────────────────────────── */
function openBulkRecatModal(){
  if(!bulkSelectedIds.size){toast('Select at least one transaction');return;}
  const selected=state.transactions.filter(t=>bulkSelectedIds.has(t.id));
  const types=new Set(selected.map(t=>t.type));
  const body=document.getElementById('bulk-recat-body');
  const btn=document.getElementById('bulk-recat-confirm-btn');
  if(types.size>1){
    body.innerHTML=`<p style="font-size:.8rem;color:#ef4444;line-height:1.5">Your selection includes both expenses and income. Narrow your filter to just one type (e.g. pick any Expense category) before bulk recategorizing.</p>`;
    btn.disabled=true;btn.style.opacity='.5';
  }else{
    const type=[...types][0];
    const cats=type==='expense'?state.categories.expense:state.categories.income;
    body.innerHTML=`
      <p style="font-size:.78rem;color:#78716c;margin-bottom:8px">Change category for ${selected.length} ${type} transaction(s):</p>
      <select id="bulk-recat-select" class="pl">${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`;
    btn.disabled=false;btn.style.opacity='1';
    btn.dataset.type=type;
  }
  openModal('modal-bulk-recat');
}
function confirmBulkRecat(){
  const btn=document.getElementById('bulk-recat-confirm-btn');
  if(btn.disabled)return;
  const type=btn.dataset.type;
  const sel=document.getElementById('bulk-recat-select');
  if(!sel)return;
  const newCat=sel.value;
  const ids=Array.from(bulkSelectedIds);
  let count=0;
  state.transactions.forEach(t=>{
    if(ids.includes(t.id)&&t.type===type){t.category=newCat;count++;}
  });
  saveState();closeModal('modal-bulk-recat');
  bulkSelectedIds.clear();
  rebuildAll();
  toast(`Recategorized ${count} transaction(s) to "${newCat}"`);
}

/* ── Bulk Tag ─────────────────────────────────────────────── */
function setBulkTagMode(mode){
  bulkTagMode=mode;
  document.getElementById('bulk-tag-add-btn').classList.toggle('active',mode==='add');
  document.getElementById('bulk-tag-remove-btn').classList.toggle('active',mode==='remove');
  document.getElementById('bulk-tag-add-fields').classList.toggle('hidden',mode!=='add');
  document.getElementById('bulk-tag-remove-fields').classList.toggle('hidden',mode!=='remove');
}
function openBulkTagModal(){
  if(!bulkSelectedIds.size){toast('Select at least one transaction');return;}
  document.getElementById('bulk-tag-input').value='';
  const suggestWrap=document.getElementById('bulk-tag-suggest');
  suggestWrap.innerHTML=state.tags.map((t,i)=>{
    const col=cpal(i);
    return`<button type="button" class="chip" style="background:${col.bg};color:${col.fg}" onclick="document.getElementById('bulk-tag-input').value=this.dataset.tag" data-tag="${esc(t)}">${esc(t)}</button>`;
  }).join('');
  const removeSel=document.getElementById('bulk-tag-remove-select');
  removeSel.innerHTML=state.tags.length?state.tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join(''):'<option value="">No tags yet</option>';
  setBulkTagMode('add');
  openModal('modal-bulk-tag');
}
function confirmBulkTag(){
  const ids=Array.from(bulkSelectedIds);
  if(!ids.length)return;
  if(bulkTagMode==='add'){
    const raw=document.getElementById('bulk-tag-input').value.trim();
    if(!raw){toast('Enter a tag');return;}
    if(!state.tags.some(t=>t.toLowerCase()===raw.toLowerCase()))state.tags.push(raw);
    const canonical=state.tags.find(t=>t.toLowerCase()===raw.toLowerCase())||raw;
    let count=0;
    state.transactions.forEach(t=>{
      if(ids.includes(t.id)&&(t.type==='expense'||t.type==='income')){
        if(!t.tags)t.tags=[];
        if(!t.tags.includes(canonical)){t.tags.push(canonical);count++;}
      }
    });
    saveState();closeModal('modal-bulk-tag');bulkSelectedIds.clear();rebuildAll();
    toast(`Added "${canonical}" to ${count} transaction(s)`);
  }else{
    const tag=document.getElementById('bulk-tag-remove-select').value;
    if(!tag){toast('No tag selected');return;}
    let count=0;
    state.transactions.forEach(t=>{
      if(ids.includes(t.id)&&(t.tags||[]).includes(tag)){
        t.tags=t.tags.filter(x=>x!==tag);count++;
      }
    });
    saveState();closeModal('modal-bulk-tag');bulkSelectedIds.clear();rebuildAll();
    toast(`Removed "${tag}" from ${count} transaction(s)`);
  }
}
