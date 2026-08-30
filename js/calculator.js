/* ── Quick Calculator ─────────────────────────────────────── */
let calcExpr='';
let calcHasResult=false;
const CALC_BTN_ROWS=[
  ['C','(',')','⌫'],
  ['7','8','9','÷'],
  ['4','5','6','×'],
  ['1','2','3','−'],
  ['0','.','=','+'],
];
const CALC_OP_MAP={'×':'*','÷':'/','−':'-','+':'+'};
const CALC_DISP_MAP={'*':' × ','/':' ÷ ','-':' − ','+':' + '};

function calcDisplayText(expr){
  return expr.replace(/[+\-*/]/g,ch=>CALC_DISP_MAP[ch]).replace(/\s+/g,' ').trim();
}
function calcRenderButtons(){
  const grid=document.getElementById('calc-grid');
  if(!grid)return;
  grid.innerHTML='';
  CALC_BTN_ROWS.flat().forEach(label=>{
    const isOp=['÷','×','−','+'].includes(label);
    const isEq=label==='=';
    const isCtl=label==='C'||label==='⌫';
    const btn=document.createElement('button');
    btn.type='button';
    btn.textContent=label;
    const base='padding:9px 0;border-radius:8px;font-size:.85rem;font-weight:500;cursor:pointer;border:1.5px solid #e7e5e4;font-family:\'DM Mono\',monospace;transition:opacity .15s;';
    const theme=isEq?'background:#1c1917;color:#fff;border-color:#1c1917;'
      :isOp?'background:#faf9f7;color:#1d4ed8;'
      :isCtl?'background:#fff1f2;color:#be123c;'
      :'background:#fff;color:#1c1917;';
    btn.style.cssText=base+theme;
    btn.onmouseover=()=>{btn.style.opacity='.75';};
    btn.onmouseout=()=>{btn.style.opacity='1';};
    btn.onclick=()=>calcHandle(label);
    grid.appendChild(btn);
  });
}
function calcHandle(label){
  if(label==='C'){calcClear();return;}
  if(label==='⌫'){calcBackspace();return;}
  if(label==='='){calcEvaluate();return;}
  const token=CALC_OP_MAP[label]!==undefined?CALC_OP_MAP[label]:label;
  calcAppend(token);
}
function calcAppend(token){
  const isOp=['+','-','*','/'].includes(token);
  if(calcHasResult){
    if(isOp)calcHasResult=false;
    else{calcExpr='';calcHasResult=false;}
  }
  if(isOp){
    if(calcExpr===''){
      if(token!=='-')return;
    }else if(['+','-','*','/'].includes(calcExpr.slice(-1))){
      calcExpr=calcExpr.slice(0,-1);
    }
  }
  if(token==='.'){
    const lastNum=calcExpr.split(/[+\-*/(]/).pop();
    if(lastNum.includes('.'))return;
  }
  calcExpr+=token;
  calcUpdateDisplay();
}
function calcBackspace(){
  if(calcHasResult){calcClear();return;}
  calcExpr=calcExpr.slice(0,-1);
  calcUpdateDisplay();
}
function calcClear(){
  calcExpr='';calcHasResult=false;
  calcUpdateDisplay();
}
function calcUpdateDisplay(){
  const disp=document.getElementById('calc-display');
  if(!disp)return;
  disp.value=calcExpr?calcDisplayText(calcExpr):'0';
}
function calcEvaluate(){
  if(!calcExpr)return;
  if(!/^[0-9+\-*/(). ]+$/.test(calcExpr)){calcClear();return;}
  try{
    const result=Function('"use strict";return ('+calcExpr+')')();
    if(!Number.isFinite(result))throw new Error('Invalid result');
    const rounded=Math.round(result*1e8)/1e8;
    calcExpr=String(rounded);
    calcHasResult=true;
    calcUpdateDisplay();
  }catch(e){
    calcExpr='';calcHasResult=false;
    const disp=document.getElementById('calc-display');
    if(disp)disp.value='Error';
  }
}
function calcCopy(){
  const disp=document.getElementById('calc-display');
  if(!disp||!disp.value||disp.value==='0'||disp.value==='Error')return;
  const text=disp.value.replace(/\s/g,'');
  const done=()=>toast('Copied to clipboard');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>calcFallbackCopy(text,done));
  }else{
    calcFallbackCopy(text,done);
  }
}
function calcFallbackCopy(text,done){
  try{
    const ta=document.createElement('textarea');
    ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    done();
  }catch(e){toast('Could not copy — select and copy manually');}
}
function calcKeyDown(e){
  const key=e.key;
  if(/^[0-9]$/.test(key)){e.preventDefault();calcAppend(key);return;}
  if(key==='.'){e.preventDefault();calcAppend('.');return;}
  if(key==='+'){e.preventDefault();calcAppend('+');return;}
  if(key==='-'){e.preventDefault();calcAppend('-');return;}
  if(key==='*'){e.preventDefault();calcAppend('*');return;}
  if(key==='/'){e.preventDefault();calcAppend('/');return;}
  if(key==='('||key===')'){e.preventDefault();calcAppend(key);return;}
  if(key==='Enter'||key==='='){e.preventDefault();calcEvaluate();return;}
  if(key==='Backspace'){e.preventDefault();calcBackspace();return;}
  if(key==='Escape'||key==='Delete'){e.preventDefault();calcClear();return;}
}
calcRenderButtons();
calcUpdateDisplay();

