const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=JSON.parse(fs.readFileSync('development/content.json')),r=require('../development/domain.js');
const q=id=>c.questions.find(q=>q.id===id),options=id=>q(id).options.map(o=>o.text);
const yes=options('A01.q-k')[0],close=options('A01.q-k')[1],no=options('A01.q-k')[2];
test('screen shape and source-approved component counts',()=>{assert.equal(c.screens.length,50);assert.equal(c.indicators.length,35);assert.equal(c.indicators.reduce((n,i)=>n+i.parts.length,0),74);assert.equal(c.indicators.find(i=>i.code==='C13').parts.length,3);assert.equal(c.indicators.find(i=>i.code==='D13').parts.length,2);assert.equal(c.questions.some(q=>/SG\.3b|SG\.4|notOurs/.test(q.id)),false);});
test('parts screens require Yes or close, never merely an opinion',()=>{const s=c.screens.find(s=>s.id==='cp-A');for(const v of ['',no,'I do not know'])assert.equal(r.screenVisible(s,{'A01.q-k':v},c),false);for(const v of [yes,close])assert.equal(r.screenVisible(s,{'A01.q-k':v},c),true);});
test('each of three triggers independently requires a substantive comment',()=>{const field=q('A01.q-o');for(const a of [{'A01.q-c':options('A01.q-c')[2]},{'A01.q-w':options('A01.q-w')[7]},{'A01.q-k':close}]){assert(r.isRequired(field,a));assert(r.missing(c,a,'mx-A').includes(field.id));assert(r.missing(c,{...a,[field.id]:'   '},'mx-A').includes(field.id));assert(!r.missing(c,{...a,[field.id]:'Explanation'},'mx-A').includes(field.id));}assert(!r.isRequired(field,{}));});
test('six specified indicators have no cut-off question',()=>{for(const i of c.indicators)assert.equal(!!q(i.code+'.q-c'),!['B03','B08','B19','B20','B21','D03'].includes(i.code));});
test('coverage follows office area and barangay-capable level regardless of legacy part holder',()=>{for(const area of options('0.4'))for(const holder of options('A01.q-k'))for(const level of options('A01:part1:SG.2')){const a={'0.4':area,'A01.q-k':yes,'A01:part1:SG.1':holder,'A01:part1:SG.2':level};assert.equal(r.relevant(q('A01:part1:SG.3'),a,c),options('0.4').slice(0,5).includes(area)&&options('A01:part1:SG.2').slice(0,3).includes(level));}});
test('filtered parts enable area immediately and retire redundant holder fields',()=>{
 const field=q('A01:part1:SG.2');
 assert(!r.relevant(field,{'A01.q-k':no},c));
 for(const value of [yes,close]) {
  const a={'A01.q-k':value};
  assert(r.relevant(field,a,c));assert(r.missing(c,a,'cp-A').includes(field.id));
  assert(!r.missing(c,a,'cp-A').some(id=>id.includes('SG.1')));
 }
 assert(!q('A01:part1:SG.1'));assert(c.legacyQuestions.some(q=>q.id==='A01:part1:SG.1'));
});
test('discard active part answers via patch while preserving input history',()=>{const before={'A01.q-k':yes,'A01:part1:SG.1':yes,'A01:part1:SG.3:NCR':'All','A01:part1:SG.4a':'2025','A01.q-v':'opinion'};const snapshot=JSON.stringify(before),p=r.normalizeChanges(c,before,{'A01.q-k':no});assert.equal(p['A01:part1:SG.1'],'');assert.equal(p['A01:part1:SG.3:NCR'],'');assert.equal(p['A01:part1:SG.4a'],'');assert.equal(p['A01.q-v'],undefined);assert.equal(JSON.stringify(before),snapshot);});
test('a changed office scope cannot reuse an answer about a different area',()=>{assert.equal(r.normalizeChanges(c,{'0.4':options('0.4')[1],'A01:part1:SG.3':'All'},{'0.4':options('0.4')[0]})['A01:part1:SG.3'],'');});
test('1500 words, exclusive no-view, six-person and 75 percent agreement',()=>{assert(r.valid({type:'text',required:true},'word '.repeat(1500)));assert(!r.valid({type:'text',required:true},'word '.repeat(1501)));const choice=q('A01.q-v'),a=choice.options[0].text,b=choice.options[1].text;const rs=Array.from({length:8},(_,i)=>({status:'submitted',answers:{[choice.id]:i<6?a:b}}));assert(r.tally(choice,rs,c).shortlist);rs[0].review={included:false};assert(!r.tally(choice,rs,c).shortlist);rs[1].answers[choice.id]=choice.options.at(-1).text;assert.equal(r.tally(choice,rs,c).n,6);});
test('fresh coverage supplied with a changed scope survives an offline save batch',()=>{const patch={'0.4':options('0.4')[0],'A01:part1:SG.3':'Most (more than or equal to 75%)'};assert.equal(r.normalizeChanges(c,{'0.4':options('0.4')[1]},patch)['A01:part1:SG.3'],patch['A01:part1:SG.3']);});

test('Defer, Drop and no-view disable subsequent fields and parts without erasing answers',()=>{
 const saved={'A01.q-k':yes,'A01.q-c':options('A01.q-c')[2],'A01.q-o':'Saved comment','A01:part1:SG.2':options('A01:part1:SG.2')[0]};
 for(const value of options('A01.q-v')) {
  const a={...saved,'A01.q-v':value},disabled=options('A01.q-v').slice(3).includes(value);
  assert.equal(r.pilotDisabled('A01',a),disabled);
  assert(r.relevant(q('A01.q-v'),a,c));
  for(const id of ['A01.q-c','A01.q-w','A01.q-k','A01.q-o','A01:part1:SG.2'])assert.equal(r.relevant(q(id),a,c),!disabled);
  assert.equal(r.screenVisible(c.screens.find(s=>s.id==='cp-A'),a,c),!disabled);
  if(disabled) {
   assert(!r.missing(c,a,'mx-A').some(id=>id.startsWith('A01.')));
   assert.equal(r.tally(q('A01.q-k'),[{status:'submitted',answers:a}],c).n,0);
  }
  assert.deepEqual(r.normalizeChanges(c,saved,{'A01.q-v':value}),{'A01.q-v':value});
 }
});
