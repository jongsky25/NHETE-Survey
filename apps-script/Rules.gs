/* Shared document-driven rules. No rendering or Google dependencies. */
(function (root) {
  'use strict';
  function words(value) { return String(value || '').match(/\S+/gu)?.length || 0; }
  function has(value) { return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '' && value !== false; }
  function matches(condition, answers) {
    const v = answers[condition.question];
    return Array.isArray(v) ? v.some(x => condition.values.includes(x)) : condition.values.includes(v);
  }
  function relevant(q, answers, content) {
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
  function valid(q, value) {
    if (!has(value)) return !q.required;
    if (q.type === 'text') return typeof value === 'string' && words(value) <= 1500;
    if (q.type === 'check' || q.type === 'toggle') return typeof value === 'boolean';
    const options = q.options.map(o => o.text);
    if (q.type === 'choice') return typeof value === 'string' && options.includes(value);
    if (q.type === 'multi') return Array.isArray(value) && new Set(value).size === value.length && value.every(v => options.includes(v)) &&
      (!q.maxChoices || value.length <= q.maxChoices) && !(value.length > 1 && value.some(noView));
    return false;
  }
  function missing(content, answers, screen) {
    return content.questions.filter(q => (!screen || q.screen === screen) && relevant(q, answers, content) && !valid(q, answers[q.id])).map(q => q.id);
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
  const api = {words, has, relevant, valid, missing, noView, tally, office, csvCell};
  root.NheteRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
