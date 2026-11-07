const {test}=require('node:test'),assert=require('node:assert/strict');
const c=require('../development/content.json'),rules=require('../development/domain.js'),analysis=require('../development/analysis.js');
const q=id=>c.questions.find(q=>q.id===id),option=(id,n=0)=>q(id).options[n].text;
const base={owner:'fake-response',entry:{name:'Example',email:'example@example.test',agency:'Example office'},status:'submitted',review:{included:true},answers:{'A01.q-v':option('A01.q-v'),'A01.q-k':option('A01.q-k'),'A01.q-o':'=not a formula','A01:part1:SG.2':'A barangay'},savedAt:'2026-11-05T00:00:00Z',screen:'mx-A'};
const table=(tables,name)=>tables.find(t=>t.name===name).rows;
test('analysis maps exact questions, grid statements, parts and latest respondent answers',()=>{
 const tables=analysis.build(c,[base],rules,'now'),rows=table(tables,'Answers by Question');
 const row=rows.find(r=>r[6]==='A01:part1:SG.2');
 assert.equal(row[9],'A01 — '+c.indicators.find(i=>i.code==='A01').title);
 assert.equal(row[10],q('A01:part1:SG.2').component);assert.equal(row[11],q('A01:part1:SG.2').label.text);assert.equal(row[15],'A barangay');
 assert.equal(rows.find(r=>r[6]==='A01.q-o')[15],'=not a formula');
 const grid=table(tables,'Question Guide').find(r=>r[0]==='tor.T:tor.T01');assert.equal(grid[4],'T01: Purpose');assert(grid[6].includes('technical guidance'));
 assert.equal(table(tables,'Response Matrix').length,2);
 for(const t of tables)assert(t.rows.every(r=>r.length===t.rows[0].length));
});
test('analysis separates unanswered and inapplicable; summary excludes drafts, exclusions and disabled fields',()=>{
 const disabled={...base,owner:'disabled',answers:{...base.answers,'A01.q-v':option('A01.q-v',3)}};
 const tables=analysis.build(c,[base,{...base,owner:'draft',status:'draft'},{...base,owner:'excluded',review:{included:false}},disabled],rules,'now');
 const rows=table(tables,'Answers by Question');
 assert.equal(rows.find(r=>r[0]==='disabled'&&r[6]==='A01.q-k')[13],'Not applicable');
 assert.equal(rows.find(r=>r[0]===base.owner&&r[6]==='A07.q-v')[13],'Not answered');
 const sum=table(tables,'Choice Summary').find(r=>r[0]==='A01.q-k'&&r[7]===option('A01.q-k'));assert.equal(sum[8],1);assert.equal(sum[9],1);assert.equal(sum[12],1);
});
test('long answers are preserved in numbered parts and false is an explicit No',()=>{
 const answer='a'.repeat(100000),r={...base,answers:{...base.answers,'A01.q-o':answer,'0.0':false}};
 const tables=analysis.build(c,[r],rules,'now'),rows=table(tables,'Answers by Question');
 assert.equal(rows.filter(r=>r[6]==='A01.q-o').map(r=>r[15]).join(''),answer);
 assert.equal(rows.find(r=>r[6]==='0.0')[15],'No');
 const matrix=table(tables,'Response Matrix'),col=matrix[0].findIndex(h=>h.startsWith('A01.q-o |'));assert.equal(matrix[1][col],'[Long answer: see Answers by Question]');
});
test('analysis refresh is restricted to authenticated admins',()=>{
 const h=require('./backend-harness.cjs').harness(),entry=h.enter();
 assert.throws(()=>h.ctx.refreshAnalysis(entry.token));assert.throws(()=>h.ctx.refreshAnalysis('invalid'));
});

test('refresh creates readable sheets, neutralizes formula text and leaves journal untouched',()=>{
 const h=require('./backend-harness.cjs').harness(),entry=h.enter();h.save(entry.token,0,{'A01.q-o':'=SUM(1,2)'});
 const journal=JSON.stringify(Object.fromEntries(Object.entries(h.sheets).map(([k,s])=>[k,s.values])));
 const report=h.ctx.refreshAnalysis(h.admin);assert(report.url.includes('existing'));
 const sourceNames=Object.keys(JSON.parse(journal));assert.equal(JSON.stringify(Object.fromEntries(sourceNames.map(k=>[k,h.sheets[k].values]))),journal);
 const rows=h.sheets['Answers by Question'].values;assert.equal(rows.find(r=>r[6]==='A01.q-o')[15],"'=SUM(1,2)");
 h.ctx.refreshAnalysis(h.admin);assert.equal(h.sheets.Respondents.values.length,2);
 h.sheets.Respondents.notes={};const before=JSON.stringify(h.sheets['Analysis Guide'].values);
 assert.throws(()=>h.ctx.refreshAnalysis(h.admin),/not a generated analysis tab/);assert.equal(JSON.stringify(h.sheets['Analysis Guide'].values),before);
});

test('coverage question wording uses the respondent’s regional or national scope',()=>{
 for(const index of [0,1]) {
  const r={...base,answers:{...base.answers,'0.4':option('0.4',index)}};
  const rows=table(analysis.build(c,[r],rules,'now'),'Answers by Question');
  const label=rows.find(r=>r[6]==='A01:part1:SG.3')[11];
  assert(!label.includes('[region]'));assert(label.includes(index===0?'four pilot regions':option('0.4',index)));
 }
});

test('visible editor refresh rejects anonymous and mismatched identities',()=>{
 const h=require('./backend-harness.cjs').harness();
 const session=(active,effective)=>{h.ctx.Session={getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})};};
 session('', 'owner@example.test');assert.throws(()=>h.ctx.runAnalysisRefresh(),/project owner account/);
 session('visitor@example.test','owner@example.test');assert.throws(()=>h.ctx.runAnalysisRefresh(),/project owner account/);
 assert.equal(h.sheets['Analysis Guide'],undefined);
 session('owner@example.test','owner@example.test');assert(h.ctx.runAnalysisRefresh().url.includes('existing'));
});
