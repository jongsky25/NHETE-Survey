/* NHETE consultation. Only public entry points below are callable by the browser.
 * Helpers end in '_' so google.script.run cannot invoke them.
 */
const TABLES_ = {
  Roster: ['email', 'name', 'agency', 'seat', 'role', 'admin', 'active'],
  Sessions: ['tokenHash', 'email', 'expiresAt'],
  Revisions: ['email', 'version', 'requestId', 'status', 'savedAt', 'changes'],
  Decisions: ['id', 'questionId', 'decision', 'reason', 'actor', 'savedAt']
};
function props_() { return PropertiesService.getScriptProperties(); }
function content_() { return NHETE_CONTENT; }
function sheet_(name) {
  const id = props_().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('The consultation has not been configured.');
  const s = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!s) throw new Error('Missing sheet: ' + name + '. Run setupConsultation_ in the editor.');
  return s;
}
function rows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  return values.slice(1).filter(r => r[0] !== '').map(r => Object.fromEntries(TABLES_[name].map((h, i) => [h, r[i]])));
}
function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function random_() { return Utilities.getUuid() + Utilities.getUuid(); }
function truth_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function email_(v) { return String(v || '').trim().toLowerCase(); }
function roster_(email) {
  const matches = rows_('Roster').filter(r => email_(r.email) === email && truth_(r.active));
  if (matches.length !== 1) throw new Error('This Google account is not on the active participant list. Contact the secretariat.');
  const p = matches[0];
  return {email, admin: truth_(p.admin)};
}
function authenticate_(token, admin) {
  if (typeof token !== 'string' || token.length > 200) throw new Error('Sign in again.');
  const h = hash_(token);
  const s = rows_('Sessions').find(r => r.tokenHash === h && Date.parse(r.expiresAt) > Date.now());
  if (!s) throw new Error('Your session has expired. Sign in again on this device to continue.');
  const person = roster_(email_(s.email));
  if (admin && !person.admin) throw new Error('Secretariat access is required.');
  return person;
}
function writable_() {
  if (props_().getProperty('CONSULTATION_OPEN') !== 'true') throw new Error('The consultation is closed. Saved responses remain available to read.');
  const deadline = content_().closesAt;
  if (deadline && (!Number.isFinite(Date.parse(deadline)) || Date.now() >= Date.parse(deadline))) {
    throw new Error('The consultation deadline has passed or needs correcting.');
  }
}
function locked_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
// November response journal is separate from all existing October responses.
const MODULE_TABLES_ = {
  Module20261102Devices: ['accountHash', 'owner'],
  Module20261102Revisions: ['owner', 'version', 'requestId', 'status', 'savedAt', 'screen', 'commitId'],
  Module20261102Changes: ['owner', 'commitId', 'questionId', 'partIndex', 'fragment'],
  Module20261102Decisions: ['id', 'questionId', 'decision', 'reason', 'actor', 'savedAt']
};
function moduleRows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  return values.slice(1).filter(r => r[0] !== '').map(r => Object.fromEntries(MODULE_TABLES_[name].map((h, i) => [h, r[i]])));
}
function ensureModule_() {
  const book = SpreadsheetApp.openById(props_().getProperty('SPREADSHEET_ID'));
  Object.keys(MODULE_TABLES_).forEach(name => {
    const s = book.getSheetByName(name) || book.insertSheet(name);
    if (!s.getLastRow()) { s.appendRow(MODULE_TABLES_[name]); s.setFrozenRows(1); }
    else if (JSON.stringify(s.getRange(1, 1, 1, MODULE_TABLES_[name].length).getValues()[0]) !== JSON.stringify(MODULE_TABLES_[name])) {
      throw new Error('Unexpected header in ' + name + '. Existing data was preserved.');
    }
  });
}
function owner_(person, device) {
  if (typeof device !== 'string' || !/^[a-zA-Z0-9-]{32,100}$/.test(device)) throw new Error('Please use the device where you started.');
  return hash_(content_().version + ':' + person.email + ':' + device);
}
function moduleState_(owner, revisions, fragments) {
  const state = {owner, version: 0, status: 'not started', answers: {}, savedAt: '', screen: 'welcome'};
  const history = (revisions || moduleRows_('Module20261102Revisions')).filter(r => r.owner === owner);
  const parts = (fragments || moduleRows_('Module20261102Changes')).filter(r => r.owner === owner);
  history.forEach(r => {
    if (Number(r.version) !== state.version + 1) throw new Error('Response history needs secretariat attention.');
    const grouped = {};
    parts.filter(p => p.commitId === r.commitId).forEach(p => {
      (grouped[p.questionId] ||= []).push(p);
    });
    Object.keys(grouped).forEach(qid => {
      const sorted = grouped[qid].sort((a,b) => Number(a.partIndex) - Number(b.partIndex));
      sorted.forEach((p,i) => { if (Number(p.partIndex) !== i) throw new Error('Incomplete answer record.'); });
      state.answers[qid] = JSON.parse(sorted.map(p => JSON.parse(p.fragment)).join(''));
    });
    state.version = Number(r.version); state.status = r.status; state.savedAt = String(r.savedAt); state.screen = String(r.screen);
  });
  return state;
}
function validateChanges_(changes) {
  if (!changes || Object.prototype.toString.call(changes) !== '[object Object]') throw new Error('Invalid answers.');
  const questions = Object.fromEntries(content_().questions.map(q => [q.id,q]));
  const cleaned = {};
  Object.keys(changes).forEach(id => {
    if (!questions[id]) throw new Error('Unknown question.');
    const q = questions[id], value = changes[id];
    if (value !== '' && value !== false && !(Array.isArray(value) && !value.length) && !NheteRules.valid(q,value)) {
      throw new Error(q.type === 'text' ? 'Please keep your answer to 1,500 words or fewer.' : 'Invalid answer.');
    }
    if (value === false && !['check','toggle'].includes(q.type) || Array.isArray(value) && q.type !== 'multi' || value === '' && ['check','toggle','multi'].includes(q.type)) throw new Error('Invalid answer type.');
    cleaned[id] = value;
  });
  return cleaned;
}
function bootstrap(token, device) {
  const p = authenticate_(token,false);
  if (typeof NheteRules === 'undefined' || typeof NheteRules.missing !== 'function') {
    throw new Error('Rules.gs is missing or outdated. Add the current Rules.gs file in Apps Script, save, and deploy a new version.');
  }
  locked_(ensureModule_);
  const owner = owner_(p,device);
  let open = true; try { writable_(); } catch (_) { open = false; }
  const accountHash = hash_(p.email);
  const differentDevice = locked_(() => {
    const devices = moduleRows_('Module20261102Devices');
    const known = devices.filter(d => d.accountHash === accountHash && d.owner !== owner).map(d => d.owner);
    if (!devices.some(d => d.accountHash === accountHash && d.owner === owner)) sheet_('Module20261102Devices').appendRow([accountHash,owner]);
    return moduleRows_('Module20261102Revisions').some(r => known.includes(r.owner));
  });
  return {person: {admin: p.admin}, content: content_(), response: moduleState_(owner), open, differentDevice, closesAt: content_().closesAt};
}
function saveAnswers(token, request) {
  const person = authenticate_(token,false);
  if (!request || !/^[a-zA-Z0-9-]{8,100}$/.test(request.requestId || '')) throw new Error('Invalid save identifier.');
  const owner = owner_(person,request.device), changes = validateChanges_(request.changes);
  if (!content_().screens.some(s => s.id === request.screen)) throw new Error('Unknown screen.');
  return locked_(() => {
    const history = moduleRows_('Module20261102Revisions');
    const state = moduleState_(owner,history);
    if (history.some(r => r.owner === owner && r.requestId === request.requestId)) return {ok: true,response: state};
    writable_();
    if (Number(request.expectedVersion) !== state.version) return {ok: false,conflict: true,response: state};
    const answers = Object.assign({},state.answers,changes);
    const missing = NheteRules.missing(content_(),answers,request.submit ? null : request.validateScreen || '__no_validation__');
    if (missing.length) return {ok:false,missing};
    const commit = random_(), rows = [];
    Object.keys(changes).forEach(qid => {
      const text = JSON.stringify(changes[qid]);
      for (let i=0;i<text.length;i+=12000) rows.push([owner,commit,qid,i/12000,JSON.stringify(text.slice(i,i+12000))]);
    });
    if (rows.length) {
      const s = sheet_('Module20261102Changes');
      s.getRange(s.getLastRow()+1,1,rows.length,5).setValues(rows);
    }
    const at = new Date().toISOString(), status = request.submit ? 'submitted' : Object.keys(changes).length ? 'draft' : state.status;
    // Append the manifest last: fragments of an interrupted attempt are never treated as committed answers.
    sheet_('Module20261102Revisions').appendRow([owner,state.version+1,request.requestId,status,at,request.screen,commit]);
    return {ok:true,response:{owner,version:state.version+1,status,savedAt:at,screen:request.screen,answers}};
  });
}
function adminData(token) {
  authenticate_(token,true);
  locked_(ensureModule_);
  const revisions = moduleRows_('Module20261102Revisions'), fragments = moduleRows_('Module20261102Changes');
  const owners = [...new Set(revisions.map(r => r.owner))];
  return {responses: owners.map(owner => moduleState_(owner,revisions,fragments)), decisions: moduleRows_('Module20261102Decisions')};
}
function recordDecision(token,input) {
  const actor = authenticate_(token,true);
  if (!input || !content_().questions.some(q => q.id === input.questionId)) throw new Error('Unknown question.');
  ['decision','reason'].forEach(k => { if (typeof input[k] !== 'string' || !input[k].trim() || NheteRules.words(input[k])>1500) throw new Error('A decision and reason are required (up to 1,500 words each).'); });
  return locked_(() => { sheet_('Module20261102Decisions').appendRow([random_(),input.questionId,JSON.stringify(input.decision),JSON.stringify(input.reason),actor.email,new Date().toISOString()]);return {ok:true}; });
}
function signOut(token) {
  const hash = hash_(String(token || ''));
  locked_(() => { const s=sheet_('Sessions'), values=s.getDataRange().getValues(); for(let i=values.length-1;i>0;i--) if(values[i][0]===hash) s.deleteRow(i+1); });
}
function beginGoogleSignIn(verifierHash) {
  if (!/^[a-f0-9]{64}$/.test(verifierHash || '')) throw new Error('This browser cannot start a secure sign-in.');
  const client = props_().getProperty('GOOGLE_CLIENT_ID');
  if (!client || !props_().getProperty('GOOGLE_CLIENT_SECRET')) throw new Error('Google sign-in has not been configured by the owner.');
  const state = random_();
  CacheService.getScriptCache().put('oauth:' + hash_(state), verifierHash, 600);
  const query = {client_id: client, redirect_uri: ScriptApp.getService().getUrl(), response_type: 'code',
    scope: 'openid email', state, prompt: 'select_account', access_type: 'online'};
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(query).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(query[k])).join('&');
}
function googleCallback_(parameters) {
  const cache = CacheService.getScriptCache(), key = 'oauth:' + hash_(String(parameters.state || ''));
  const verifierHash = cache.get(key);
  if (!verifierHash) throw new Error('Sign-in expired. Start again in the original browser tab.');
  cache.remove(key);
  if (parameters.error || !parameters.code) throw new Error('Google sign-in was cancelled.');
  const result = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {method: 'post', muteHttpExceptions: true, payload: {
    code: parameters.code, client_id: props_().getProperty('GOOGLE_CLIENT_ID'), client_secret: props_().getProperty('GOOGLE_CLIENT_SECRET'),
    redirect_uri: ScriptApp.getService().getUrl(), grant_type: 'authorization_code'
  }});
  if (result.getResponseCode() !== 200) throw new Error('Google could not complete sign-in. Please start again.');
  const access = JSON.parse(result.getContentText()).access_token;
  if (!access) throw new Error('Google did not return an access token.');
  const info = UrlFetchApp.fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {Authorization: 'Bearer ' + access}, muteHttpExceptions: true
  });
  if (info.getResponseCode() !== 200) throw new Error('Google identity verification failed.');
  const identity = JSON.parse(info.getContentText());
  if (identity.email_verified !== true || !identity.sub) throw new Error('Use a verified Google account.');
  const person = roster_(email_(identity.email));
  const pending = random_();
  cache.put('pending:' + hash_(pending), JSON.stringify({email: person.email, verifierHash}), 300);
  return pending;
}
function completeGoogleSignIn(pending, verifier) {
  if (typeof pending !== 'string' || pending.length > 200 || typeof verifier !== 'string' || verifier.length > 200) throw new Error('Invalid sign-in.');
  return locked_(() => {
    const cache = CacheService.getScriptCache(), key = 'pending:' + hash_(pending);
    const record = cache.get(key);
    if (!record) throw new Error('Sign-in expired. Start again.');
    const data = JSON.parse(record);
    if (hash_(verifier) !== data.verifierHash) throw new Error('Finish sign-in in the browser where you started it.');
    cache.remove(key);
    roster_(data.email);
    const token = random_(), now = Date.now(), sessions = sheet_('Sessions');
    const values = sessions.getDataRange().getValues();
    for (let i = values.length - 1; i > 0; i--) if (Date.parse(values[i][2]) <= now) sessions.deleteRow(i + 1);
    sessions.appendRow([hash_(token), data.email, new Date(now + 12 * 60 * 60 * 1000).toISOString()]);
    return token;
  });
}
function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  let pending = '', error = '';
  if (e && e.parameter && (e.parameter.code || e.parameter.error)) {
    try { pending = googleCallback_(e.parameter); } catch (err) { error = err.message; }
  }
  t.boot = JSON.stringify({pending, error}).replace(/</g, '\\u003c');
  return t.evaluate().setTitle('NHETE indicator consultation').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
// Run manually from the Apps Script editor, never from the web app.
function setupConsultation_() {
  const p = props_();
  let id = p.getProperty('SPREADSHEET_ID');
  if (!id) { id = SpreadsheetApp.create('NHETE consultation').getId(); p.setProperty('SPREADSHEET_ID', id); }
  const book = SpreadsheetApp.openById(id);
  Object.keys(TABLES_).forEach(name => {
    const s = book.getSheetByName(name) || book.insertSheet(name);
    if (s.getLastRow() === 0) { s.appendRow(TABLES_[name]); s.setFrozenRows(1); }
    else if (JSON.stringify(s.getRange(1, 1, 1, TABLES_[name].length).getValues()[0]) !== JSON.stringify(TABLES_[name])) throw new Error('Unexpected header in ' + name + '; existing data was preserved.');
  });
  if (!p.getProperty('CONSULTATION_OPEN')) p.setProperty('CONSULTATION_OPEN', 'false');
  console.log('Prepared workbook: ' + book.getUrl());
}
