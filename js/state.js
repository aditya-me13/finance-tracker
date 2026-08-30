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
   cards now include: { id, name, limit, startDue, dueDay, remindDays }
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
const loadLocalCache=()=>{try{const r=localStorage.getItem('ft_v4');if(r)return JSON.parse(r);}catch(e){}return null;};
let _saveTimer=null;
function saveState(){
  try{localStorage.setItem('ft_v4',JSON.stringify(state));}catch(e){}
  if(!currentUid)return;
  clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>{
    db.collection('users').doc(currentUid).set({data:JSON.stringify(state),updatedAt:Date.now()})
      .catch(()=>toast('Cloud sync failed — saved locally, will retry next change'));
  },700);
}
async function loadStateFromCloud(){
  try{
    const snap=await db.collection('users').doc(currentUid).get();
    if(snap.exists && snap.data() && snap.data().data){
      state=JSON.parse(snap.data().data);
    }else{
      const local=loadLocalCache();
      if(local)state=local;
    }
  }catch(e){
    const local=loadLocalCache();
    if(local)state=local;
    toast('Could not reach cloud — showing local copy');
  }
  normalizeState();
}

let state={banks:[],cards:[],cash:{startBalance:0},categories:{expense:[...DEF_EXP],income:[...DEF_INC]},monthlyBudget:0,categoryBudgets:{},transactions:[],investments:{accounts:[],holdings:[]}};
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
  state.transactions.forEach(t=>{
    if(t.type==='expense'&&(t.myShare===undefined||t.myShare===null||t.myShare===''))t.myShare=Number(t.amount)||0;
  });
  state.banks.forEach(b=>{if(b.includeInNetWorth===undefined)b.includeInNetWorth=true;});
}

/* UI state */
let txnType='expense',selExpCat=null,selIncCat=null,viewMK=null,viewFY=null,viewMode='month',activeTab='log',activeView='dashboard';
let txnFilter={category:'',from:'',to:''};
let invSummaryMode='cash';
let CH={};  // chart instances keyed by id
let cumulativeCatSelection=[];

/* Analytics range state */
let anRange={mode:'this_month',from:null,to:null};

/* Pending delete id */
let _pendingDeleteId=null;

