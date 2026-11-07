export function majority(votes) {
  const values=Object.values(votes), yes=values.filter(v=>v.vote==='agree').length, no=values.filter(v=>v.vote==='disagree').length, abstain=values.filter(v=>v.vote==='abstain').length;
  return {yes,no,abstain,valid:yes+no,majority:yes+no>0 && yes>(yes+no)/2,percent:yes+no?Math.round(100*yes/(yes+no)):0};
}
export function availability(records,components) {
  // A single respondent must attest to every component for their office.
  const qualified=Object.values(records).filter(r=>components.length && components.every((_,i)=>r.components?.[i]===true));
  return {sufficient:qualified.length>0,offices:[...new Set(qualified.map(r=>r.agency))]};
}
export function consolidate(comments) {
  const groups=[['Definition / wording',/defin|descrip|word|meaning|linaw|kahulugan|term/i],['Formula / measurement',/formul|numerator|denominator|calcul|measur|sukat|count|bilang/i],['Data availability',/data|component|source|available|office|record|bureau/i],['Barangay collection',/barangay|brgy|household|survey|collect|sambahayan/i],['Implementation / feasibility',/pilot|cost|time|feasib|implement|staff|budget|gastos/i]];
  const buckets=new Map(groups.map(([name])=>[name,[]]));buckets.set('Other suggestions',[]);
  comments.filter(x=>x.text?.trim()).forEach((c,i)=>{const hit=groups.filter(([,r])=>r.test(c.text));for(const [name] of hit.length?hit:[['Other suggestions']])buckets.get(name).push({source:c.source||String(i+1),text:c.text});});
  return {method:'Extractive thematic consolidation; comments can appear under multiple themes.',count:comments.filter(c=>c.text?.trim()).length,themes:[...buckets].filter(([,v])=>v.length).map(([theme,items])=>({theme,count:items.length,excerpts:items})),draft:true};
}
export function initialItem(task) {return {id:task.id,revision:1,stage:'review',description:task.description,formula:task.formula||'',components:task.components||[],collection:'office',collectionPlan:'',votes:{},data:{},discussion:'',summary:null,official:null,history:[]};}
export function publicItem(item,admin,uid) {
 const tally=majority(item.votes),data=availability(item.data,item.components);
 if(admin)return {...item,tally,availability:data};
 return {id:item.id,revision:item.revision,stage:item.stage,description:item.description,formula:item.formula,components:item.components,collection:item.collection,collectionPlan:item.collectionPlan,tally,availability:data,official:item.official?{decision:item.official.decision,reason:item.official.reason,at:item.official.at,tally:item.official.tally}:null,myVote:item.votes[uid]||null,myData:item.data[uid]||null,discussion:item.discussion,summary:item.summary?.approved?{text:item.summary.text,approved:true}:null};
}
export function csv(rows) {return '\uFEFF'+rows.map(r=>r.map(v=>{let s=typeof v==='object'?JSON.stringify(v):String(v??'');if(/^[\s]*[=+@-]|^[\t\r\n]/u.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
