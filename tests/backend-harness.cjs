const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const c=JSON.parse(fs.readFileSync('development/content.json'));
const device='a'.repeat(40),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function harness(){
 const sheets={},props={SPREADSHEET_ID:'existing',CONSULTATION_OPEN:'true'};
 class Sheet{
  constructor(name){this.name=name;this.values=[];}
  getLastRow(){return this.values.length;}
  appendRow(row){this.values.push([...row]);return this;}
  setFrozenRows(){}
  getDataRange(){return {getValues:()=>this.values.map(r=>[...r])};}
  getRange(row,col,n,m){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.values[row-1+i]?.[col-1+j]??'')),setValues:vs=>{vs.forEach((v,i)=>{this.values[row-1+i]??=[];v.forEach((x,j)=>this.values[row-1+i][col-1+j]=x);});}};}
  deleteRow(i){this.values.splice(i-1,1);}
 }
 const book={getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet(n)};
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-03T12:00:00Z']));}static now(){return new Date('2026-11-03T12:00:00Z').getTime();}}
 const ctx=vm.createContext({console,Date:Clock,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},SpreadsheetApp:{openById:id=>{assert.equal(id,'existing');return book;}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),getUuid:()=>crypto.randomUUID(),base64Decode:s=>Buffer.from(s,'base64'),newBlob:x=>x,ungzip:b=>({getDataAsString:()=>zlib.gunzipSync(b).toString()})}});
 vm.runInContext(fs.readFileSync('apps-script/Content.gs','utf8'),ctx);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),ctx);ctx.ensureModule_();
 for(const [name,headers]of Object.entries(vm.runInContext('TABLES_',ctx)))book.insertSheet(name).appendRow(headers);
 const token='admin-token';sheets.Roster.appendRow(['admin@example.test','Admin','DOH','','',true,true]);sheets.Sessions.appendRow([hash(token),'admin@example.test','2026-12-01T00:00:00Z']);
 const enter=(d=device)=>ctx.enterConsultation({email:'person@example.test',name:'Respondent',agency:'Example agency'},d);
 const save=(token,version,changes,extra={})=>ctx.saveAnswers(token,{device,expectedVersion:version,requestId:crypto.randomUUID(),changes,screen:'mx-A',...extra});
 return {ctx,sheets,props,enter,save,admin:token};
}

module.exports={harness,device,hash,c};
