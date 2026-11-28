/* ── Sync merge: combine two copies of the data item by item ──────────────────
   Each device keeps sync metadata next to its data:
     meta = { items:{'<coll>|<id>':ts}, tomb:{'<coll>|<id>':ts}, fields:{'<field>':ts} }
   ts = when that item / field was last changed (ms). Changes are found by diffing the data
   against the copy from the previous save (stampChanges), so no mutation code records anything.
   Merge rule (mergeStates): per item and per field the latest change wins; a delete (tombstone)
   beats older edits; an item only one side has is kept. So edits on two devices to different
   transactions both survive; only the same item changed on both keeps the later edit.
   Pure functions, no DOM or Firebase: loaded before state.js. */
const SYNC_COLLS=['banks','cards','transactions','loans','recurring','investments.accounts','investments.holdings'];
const SYNC_TOMB_TTL=180*864e5; // forget deletes after 180 days (every device has synced by then)

const syncClone=o=>o===undefined?undefined:JSON.parse(JSON.stringify(o));
function syncGet(o,path){return path.split('.').reduce((a,k)=>a&&typeof a==='object'?a[k]:undefined,o);}
function syncSet(o,path,v){
  const ks=path.split('.');let a=o;
  for(let i=0;i<ks.length-1;i++){if(!a[ks[i]]||typeof a[ks[i]]!=='object')a[ks[i]]={};a=a[ks[i]];}
  if(v===undefined)delete a[ks[ks.length-1]];else a[ks[ks.length-1]]=v;
}
const syncList=(s,c)=>{const v=syncGet(s,c);return Array.isArray(v)?v:[];};
/* Everything that is not an id'd collection is merged as a whole field ('monthlyBudget', 'categories', ...) */
function syncFieldKeys(s){
  const out=[];
  Object.keys(s||{}).forEach(k=>{
    if(SYNC_COLLS.includes(k))return;
    if(k==='investments'&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){
      Object.keys(s[k]).forEach(j=>{if(!SYNC_COLLS.includes('investments.'+j))out.push('investments.'+j);});
      return;
    }
    out.push(k);
  });
  return out;
}
const emptySyncMeta=()=>({items:{},tomb:{},fields:{}});
function normSyncMeta(m){m=m&&typeof m==='object'?m:{};return{items:{...(m.items||{})},tomb:{...(m.tomb||{})},fields:{...(m.fields||{})}};}
/* Key-order independent JSON, for "did anything change" comparisons */
function syncCanon(o){
  if(Array.isArray(o))return'['+o.map(syncCanon).join(',')+']';
  if(o&&typeof o==='object')return'{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+syncCanon(o[k])).join(',')+'}';
  return JSON.stringify(o===undefined?null:o);
}

/* Record in meta what differs between base (data as of the previous save) and cur, at time now.
   noTombs: only stamp added/changed items (used once when upgrading an old unsynced local copy). */
function stampChanges(base,cur,meta,now,noTombs){
  meta=normSyncMeta(meta);
  SYNC_COLLS.forEach(c=>{
    const before=new Map(syncList(base,c).filter(x=>x&&x.id).map(x=>[x.id,syncCanon(x)]));
    const seen=new Set();
    syncList(cur,c).forEach(x=>{
      if(!x||!x.id)return;
      seen.add(x.id);
      const k=c+'|'+x.id;
      if(before.get(x.id)!==syncCanon(x)){meta.items[k]=now;delete meta.tomb[k];}
    });
    if(!noTombs)before.forEach((_,id)=>{if(!seen.has(id)){const k=c+'|'+id;meta.tomb[k]=now;delete meta.items[k];}});
  });
  new Set([...syncFieldKeys(base),...syncFieldKeys(cur)]).forEach(f=>{
    const a=syncGet(base,f),b=syncGet(cur,f);
    if(noTombs&&b===undefined)return;
    if(syncCanon(a)!==syncCanon(b))meta.fields[f]=now;
  });
  return meta;
}

/* Merge local (L, Lm) with remote (R, Rm). Returns {state, meta}. Ties go to the remote copy,
   so every device settles on the same result. */
function mergeStates(L,Lm,R,Rm,now){
  Lm=normSyncMeta(Lm);Rm=normSyncMeta(Rm);
  const cutoff=(now||Date.now())-SYNC_TOMB_TTL;
  if(!R)R=null;
  const out=syncClone(R||L||{});
  const meta=emptySyncMeta();
  [Lm.tomb,Rm.tomb].forEach(t=>{for(const k in t)if(t[k]>cutoff&&!(meta.tomb[k]>=t[k]))meta.tomb[k]=t[k];});
  SYNC_COLLS.forEach(c=>{
    const lMap=new Map(syncList(L,c).filter(x=>x&&x.id).map(x=>[x.id,x]));
    const res=[],used=new Set();
    const take=(id,rx)=>{
      const k=c+'|'+id,lx=lMap.get(id);
      const lt=lx?(Lm.items[k]||0):-1,rt=rx?(Rm.items[k]||0):-1;
      const useL=lt>rt,item=useL?lx:rx,ts=Math.max(lt,rt,0);
      const tb=meta.tomb[k];
      if(tb!==undefined&&tb>=ts)return;          // deleted after its last edit
      if(tb!==undefined)delete meta.tomb[k];      // edited after the delete: the edit wins
      res.push(syncClone(item));
      if(ts>0)meta.items[k]=ts;
    };
    syncList(R,c).forEach(rx=>{
      if(!rx||!rx.id){res.push(syncClone(rx));return;}
      used.add(rx.id);take(rx.id,rx);
    });
    syncList(L,c).forEach(lx=>{if(lx&&lx.id&&!used.has(lx.id)){used.add(lx.id);take(lx.id,null);}});
    if(syncGet(L,c)!==undefined||syncGet(R,c)!==undefined)syncSet(out,c,res);
  });
  new Set([...syncFieldKeys(L),...syncFieldKeys(R)]).forEach(f=>{
    const lt=Lm.fields[f]||0,rt=Rm.fields[f]||0,lv=syncGet(L,f),rv=syncGet(R,f);
    // Newer side wins; on a tie keep the remote value unless the remote copy doesn't have the field
    const useL=!R||lt>rt||(lt===rt&&rv===undefined);
    syncSet(out,f,syncClone(useL?lv:rv));
    const ts=Math.max(lt,rt);if(ts>0)meta.fields[f]=ts;
  });
  return{state:out,meta};
}
