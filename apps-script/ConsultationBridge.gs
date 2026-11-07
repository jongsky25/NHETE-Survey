/* Read-only pre-work bridge for the separate live consultation. No original
 * answers are modified. Set CONSULTATION_BRIDGE_KEY to a long random secret
 * in Script Properties and the same value as the Site PREWORK_KEY secret.
 * POST-only: the shared secret is never placed in a URL or browser code.
 */
function consultationExport_() {
  return {format:'nhete-prework',version:1,exportedAt:new Date().toISOString(),responses:analysisData_().responses
    .filter(r=>r.entry && r.entry.email && r.review?.included!==false)
    .map(r=>({sourceId:r.owner,email:r.entry.email,name:r.entry.name,agency:r.entry.agency,status:r.status,savedAt:r.savedAt,answers:r.answers}))};
}
function doPost(e) {
  let result;
  try {
    const input=JSON.parse(e?.postData?.contents || '{}'), expected=props_().getProperty('CONSULTATION_BRIDGE_KEY');
    if(input.action!=='consultationPrework'||!expected||expected.length<32||typeof input.key!=='string'||hash_(input.key)!==hash_(expected))throw new Error('Access denied.');
    result=locked_(()=>{ensureModule_();return consultationExport_();});
  } catch(error) { result={error:'Pre-work export unavailable or access denied.'}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
// Editor-only export; output is a private Drive file. No response data is logged.
function runConsultationPreworkExport() {
  const active=email_(Session.getActiveUser().getEmail()),effective=email_(Session.getEffectiveUser().getEmail());
  if(!active||active!==effective)throw new Error('Run this command from the Apps Script editor as the project owner.');
  const output=locked_(()=>{ensureModule_();return consultationExport_();});
  const boundary='nhete_'+Utilities.getUuid();
  const metadata={name:'NHETE-prework-'+new Date().toISOString().slice(0,10)+'.json',mimeType:'application/json'};
  const payload='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(output)+'\r\n--'+boundary+'--';
  const response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
    method:'post',contentType:'multipart/related; boundary='+boundary,
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:payload,muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Could not create the private export. Reauthorize the drive.file permission and retry.');
  const file=JSON.parse(response.getContentText()),url='https://drive.google.com/file/d/'+file.id+'/view';
  console.log('Private pre-work export: '+url);
  return {url:url,count:output.responses.length};
}
