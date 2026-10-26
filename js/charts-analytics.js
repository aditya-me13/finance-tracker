/* ── Chart helpers ────────────────────────────────────────── */
function destroyChart(key){if(CH[key]){CH[key].destroy();delete CH[key];}}
const baseOpts=(extra={})=>({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},...extra.plugins},...extra});

function renderBarChart(mk,exps){
  const[y,m]=mk.split('-').map(Number),days=new Date(y,m,0).getDate();
  const data=Array(days).fill(0);
  exps.forEach(e=>{const d=parseInt(e.date.split('-')[2],10);if(d>=1&&d<=days)data[d-1]+=shareAmount(e);});
  document.getElementById('bar-label').textContent=mkLabel(mk);
  destroyChart('bar');
  CH.bar=new Chart(document.getElementById('chart-bar').getContext('2d'),{
    type:'bar',
    data:{labels:Array.from({length:days},(_,i)=>String(i+1)),datasets:[{data,backgroundColor:'#e7e5e4',borderRadius:3,hoverBackgroundColor:'#a8a29e'}]},
    options:{...baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)}}}}),
      scales:{x:{grid:{display:false},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',maxTicksLimit:10}},
        y:{grid:{color:'#f4f3f0'},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}}}
  });
}

function renderBarChartFY(fy,exps){
  const fyStartYear=Number(fy);
  const data=Array(12).fill(0);
  exps.forEach(e=>{
    const[ey,em]=e.date.split('-').map(Number);
    const idx=em>=4?em-4:em+8;
    data[idx]+=shareAmount(e);
  });
  document.getElementById('bar-label').textContent=fyLabel(fy);
  const labels=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  destroyChart('bar');
  CH.bar=new Chart(document.getElementById('chart-bar').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[{data,backgroundColor:'#e7e5e4',borderRadius:3,hoverBackgroundColor:'#a8a29e'}]},
    options:{...baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)}}}}),
      scales:{x:{grid:{display:false},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba'}},
        y:{grid:{color:'#f4f3f0'},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}}}
  });
}

function buildDonut(key,canvasId,legId,labels,data,bgs,fgs,emptyMsg){
  const empty=!labels.length;
  const leg=document.getElementById(legId);
  leg.innerHTML=empty?`<span style="font-size:.77rem;color:#c4bfba">${emptyMsg}</span>`:
    (()=>{const tot=data.reduce((a,b)=>a+b,0);return labels.map((l,i)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px"><span style="width:8px;height:8px;border-radius:2px;background:${fgs[i]};flex-shrink:0"></span><span style="font-size:.75rem;color:#57534e;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l)}</span><span class="num" style="font-size:.7rem;color:#a8a29e">${((data[i]/tot)*100).toFixed(0)}%</span></div>`).join('');})();
  destroyChart(key);
  CH[key]=new Chart(document.getElementById(canvasId).getContext('2d'),{
    type:'doughnut',
    data:{labels,datasets:[{data:empty?[1]:data,backgroundColor:empty?['#f4f3f0']:bgs,borderColor:empty?['#e7e5e4']:fgs,borderWidth:2,hoverOffset:4}]},
    options:{cutout:'67%',plugins:{legend:{display:false},tooltip:{enabled:!empty,callbacks:{label:c=>' '+fmt(c.raw)}}},responsive:true,maintainAspectRatio:true}
  });
}

function renderQuickCharts(){
  const exps=curViewTxns().filter(t=>t.type==='expense'&&!t.splitSettle);
  if(viewMode==='fy')renderBarChartFY(viewFY,exps);else renderBarChart(viewMK,exps);
  const et={};exps.forEach(e=>{et[e.category]=(et[e.category]||0)+shareAmount(e);});
  const el=Object.keys(et),ed=el.map(l=>et[l]);
  buildDonut('qDonut','chart-donut','donut-leg',el,ed,
    el.map((_,i)=>{const idx=state.categories.expense.indexOf(_);return cpal(idx>=0?idx:i).bg;}),
    el.map((_,i)=>{const idx=state.categories.expense.indexOf(_);return cpal(idx>=0?idx:i).fg;}),'No expenses');
  const bkT=exps.filter(e=>e.acType==='bank').reduce((s,e)=>s+shareAmount(e),0);
  const caT=exps.filter(e=>e.acType==='cash').reduce((s,e)=>s+shareAmount(e),0);
  const ccT=exps.filter(e=>e.acType==='cc').reduce((s,e)=>s+shareAmount(e),0);
  const shT=exps.filter(e=>e.acType==='shared').reduce((s,e)=>s+shareAmount(e),0);
  const me=[['Bank',bkT,'#dbeafe','#3b82f6'],['Cash',caT,'#dcfce7','#22c55e'],['Credit Card',ccT,'#fef3c7','#f59e0b'],['Roommate Split',shT,'#ede9fe','#7c3aed']].filter(e=>e[1]>0);
  const ml=document.getElementById('mode-leg');
  if(!me.length){ml.innerHTML='<span style="font-size:.77rem;color:#c4bfba">No data</span>';}
  else{const tot=me.reduce((s,e)=>s+e[1],0);ml.innerHTML=me.map(([l,v,,fg])=>`<div style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${fg};flex-shrink:0"></span><span style="font-size:.75rem;color:#57534e;flex:1">${l}</span><span class="num" style="font-size:.7rem;color:#a8a29e">${((v/tot)*100).toFixed(0)}%</span></div>`).join('');}
  destroyChart('qMode');
  CH.qMode=new Chart(document.getElementById('chart-mode').getContext('2d'),{
    type:'doughnut',
    data:{labels:me.map(e=>e[0]),datasets:[{data:me.length?me.map(e=>e[1]):[1],backgroundColor:me.length?me.map(e=>e[2]):['#f4f3f0'],borderColor:me.length?me.map(e=>e[3]):['#e7e5e4'],borderWidth:2,hoverOffset:4}]},
    options:{cutout:'67%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)}}},responsive:true,maintainAspectRatio:true}
  });
}

/* ── Analytics Date Range ─────────────────────────────────── */
function getRangeDates(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  let from,to;
  switch(anRange.mode){
    case'this_month':from=dateToStr(new Date(y,m,1));to=dateToStr(new Date(y,m+1,0));break;
    case'last_month':from=dateToStr(new Date(y,m-1,1));to=dateToStr(new Date(y,m,0));break;
    case'3_months':from=dateToStr(new Date(y,m-2,1));to=dateToStr(new Date(y,m+1,0));break;
    case'6_months':from=dateToStr(new Date(y,m-5,1));to=dateToStr(new Date(y,m+1,0));break;
    case'this_year':from=`${y}-01-01`;to=`${y}-12-31`;break;
    case'this_fy':{const fy=curFY();from=`${fy}-04-01`;to=`${Number(fy)+1}-03-31`;break;}
    case'custom':from=anRange.from||dateToStr(new Date(y,m,1));to=anRange.to||dateToStr(new Date(y,m+1,0));break;
    default:from=dateToStr(new Date(y,m,1));to=dateToStr(new Date(y,m+1,0));
  }
  return{from,to};
}

function setRange(mode){
  anRange.mode=mode;
  ['this','last','3m','6m','yr','fy','custom'].forEach(k=>document.getElementById('rng-'+k)?.classList.remove('active'));
  const map={this_month:'rng-this',last_month:'rng-last','3_months':'rng-3m','6_months':'rng-6m',this_year:'rng-yr',this_fy:'rng-fy',custom:'rng-custom'};
  document.getElementById(map[mode])?.classList.add('active');
  const crow=document.getElementById('custom-range-row');
  if(mode==='custom'){crow.classList.remove('hidden');crow.style.display='flex';}
  else crow.classList.add('hidden');
  updateRangeDisplay();
  renderAnalytics();
}
function applyCustomRange(){
  anRange.from=document.getElementById('rng-from').value;
  anRange.to=document.getElementById('rng-to').value;
  if(anRange.from&&anRange.to)renderAnalytics();
}
function updateRangeDisplay(){
  const{from,to}=getRangeDates();
  const f=new Date(from+'T00:00:00'),t=new Date(to+'T00:00:00');
  document.getElementById('rng-display').textContent=
    f.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})+' — '+
    t.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}

/* ── ANALYTICS RENDER ─────────────────────────────────────── */
function renderAnalytics(){
  updateRangeDisplay();
  const{from,to}=getRangeDates();
  const allTxns=txnsInRange(from,to);
  const exps=allTxns.filter(t=>t.type==='expense'&&!t.splitSettle);
  const incs=allTxns.filter(t=>t.type==='income'&&!t.splitSettle);
  const totalSpent=exps.reduce((s,t)=>s+realAmount(t),0);
  const totalInc=incs.reduce((s,t)=>s+Number(t.amount),0);
  const surplus=totalInc-totalSpent;
  const trueSpent=exps.reduce((s,t)=>s+shareAmount(t),0);
  const frontedForOthers=exps.filter(t=>t.shared&&t.acType!=='shared').reduce((s,t)=>s+Math.max(0,(Number(t.amount)||0)-shareAmount(t)),0);
  const owedToOthers=exps.filter(t=>t.acType==='shared').reduce((s,t)=>s+shareAmount(t),0);

  renderStatTiles(totalSpent,totalInc,surplus,exps,incs,trueSpent,frontedForOthers,owedToOthers);
  renderBvaChart(exps,from,to);
  renderAnExpDonut(exps);
  renderAnIncDonut(incs);
  renderCashflowChart(from,to,surplus);
  renderHistChart();
  renderTrendChart(exps,from,to);
  renderTopCategories(exps);
  renderNetWorthChart();
  renderSavingsRate(totalSpent,totalInc);
}

function renderStatTiles(totalSpent,totalInc,surplus,exps,incs,trueSpent,frontedForOthers,owedToOthers){
  const avgDay=(()=>{
    if(!exps.length)return 0;
    const{from,to}=getRangeDates();
    const days=Math.max(1,Math.round((new Date(to)-new Date(from))/(86400000))+1);
    return totalSpent/days;
  })();
  const bal=computeBal();
  const tiles=[
    {label:'Actual Bank Spend',val:fmt(totalSpent),color:'#ef4444',sub:`${exps.length} transactions · real money out`},
    {label:'Total Income',val:fmt(totalInc),color:'#166534',sub:`${incs.length} transactions`},
    {label:'Net Surplus',val:fmt(surplus),color:surplus>=0?'#166534':'#ef4444',sub:surplus>=0?'Savings':'Deficit'},
    {label:'Avg Daily Spend',val:fmt(avgDay),color:'#57534e',sub:'Over the period'},
    {label:'True Personal Spend',val:fmt(trueSpent),color:'#7c3aed',sub:'Your share, incl. owed to roommates'},
    {label:'Fronted for Roommates',val:fmt(frontedForOthers),color:'#1d4ed8',sub:'Paid by you, not yet settled'},
    {label:'Owed via Splitwise',val:fmt(owedToOthers),color:'#d97706',sub:'Their spend — still your share'},
  ];
  document.getElementById('an-stat-tiles').innerHTML=tiles.map(({label,val,color,sub})=>`
    <div class="stat-tile">
      <div class="slabel">${label}</div>
      <div class="val" style="color:${color}">${val}</div>
      <div class="delta" style="color:#a8a29e">${sub}</div>
    </div>`).join('');
}

function renderBvaChart(exps){
  const budCats=state.categories.expense.filter(cat=>state.categoryBudgets[cat]>0);
  const spentCats=new Set(exps.map(e=>e.category));
  const allCats=[...new Set([...budCats,...Array.from(spentCats)])];
  const wrap=document.getElementById('an-bva-wrap'),empty=document.getElementById('an-bva-empty');
  if(!allCats.length){empty.classList.remove('hidden');wrap.style.height='80px';return;}
  empty.classList.add('hidden');
  wrap.style.height=Math.max(allCats.length*48+70,220)+'px';
  const budData=allCats.map(cat=>state.categoryBudgets[cat]||0);
  const actData=allCats.map(cat=>exps.filter(e=>e.category===cat).reduce((s,e)=>s+shareAmount(e),0));
  destroyChart('bva');
  CH.bva=new Chart(document.getElementById('an-bva').getContext('2d'),{
    type:'bar',
    data:{labels:allCats,datasets:[
      {label:'Budget',data:budData,backgroundColor:'#e7e5e4',borderRadius:4,barPercentage:.55,categoryPercentage:.75},
      {label:'Spent',data:actData,backgroundColor:actData.map((v,i)=>{const b=budData[i];if(!b)return'#a8a29e';if(v>=b)return'#fca5a5';if(v>=b*.8)return'#fcd34d';return'#86efac';}),borderRadius:4,barPercentage:.55,categoryPercentage:.75},
    ]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'top',labels:{font:{family:'DM Sans',size:11},color:'#78716c',boxWidth:10,boxHeight:10}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{
        x:{grid:{color:'#f4f3f0'},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}},
        y:{grid:{display:false},ticks:{font:{family:'DM Sans',size:11},color:'#57534e'}}
      }}
  });
}

function renderAnExpDonut(exps){
  const t={};exps.forEach(e=>{t[e.category]=(t[e.category]||0)+shareAmount(e);});
  const labels=Object.keys(t),data=labels.map(l=>t[l]);
  const bgs=labels.map((_,i)=>{const idx=state.categories.expense.indexOf(_);return cpal(idx>=0?idx:i).bg;});
  const fgs=labels.map((_,i)=>{const idx=state.categories.expense.indexOf(_);return cpal(idx>=0?idx:i).fg;});
  document.getElementById('an-exp-empty').classList.toggle('hidden',labels.length>0);
  buildDonut('anExpD','an-exp-donut','an-exp-leg',labels,data,bgs,fgs,'No expenses this period');
}

function renderAnIncDonut(incs){
  const t={};incs.forEach(e=>{t[e.category]=(t[e.category]||0)+Number(e.amount);});
  const labels=Object.keys(t),data=labels.map(l=>t[l]);
  const INC_PAL=[{bg:'#dcfce7',fg:'#166534'},{bg:'#d1fae5',fg:'#065f46'},{bg:'#a7f3d0',fg:'#064e3b'},{bg:'#6ee7b7',fg:'#065f46'},{bg:'#bbf7d0',fg:'#14532d'},{bg:'#4ade80',fg:'#14532d'}];
  const bgs=labels.map((_,i)=>INC_PAL[i%INC_PAL.length].bg);
  const fgs=labels.map((_,i)=>INC_PAL[i%INC_PAL.length].fg);
  document.getElementById('an-inc-empty').classList.toggle('hidden',labels.length>0);
  buildDonut('anIncD','an-inc-donut','an-inc-leg',labels,data,bgs,fgs,'No income this period');
}

function renderCashflowChart(from,to,surplus){
  const mkSet=new Set();
  state.transactions.filter(t=>t.date>=from&&t.date<=to).forEach(t=>mkSet.add(mkOf(t.date)));
  const months=Array.from(mkSet).sort();
  const incData=months.map(mk=>txnsForMK(mk).filter(t=>t.type==='income'&&!t.splitSettle).reduce((s,t)=>s+Number(t.amount),0));
  const expData=months.map(mk=>txnsForMK(mk).filter(t=>t.type==='expense'&&!t.splitSettle).reduce((s,t)=>s+Number(t.amount),0));
  const empty=document.getElementById('an-cashflow-empty');
  const surEl=document.getElementById('cashflow-surplus');
  surEl.textContent=`Net: ${fmt(surplus)}`;surEl.style.color=surplus>=0?'#166534':'#ef4444';
  if(!months.length){empty.classList.remove('hidden');destroyChart('cashflow');return;}
  empty.classList.add('hidden');
  const shortLbl=k=>{const[y,m]=k.split('-');return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});};
  destroyChart('cashflow');
  CH.cashflow=new Chart(document.getElementById('an-cashflow').getContext('2d'),{
    type:'bar',
    data:{labels:months.map(shortLbl),datasets:[
      {label:'Income',data:incData,backgroundColor:'rgba(34,197,94,.7)',borderColor:'#22c55e',borderWidth:1.5,borderRadius:4,barPercentage:.55,categoryPercentage:.7},
      {label:'Expenses',data:expData,backgroundColor:'rgba(239,68,68,.65)',borderColor:'#ef4444',borderWidth:1.5,borderRadius:4,barPercentage:.55,categoryPercentage:.7},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'top',labels:{font:{family:'DM Sans',size:11},color:'#78716c',boxWidth:10,boxHeight:10}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:10},color:'#a8a29e'}},
        y:{grid:{color:'#f4f3f0'},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}}}
  });
}

function renderHistChart(){
  const allMKs=new Set();
  state.transactions.filter(t=>t.type==='expense').forEach(t=>allMKs.add(mkOf(t.date)));
  const months=Array.from(allMKs).sort();
  const empty=document.getElementById('an-hist-empty');
  if(!months.length){empty.classList.remove('hidden');destroyChart('hist');return;}
  empty.classList.add('hidden');
  const showBank=document.getElementById('hf-bank').checked;
  const showCash=document.getElementById('hf-cash').checked;
  const showCC=document.getElementById('hf-cc').checked;
  const showShared=document.getElementById('hf-shared')?.checked;
  const mkExps=mk=>state.transactions.filter(t=>t.type==='expense'&&!t.splitSettle&&mkOf(t.date)===mk);
  const shortLbl=k=>{const[y,m]=k.split('-');return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});};
  const ds=[];
  if(showBank)ds.push({label:'Bank/UPI',data:months.map(mk=>mkExps(mk).filter(e=>e.acType==='bank').reduce((s,t)=>s+shareAmount(t),0)),backgroundColor:'rgba(59,130,246,.75)',borderColor:'#3b82f6',borderWidth:2,borderRadius:4,stack:'s'});
  if(showCash)ds.push({label:'Cash',data:months.map(mk=>mkExps(mk).filter(e=>e.acType==='cash').reduce((s,t)=>s+shareAmount(t),0)),backgroundColor:'rgba(34,197,94,.75)',borderColor:'#22c55e',borderWidth:2,borderRadius:4,stack:'s'});
  if(showCC)  ds.push({label:'CC',data:months.map(mk=>mkExps(mk).filter(e=>e.acType==='cc').reduce((s,t)=>s+shareAmount(t),0)),backgroundColor:'rgba(245,158,11,.75)',borderColor:'#f59e0b',borderWidth:2,borderRadius:4,stack:'s'});
  if(showShared)ds.push({label:'Roommate Split',data:months.map(mk=>mkExps(mk).filter(e=>e.acType==='shared').reduce((s,t)=>s+shareAmount(t),0)),backgroundColor:'rgba(124,58,237,.75)',borderColor:'#7c3aed',borderWidth:2,borderRadius:4,stack:'s'});
  destroyChart('hist');
  CH.hist=new Chart(document.getElementById('an-hist').getContext('2d'),{
    type:'bar',data:{labels:months.map(shortLbl),datasets:ds},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'top',labels:{font:{family:'DM Sans',size:11},color:'#78716c',boxWidth:10,boxHeight:10}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:10},color:'#a8a29e'}},
        y:{grid:{color:'#f4f3f0'},stacked:true,ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}}}
  });
}

function renderTrendChart(exps,from,to){
  const empty=document.getElementById('an-trend-empty');
  if(!exps.length){empty.classList.remove('hidden');destroyChart('trend');return;}
  empty.classList.add('hidden');
  const byDate={};
  exps.forEach(e=>{byDate[e.date]=(byDate[e.date]||0)+shareAmount(e);});
  const dates=[],data=[];
  const cur=new Date(from+'T00:00:00'),end=new Date(to+'T00:00:00');
  while(cur<=end){const k=dateToStr(cur);dates.push(k);data.push(byDate[k]||0);cur.setDate(cur.getDate()+1);}
  const avg=data.map((_,i)=>{const w=data.slice(Math.max(0,i-3),i+4);return w.reduce((a,b)=>a+b,0)/w.length;});
  const shortD=d=>{const[,,day]=d.split('-');return parseInt(day,10);};
  destroyChart('trend');
  CH.trend=new Chart(document.getElementById('an-trend').getContext('2d'),{
    type:'bar',
    data:{labels:dates.map(shortD),datasets:[
      {type:'bar',label:'Daily',data,backgroundColor:'#e7e5e4',borderRadius:2,barPercentage:.8,order:2},
      {type:'line',label:'7d Avg',data:avg,borderColor:'#1c1917',borderWidth:2,pointRadius:0,tension:.4,fill:false,order:1},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'top',labels:{font:{family:'DM Sans',size:10},color:'#78716c',boxWidth:10,boxHeight:8}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{font:{family:'DM Mono',size:8},color:'#c4bfba',maxTicksLimit:12}},
        y:{grid:{color:'#f4f3f0'},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}}}
  });
}

function renderTopCategories(exps){
  const totals={};exps.forEach(e=>{totals[e.category]=(totals[e.category]||0)+shareAmount(e);});
  const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxV=sorted[0]?.[1]||1;
  const wrap=document.getElementById('an-top-cats');
  if(!sorted.length){wrap.innerHTML='<div style="font-size:.82rem;color:#c4bfba;text-align:center;padding:20px 0">No data</div>';return;}
  wrap.innerHTML=sorted.map(([cat,val])=>{
    const ci=state.categories.expense.indexOf(cat),col=cpal(ci>=0?ci:0);
    const pct=(val/maxV)*100;
    return`<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="width:7px;height:7px;border-radius:50%;background:${col.fg};flex-shrink:0;display:inline-block"></span>
          <span style="font-size:.8rem;color:#292524">${esc(cat)}</span>
        </div>
        <span class="num" style="font-size:.78rem;color:#57534e">${fmt(val)}</span>
      </div>
      <div class="pt"><div class="pf" style="width:${pct}%;background:${col.fg};opacity:.7"></div></div>
    </div>`;
  }).join('');
}

function renderNetWorthChart(){
  const allMKs=new Set([curMK()]);
  state.transactions.forEach(t=>allMKs.add(mkOf(t.date)));
  const months=Array.from(allMKs).sort();
  const empty=document.getElementById('an-nw-empty');
  if(months.length<1){empty.classList.remove('hidden');destroyChart('nw');return;}
  empty.classList.add('hidden');
  const nwData=months.map(mk=>{
    const[y,m]=mk.split('-').map(Number);
    const endDate=dateToStr(new Date(y,m,0));
    const bk={};state.banks.forEach(b=>bk[b.id]=Number(b.startBalance)||0);
    let ca=Number(state.cash.startBalance)||0;
    const cd={};state.cards.forEach(c=>cd[c.id]=Number(c.startDue)||0);
    state.transactions.filter(t=>t.date<=endDate).forEach(t=>{
      const a=Number(t.amount)||0;
      if(t.type==='expense'){if(t.acType==='bank'&&bk[t.acId]!==undefined)bk[t.acId]-=a;else if(t.acType==='cash')ca-=a;else if(t.acType==='cc'&&cd[t.acId]!==undefined)cd[t.acId]+=a;}
      else if(t.type==='income'){if(t.destType==='bank'&&bk[t.destId]!==undefined)bk[t.destId]+=a;else if(t.destType==='cash')ca+=a;else if(t.destType==='cc'&&cd[t.destId]!==undefined)cd[t.destId]-=a;}
      else if(t.type==='transfer'){
        const mv=(key,sign)=>{if(!key)return;if(key==='cash'){ca+=sign*a;return;}const[k,id]=key.split(':');if(k==='bank'&&bk[id]!==undefined)bk[id]+=sign*a;else if(k==='cc'&&cd[id]!==undefined)cd[id]-=sign*a;};
        mv(t.fromKey,-1);mv(t.toKey,+1);
      }
      else if(t.type==='invest'){
        if(t.sourceKey){const[k,id]=t.sourceKey.split(':');if(k==='bank'&&bk[id]!==undefined)bk[id]-=a;}
      }
      else if(t.type==='divest'){
        if(t.destKey==='cash')ca+=a;else if(t.destKey){const[k,id]=t.destKey.split(':');if(k==='bank'&&bk[id]!==undefined)bk[id]+=a;}
      }
    });
    return state.banks.filter(b=>b.includeInNetWorth!==false).reduce((s,b)=>s+(bk[b.id]||0),0)+ca-Object.values(cd).reduce((s,v)=>s+v,0);
  });
  const shortLbl=k=>{const[y,m]=k.split('-');return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});};
  const colors=nwData.map(v=>v>=0?'rgba(34,197,94,.7)':'rgba(239,68,68,.7)');
  destroyChart('nw');
  CH.nw=new Chart(document.getElementById('an-networth').getContext('2d'),{
    type:'line',
    data:{labels:months.map(shortLbl),datasets:[
      {label:'Net Worth',data:nwData,borderColor:'#1c1917',borderWidth:2,pointBackgroundColor:colors,pointRadius:4,fill:true,backgroundColor:'rgba(28,25,23,.05)',tension:.3},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`Net Worth: ${fmt(c.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:10},color:'#a8a29e'}},
        y:{grid:{color:'#f4f3f0'},ticks:{font:{family:'DM Mono',size:9},color:'#c4bfba',callback:v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}}}
  });
}

function renderSavingsRate(totalSpent,totalInc){
  const wrap=document.getElementById('an-savings-content');
  const rate=totalInc>0?Math.max(0,(totalInc-totalSpent)/totalInc*100):0;
  const surplus=totalInc-totalSpent;
  const pct=Math.min(rate,100);
  const color=rate>=30?'#166534':rate>=10?'#d97706':'#ef4444';
  const label=rate>=50?'Excellent':rate>=30?'Good':rate>=10?'Fair':'Low';
  wrap.innerHTML=`
    <div>
      <div style="font-size:2rem;font-weight:700;font-family:'DM Mono',monospace;color:${color};letter-spacing:-.03em">${rate.toFixed(1)}%</div>
      <div style="font-size:.78rem;color:#a8a29e;margin-top:2px">Savings Rate · <span style="color:${color};font-weight:500">${label}</span></div>
    </div>
    <div class="pt" style="margin-top:4px"><div class="pf" style="width:${pct}%;background:${color};opacity:.7;transition:width .5s ease"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:.73rem;color:#a8a29e;margin-top:2px">
      <span>Saved: ${fmt(Math.max(0,surplus))}</span>
      <span>Income: ${fmt(totalInc)}</span>
    </div>
    <div style="background:#f4f3f0;border-radius:8px;padding:10px 12px;font-size:.75rem;color:#78716c;line-height:1.5">
      ${rate>=30?'Great discipline. Keep building your emergency fund.':rate>=10?'Decent savings. Try to cut one category to improve.':'Consider reviewing your largest expense categories.'}
    </div>`;
}

