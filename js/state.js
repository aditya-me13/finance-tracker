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

/* ── Local cache (instant load / offline fallback) + cloud sync ── */
/* Cache is namespaced per user so several accounts can share one browser */
const cacheKey=()=>currentUid?'ft_v4_'+currentUid:null;
const loadLocalCache=()=>{try{const k=cacheKey();if(!k)return null;const r=localStorage.getItem(k);if(r)return JSON.parse(r);}catch(e){}return null;};
let _saveTimer=null;
/* Cloud pushes stay disabled until the cloud copy has been read successfully; otherwise an
   offline/failed load followed by an edit would overwrite the real cloud document with defaults. */
let _cloudReady=false;
const tsKey=()=>currentUid?'ft_v4_ts_'+currentUid:null;
const getLocalTs=()=>{try{return Number(localStorage.getItem(tsKey()))||0;}catch(e){return 0;}};
function pushToCloud(){
  const ts=getLocalTs()||Date.now();
  return db.collection('users').doc(currentUid).set({data:JSON.stringify(state),updatedAt:ts});
}
function _flushCloud(){
  if(!_saveTimer||!_cloudReady)return;
  clearTimeout(_saveTimer);_saveTimer=null;
  pushToCloud().catch(()=>{});
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')_flushCloud();});
window.addEventListener('pagehide',_flushCloud);
function saveState(){
  if(typeof resetSplitAllocMemo==='function')resetSplitAllocMemo();
  if(!currentUid)return;
  try{localStorage.setItem(cacheKey(),JSON.stringify(state));localStorage.setItem(tsKey(),String(Date.now()));}catch(e){}
  clearTimeout(_saveTimer);
  if(!_cloudReady){
    _saveTimer=null;
    toast('Offline — saved on this device. Reload when online to sync.');
    return;
  }
  _saveTimer=setTimeout(()=>{
    _saveTimer=null;
    pushToCloud().catch(()=>toast('Cloud sync failed — saved locally, will retry next change'));
  },700);
}
async function loadStateFromCloud(){
  _cloudReady=false;
  try{
    const snap=await db.collection('users').doc(currentUid).get();
    const cloud=snap.exists&&snap.data()&&snap.data().data?snap.data():null;
    const local=loadLocalCache();
    // Prefer whichever copy was written last. A local copy newer than the cloud one means a
    // push never landed (closed tab, failed sync), so keep it and push it up.
    if(local&&(!cloud||getLocalTs()>(Number(cloud.updatedAt)||0))){
      state=local;
      _cloudReady=true;
      normalizeState();
      pushToCloud().catch(()=>toast('Cloud sync failed — saved locally, will retry next change'));
      return;
    }
    if(cloud)state=JSON.parse(cloud.data);
    _cloudReady=true;
  }catch(e){
    const local=loadLocalCache();
    if(local)state=local;
    toast('Could not reach cloud — showing local copy');
  }
  normalizeState();
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
  state.cards.forEach(c=>{
    if(!c.autoDebit)c.autoDebit={enabled:false,bankId:'',day:0,mode:'total',fixedAmount:0,lastRunDate:''};
  });
}

/* UI state */
let txnType='expense',selExpCat=null,selIncCat=null,viewMK=null,viewFY=null,viewMode='month',activeTab='log',activeView='dashboard';
let txnFilter={category:'',from:'',to:'',tag:'',search:''};
let bulkSelectedIds=new Set();
let bulkTagMode='add';
let selExpTags=[],selIncTags=[];
let invSummaryMode='cash';
let CH={};  // chart instances keyed by id
let cumulativeCatSelection=[];

/* Analytics range state */
let anRange={mode:'this_month',from:null,to:null};

/* Pending delete id */
let _pendingDeleteId=null;

