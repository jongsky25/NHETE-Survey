const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const c=JSON.parse(fs.readFileSync('development/content.json'));
const device='a'.repeat(40),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function harness(){
 const sheets={},props={SPREADSHEET_ID:'existing',CONSULTATION_OPEN:'true'};
 class Sheet{
  constructor(name){this.name=name;this.values=[];this.notes={};this.filter=null;}
  getLastRow(){return this.values.length;}
  appendRow(row){this.values.push([...row]);return this;}
  setFrozenRows(){}
  setFrozenColumns(){}
  getMaxRows(){return Math.max(1000,this.values.length);}
  getMaxColumns(){return 500;}
  insertRowsAfter(){return this;}
  insertColumnsAfter(){return this;}
  getFilter(){return this.filter;}
  clearContents(){this.values=[];return this;}
  setColumnWidths(){return this;}
  setColumnWidth(){return this;}
  getDataRange(){return {getValues:()=>this.values.map(r=>[...r])};}
  getRange(row,col,n=1,m=1){const range={getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.values[row-1+i]?.[col-1+j]??'')),setValues:vs=>{vs.forEach((v,i)=>{this.values[row-1+i]??=[];v.forEach((x,j)=>this.values[row-1+i][col-1+j]=x);});return range;},getNote:()=>this.notes[row+':'+col] || '',setNote:v=>{this.notes[row+':'+col]=v;return range;},createFilter:()=>{this.filter={remove:()=>{this.filter=null;},setColumnFilterCriteria:()=>{}};return range;}};for(const key of ['setWrap','setVerticalAlignment','setBackground','setFontWeight','setNumberFormat'])range[key]=()=>range;return range;}

  deleteRow(i){this.values.splice(i-1,1);}
 }
 const book={getUrl:()=> 'https://docs.google.com/spreadsheets/d/existing/edit',getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet(n)};
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-03T12:00:00Z']));}static now(){return new Date('2026-11-03T12:00:00Z').getTime();}}
 const ctx=vm.createContext({console,Date:Clock,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},SpreadsheetApp:{newFilterCriteria:()=>({setHiddenValues:()=>({build:()=>({})})}),openById:id=>{assert.equal(id,'existing');return book;}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),getUuid:()=>crypto.randomUUID(),base64Decode:s=>Buffer.from(s,'base64'),newBlob:(bytes,contentType,name)=>({bytes,contentType,name}),ungzip:b=>{if(!b.contentType)throw new Error('Blob object must have non-null content type');assert.equal(b.contentType,'application/x-gzip');return {getDataAsString:()=>zlib.gunzipSync(b.bytes).toString()};}}});
 vm.runInContext(fs.readFileSync('apps-script/Content.gs','utf8'),ctx);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),ctx);ctx.ensureModule_();
 for(const [name,headers]of Object.entries(vm.runInContext('TABLES_',ctx)))book.insertSheet(name).appendRow(headers);
 const token='admin-token';sheets.Roster.appendRow(['admin@example.test','Admin','DOH','','',true,true]);sheets.Sessions.appendRow([hash(token),'admin@example.test','2026-12-01T00:00:00Z']);
 const enter=(d=device)=>ctx.enterConsultation({email:'person@example.test',name:'Respondent',agency:'Example agency'},d);
 const save=(token,version,changes,extra={})=>ctx.saveAnswers(token,{device,expectedVersion:version,requestId:crypto.randomUUID(),changes,screen:'mx-A',...extra});
 return {ctx,sheets,props,enter,save,admin:token};
}

module.exports={harness,device,hash,c};
