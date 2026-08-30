/* ── Balance computation ──────────────────────────────────── */
function computeBal(){
  const bk={};state.banks.forEach(b=>bk[b.id]=Number(b.startBalance)||0);
  let ca=Number(state.cash.startBalance)||0;
  const cd={};state.cards.forEach(c=>cd[c.id]=Number(c.startDue)||0);
  const iv={};state.investments.accounts.forEach(a=>iv[a.id]=0);
  for(const t of state.transactions){
    const a=Number(t.amount)||0;
    if(t.type==='expense'){
      if(t.acType==='bank'&&bk[t.acId]!==undefined)bk[t.acId]-=a;
      else if(t.acType==='cash')ca-=a;
      else if(t.acType==='cc'&&cd[t.acId]!==undefined)cd[t.acId]+=a;
    }else if(t.type==='income'){
      if(t.destType==='bank'&&bk[t.destId]!==undefined)bk[t.destId]+=a;
      else if(t.destType==='cash')ca+=a;
      else if(t.destType==='cc'&&cd[t.destId]!==undefined)cd[t.destId]-=a;
    }else if(t.type==='transfer'){
      const mv=(key,sign)=>{
        if(!key)return;
        if(key==='cash'){ca+=sign*a;return;}
        const[k,id]=key.split(':');
        if(k==='bank'&&bk[id]!==undefined)bk[id]+=sign*a;
        else if(k==='cc'&&cd[id]!==undefined)cd[id]-=sign*a;
        else if(k==='inv'&&iv[id]!==undefined)iv[id]+=sign*a;
      };
      mv(t.fromKey,-1);mv(t.toKey,+1);
    }else if(t.type==='invest'){
      if(t.sourceKey){
        const[k,id]=t.sourceKey.split(':');
        if(k==='bank'&&bk[id]!==undefined)bk[id]-=a;
        else if(k==='inv'&&iv[id]!==undefined)iv[id]-=a;
        else if(iv[t.accountId]!==undefined)iv[t.accountId]-=a;
      }else if(iv[t.accountId]!==undefined)iv[t.accountId]-=a;
    }else if(t.type==='divest'){
      if(t.destKey==='cash')ca+=a;
      else if(t.destKey){
        const[k,id]=t.destKey.split(':');
        if(k==='bank'&&bk[id]!==undefined)bk[id]+=a;
        else if(k==='inv'&&iv[id]!==undefined)iv[id]+=a;
      }
    }
  }
  const totBankAll=Object.values(bk).reduce((s,v)=>s+v,0);
  const totBank=state.banks.filter(b=>b.includeInNetWorth!==false).reduce((s,b)=>s+(bk[b.id]||0),0);
  const totCC=Object.values(cd).reduce((s,v)=>s+v,0);
  const totInvCash=Object.values(iv).reduce((s,v)=>s+v,0);
  const totHoldingsValue=state.investments.holdings.reduce((s,h)=>s+(Number(h.units)||0)*(Number(h.nav)||0),0);
  const liquid=totBank+ca-totCC;
  const investWorth=totInvCash+totHoldingsValue;
  return{bk,ca,cd,iv,totBank,totBankAll,totCC,totInvCash,totHoldingsValue,liquid,investWorth,netWorth:liquid+investWorth};
}

/* ── CC Due Date logic ────────────────────────────────────── */
function getDueDateStatus(card){
  if(!card.dueDay)return null;
  const now=new Date();
  const day=parseInt(card.dueDay,10);
  const remind=parseInt(card.remindDays,10)||5;
  let due=new Date(now.getFullYear(),now.getMonth(),day);
  if(due<now)due=new Date(now.getFullYear(),now.getMonth()+1,day);
  const diffMs=due-now;
  const diffDays=Math.ceil(diffMs/(1000*60*60*24));
  let status='ok',label='';
  if(diffDays<0){status='overdue';label=`Overdue by ${-diffDays}d`;}
  else if(diffDays===0){status='urgent';label='Due Today';}
  else if(diffDays<=remind){status='soon';label=`Due in ${diffDays}d`;}
  else{status='ok';label=`Due ${due.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`;}
  return{status,label,due,diffDays};
}

/* ── Splitwise / Roommate Settlement ──────────────────────── */
function computeSplitwiseBalance(){
  const owed=state.transactions.filter(t=>t.type==='expense'&&t.acType==='shared'&&!t.settled).reduce((s,t)=>s+(Number(t.myShare!==undefined?t.myShare:t.amount)||0),0);
  const fronted=state.transactions.filter(t=>t.type==='expense'&&t.shared&&t.acType!=='shared'&&!t.settled).reduce((s,t)=>s+Math.max(0,(Number(t.amount)||0)-(Number(t.myShare)||0)),0);
  return{owed,fronted,net:fronted-owed};
}

