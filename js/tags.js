/* ── Tags (freeform, cross-cutting labels e.g. "Goa Trip") ──── */
function selTagsFor(ctx){return ctx==='expense'?selExpTags:selIncTags;}
function setSelTagsFor(ctx,arr){if(ctx==='expense')selExpTags=arr;else selIncTags=arr;}

function renderTagChips(ctx){
  const chipsWrap=document.getElementById(ctx==='expense'?'e-tag-chips':'i-tag-chips');
  const suggestWrap=document.getElementById(ctx==='expense'?'e-tag-suggest':'i-tag-suggest');
  const selected=selTagsFor(ctx);
  chipsWrap.innerHTML='';
  selected.forEach(tag=>{
    const i=state.tags.indexOf(tag),col=cpal(i>=0?i:0);
    const chip=document.createElement('span');
    chip.className='chip';chip.style.background=col.bg;chip.style.color=col.fg;chip.style.cursor='default';
    chip.innerHTML=`${esc(tag)} <button type="button" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:700;padding:0 0 0 5px;font-size:.85rem;line-height:1" title="Remove tag">&times;</button>`;
    chip.querySelector('button').onclick=()=>removeTag(ctx,tag);
    chipsWrap.appendChild(chip);
  });
  const unused=state.tags.filter(t=>!selected.includes(t));
  suggestWrap.innerHTML='';
  unused.forEach(tag=>{
    const i=state.tags.indexOf(tag),col=cpal(i>=0?i:0);
    const chip=document.createElement('button');
    chip.type='button';chip.className='chip';
    chip.style.background='#fff';chip.style.color=col.fg;chip.style.border=`1.5px dashed ${col.fg}55`;
    chip.textContent='+ '+tag;
    chip.onclick=()=>addTag(ctx,tag);
    suggestWrap.appendChild(chip);
  });
}
function addTag(ctx,rawTag){
  const tag=String(rawTag).trim();
  if(!tag)return;
  if(!state.tags.some(t=>t.toLowerCase()===tag.toLowerCase()))state.tags.push(tag);
  const canonical=state.tags.find(t=>t.toLowerCase()===tag.toLowerCase())||tag;
  const selected=selTagsFor(ctx);
  if(!selected.includes(canonical))setSelTagsFor(ctx,[...selected,canonical]);
  saveState();
  renderTagChips(ctx);
  fillTxnFilterTagOpts();
}
function removeTag(ctx,tag){
  setSelTagsFor(ctx,selTagsFor(ctx).filter(t=>t!==tag));
  renderTagChips(ctx);
}
function addTagFromInput(ctx){
  const inp=document.getElementById(ctx==='expense'?'e-tag-input':'i-tag-input');
  const val=inp.value.trim();
  if(!val)return;
  addTag(ctx,val);
  inp.value='';
}
function resetTagInputs(){
  selExpTags=[];selIncTags=[];
  ['e-tag-input','i-tag-input'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderTagChips('expense');renderTagChips('income');
}
function tagPillsHtml(tags){
  if(!tags||!tags.length)return'';
  return tags.map(tag=>{
    const i=state.tags.indexOf(tag),col=cpal(i>=0?i:0);
    return`<span class="badge-sm" style="background:${col.bg};color:${col.fg};margin-left:4px">${esc(tag)}</span>`;
  }).join('');
}
