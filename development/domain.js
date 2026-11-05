/* Shared document-driven rules. No rendering or Google dependencies. */
(function (root) {
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
  root.NheteRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
