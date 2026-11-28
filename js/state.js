/* ================================================================
   CLOUD CONFIG — fill these in after you finish the setup steps
================================================================ */
// 1) Paste your Firebase project config here (Firebase console → Project settings → Your apps → SDK setup and configuration)
const firebaseConfig = {
  apiKey: "AIzaSyCJBpPQ644MJ_3s20XwkBS2rqAyKiimYls",
  authDomain: "finance-tracker-1ed79.firebaseapp.com",
  projectId: "finance-tracker-1ed79",
  storageBucket: "finance-tracker-1ed79.firebasestorage.app",
  messagingSenderId: "411022965468",
  appId: "1:411022965468:web:5bdf85870237a1a0cc9219",
  measurementId: "G-FEMBDZWP6Y"
};
// 2) Paste your deployed Cloudflare Worker URL here (used only for live stock prices)
const STOCK_PROXY_URL = "https://orange-band-a22e.mehtaaditya1307.workers.dev";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUid = null;

/* ================================================================
   STATE v4
   cards now include: { id, name, limit, startDue, dueDay, remindDays,
     autoDebit:{ enabled, bankId, day, mode:'total'|'fixed', fixedAmount, lastRunDate } }
   Holdings now include: { symbol } for stocks, { schemeCode } for MFs
================================================================ */
const CHIP_COLORS=[
  {bg:'#fce7f3',fg:'#9d174d'},{bg:'#ede9fe',fg:'#5b21b6'},{bg:'#dbeafe',fg:'#1e40af'},
  {bg:'#dcfce7',fg:'#166534'},{bg:'#fef3c7',fg:'#92400e'},{bg:'#e0f2fe',fg:'#0c4a6e'},
  {bg:'#f0fdf4',fg:'#14532d'},{bg:'#fff7ed',fg:'#7c2d12'},{bg:'#f3e8ff',fg:'#6b21a8'},
  {bg:'#ecfdf5',fg:'#064e3b'},{bg:'#fef9c3',fg:'#713f12'},{bg:'#fae8ff',fg:'#701a75'},
];
const cpal=i=>CHIP_COLORS[i%CHIP_COLORS.length];
const BDOTS=['#3b82f6','#6366f1','#0ea5e9','#8b5cf6','#06b6d4','#14b8a6'];
const CDOTS=['#f59e0b','#ef4444','#ec4899','#f97316','#a855f7','#e11d48'];
const CASHDOT='#22c55e';
const IDOTS=['#0ea5e9','#8b5cf6','#f59e0b','#14b8a6','#ec4899','#6366f1'];
const DEF_EXP=['Food','Travel','Shopping','Bills','Entertainment','Investment'];
const DEF_INC=['Salary','Freelance','Refund','Interest','Gift','Other'];

/* ── Local cache (instant load / offline) + cloud sync ─────────────────────
   Both devices keep a full copy. Every save is stored on this device at once, then merged into
   the cloud copy inside a Firestore transaction (re-reads the latest cloud copy first), so two
   devices never overwrite each other: they merge item by item (see js/sync.js). A live listener
   merges changes from the other device into this one within a second or two. */
/* Cache is namespaced per user so several accounts can share one browser */
const cacheKey=()=>currentUid?'ft_v4_'+currentUid:null;
const tsKey=()=>currentUid?'ft_v4_ts_'+currentUid:null;
const metaKey=()=>currentUid?'ft_v4_meta_'+currentUid:null;
const loadLocalCache=()=>{try{const k=cacheKey();if(!k)return null;const r=localStorage.getItem(k);if(r)return JSON.parse(r);}catch(e){}return null;};
const getLocalTs=()=>{try{return Number(localStorage.getItem(tsKey()))||0;}catch(e){return 0;}};
const userDoc=()=>db.collection('users').doc(currentUid);
let _saveTimer=null;
/* Pushes wait until the cloud copy has been read once, so a device that started offline with an
   empty cache never pushes its blank defaults as if they were newer edits. */
let _cloudReady=false;
let _syncMeta=emptySyncMeta();   // per item / field change times (js/sync.js)
let _syncBase=null;              // the data as of the previous save, to see what changed
let _pushing=null,_pushAgain=false,_liveUnsub=null,_appBooted=false;

function saveLocal(){
  try{
    localStorage.setItem(cacheKey(),JSON.stringify(state));
    localStorage.setItem(metaKey(),JSON.stringify(_syncMeta));
    localStorage.setItem(tsKey(),String(Date.now()));
  }catch(e){}
}
/* Merge a cloud copy into this device's data. Returns true when the cloud lacks something this
   device has (so it should push). render: redraw if the data changed. */
function mergeCloudDoc(d,render){
  const R=d&&d.data?JSON.parse(d.data):null;
  const Rm=d&&d.meta?JSON.parse(d.meta):null;
  const m=mergeStates(state,_syncMeta,R,Rm);
  const before=syncCanon(state),changed=syncCanon(m.state)!==before;
  state=m.state;_syncMeta=m.meta;
  normalizeState();
  _syncBase=syncClone(state);
  saveLocal();
  if(changed&&render&&_appBooted){rebuildAll();}
  return !R||syncCanon(state)!==syncCanon(R)||syncCanon(m.meta)!==syncCanon(normSyncMeta(Rm));
}
/* Merge this device's data into the cloud copy atomically, then take the merged result. */
async function pushToCloud(){
  if(!currentUid||!_cloudReady)return;
  if(_pushing){_pushAgain=true;return _pushing;}
  _pushing=(async()=>{
    try{
      let written=null;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(userDoc());
        const d=snap.exists?snap.data():null;
        const R=d&&d.data?JSON.parse(d.data):null,Rm=d&&d.meta?JSON.parse(d.meta):null;
        const m=mergeStates(state,_syncMeta,R,Rm);
        written={data:JSON.stringify(m.state),meta:JSON.stringify(m.meta),updatedAt:Date.now()};
        tx.set(userDoc(),written);
      });
      // Edits made while the transaction ran are kept: merge, don't overwrite
      if(written)mergeCloudDoc(written,true);
    }finally{
      _pushing=null;
      if(_pushAgain){_pushAgain=false;pushToCloud().catch(()=>{});}
    }
  })();
  return _pushing;
}
function schedulePush(ms){
  clearTimeout(_saveTimer);
  if(!_cloudReady){_saveTimer=null;return;}
  _saveTimer=setTimeout(()=>{
    _saveTimer=null;
    pushToCloud().catch(()=>toast('Saved on this device — will sync when back online'));
  },ms);
}
function _flushCloud(){
  if(!_saveTimer||!_cloudReady)return;
  clearTimeout(_saveTimer);_saveTimer=null;
  pushToCloud().catch(()=>{});
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')_flushCloud();});
window.addEventListener('pagehide',_flushCloud);
// Back online: push anything saved while offline (the live listener also catches up on its own)
window.addEventListener('online',()=>{if(currentUid&&_cloudReady)schedulePush(500);});
/* createdAt orders same-day transactions in the log (newest on top). Any transaction pushed
   without one gets stamped here, so every creation path is covered. */
function stampCreatedAt(){
  let n=Date.now();
  state.transactions.forEach(t=>{if(!t.createdAt)t.createdAt=n++;});
}
function saveState(){
  if(typeof resetSplitAllocMemo==='function')resetSplitAllocMemo();
  stampCreatedAt();
  if(!currentUid)return;
  _syncMeta=stampChanges(_syncBase,state,_syncMeta,Date.now());
  _syncBase=syncClone(state);
  saveLocal();
  if(!_cloudReady){
    clearTimeout(_saveTimer);_saveTimer=null;
    toast('Offline — saved on this device. It will sync when you are back online.');
    return;
  }
  schedulePush(700);
}
/* Live updates from the other device. Snapshots caused by this device's own pending write
   are skipped; a cache-only "no document" while offline is not taken as the truth. */
function startLiveSync(){
  if(_liveUnsub)_liveUnsub();
  _liveUnsub=userDoc().onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites)return;
    if(snap.metadata.fromCache&&!snap.exists)return;
    const first=!_cloudReady;
    if(!snap.metadata.fromCache)_cloudReady=true;
    const need=mergeCloudDoc(snap.exists?snap.data():null,true);
    if(_cloudReady&&need)schedulePush(first?100:400);
  },()=>{});
}
async function loadStateFromCloud(){
  _cloudReady=false;
  const local=loadLocalCache();
  let meta=null;try{meta=JSON.parse(localStorage.getItem(metaKey())||'null');}catch(e){}
  const legacy=local&&!meta; // cached before item-level sync existed
  _syncMeta=normSyncMeta(meta);
  if(local)state=local;
  normalizeState();
  _syncBase=syncClone(state);
  try{
    const snap=await userDoc().get();
    const d=snap.exists?snap.data():null;
    // An older cached copy that is newer than the cloud never got pushed: mark its additions and
    // edits as newer so the merge keeps them (deletions can't be told apart, so nothing is dropped)
    if(legacy&&d&&d.data&&getLocalTs()>(Number(d.updatedAt)||0))
      _syncMeta=stampChanges(JSON.parse(d.data),state,_syncMeta,getLocalTs(),true);
    _cloudReady=true;
    if(mergeCloudDoc(d,false))pushToCloud().catch(()=>toast('Cloud sync failed — saved on this device, will retry'));
  }catch(e){
    toast(local?'Could not reach cloud — showing this device\'s copy':'Could not reach cloud');
  }
  startLiveSync();
}

let state={banks:[],cards:[],cash:{startBalance:0},categories:{expense:[...DEF_EXP],income:[...DEF_INC]},monthlyBudget:0,categoryBudgets:{},transactions:[],investments:{accounts:[],holdings:[]},tags:[],loans:[],recurring:[]};
function normalizeState(){
  if(!state.banks)state.banks=[];
  if(!state.cards)state.cards=[];
  if(!state.cash)state.cash={startBalance:0};
  if(!state.categories)state.categories={expense:[...DEF_EXP],income:[...DEF_INC]};
  if(!state.categories.expense)state.categories.expense=[...DEF_EXP];
  if(!state.categories.income)state.categories.income=[...DEF_INC];
  if(!state.transactions)state.transactions=[];
  if(!state.categoryBudgets)state.categoryBudgets={};
  if(!state.investments)state.investments={accounts:[],holdings:[]};
  if(!state.investments.accounts)state.investments.accounts=[];
  if(!state.investments.holdings)state.investments.holdings=[];
  if(!state.tags)state.tags=[];
  if(!state.loans)state.loans=[];
  if(!state.recurring)state.recurring=[];
  state.recurring.forEach(r=>{if(r.active===undefined)r.active=true;if(!r.tags)r.tags=[];});
  if(state.monthStartDay===undefined)state.monthStartDay=1;
  // Older entries have no createdAt: use their array position (they were appended in the order added)
  state.transactions.forEach((t,i)=>{if(!t.createdAt)t.createdAt=i+1;});
  state.transactions.forEach(t=>{
    if(typeof t.amount==='string')t.amount=Number(t.amount)||0;
    if(t.type==='expense'&&(t.myShare===undefined||t.myShare===null||t.myShare===''))t.myShare=Number(t.amount)||0;
    if(!t.tags)t.tags=[];
  });
  state.banks.forEach(b=>{if(b.includeInNetWorth===undefined)b.includeInNetWorth=true;});
  // Older SIP holdings stored the monthly amount as buyPrice, which made invested/P&L wildly wrong.
  // Replace it with the true average price (total invested / units bought across the series).
  state.investments.holdings.forEach(h=>{
    if(h.type==='sip'&&h.sipSeries&&!h.avgPriceFixed){
      const bought=state.transactions.filter(t=>t.type==='invest'&&t.holdingId===h.id).reduce((s,t)=>s+(Number(t.units)||0),0);
      const total=(Number(h.monthlyAmount)||0)*(Number(h.durationMonths)||0);
      if(bought>0&&total>0)h.buyPrice=total/bought;
      h.avgPriceFixed=true;
    }
  });
  // SIP installments fall on the next trading day when the market is closed. Re-derive the dates of
  // existing series (they are not hand-editable) so older entries and new holiday data both apply.
  if(typeof sipInstallmentDate==='function'){
    const byId=new Map(state.transactions.map(t=>[t.id,t]));
    state.investments.holdings.forEach(h=>{
      if(!h.sipSeries||!h.date||!Array.isArray(h.seriesTxnIds))return;
      h.seriesTxnIds.forEach(id=>{const t=byId.get(id);if(t&&t.sipMonth>0)t.date=sipInstallmentDate(h.date,t.sipMonth-1);});
    });
  }
  state.cards.forEach(c=>{
    if(!c.autoDebit)c.autoDebit={enabled:false,bankId:'',day:0,mode:'total',fixedAmount:0,lastRunDate:''};
    // Older cards have no creation date: start judging overdue from today (never flag past cycles we can't verify)
    if(!c.createdAt)c.createdAt=today();
  });
}

/* UI state */
let txnType='expense',selExpCat=null,selIncCat=null,viewMK=null,viewFY=null,viewMode='month',activeTab='log',activeView='dashboard';
let txnFilter={category:'',from:'',to:'',tag:'',search:'',account:''};
let txnTypesShown=(()=>{const d={expense:true,income:true,transfer:true,invest:true};try{return{...d,...JSON.parse(localStorage.getItem('ft-txn-types')||'{}')};}catch(e){return d;}})();
let bulkSelectedIds=new Set();
let bulkTagMode='add';
let selExpTags=[],selIncTags=[];
let invSummaryMode='cash';
let CH={};  // chart instances keyed by id
let cumulativeCatSelection=[];
let invAccUIState={};  // per investment account: {tab:'holdings'|'calendar', mk:'YYYY-MM', cal:'month'|'pattern'}

/* Analytics range state */
let anRange={mode:'this_month',from:null,to:null};

/* Pending delete id */
let _pendingDeleteId=null;

