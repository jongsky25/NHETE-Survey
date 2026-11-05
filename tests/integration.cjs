const {chromium}=require('playwright'),assert=require('assert/strict');
const {harness,c}=require('./backend-harness.cjs');
(async()=>{
 const h=harness(),browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('mockRpc',({name,args})=>JSON.parse(JSON.stringify(h.ctx[name](...args))));
 await page.addInitScript(()=>{
  function run(success,failure){return new Proxy({}, {get(_,name){if(name==='withSuccessHandler')return f=>run(f,failure);if(name==='withFailureHandler')return f=>run(success,f);return (...args)=>window.mockRpc({name,args}).then(success).catch(e=>failure({message:e.message}));}});}
  window.google={script:{run:run(()=>{},()=>{})}};
 });
 await page.goto('http://127.0.0.1:8860/');await page.locator('#entry-email').fill('new@example.test');await page.locator('#entry-name').fill('Test respondent');await page.locator('#entry-agency').fill('Example agency');await page.getByRole('button',{name:'Begin consultation'}).click();await page.locator('[data-screen-id="welcome"]').waitFor();
 await page.locator('#next').click();await page.locator('[data-screen-id="aboutmat"]').waitFor();assert((await page.locator('main').innerText()).includes(c.sourceTextAmendments['aboutmat.9'].text));
 await page.locator('#next').click();await page.locator('[data-screen-id="consent"]').waitFor();assert(await page.locator('#next').isDisabled());await page.locator('input[type=checkbox]').check();await page.locator('#next').click();await page.locator('[data-screen-id="about"]').waitFor();
 const state=h.ctx.adminData(h.admin).responses[0];assert.equal(state.answers['0.0'],true);assert.equal(state.entry.name,'Test respondent');assert.equal(state.answers['0.1:extra'],'Example agency');
 await page.reload();await page.locator('[data-screen-id="about"]').waitFor();assert.equal(h.ctx.adminData(h.admin).responses.length,1);
 // Drive the actual deployed server through the new table and parts states.
 const creds=await page.evaluate(()=>({token:localStorage.getItem('nhete-public-token'),device:localStorage.getItem('nhete-device-id')}));
 const fixture={};for(const q of c.questions){if(q.type==='text')fixture[q.id]='Written explanation';else if(['check','toggle'].includes(q.type))fixture[q.id]=true;else if(q.type==='multi')fixture[q.id]=[q.options[0].text];else fixture[q.id]=q.options[0].text;}
 fixture['A01:part1:SG.1']='Yes, we keep it'; // legacy answer remains accepted and archived
 const saved=h.ctx.saveAnswers(creds.token,{device:creds.device,requestId:'integration-fixture',expectedVersion:state.version,changes:fixture,screen:'mx-A'});assert(saved.ok);
 await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('nhete:')).forEach(k=>localStorage.removeItem(k)));await page.reload();await page.locator('[data-screen-id="mx-A"]').waitFor();
 await page.locator('[data-question-id="A01.q-k"] summary').click();await page.getByRole('radio',{name:'No, we do not keep it',exact:true}).click();await page.locator('#next').click();await page.locator('[data-screen-id="cp-A"]').waitFor();assert.equal(await page.locator('[data-part^="A01."]').count(),0);assert.equal(h.ctx.adminData(h.admin).responses[0].answers['A01:part1:SG.1'],'');
 // Verify administrator export includes historical answers and the review action survives saves.
 await page.evaluate(token=>{sessionStorage.setItem('nhete-token',token);sessionStorage.setItem('nhete-admin-intent','true');},h.admin);await page.reload();await page.getByRole('heading',{name:'Secretariat',exact:true}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export all entries (including excluded)',exact:true}).click();const download=await downloadPromise;const stream=await download.createReadStream();let csv='';for await(const part of stream)csv+=part.toString();assert(csv.includes('Revision history JSON'));assert(csv.includes('Test respondent'));assert(csv.includes('integration-fixture')===false);assert(csv.includes('Yes, we keep it'));
 await page.getByRole('button',{name:'Exclude',exact:true}).click();await page.getByRole('button',{name:'Restore',exact:true}).waitFor();assert.equal(h.ctx.adminData(h.admin).responses.find(r=>r.entry?.name==='Test respondent').review.included,false);
 assert.deepEqual(errors,[]);console.log('PASS browser → Apps Script → mock Sheets: public entry, consent, resume, domain/parts save, protected admin, archive export, exclusion');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
