const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
const c=JSON.parse(fs.readFileSync('development/content.json')),rules=require('../development/domain.js');
const base='http://127.0.0.1:8860/?demo=1',device='test-device-'+ 'x'.repeat(40),owner='demonstration';
const q=id=>c.questions.find(q=>q.id===id),opt=(id,n=0)=>q(id).options[n].text;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function seed(screen,answers={},width=1440){await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(({screen,answers,device,c})=>{localStorage.clear();localStorage.setItem('nhete-device-id',device);const response={owner:'demonstration',version:1,status:'draft',answers,savedAt:'',screen};localStorage.setItem('nhete-demo:'+device,JSON.stringify(response));localStorage.setItem('nhete:'+c.storageVersion+':demonstration',JSON.stringify({response,dirty:{},screen,furthest:49,moduleVersion:c.version}));},{screen,answers,device,c});await page.reload();await page.locator('[data-screen-id]').waitFor();}
 async function choose(id,value){const group=page.locator('[data-question-id="'+id+'"]');await group.locator('summary').click();await group.getByRole('radio',{name:value,exact:true}).click();}
 await seed('mx-A');assert.equal(await page.locator('[data-indicator]').count(),5);assert.equal(await page.locator('select').count(),20);assert.equal(await page.locator('select').first().inputValue(),'');
 // No nested scrolling at desktop/tablet widths, even with options open.
 for(const width of [1024,1280,1920]) {
  await seed('mx-A',{},width);
  await page.locator('.choice-picker summary').first().click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.locator('.table-wrap').evaluate(n=>n.scrollHeight===n.clientHeight && n.scrollWidth===n.clientWidth));
  const menu=await page.locator('.choice-options').first().boundingBox(), bounds=await page.locator('table').boundingBox();
  assert(menu.x>=bounds.x && menu.x+menu.width<=bounds.x+bounds.width);
 }
 await seed('mx-A');
 await page.locator('#next').click();assert(await page.locator('.invalid-question').count()>0);
 await choose('A01.q-c',opt('A01.q-c',2));assert.equal(await page.locator('[data-question-id="A01.q-o"] textarea').getAttribute('placeholder'),c.ui['D-mx.6'].text);
 await choose('A01.q-w',opt('A01.q-w',7));await choose('A01.q-k',opt('A01.q-k',1));
 const comment=page.locator('[data-question-id="A01.q-o"] textarea');assert.equal(await comment.getAttribute('placeholder'),['D-mx.6','D-mx.7','D-mx.13'].map(k=>c.ui[k].text).join(' '));await comment.fill('Keep this typed explanation.');
 await page.locator('[data-view-key="indicator:A01"] summary').first().click();await page.locator('[data-view-key="research:A01"] summary').click();await choose('A01.q-v',opt('A01.q-v'));assert.equal(await comment.inputValue(),'Keep this typed explanation.');assert(await page.locator('[data-view-key="research:A01"]').getAttribute('open')!==null);
 const a={'0.4':opt('0.4',1),'A01.q-k':opt('A01.q-k'),'A01:part1:SG.1':opt('A01.q-k'),'A01:part1:SG.2':opt('A01:part1:SG.2',2)};
 await seed('cp-A',{'A01.q-k':opt('A01.q-k')});
 assert.equal(await page.locator('[data-question-id$=":SG.2"] .choice-picker').count(),2);
 assert.equal(await page.locator('[data-question-id$=":SG.1"]').count(),0);
 await seed('cp-A',a);assert.equal(await page.locator('[data-part]').count(),2);assert((await page.locator('thead').innerText()).includes('National Capital Region (NCR)'));assert.equal(await page.locator('[data-question-id="A01:part1:SG.3"] select').count(),1);
 await seed('cp-A',{...a,'0.4':opt('0.4')});assert((await page.locator('thead').innerText()).includes('four pilot regions'));
 await seed('cp-A',{...a,'0.4':opt('0.4',5)});assert.equal(await page.locator('thead th').count(),3);
 await seed('cp-A',{...a,'A01:part1:SG.2':opt('A01:part1:SG.2',4)});assert.equal(await page.locator('[data-question-id="A01:part1:SG.3"]').count(),0);assert((await page.locator('tbody').innerText()).includes('This question is only applicable for datasets that can produce barangay-level data'));
 await seed('mx-A',{},390);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const select=page.locator('[data-question-id="A04.q-v"] summary');await select.scrollIntoViewIfNeeded();await select.focus();const before=await select.boundingBox();await select.click();await page.locator('[data-question-id="A04.q-v"] input[type=radio]').first().click();await page.waitForTimeout(100);const after=await select.boundingBox();assert(Math.abs(after.y-before.y)<3,'mobile selected control stays in place '+JSON.stringify({before,after}));
 await page.screenshot({path:'tests/mobile-matrix.png',fullPage:false});
 // Pilot exclusions disable every subsequent control and restore saved answers on re-inclusion.
 for(const n of [3,4,5]) {
  await seed('mx-A',{'A01.q-k':opt('A01.q-k'),'A01.q-o':'Retained comment'});
  await choose('A01.q-v',opt('A01.q-v',n));
  const row=page.locator('[data-indicator="A01"]');
  assert.equal(await row.locator('.pilot-disabled').count(),4);
  assert.equal(await row.locator('.pilot-disabled input:enabled,.pilot-disabled textarea:enabled,.pilot-disabled select:enabled').count(),0);
  assert.equal(await row.locator('.pilot-disabled').first().getAttribute('inert'),'');
  await choose('A01.q-v',opt('A01.q-v'));
  assert.equal(await row.locator('.pilot-disabled').count(),0);
  assert.equal(await row.locator('textarea').inputValue(),'Retained comment');
 }
 // Explanatory paragraphs suppress a term throughout the page; headings never link.
 await seed('s5b');
 assert.equal(await page.locator('h1 .glossary-word, th .glossary-word, caption .glossary-word, .pill .glossary-word').count(),0);
 assert.equal(await page.getByRole('button',{name:'service-ready',exact:true}).count(),0);
 const terms=await page.locator('.module-screen .glossary-word').allTextContents();
 const ordinary=terms.map(t=>t.toLowerCase()).filter(t=>!/^[a-d]\d\d$/.test(t));
 assert.equal(new Set(ordinary).size,ordinary.length);
 await seed('s5b',{},390);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Visit every screen with a valid full-answer fixture and inspect all rendered source nodes.
 const all={};for(const field of c.questions){if(field.type==='text')all[field.id]='An explanation for consultation.';else if(['check','toggle'].includes(field.type))all[field.id]=true;else if(field.type==='multi')all[field.id]=[field.options[0].text];else all[field.id]=field.options[0].text;}
 const rendered={};
 async function capture(){const refs=await page.locator('[data-source-ref]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.sourceRef,n.textContent]));for(const [ref,text]of refs)(rendered[ref]??=[]).push(text);}
 for(const screen of c.screens){await seed(screen.id,all);await page.locator('[data-source-ref="D-adv.1"]').evaluateAll(nodes=>nodes.forEach(n=>n.click()));await capture();if(screen.id==='mx-C')await page.screenshot({path:'tests/desktop-matrix.png'});}
 // Conditional regional coverage, change-answer branch, and all parts descriptions.
 await seed('cp-A',a);await capture();
 const changed={...all,'3.4':opt('3.4',1)};await seed('s3c',changed);await capture();

 // Real forward/back navigation skips empty parts screens and preserves saved data.
 const none={...all};for(const ind of c.indicators)none[ind.code+'.q-k']=opt(ind.code+'.q-k',2);
 await seed('mx-A',none);await page.locator('#next').click();await page.locator('[data-screen-id="mx-B"]').waitFor();await page.getByRole('button',{name:'Back',exact:true}).click();await page.locator('[data-screen-id="mx-A"]').waitFor();
 // Traverse the complete 50-screen journey using Continue, including actual submission.
 await seed('welcome',all);const visited=[];
 for(let i=0;i<55;i++){const id=await page.locator('[data-screen-id]').getAttribute('data-screen-id');visited.push(id);if(id==='end1')break;await page.locator('#next').click();await page.waitForFunction(previous=>document.querySelector('[data-screen-id]')?.dataset.screenId!==previous,id);}
 assert.deepEqual(visited,c.screens.map(s=>s.id));assert.equal(await page.evaluate(device=>JSON.parse(localStorage.getItem('nhete-demo:'+device)).status,device),'submitted');
 // Existing saved screen names resume at their corresponding domain without losing edits.
 await seed('ind-A01',{'A01.q-o':'Historical comment','A01:part1:SG.4a':'Historical year'});assert.equal(await page.locator('[data-screen-id]').getAttribute('data-screen-id'),'mx-A');assert.equal(await page.locator('[data-question-id="A01.q-o"] textarea').inputValue(),'Historical comment');
 fs.writeFileSync('tests/rendered-refs.json',JSON.stringify(rendered,null,2));assert.deepEqual(errors,[]);console.log('PASS browser matrices, validation, coverage, mobile scroll and all 50 screen renders');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
