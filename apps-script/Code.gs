// BEGIN EMBEDDED SERVER RULES
const NHETE_SERVER_RULES_ = (function () {
  'use strict';
  function words(value) { return String(value || '').match(/\S+/gu)?.length || 0; }
  function has(value) { return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '' && value !== false; }
  function matches(condition, answers) {
    const v = answers[condition.question];
    return Array.isArray(v) ? v.some(x => condition.values.includes(x)) : condition.values.includes(v);
  }
  function pilotDisabled(code, answers) {
    return /^(?:Defer|Drop|No view or opinion)(?:\.|$)/u.test(answers[code+'.q-v'] || '');
  }
  function relevant(q, answers, content) {
    if (q.indicator && q.id !== q.indicator+'.q-v' && pilotDisabled(q.indicator, answers)) return false;
    if (q.holder && !holds(answers[q.holder])) return false;
    if (q.coverage && !coverageRegion(answers,content)) return false;
    if (q.unless && answers[q.unless] === true) return false;
    if (q.when && !matches(q.when, answers)) return false;
    if (q.alsoWhen && !matches(q.alsoWhen, answers)) return false;
    if (q.whenChoiceRefs) {
      const parent = content.questions.find(p => p.id === q.whenChoiceRefs.question);
      const allowed = parent.options.filter(o => q.whenChoiceRefs.refs.includes(o.ref)).map(o => o.text);
      if (!matches({question: parent.id, values: allowed}, answers)) return false;
      return relevant(parent, answers, content);
    }
    return true;
  }
  function holds(value) { return ['Yes, we keep it','We keep something close to it (please describe)'].includes(value); }
  function coverageRegion(answers, content) {
    const options=content.questions.find(q=>q.id==='0.4').options;
    return options.slice(0,5).some(o=>o.text===answers['0.4']) ? answers['0.4'] : '';
  }
  function isRequired(q, answers) { return q.required || !!q.requiredAny?.some(c=>matches(c,answers)); }
  function screenVisible(screen, answers, content) {
    return !screen.id.startsWith('cp-') || content.indicators.some(i=>i.partsScreen===screen.id && !pilotDisabled(i.code, answers) && holds(answers[i.code+'.q-k']));
  }
  function normalizeChanges(content, before, patch) {
    const changes={...patch}, next={...before,...patch};
    const clear=id=>{if(has(next[id]))changes[id]='';};
    content.indicators.forEach(ind=>{
      const id=ind.code+'.q-k';
      if(Object.prototype.hasOwnProperty.call(patch,id) && !holds(patch[id])) {
        Object.keys(next).filter(k=>k.startsWith(ind.code+':part')).forEach(clear);
      }
    });
    // A changed scope requires a fresh coverage answer; do not reinterpret a saved number.
    if(Object.prototype.hasOwnProperty.call(patch,'0.4') && patch['0.4']!==before['0.4']) {
      content.questions.filter(q=>q.coverage && !Object.prototype.hasOwnProperty.call(patch,q.id)).forEach(q=>clear(q.id));
    }
    content.questions.filter(q=>q.id.endsWith(':SG.1')).forEach(q=>{
      if(Object.prototype.hasOwnProperty.call(patch,q.id) && !holds(patch[q.id])) {
        clear(q.id.replace(/SG\.1$/,'SG.2'));clear(q.id.replace(/SG\.1$/,'SG.3'));clear(q.id+':extra');
      }
    });
    return changes;
  }
  function valid(q, value) {
    if (!has(value)) return !q.required;
    if (q.type === 'text') return typeof value === 'string' && (!q.required || !!value.trim()) && words(value) <= 1500;
    if (q.type === 'check' || q.type === 'toggle') return typeof value === 'boolean';
    const options = q.options.map(o => o.text);
    if (q.type === 'choice') return typeof value === 'string' && options.includes(value);
    if (q.type === 'multi') return Array.isArray(value) && new Set(value).size === value.length && value.every(v => options.includes(v)) &&
      (!q.maxChoices || value.length <= q.maxChoices) && !(value.length > 1 && value.some(noView));
    return false;
  }
  function missing(content, answers, screen) {
    return content.questions.filter(q => (!screen || q.screen === screen) && relevant(q, answers, content) && !valid({...q,required:isRequired(q,answers)}, answers[q.id])).map(q => q.id);
  }
  function noView(value) { return typeof value === 'string' && /^No view or opinion(?:\.|$)/u.test(value); }
  function tally(q, responses, content) {
    const counts = {}; let n = 0;
    responses.filter(p => p.status === 'submitted' && p.review?.included !== false).forEach(p => {
      const value = p.answers[q.id];
      if (!relevant(q, p.answers, content) || !has(value) || noView(value) || Array.isArray(value) && value.some(noView)) return;
      n++;
      (Array.isArray(value) ? value : [String(value)]).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    });
    const max = Math.max(0, ...Object.values(counts));
    const modes = Object.keys(counts).filter(k => counts[k] === max);
    const agreement = n ? max / n : 0;
    return {counts, n, modes, agreement, shortlist: n >= 6 && agreement >= .75};
  }
  function office(response) {
    return response.answers['0.1'] === 'Other (specify)' ? response.answers['0.1:extra'] || 'Other (specify)' : response.answers['0.1'] || response.entry?.agency || '';
  }
  function csvCell(value) {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[\s]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  const api = {pilotDisabled, holds, coverageRegion, isRequired, screenVisible, normalizeChanges, words, has, relevant, valid, missing, noView, tally, office, csvCell};
  return api;
})();
// END EMBEDDED SERVER RULES

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
  Module20261102Entries: ['entryId', 'deviceHash', 'profile', 'createdAt'],
  Module20261102PublicSessions: ['tokenHash', 'entryId', 'deviceHash', 'expiresAt'],
  Module20261102Reviews: ['owner', 'included', 'reason', 'actor', 'reviewedAt'],
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
function validDevice_(device) {
  if (typeof device !== 'string' || !/^[a-zA-Z0-9-]{32,100}$/.test(device)) throw new Error('Please use the device where you started.');
  return hash_(device);
}
function entryProfile_(input) {
  if (!input || typeof input !== 'object') throw new Error('Please enter your email, name and agency.');
  const profile = {email: email_(input.email), name: String(input.name || '').trim(), agency: String(input.agency || '').trim()};
  if (profile.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new Error('Please enter a valid email address.');
  if (!profile.name || profile.name.length > 200) throw new Error('Please enter your name (up to 200 characters).');
  if (!profile.agency || profile.agency.length > 300) throw new Error('Please enter the agency you represent (up to 300 characters).');
  return profile;
}
function enterConsultation(input, device) {
  const profile = entryProfile_(input), deviceHash = validDevice_(device);
  return locked_(() => {
    ensureModule_();
    const entries = moduleRows_('Module20261102Entries');
    let entry = entries.find(e => e.deviceHash === deviceHash && e.profile === JSON.stringify(profile));
    if (!entry) {
      writable_();
      entry = {entryId: random_(), deviceHash, profile: JSON.stringify(profile), createdAt: new Date().toISOString()};
      // The profile is JSON-encoded so names or agencies cannot become Sheet formulas.
      sheet_('Module20261102Entries').appendRow([entry.entryId,deviceHash,entry.profile,entry.createdAt]);
    }
    const token = 'entry-' + random_(), expiresAt = new Date(Date.now()+30*24*60*60*1000).toISOString();
    sheet_('Module20261102PublicSessions').appendRow([hash_(token),entry.entryId,deviceHash,expiresAt]);
    return {token,profile};
  });
}
function participant_(token, device) {
  const deviceHash = validDevice_(device);
  if (typeof token !== 'string' || token.length > 200) throw new Error('Please enter your details to continue.');
  if (!token.startsWith('entry-')) return authenticate_(token,false); // Existing signed-in responses remain accessible.
  const session = moduleRows_('Module20261102PublicSessions').find(s => s.tokenHash === hash_(token) && Date.parse(s.expiresAt)>Date.now());
  if (!session || session.deviceHash !== deviceHash) throw new Error('Please enter your details on the device where you started.');
  const entry = moduleRows_('Module20261102Entries').find(e => e.entryId === session.entryId && e.deviceHash === deviceHash);
  if (!entry) throw new Error('Please enter your details to continue.');
  return {publicEntry:true,entryId:entry.entryId,profile:JSON.parse(entry.profile),admin:false};
}
function owner_(person, device) {
  if (typeof device !== 'string' || !/^[a-zA-Z0-9-]{32,100}$/.test(device)) throw new Error('Please use the device where you started.');
  return hash_(person.publicEntry ? (content_().storageVersion || content_().version) + ':entry:' + person.entryId : (content_().storageVersion || content_().version) + ':' + person.email + ':' + device);
}
function storedQuestionId_(raw, numericIds) {
  let id = String(raw);
  // New writes encode IDs as JSON strings so Sheets cannot turn "0.0" into 0.
  if (id.charAt(0) === '"') {
    try {
      const decoded = JSON.parse(id);
      if (typeof decoded === 'string') return decoded;
    } catch (error) { /* Preserve an unfamiliar historical ID rather than drop data. */ }
  }
  if (/^\d+(?:\.\d+)?$/.test(id)) {
    const candidates = numericIds[String(Number(id))];
    if (candidates && candidates.length === 1) return candidates[0];
  }
  return id;
}
function moduleState_(owner, revisions, fragments, includeHistory) {
  const state = {owner, version: 0, status: 'not started', answers: {}, savedAt: '', screen: 'welcome'};
  if(includeHistory)state.history=[];
  const history = (revisions || moduleRows_('Module20261102Revisions')).filter(r => r.owner === owner);
  const parts = (fragments || moduleRows_('Module20261102Changes')).filter(r => r.owner === owner);
  const numericIds = {};
  content_().questions.forEach(q => {
    if (/^\d+(?:\.\d+)?$/.test(q.id)) {
      const key = String(Number(q.id));
      if (!numericIds[key]) numericIds[key] = [];
      numericIds[key].push(q.id);
    }
  });
  history.forEach(r => {
    if (Number(r.version) !== state.version + 1) throw new Error('Response history needs secretariat attention.');
    const grouped = {};
    parts.filter(p => p.commitId === r.commitId).forEach(p => {
      const questionId = storedQuestionId_(p.questionId, numericIds);
      if (!grouped[questionId]) {
        grouped[questionId] = [];
      }
      grouped[questionId].push(p);
    });
    const revisionChanges={};
    Object.keys(grouped).forEach(qid => {
      const sorted = grouped[qid].sort((a,b) => Number(a.partIndex) - Number(b.partIndex));
      sorted.forEach((p,i) => { if (Number(p.partIndex) !== i) throw new Error('Incomplete answer record.'); });
      state.answers[qid] = JSON.parse(sorted.map(p => JSON.parse(p.fragment)).join(''));
      revisionChanges[qid]=state.answers[qid];
    });
    if(includeHistory)state.history.push({version:Number(r.version),savedAt:String(r.savedAt),status:r.status,changes:revisionChanges});
    state.version = Number(r.version); state.status = r.status; state.savedAt = String(r.savedAt); state.screen = String(r.screen);
  });
  return state;
}
function validateChanges_(changes) {
  if (!changes || Object.prototype.toString.call(changes) !== '[object Object]') throw new Error('Invalid answers.');
  const questions = Object.fromEntries([...(content_().legacyQuestions || []),...content_().questions].map(q => [q.id,q]));
  const cleaned = {};
  Object.keys(changes).forEach(id => {
    if (!questions[id]) throw new Error('Unknown question.');
    const q = questions[id], value = changes[id];
    if (value !== '' && value !== false && !(Array.isArray(value) && !value.length) && !NHETE_SERVER_RULES_.valid(q,value)) {
      throw new Error(q.type === 'text' ? 'Please keep your answer to 1,500 words or fewer.' : 'Invalid answer.');
    }
    if (value === false && !['check','toggle'].includes(q.type) || Array.isArray(value) && q.type !== 'multi' || value === '' && ['check','toggle','multi'].includes(q.type)) throw new Error('Invalid answer type.');
    cleaned[id] = value;
  });
  return cleaned;
}
function bootstrap(token, device) {
  const p = participant_(token,device);
  locked_(ensureModule_);
  const owner = owner_(p,device);
  let open = true; try { writable_(); } catch (_) { open = false; }
  const accountHash = hash_(p.publicEntry ? 'entry:'+p.entryId : p.email);
  const differentDevice = locked_(() => {
    const devices = moduleRows_('Module20261102Devices');
    const known = devices.filter(d => d.accountHash === accountHash && d.owner !== owner).map(d => d.owner);
    if (!devices.some(d => d.accountHash === accountHash && d.owner === owner)) sheet_('Module20261102Devices').appendRow([accountHash,owner]);
    return moduleRows_('Module20261102Revisions').some(r => known.includes(r.owner));
  });
  return {person: {admin: p.admin, entry: p.profile || null}, content: content_(), response: moduleState_(owner), open, differentDevice, closesAt: content_().closesAt};
}
function saveAnswers(token, request) {
  const person = participant_(token,request && request.device);
  if (!request || !/^[a-zA-Z0-9-]{8,100}$/.test(request.requestId || '')) throw new Error('Invalid save identifier.');
  const owner = owner_(person,request.device), changes = validateChanges_(request.changes);
  if (!content_().screens.some(s => s.id === request.screen)) throw new Error('Unknown screen.');
  return locked_(() => {
    const history = moduleRows_('Module20261102Revisions');
    const state = moduleState_(owner,history);
    if (history.some(r => r.owner === owner && r.requestId === request.requestId)) return {ok: true,response: state};
    writable_();
    if (Number(request.expectedVersion) !== state.version) return {ok: false,conflict: true,response: state};
    Object.assign(changes,NHETE_SERVER_RULES_.normalizeChanges(content_(),state.answers,changes));
    const answers = Object.assign({},state.answers,changes);
    const missing = NHETE_SERVER_RULES_.missing(content_(),answers,request.submit ? null : request.validateScreen || '__no_validation__');
    if (missing.length) return {ok:false,missing};
    const commit = random_(), rows = [];
    Object.keys(changes).forEach(qid => {
      const text = JSON.stringify(changes[qid]);
      for (let i=0;i<text.length;i+=12000) rows.push([owner,commit,JSON.stringify(qid),i/12000,JSON.stringify(text.slice(i,i+12000))]);
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
  return analysisData_();
}
function analysisData_() {
  const revisions = moduleRows_('Module20261102Revisions'), fragments = moduleRows_('Module20261102Changes');
  const entries = moduleRows_('Module20261102Entries'), reviews = moduleRows_('Module20261102Reviews');
  const entryOwners = Object.fromEntries(entries.map(e => [hash_((content_().storageVersion || content_().version)+':entry:'+e.entryId),JSON.parse(e.profile)]));
  const owners = [...new Set([...revisions.map(r => r.owner),...Object.keys(entryOwners)])];
  return {responses: owners.map(owner => {
    const state = moduleState_(owner,revisions,fragments,true);
    const review = reviews.filter(r => r.owner === owner).pop();
    return {...state,entry:entryOwners[owner] || null,review:review ? {included:truth_(review.included),reason:JSON.parse(review.reason),reviewedAt:String(review.reviewedAt)} : {included:true,reason:'',reviewedAt:''}};
  }), decisions: moduleRows_('Module20261102Decisions')};
}
function setEntryReview(token, input) {
  const actor = authenticate_(token,true);
  if (!input || typeof input.owner !== 'string' || typeof input.included !== 'boolean') throw new Error('Choose an entry and review action.');
  const reason = String(input.reason || '').trim();
  if (NHETE_SERVER_RULES_.words(reason)>1500) throw new Error('Keep the review reason to 1,500 words or fewer.');
  return locked_(() => {
    ensureModule_();
    const exists = moduleRows_('Module20261102Revisions').some(r => r.owner === input.owner) || moduleRows_('Module20261102Entries').some(e => hash_((content_().storageVersion || content_().version)+':entry:'+e.entryId) === input.owner);
    if (!exists) throw new Error('Entry not found.');
    sheet_('Module20261102Reviews').appendRow([input.owner,input.included,JSON.stringify(reason),actor.email,new Date().toISOString()]);
    return {ok:true};
  });
}
function recordDecision(token,input) {
  const actor = authenticate_(token,true);
  if (!input || !content_().questions.some(q => q.id === input.questionId)) throw new Error('Unknown question.');
  ['decision','reason'].forEach(k => { if (typeof input[k] !== 'string' || !input[k].trim() || NHETE_SERVER_RULES_.words(input[k])>1500) throw new Error('A decision and reason are required (up to 1,500 words each).'); });
  return locked_(() => { sheet_('Module20261102Decisions').appendRow([random_(),input.questionId,JSON.stringify(input.decision),JSON.stringify(input.reason),actor.email,new Date().toISOString()]);return {ok:true}; });
}
function signOut(token) {
  const hash = hash_(String(token || ''));
  locked_(() => {
    const name = String(token || '').startsWith('entry-') ? 'Module20261102PublicSessions' : 'Sessions';
    const s=sheet_(name), values=s.getDataRange().getValues();
    for(let i=values.length-1;i>0;i--) if(values[i][0]===hash) s.deleteRow(i+1);
  });
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
  if (!person.admin) throw new Error('This Google sign-in is for secretariat administrators only. Participants can enter their details on the entry form.');
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

// Private editor entry point; browser calls require verified secretariat access.
function refreshAnalysis(token) {
  authenticate_(token,true);
  return refreshAnalysis_();
}
function refreshAnalysis_() {
  return locked_(() => {
    ensureModule_();
    const at=new Date().toISOString(), book=SpreadsheetApp.openById(props_().getProperty('SPREADSHEET_ID'));
    const tables=NHETE_ANALYSIS_.build(content_(),analysisData_().responses,NHETE_SERVER_RULES_,at);
    const marker='NHETE_GENERATED_ANALYSIS_V1';
    // Verify ownership before touching any existing report tab.
    tables.forEach(t=>{const s=book.getSheetByName(t.name);if(s && s.getRange(1,1).getNote()!==marker)throw new Error('The tab '+t.name+' is not a generated analysis tab. Rename it before refreshing.');});
    tables.forEach(t=>{
      const s=book.getSheetByName(t.name) || book.insertSheet(t.name),height=t.rows.length,width=t.rows[0].length;
      if(s.getMaxRows()<height)s.insertRowsAfter(s.getMaxRows(),height-s.getMaxRows());
      if(s.getMaxColumns()<width)s.insertColumnsAfter(s.getMaxColumns(),width-s.getMaxColumns());
      if(s.getFilter())s.getFilter().remove();
      s.clearContents();
      const safe=value=>typeof value==='string' && /^[\s]*[=+@-]|^[\t\r\n]/u.test(value)?"'"+value:value;
      for(let start=0;start<height;start+=200)s.getRange(start+1,1,Math.min(200,height-start),width).setValues(t.rows.slice(start,start+200).map(row=>row.map(safe)));
      s.getRange(1,1).setNote(marker);
      s.setFrozenRows(1);s.setFrozenColumns(t.name==='Response Matrix'?2:0);
      s.getRange(1,1,height,width).setWrap(true).setVerticalAlignment('top');
      s.getRange(1,1,1,width).setBackground('#eeeeee').setFontWeight('bold');
      s.setColumnWidths(1,width,180);
      if(t.name==='Analysis Guide'){s.setColumnWidth(1,230);s.setColumnWidth(2,850);}
      else {
        if(height>1){
          s.getRange(1,1,height,width).createFilter();
          if(t.name==='Answers by Question')s.getFilter().setColumnFilterCriteria(14,SpreadsheetApp.newFilterCriteria().setHiddenValues(['Not applicable','Not answered']).build());
        }
        t.rows[0].forEach((header,i)=>{if(/Question asked|Question context|Answer$|Allowed answers|Display conditions|Answer choice|Part or statement/.test(header))s.setColumnWidth(i+1,360);});
      }
      if(t.name==='Choice Summary' && height>1)s.getRange(2,width,height-1,1).setNumberFormat('0.0%');
    });
    return {url:book.getUrl(),updatedAt:at};
  });
}

const NHETE_ANALYSIS_ = (function () {
  'use strict';
  function display(value) {
    if(value === undefined || value === null || value === '')return '';
    if(Array.isArray(value))return value.join('\n');
    return typeof value === 'boolean' ? (value?'Yes':'No') : String(value);
  }
  function build(content, responses, rules, at) {
    const screens=Object.fromEntries(content.screens.map(s=>[s.id,s]));
    const indicators=Object.fromEntries(content.indicators.map(i=>[i.code,i]));
    const parents={};content.questions.forEach(q=>{if(q.extra)parents[q.extra]=q;if(q.comment)parents[q.comment]=q;});
    const questions=content.questions.slice().sort((a,b)=>content.screens.indexOf(screens[a.screen])-content.screens.indexOf(screens[b.screen]));
    const meta=(q,response)=>{
      const parent=parents[q.id],screen=screens[q.screen],ind=indicators[q.indicator];
      const heading=screen.blocks.find(b=>b.type==='body' && /heading/i.test(b.row.kind));
      let label=q.label.text;
      if(q.coverage && response) {
        const region=rules.coverageRegion(response.answers,content);
        const national=region===content.questions.find(q=>q.id==='0.4').options[0].text;
        label=(content.templateBindings[national?'QSG.3n-label':'QSG.3-label'].text).replaceAll('[region]',region || 'the selected area');
      }
      return [q.id,content.stops.find(s=>s.id===screen.stop).name,heading?.row.text || q.screen,
        ind?ind.code+' — '+ind.title:'',q.component || q.rowLabel?.text || parent?.rowLabel?.text || '',label,
        q.rowDescription?.text || parent?.rowDescription?.text || parent?.label.text || ''];
    };
    const hasAnswer=(q,v)=>q.type==='check'||q.type==='toggle'?typeof v==='boolean':rules.has(v);
    const review=r=>r.review?.included===false?'Excluded':'Included';
    const eligible=r=>r.status==='submitted' && r.review?.included!==false;
    const identity=r=>[r.owner,r.entry?.name || 'Unlinked entry',r.entry?.email || '',r.entry?.agency || rules.office(r),r.status,review(r)];
    const identityHeaders=['Response ID','Name','Email','Agency','Response status','Review status'];
    const metaHeaders=['Question ID','Module section','Page','Indicator','Part or statement','Question asked','Question context'];
    const info=[['Item','Explanation'],['Updated at (UTC)',at],['Start here','Use Answers by Question to filter a question and see each respondent’s answer beside the actual question. Use Respondents for progress, Response Matrix for one row per response, and Choice Summary for counts.'],
      ['Snapshot','These analysis tabs are a snapshot. After deploying the updated app, use Secretariat → Refresh analysis sheets (or run refreshAnalysis_ in Apps Script) to rebuild them from the latest saved responses.'],
      ['Summary population','Choice Summary uses submitted, included responses only. Draft and excluded entries remain visible in the detail tabs with explicit status.'],
      ['Percentages','Share of answered uses all applicable answered responses, including No view or opinion. Multi-select percentages may total more than 100%. This is a descriptive count, not a TWG decision or consensus score.'],
      ['Blank vs skipped','Not answered means an applicable question has no answer. Not applicable means conditional rules hide or disable the question. Prior inactive answers remain in the original journal.'],
      ['Response IDs','Each row is a device-bound response, not necessarily a unique person. Repeated names/emails are not automatically combined. Unlinked entries have no matching public-entry profile.'],
      ['Question version','Question wording and applicability use the current deployed module. Retired question answers remain in the original journal; this report covers the active questionnaire.'],
      ['Long answers','Answers longer than 45,000 characters are split into numbered parts in Answers by Question. Response Matrix points there instead of truncating the answer.'],
      ['Editing','Analysis tabs are generated views. Put analyst notes in separate tabs because refresh replaces these views. Do not edit the original Module20261102 tabs.'],
      ['Responses',responses.length],['Submitted and included',responses.filter(eligible).length],['Draft',responses.filter(r=>r.status==='draft').length],['Excluded',responses.filter(r=>r.review?.included===false).length]];
    const respondents=[[...identityHeaders,'Last saved (UTC)','Last page','Applicable questions answered','Applicable required questions missing','Review reason']];
    const answers=[[...identityHeaders,...metaHeaders,'Answer status','Answer part','Answer','Last saved (UTC)']];
    const matrix=[[...identityHeaders,...questions.map(q=>{const m=meta(q);return [m[0],m[3],m[4],m[5],m[6]].filter(Boolean).join(' | ');})]];
    responses.forEach(r=>{
      const active=questions.filter(q=>rules.relevant(q,r.answers,content));
      respondents.push([...identity(r),r.savedAt || '',r.screen || '',active.filter(q=>hasAnswer(q,r.answers[q.id])).length,rules.missing(content,r.answers).length,r.review?.reason || '']);
      const wide=[...identity(r)];
      questions.forEach(q=>{
        const applies=rules.relevant(q,r.answers,content),answered=hasAnswer(q,r.answers[q.id]);
        const value=applies?display(r.answers[q.id]):'';
        const status=!applies?'Not applicable':answered?'Answered':'Not answered';
        const chunks=value.match(/[\s\S]{1,45000}/g) || [''];
        chunks.forEach((chunk,i)=>answers.push([...identity(r),...meta(q,r),status,(i+1)+' / '+chunks.length,chunk,r.savedAt || '']));
        wide.push(!applies?'[Not applicable]':!answered?'[Not answered]':chunks.length>1?'[Long answer: see Answers by Question]':value);
      });matrix.push(wide);
    });
    const guide=[[...metaHeaders,'Answer type','Allowed answers','When required','Display conditions']];
    questions.forEach(q=>guide.push([...meta(q),q.type,(q.options || []).map(o=>o.text).join('\n'),q.required?'Required when applicable':q.requiredAny?'Required for specified earlier choices':'Optional',
      [q.indicator && 'Follow-up fields and parts are skipped for Defer, Drop or No view or opinion.',q.holder && 'Only for indicators the office keeps or keeps something close to.',q.coverage && 'Only for pilot-region/national respondents with barangay-capable data.',q.when && 'Depends on '+q.when.question+': '+q.when.values.join(' / '),q.alsoWhen && 'Depends on '+q.alsoWhen.question+': '+q.alsoWhen.values.join(' / '),q.whenChoiceRefs && 'Depends on '+q.whenChoiceRefs.question].filter(Boolean).join('\n')]));
    const summary=[[...metaHeaders,'Answer choice','Respondents choosing this','Applicable submitted responses','Answered','Not answered','Share of answered']];
    questions.filter(q=>['choice','multi','check','toggle'].includes(q.type)).forEach(q=>{
      const applicable=responses.filter(r=>eligible(r)&&rules.relevant(q,r.answers,content));
      const answered=applicable.filter(r=>hasAnswer(q,r.answers[q.id]));
      const choices=['check','toggle'].includes(q.type)?[true,false]:q.options.map(o=>o.text);
      choices.forEach(choice=>{
        const n=answered.filter(r=>Array.isArray(r.answers[q.id])?r.answers[q.id].includes(choice):r.answers[q.id]===choice).length;
        summary.push([...meta(q),display(choice),n,applicable.length,answered.length,applicable.length-answered.length,answered.length?n/answered.length:'']);
      });
    });
    return [{name:'Analysis Guide',rows:info},{name:'Respondents',rows:respondents},{name:'Answers by Question',rows:answers},
      {name:'Choice Summary',rows:summary},{name:'Question Guide',rows:guide},{name:'Response Matrix',rows:matrix}];
  }
  const api={build};
  return api;
})();
