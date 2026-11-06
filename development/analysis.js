/* Read-only analysis projection. The response journal remains authoritative. */
(function (root) {
  'use strict';
  function display(value) {
    if(value === undefined || value === null || value === '')return '';
    if(Array.isArray(value))return value.join('\n');
    return typeof value === 'boolean' ? (value?'Yes':'No') : String(value);
  }
  function build(content, responses, rules, at) {
    responses=responses.map(r=>({...r,answers:rules.normalizeAnswers(content,r.answers)}));
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
      ['Snapshot','These analysis tabs are a snapshot. After deploying the updated app, use Secretariat → Refresh analysis sheets (or run runAnalysisRefresh in Apps Script) to rebuild them from the latest saved responses.'],
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
  root.NheteAnalysis=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
