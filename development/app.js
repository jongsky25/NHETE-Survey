'use strict';
(async function () {
  const main = document.getElementById('main'), badge = document.getElementById('saveState');
  const boot = window.NHETE_BOOT || {}, rules = window.NheteRules;
  const demo = !window.google?.script?.run && new URLSearchParams(location.search).get('demo') === '1';
  let token = sessionStorage.getItem('nhete-token') || localStorage.getItem('nhete-public-token') || '', data, content, qmap, screenIndex = 0, furthest = 0;
  let dirty = {}, busy = false, timer, retry = null, conflict = false, storedKey, device;
  const adviceOpen = new Set();
  let viewRestoreGeneration=0;
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (['disabled','hidden','checked'].includes(key)) node[key] = !!value;
      else node.setAttribute(key,value);
    });
    children.flat().forEach(child => { if (child != null) node.append(typeof child === 'string' ? document.createTextNode(child) : child); });
    return node;
  }
  function ui(ref) { return content?.ui[ref]?.text || ref; }
  function answers() { return {...data.response.answers,...dirty}; }
  function currentScreen() { return content.screens[screenIndex]; }
  function status(text) { badge.textContent = text; }
  function notice(text, bringIntoView=false) {
    let out = document.getElementById('notice');
    if (!out) { out = el('div',{id:'notice',role:'alert',class:'error'}); main.prepend(out); }
    out.textContent = text;
    if(bringIntoView) {
      out.tabIndex=-1;
      out.focus({preventScroll:true});
      out.scrollIntoView({block:'start'});
    }
  }
  function showMissing(ids) {
    main.querySelectorAll('.question-error').forEach(node=>node.remove());
    main.querySelectorAll('.invalid-question').forEach(node=>node.classList.remove('invalid-question'));
    main.querySelectorAll('[aria-invalid="true"]').forEach(node=>node.removeAttribute('aria-invalid'));
    notice(ui('D-nav.4'));
    let first;
    ids.forEach(id=>{
      const group=main.querySelector('[data-question-id="'+id+'"]');
      if(!group)return;
      group.classList.add('invalid-question');
      group.querySelectorAll('input,textarea,select').forEach(input=>input.setAttribute('aria-invalid','true'));
      const error=el('p',{class:'question-error',role:'alert',text:ui('D-nav.4')});
      if(group.tagName==='TR')group.closest('.table-wrap').before(error);
      else group.append(error);
      if(!first)first=group;
    });
    if(first) {
      first.querySelector('summary,input:not(:disabled),textarea:not(:disabled),select:not(:disabled):not([hidden])')?.focus({preventScroll:true});
      first.scrollIntoView({block:'start'});
    }
  }
  function action(text, fn, attrs) {
    return el('button',{type:'button',class:'btn ghost',text,...attrs,onclick:async e => {
      const b=e.currentTarget; b.disabled=true;
      try { await fn(); } catch(err) { notice(err.message,true); } finally { if (b.isConnected) b.disabled=false; updateNavigation(); }
    }});
  }
  function rpc(name,...args) {
    if (demo) return demoRpc(name,args);
    return new Promise((resolve,reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(e => reject(new Error(e.message || 'Could not save. Please try again.')))[name](...args));
  }
  function persist() {
    localStorage.setItem(storedKey,JSON.stringify({response:data.response,dirty,screen:currentScreen()?.id,furthest,moduleVersion:content.version}));
  }
  function glossaryRow(term) {
    return content.glossary.find(row => {
      const match = row.kind.match(/[“"](.+?)[”"]/u);
      return (match?.[1] || row.ref.replace('GL-','')).toLowerCase() === term.toLowerCase();
    });
  }
  function glossary(term) {
    const row = glossaryRow(term); if (!row) return;
    const previous = document.activeElement, dialog=el('dialog',{'aria-label':term,class:'glossary-dialog'});
    dialog.append(el('h2',{text:term}),el('div',{},rich(row,false)),action('Close',() => dialog.close()));
    dialog.addEventListener('close',() => {dialog.remove();previous?.focus();});
    document.body.append(dialog);dialog.showModal();
  }
  function textWithGlossary(text, enabled) {
    const fragment=document.createDocumentFragment();
    if (!enabled || !content) { fragment.append(document.createTextNode(text));return fragment; }
    const terms=content.glossary.map(r => r.kind.match(/[“"](.+?)[”"]/u)?.[1] || r.ref.replace('GL-','')).sort((a,b)=>b.length-a.length);
    const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const regex=new RegExp('(?<![\\p{L}\\p{N}])('+terms.map(escape).join('|')+')(?![\\p{L}\\p{N}])','giu');
    let start=0;
    for (const m of text.matchAll(regex)) {
      fragment.append(document.createTextNode(text.slice(start,m.index)));
      fragment.append(el('button',{type:'button',class:'glossary-word',text:m[0],onclick:e=>{e.preventDefault();e.stopPropagation();glossary(m[0]);}}));
      start=m.index+m[0].length;
    }
    fragment.append(document.createTextNode(text.slice(start)));return fragment;
  }
  function rich(row, enabled=true) {
    const fragment=document.createDocumentFragment();
    const paragraphs=row.paragraphs?.length ? row.paragraphs : [[{text:row.text || ''}]];
    paragraphs.forEach((p,i) => {
      if(i) fragment.append(el('br'));
      p.forEach(run => {
        const parent=run.bold ? el('strong') : document.createDocumentFragment();
        const inner=run.italic?el('em'):document.createDocumentFragment();
        inner.append(textWithGlossary(run.text,enabled));parent.append(inner);fragment.append(parent);
      });
    });
    return fragment;
  }
  function sourceText(row,tag='p',attrs={}) {
    return el(tag,{'data-source-ref':row.ref,...attrs},rich(row));
  }
  function applyGlossaryRules(card) {
    const explained=new Set();
    // Explicit source references keep this editorial rule deterministic.
    const definitions={
      's5b.4':['service-ready'], 's4b.3':['indicator','domain'],
      's4c.5':['red flags'], 's4c.3':['cut-off'], 's8b.9':['No view or opinion'],
      'welcome.3':['NHETE'], 'welcome.5':['No view or opinion'],
      's2a.3':['Unserved and Underserved Communities'], 's2a.5':['NHETE'],
      'consent.3':['BLHSD'], 's4a-1.5':['domain'], 's4a-2.6':['domain'],
      's4a-1.11':['4Ps'], 's4d.3':['pilot'], 's5c.3':['big choices'],
      's5d.3':['short list','No view or opinion'], 's7e.3':['Unserved and Underserved Communities','P1 to P4'],
      's5a.6':['ground rules'], 's5a.7':['big choices'], 's5b.3':['ground rules']
    };
    card.querySelectorAll('[data-source-ref]').forEach(node=>{
      (definitions[node.dataset.sourceRef] || []).forEach(term=>explained.add(term.toLowerCase()));
      // Definitions and expanded acronyms can also occur inside formatted runs.
      const text=node.textContent.toLowerCase();
      content.glossary.filter(r=>!/^GL-[A-D]\d\d$/.test(r.ref)).forEach(row=>{
        const term=(row.kind.match(/[“"](.+?)[”"]/u)?.[1] || row.ref.replace('GL-','')).toLowerCase();
        const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const definition=row.text.split('.')[0].toLowerCase();
        if(new RegExp('(?:^|[.!?]\\s+)(?:an? |the )?'+escaped+' (?:is|are|means|stands for)\\b').test(text) ||
          (text.includes(term) && definition.length>15 && text.includes(definition)))explained.add(term);
      });
    });
    const seen=new Set();
    card.querySelectorAll('.glossary-word').forEach(button=>{
      const term=button.textContent.toLowerCase(), indicator=/^[a-d]\d\d$/.test(term);
      const heading=button.closest('h1,h2,h3,h4,h5,h6,th,legend,summary,caption,.matrix-label,.tile-heading,.pill,strong[data-source-ref]');
      if(heading || button.closest('.matrix-mobile-help') && window.innerWidth>=900 || !indicator && (explained.has(term) || seen.has(term)))button.replaceWith(document.createTextNode(button.textContent));
      else if(!indicator)seen.add(term);
    });
  }
  function captureView() {
    const active=document.activeElement;
    const scope=active?.closest('[data-question-id],[data-view-key]');
    return {
      screen:currentScreen().id,x:window.scrollX,y:window.scrollY,
      scrolls:Array.from(main.querySelectorAll('[data-scroll-key]')).map(node=>({key:node.dataset.scrollKey,left:node.scrollLeft,top:node.scrollTop})),
      panels:Array.from(main.querySelectorAll('details[data-view-key]')).map(node=>({key:node.dataset.viewKey,open:node.open})),
      active:scope&&/^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(active.tagName)?{
        question:scope.dataset.questionId,view:scope.dataset.viewKey,
        tag:active.tagName,name:active.name,value:active.value,id:active.id,top:active.getBoundingClientRect().top
      }:null
    };
  }
  function redrawInPlace(view=captureView()) {
    const generation=++viewRestoreGeneration;
    // Hold the page height while replacing its contents to prevent the browser
    // from clamping the document scroll position to the temporarily empty page.
    main.style.minHeight=main.offsetHeight+'px';
    render();
    function restore() {
      if(currentScreen().id!==view.screen || generation!==viewRestoreGeneration)return;
      const panels=Array.from(main.querySelectorAll('details[data-view-key]'));
      view.panels.forEach(saved=>{const node=panels.find(p=>p.dataset.viewKey===saved.key);if(node)node.open=saved.open;});
      const scrolls=Array.from(main.querySelectorAll('[data-scroll-key]'));
      view.scrolls.forEach(saved=>{
        const node=scrolls.find(p=>p.dataset.scrollKey===saved.key);
        if(node){node.scrollLeft=saved.left;node.scrollTop=saved.top;}
      });
      window.scrollTo(view.x,view.y);
      if(view.active) {
        const saved=view.active;
        const scopes=Array.from(main.querySelectorAll('[data-question-id],[data-view-key]'));
        const scope=scopes.find(n=>saved.question?n.dataset.questionId===saved.question:n.dataset.viewKey===saved.view);
        const control=scope&&Array.from(scope.querySelectorAll('input,textarea,select,button,summary')).find(n=>
          n.tagName===saved.tag && (saved.id?n.id===saved.id:n.name===saved.name&&n.value===saved.value));
        if(control){
          control.focus({preventScroll:true});
          // Saving status can change the header's height. Keep the selected
          // control at the same viewport position rather than moving the user.
          window.scrollBy(0,control.getBoundingClientRect().top-saved.top);
        }
      }
    }
    restore();
    requestAnimationFrame(()=>{
      if(generation!==viewRestoreGeneration)return;
      main.style.minHeight='';
      restore();
    });
  }
  function setAnswer(qid,value,redraw=false) {
    const view=redraw?captureView():null;
    dirty={...dirty,...rules.normalizeChanges(content,answers(),{[qid]:value})};persist();status('Saving…');
    if(rules.valid({...qmap[qid],required:rules.isRequired(qmap[qid],answers())},value)) {
      const group=main.querySelector('[data-question-id="'+qid+'"]');
      group?.classList.remove('invalid-question');
      group?.querySelectorAll('[aria-invalid="true"]').forEach(node=>node.removeAttribute('aria-invalid'));
      group?.querySelectorAll('.question-error').forEach(node=>node.remove());
    }
    clearTimeout(timer);timer=setTimeout(()=>flush().catch(e=>notice(e.message)),2200);
    if(redraw)redrawInPlace(view);
    else updateNavigation();
  }
  function activeQuestions(screen=currentScreen()) {
    return content.questions.filter(q=>q.screen===screen.id && rules.relevant(q,answers(),content));
  }
  function updateNavigation() {
    if(!content || !data || conflict)return;
    const next=document.getElementById('next');
    if(next) next.disabled=busy || currentScreen().id==='consent' && answers()['0.0']!==true || activeQuestions().some(q=>q.type==='text' && rules.words(answers()[q.id])>1500);
  }
  async function flush(options={}) {
    clearTimeout(timer);
    if(conflict) throw new Error('Review the newer revision before continuing.');
    if(busy) throw new Error('Please wait for the current save to finish.');
    if(!Object.keys(dirty).length && !options.advance && !options.submit && !retry)return true;
    if(!data.open)throw new Error('The module is closed.');
    const invalid=Object.keys(dirty).filter(id=>!qmap[id] || !rules.valid({...qmap[id],required:false},dirty[id]));
    if(invalid.length)throw new Error('Please keep each answer to 1,500 words or fewer.');
    busy=true;updateNavigation();
    try {
      // Request identifiers survive uncertain replies. Limit transport batches, not answer length.
      do {
        let request=retry;
        if(!request) {
          const patch={};let size=0;
          for(const [id,value] of Object.entries(dirty)) {
            const n=JSON.stringify(value).length;
            if(size && size+n>100000)break;
            patch[id]=value;size+=n;
          }
          request={requestId:crypto.randomUUID(),device,expectedVersion:data.response.version,changes:patch,screen:currentScreen().id};
        }
        retry=request;
        const result=await rpc('saveAnswers',token,request);
        if(result.conflict){retry=null;showConflict(result.response);return false;}
        if(result.missing){retry=null;showMissing(result.missing);return false;}
        if(!result.ok)throw new Error('Could not confirm the save.');
        data.response=result.response;
        Object.entries(request.changes).forEach(([id,value])=>{if(JSON.stringify(dirty[id])===JSON.stringify(value))delete dirty[id];});
        retry=null;persist();
      } while(Object.keys(dirty).length);
      if(options.advance || options.submit) {
        const target=options.submit ? 'end1' : options.advance;
        const request={requestId:crypto.randomUUID(),device,expectedVersion:data.response.version,changes:{},screen:target,
          validateScreen:currentScreen().id,submit:!!options.submit};
        retry=request;
        const result=await rpc('saveAnswers',token,request);
        retry=null;
        if(result.conflict){showConflict(result.response);return false;}
        if(result.missing){showMissing(result.missing);return false;}
        if(!result.ok)throw new Error('Could not confirm the save.');
        data.response=result.response;persist();
      }
      status(ui('D-nav.3'));return true;
    } catch(err){status('Save not confirmed');throw err;}finally{busy=false;updateNavigation();}
  }
  function showConflict(latest) {
    conflict=true;status('Newer revision found');
    main.replaceChildren(el('section',{class:'card'},el('h1',{text:'Review a newer saved revision'}),
      el('p',{text:'Another tab changed this response. Your unsaved edits remain on this device.'}),
      el('pre',{text:JSON.stringify({saved:latest.answers,pending:dirty},null,2)}),
      action('Use the newer saved answers',()=>{if(!confirm('Discard this tab’s pending edits?'))return;data.response=latest;dirty={};conflict=false;persist();render();}),
      action('Apply my pending edits to the newer revision',async()=>{data.response=latest;conflict=false;persist();await flush();render();})));
  }
  function field(q,compact=false) {
    const value=answers()[q.id];
    const group=el('fieldset',{'data-question-id':q.id,disabled:!data.open,class:compact?'compact-question':'question'});
    if(!compact)group.append(el('legend',{'data-source-ref':q.label.ref},rich(q.label)));
    q.help?.forEach(row=>group.append(sourceText(row,'p',{class:'help'})));
    if(q.type==='text') {
      const id='answer-'+q.id,input=el('textarea',{id,rows:'4','aria-label':q.label.text,disabled:!data.open});input.value=value || '';
      const count=el('p',{class:'word-count',text:rules.words(value)+' / 1,500 words','aria-live':'polite'});
      input.oninput=()=>{setAnswer(q.id,input.value);const n=rules.words(input.value);count.textContent=n+' / 1,500 words';count.classList.toggle('over',n>1500);};
      group.append(input,count);
    } else if(q.type==='toggle') {
      group.replaceChildren(action(q.label.text,()=>setAnswer(q.id,!value,true),{'aria-pressed':String(!!value),class:!!value?'btn':'btn ghost',disabled:!data.open}));
      if(content.notOursHelp)group.append(el('p',{class:'help',text:content.notOursHelp}));
    } else {
      const selected=Array.isArray(value)?value:[];
      const options=q.type==='check' ? q.options.slice(0,1) : q.options;
      options.forEach(option=>{
        const type=['multi','check'].includes(q.type)?'checkbox':'radio';
        const input=el('input',{type,name:q.id,value:option.text,checked:q.type==='check'?value===true:q.type==='multi'?selected.includes(option.text):value===option.text,
          'aria-label':option.text,disabled:!data.open || q.type==='multi' && selected.some(rules.noView) && !rules.noView(option.text)});
        input.onchange=()=>{
          let next=option.text;
          if(q.type==='check')next=input.checked;
          if(q.type==='multi') {
            if(input.checked && rules.noView(option.text))next=[option.text];
            else next=input.checked?[...selected,option.text]:selected.filter(v=>v!==option.text);
            if(q.maxChoices && next.length>q.maxChoices){input.checked=false;notice(ui('D-nav.5'));return;}
          }
          setAnswer(q.id,next,true);
        };
        group.append(el('label',{class:'opt'},input,el('span',{'data-source-ref':option.ref},rich(option))));
      });
    }
    if(q.extra && rules.relevant(qmap[q.extra],answers(),content)) {
      const extra=qmap[q.extra];
      const chosen=q.options.find(o=>(Array.isArray(value)?value:[value]).includes(o.text) && q.extraChoices.includes(o.ref));
      group.append(field({...extra,label:chosen || extra.label}));
    }
    return group;
  }
  function grid(block) {
    const choices=qmap[block.rows[0]].options, red=block.ref==='s8-RF.grid';
    const table=el('table',{class:'response-grid'},el('caption',{'data-source-ref':block.prompt.ref},rich(block.prompt)),el('thead',{},el('tr',{},el('th',{scope:'col',text:red?'Red flag':block.ref==='tor.grid'?'Part':'Code and ground rule'}),red?null:el('th',{scope:'col',text:block.ref==='tor.grid'?'What it says':'What it means, in plain words with an example'}),choices.map(o=>el('th',{scope:'col','data-source-ref':o.ref},rich(o))),el('th',{scope:'col','data-source-ref':qmap[qmap[block.rows[0]].comment].label.ref,text:qmap[qmap[block.rows[0]].comment].label.text}))));
    const tbody=el('tbody');
    block.rows.forEach(id=>{
      const q=qmap[id],value=answers()[id],comment=qmap[q.comment];
      const tr=el('tr',{'data-question-id':id},el('th',{scope:'row','data-source-ref':q.rowLabel.ref},rich(q.rowLabel)),red?null:el('td',{'data-source-ref':q.rowDescription?.ref},q.rowDescription?rich(q.rowDescription):rich(q.label)));
      q.options.forEach(o=>{
        const radio=el('input',{type:'radio',name:id,value:o.text,checked:value===o.text,disabled:!data.open,'aria-label':q.rowLabel.text+' — '+o.text,onchange:()=>setAnswer(id,o.text,true)});
        tr.append(el('td',{'data-choice':o.text},radio));
      });
      tr.append(el('td',{},rules.relevant(comment,answers(),content)?field(comment,true):null));tbody.append(tr);
    });
    table.append(tbody);return el('div',{class:'table-wrap','data-scroll-key':block.ref},table);
  }
  function template(ref) { return content.templateBindings[ref] || content.ui[ref]; }
  function substituted(row,region) {
    return {...row,text:row.text.replaceAll('[region]',region),paragraphs:row.paragraphs.map(p=>p.map(r=>({...r,text:r.text.replaceAll('[region]',region)})))};
  }
  function matrixField(q) {
    const value=answers()[q.id], required=rules.isRequired(q,answers());
    if(q.type==='text') {
      const group=field(q,true), input=group.querySelector('textarea');
      group.classList.add('matrix-question');group.prepend(sourceText(q.label,'div',{class:'matrix-label'}));
      input.required=required;
      let placeholders=[];
      if(q.id.endsWith('.q-o')) {
        const code=q.indicator;
        if(answers()[code+'.q-c']===qmap[code+'.q-c']?.options[2].text)placeholders.push('D-mx.6');
        if(answers()[code+'.q-w']===qmap[code+'.q-w'].options[7].text)placeholders.push('D-mx.7');
        if(answers()[code+'.q-k']===qmap[code+'.q-k'].options[1].text)placeholders.push('D-mx.13');
      } else placeholders.push('D-mx.14');
      if(!placeholders.length)placeholders=['D-mx.11'];
      input.placeholder=placeholders.map(ui).join(' ');input.dataset.placeholderRefs=placeholders.join(' ');
      if(required)group.append(el('span',{class:'small',text:'Required'}));
      return group;
    }
    const group=el('fieldset',{'data-question-id':q.id,class:'matrix-question',disabled:!data.open});
    group.append(sourceText(q.label,'legend',{class:'matrix-label'}));
    q.help?.forEach(r=>group.append(sourceText(r,'p',{class:'help matrix-mobile-help'})));
    const select=el('select',{id:'answer-'+q.id,name:q.id,'aria-label':(q.indicator?q.indicator+' — ':'')+q.label.text,disabled:!data.open});
    select.required=required;
    select.append(el('option',{value:'',text:ui('D-mx.1'),'data-source-ref':'D-mx.1'}));
    q.options.forEach(o=>select.append(el('option',{value:o.text,text:o.text,'data-source-ref':o.ref})));
    select.value=value || '';select.onchange=()=>setAnswer(q.id,select.value,true);
    // Native option popups cannot wrap reliably. Use an in-flow disclosure
    // with native radios; retain a hidden select for value synchronization.
    select.hidden=true;select.tabIndex=-1;select.required=false;
    const picker=el('details',{class:'choice-picker'});
    const summary=el('summary',{id:'choice-'+q.id,'aria-label':select.getAttribute('aria-label')+' — '+(value || ui('D-mx.1')),text:value?(q.shortOptions?value.split('.')[0]:value):ui('D-mx.1')});
    picker.append(summary);
    const options=el('div',{class:'choice-options',role:'radiogroup','aria-label':select.getAttribute('aria-label')});
    q.options.forEach(o=>{
      const radio=el('input',{type:'radio',name:'choice-'+q.id,value:o.text,checked:value===o.text,disabled:!data.open,
        onchange:()=>{picker.open=false;summary.focus({preventScroll:true});select.value=o.text;setAnswer(q.id,o.text,true);}});
      options.append(el('label',{class:'choice-option'},radio,el('span',{'data-source-ref':o.ref,text:o.text})));
    });
    picker.append(options);picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;summary.focus();}});
    group.append(select,picker);
    if(q.extra && rules.relevant(qmap[q.extra],answers(),content))group.append(matrixField(qmap[q.extra]));
    return group;
  }
  function matrixHeading(ref) {
    const th=el('th',{scope:'col'},sourceText(template(ref),'span'));
    const help=ref.endsWith('-label')?content.templateBindings[ref.replace('-label','-help')]:null;
    if(help)th.append(sourceText(help,'p',{class:'help matrix-desktop-help'}));
    return th;
  }
  function labelled(row,labelRef,label) {
    const p=el('p');
    if(labelRef)p.append(sourceText(content.ui[labelRef],'strong'),' ');
    else if(label)p.append(el('strong',{text:label}),' ');
    p.append(sourceText(row,'span'));return p;
  }
  function indicatorMatrix(block) {
    const table=el('table',{class:'indicator-matrix'},el('thead',{},el('tr',{},['MX.h1','MX.h2','QT.v-label','QT.c-label','QT.w-label','QT.k-label','T.o'].map(matrixHeading))));
    const tbody=el('tbody');
    block.codes.forEach(code=>{
      const ind=content.indicators.find(i=>i.code===code), rows=Object.fromEntries(ind.rows.map(r=>[r.ref,r]));
      const tr=el('tr',{'data-indicator':code});
      tr.append(el('th',{scope:'row',class:'matrix-code'},sourceText(rows[code+'.code'],'span')));
      const detailsCell=el('td',{class:'indicator-details'},sourceText(rows[code+'.2'],'h2'),sourceText(rows[code+'.3']));
      if(rows[code+'.7'])detailsCell.append(labelled(rows[code+'.7'],'D-mx.2'));
      if(rows[code+'.8'])detailsCell.append(labelled(rows[code+'.8'],'D-mx.3'));
      const details=el('details',{'data-view-key':'indicator:'+code},el('summary',{'data-source-ref':'D-mx.5',text:ui('D-mx.5')}));
      ind.rows.filter(r=>r.kind.startsWith('More about') && !r.ref.includes('.ev')).forEach(r=>{
        const labelRef=r.kind.includes('(D-mx.')?r.kind.match(/\((D-mx\.\d+)\)/)[1]:null;
        const label=r.kind.endsWith('where it is used')?'Where it is used:':r.kind.endsWith('what it is made of')?'What it is made of:':null;
        const node=labelled(r,labelRef,label);if(r.kind.includes('watch-out'))node.classList.add('note');details.append(node);
      });
      if(ind.research)details.append(research({...ind.research,key:code}));
      detailsCell.append(details);tr.append(detailsCell);
      ['v','c','w','k','o'].forEach(suffix=>{
        const q=qmap[code+'.q-'+suffix];
        let control=q?matrixField(q):null;
        if(control && suffix!=='v' && rules.pilotDisabled(code,answers())) {
          control.classList.add('pilot-disabled');control.setAttribute('aria-disabled','true');control.inert=true;
          control.querySelectorAll('input,select,textarea,button').forEach(node=>{node.disabled=true;node.required=false;});
          control.querySelectorAll('details').forEach(node=>{node.open=false;});
        }
        tr.append(el('td',{class:'matrix-answer'},q?control:el('div',{class:'not-needed'},sourceText(template('QT.c-label'),'div',{class:'matrix-label'}),sourceText(content.ui['D-mx.4'],'span'))));
      });
      tbody.append(tr);
    });
    table.append(tbody);return el('div',{class:'table-wrap matrix-wrap','data-scroll-key':block.ref},table);
  }
  function partsMatrix(block) {
    const region=rules.coverageRegion(answers(),content), national=region===qmap['0.4'].options[0].text;
    const section=el('section',{class:'parts-section'});
    ['s8g.2','s8g.3'].forEach(ref=>section.append(sourceText(template(ref),ref==='s8g.2'?'h1':'p')));
    if(region)section.append(sourceText(substituted(template(national?'s8g.3n':'s8g.3r'),region)));
    section.append(sourceText(template('s8g.4')));
    const first=content.screens.find(s=>s.id.startsWith('cp-') && rules.screenVisible(s,answers(),content));
    if(first?.id===currentScreen().id)section.append(sourceText(template('s8g.5'),'p',{class:'note'}));
    const head=['CP.h1','CP.h2','QSG.2-label'];
    const headings=head.map(matrixHeading);
    if(region){const ref=national?'QSG.3n-label':'QSG.3-label';const h=matrixHeading(ref);h.firstChild.replaceWith(sourceText(substituted(template(ref),region),'span'));headings.push(h);}
    const table=el('table',{class:'parts-matrix'},el('thead',{},el('tr',{},headings))),tbody=el('tbody');
    block.codes.filter(code=>!rules.pilotDisabled(code,answers()) && rules.holds(answers()[code+'.q-k'])).forEach(code=>{
      const ind=content.indicators.find(i=>i.code===code);
      ind.parts.forEach((part,i)=>{
        const prefix=code+':part'+(i+1)+':';
        const tr=el('tr',{'data-part':code+'.p'+(i+1)},el('th',{scope:'row',class:'matrix-code'},el('span',{},textWithGlossary(code,true)),el('div',{class:'small',text:ind.title})),el('td',{class:'part-name'},sourceText(part,'span')));
        ['SG.2',...(region?['SG.3']:[])].forEach(suffix=>{
          let q=qmap[prefix+suffix];
          if(suffix==='SG.3') {
            const ref=national?'QSG.3n':'QSG.3';q={...q,label:substituted(template(ref+'-label'),region),help:[template(ref+'-help')]};
          }
          tr.append(el('td',{class:'matrix-answer'},rules.relevant(q,answers(),content)?matrixField(q):el('div',{class:'not-needed'},el('span',{text:'This question is only applicable for datasets that can produce barangay-level data'}))));
        });
        tbody.append(tr);
      });
    });
    table.append(tbody);section.append(el('div',{class:'table-wrap matrix-wrap','data-scroll-key':block.ref},table));return section;
  }
  function renderBody(row) {
    const kind=row.kind.toLowerCase();
    if(kind.includes('progress label'))return sourceText(row,'p',{class:'pill'});
    if(kind.includes('heading'))return sourceText(row,'h1');
    if(kind.includes('diagram'))return el('figure',{'data-source-ref':row.ref || 'diagram'},row.images.map(im=>el('img',{src:im.data,alt:im.path.endsWith('image1.png')?'NHETE classification and prioritization framework':'Priority levels P1 to P4 and their meanings',class:'document-diagram'})));
    if(kind.includes('tile: big'))return sourceText(row,'h3',{class:'tile-heading'});
    if(kind.includes('tile: caption'))return sourceText(row,'p',{class:'tile-caption'});
    if(kind.includes('box title'))return sourceText(row,'h2');
    if(kind.includes('where we think the data sits'))return sourceText(row,'p',{class:'data-source','aria-label':'Proposed data source'});
    if(kind.includes('bullet'))return el('ul',{class:'plain'},sourceText(row,'li'));
    return sourceText(row,'p',{class:kind.includes('note')?'note':kind.includes('small grey')?'help':''});
  }
  function research(block) {
    const details=el('details',{class:'research','data-view-key':'research:'+(block.key || currentScreen().id)},el('summary',{'data-source-ref':'D-res.1',text:ui('D-res.1')}),el('p',{class:'help','data-source-ref':'D-res.2',text:ui('D-res.2')}));
    block.entries.forEach(entry=>{
      const article=el('article',{class:'research-entry'},el('p',{class:'small',text:[entry.stance,entry.sourceType].filter(Boolean).join(' · ')}),sourceText(entry.row));
      if(entry.url)article.append(el('a',{href:entry.url,target:'_blank',rel:'noopener noreferrer','data-source-ref':'D-res.10',text:ui('D-res.10')}));
      if(entry.access && !entry.access.includes('not checked'))article.append(el('p',{class:'small',text:/free to read/i.test(entry.access)?ui('D-res.11'):/subscription/i.test(entry.access)?ui('D-res.12'):entry.access}));
      details.append(article);
    });
    details.append(el('p',{class:'small','data-source-ref':'D-res.13',text:ui('D-res.13')}));return details;
  }
  async function go(index,back=false) {
    while(index>=0 && index<content.screens.length && !rules.screenVisible(content.screens[index],answers(),content))index+=back?-1:1;
    if(index<0 || index>=content.screens.length)return;
    const missing=!back?rules.missing(content,answers(),currentScreen().id):[];
    if(missing.length){showMissing(missing);return;}
    if(!data.open) {screenIndex=index;furthest=Math.max(furthest,index);render();return;}
    const next=content.screens[index];
    const submit=next.id==='end1';
    if(await flush(back?{}:{advance:next.id,submit})) {
      screenIndex=index;furthest=Math.max(furthest,index);persist();render();main.focus();window.scrollTo(0,0);
    }
  }
  function render() {
    if(conflict)return;
    main.replaceChildren();
    const screen=currentScreen();
    if(demo)main.append(el('p',{class:'readonly',text:'Demonstration — responses stay in this browser; nothing is sent to Google.'}));
    if(!data.open)main.append(el('p',{class:'readonly',text:'The module is closed.'}));
    const nav=el('nav',{class:'section-nav','aria-label':'Module stops'});
    content.stops.forEach(stop=>{
      const index=content.screens.findIndex(s=>s.stop===stop.id);
      nav.append(action(stop.name,()=>go(index,true),{disabled:index>furthest,'aria-current':screen.stop===stop.id?'step':'false','data-source-ref':stop.sourceRef}));
    });
    if(data.differentDevice && !sessionStorage.getItem('nhete-device-notice')) {
      main.append(el('p',{class:'note',text:ui('D-nav.6')}));sessionStorage.setItem('nhete-device-notice','shown');
    }
    main.append(nav);
    const card=el('section',{class:'card module-screen'+(screen.id.startsWith('mx-')||screen.id.startsWith('cp-')?' matrix-screen':''),'data-screen-id':screen.id});
    screen.blocks.forEach(block=>{
      if(block.type==='body')card.append(renderBody(block.row));
      else if(block.type==='question') {
        const q=qmap[block.id];if(rules.relevant(q,answers(),content))card.append(field(q));
      } else if(block.type==='grid')card.append(grid(block));
      else if(block.type==='indicatorMatrix')card.append(indicatorMatrix(block));
      else if(block.type==='partsMatrix')card.append(partsMatrix(block));
      else if(block.type==='research')card.append(research(block));
      else if(block.type==='advice' && rules.has(answers()[block.after])) {
        const box=el('div',{class:'advice-control','data-view-key':'advice:'+block.row.ref});
        box.append(action(ui('D-adv.1'),()=>{adviceOpen.add(block.row.ref);redrawInPlace();},{'data-source-ref':'D-adv.1'}));
        if(adviceOpen.has(block.row.ref))box.append(el('div',{class:'advice'},el('p',{class:'small','data-source-ref':'D-adv.2',text:ui('D-adv.2')}),sourceText(block.row)));
        card.append(box);
      }
    });
    main.append(card);
    applyGlossaryRules(card);
    if(screen.id!=='end1') {
      const submit=screen.blocks.find(b=>b.type==='submit');
      main.append(el('div',{class:'page-actions'},action(ui('D-nav.2'),()=>go(screenIndex-1,true),{disabled:screenIndex===0,'data-source-ref':'D-nav.2'}),el('span',{class:'spacer'}),
        action(submit?.row.text || ui('D-nav.1'),()=>go(screenIndex+1),{id:'next',class:'btn','data-source-ref':submit?.row.ref || 'D-nav.1'})));
    } else {main.append(sourceText(content.ui['D-end.1'],'p',{role:'status'}),action('Exit module',leaveModule));}
    document.getElementById('signout').hidden=false;
    document.getElementById('signout').textContent=data.person.admin?'Secretariat':'Exit module';
    document.getElementById('signout').onclick=()=> (data.person.admin?showAdmin():leaveModule()).catch(e=>notice(e.message,true));
    updateNavigation();
  }
  function table(headers,rows) {
    return el('div',{class:'table-wrap'},el('table',{},el('thead',{},el('tr',{},headers.map(text=>el('th',{scope:'col',text})))),el('tbody',{},rows.map(row=>el('tr',{},row.map(value=>el('td',{},value instanceof Node?value:String(value ?? ''))))))));
  }
  function download(filename,rows) {
    const text='\ufeff'+rows.map(row=>row.map(rules.csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=el('a',{href:url,download:filename});
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function showAdmin() {
    if(!await flush())return;
    const result=await rpc('adminData',token);
    const included=result.responses.filter(r=>r.review?.included!==false);
    main.replaceChildren(action('Return to module',render),el('h1',{text:'Secretariat'}),
      el('p',{text:'Email, name and agency are self-reported. All entries are included by default. Exclude unsuitable entries to remove them from summaries and analytical exports; their original answers remain available in the all-entry export.'}));
    main.append(el('h2',{text:'Entry review'}),table(['Name','Email','Agency represented','Office in questionnaire','Role','Response status','Review status','Reason','Action'],result.responses.map(r=>{
      const accepted=r.review?.included!==false;
      const reason=el('input',{type:'text','aria-label':'Review reason for '+(r.entry?.name || rules.office(r) || r.owner),placeholder:'Optional reason'});reason.value=r.review?.reason || '';
      const button=action(accepted?'Exclude':'Restore',async()=>{
        await rpc('setEntryReview',token,{owner:r.owner,included:!accepted,reason:reason.value});await showAdmin();
      });
      return [r.entry?.name || '',r.entry?.email || '',r.entry?.agency || '',rules.office(r),r.answers['0.2'] || '',r.status,accepted?'Included':'Excluded',reason,button];
    })));

    const analysisStatus=el('p',{class:'small',role:'status'});
    main.append(action('Refresh analysis sheets',async()=>{
      const report=await rpc('refreshAnalysis',token);
      analysisStatus.replaceChildren('Analysis sheets updated. ',el('a',{href:report.url,target:'_blank',rel:'noopener noreferrer',text:'Open the response workbook'}));
    }),analysisStatus);

    const rows=content.questions.filter(q=>['choice','multi','check'].includes(q.type)).map(q=>{
      const t=rules.tally(q,included,content);return [q.id,q.label.text,t.n,t.modes.join(' / '),t.n?Math.round(t.agreement*100)+'%':'',t.shortlist?'Proposed shortlist':'Discuss',JSON.stringify(t.counts)];
    });
    main.append(el('h2',{text:'Agreement summaries'}),table(['Reference','Question','With a view','Most common','Agreement','Route','Counts'],rows));
    const dataRows=content.indicators.map(ind=>{
      const relevant=included.filter(r=>r.status==='submitted' && !rules.pilotDisabled(ind.code,r.answers));
      const notOurs=relevant.filter(r=>r.answers[ind.code+'.q-k']==='No, we do not keep it').map(rules.office);
      const unsure=relevant.filter(r=>r.answers[ind.code+'.q-k']==='I do not know').map(rules.office);
      const holders=relevant.filter(r=>rules.holds(r.answers[ind.code+'.q-k'])).map(rules.office);
      return [ind.code,ind.title,[...new Set(holders)].join('; '),[...new Set(notOurs)].join('; '),[...new Set(unsure)].join('; '),holders.length?'Custodian reported':'BLHSD follow-up: no confirmed custodian'];
    });
    main.append(el('h2',{text:'Data custodians and follow-up'}),table(['Indicator','Title','Offices reporting data','Offices reporting not ours','Possibly held / unsure','Follow-up'],dataRows));
    const exportResponses=(list,archive=false)=>[['Response ID','Name','Email','Agency represented','Office','Status','Included','Review reason','Saved at',...content.questions.map(q=>q.id),...(archive?['All stored answers JSON','Revision history JSON']:[])]].concat(list.map(r=>[
      r.owner,r.entry?.name || '',r.entry?.email || '',r.entry?.agency || '',rules.office(r),r.status,r.review?.included!==false?'Yes':'No',r.review?.reason || '',r.savedAt,
      ...content.questions.map(q=>rules.relevant(q,r.answers,content)?r.answers[q.id] ?? '':''),...(archive?[r.answers,r.history || []]:[])]));
    main.append(action('Export included responses',()=>download('NHETE-November-responses.csv',exportResponses(included))),
      action('Export all entries (including excluded)',()=>download('NHETE-November-all-entries.csv',exportResponses(result.responses,true))),
      action('Export component availability',()=>download('NHETE-November-component-availability.csv',
        [['Agency','Status','Indicator','Component','Question','Region','Answer']].concat(included.flatMap(r=>content.questions.filter(q=>q.indicator && rules.relevant(q,r.answers,content)).map(q=>[rules.office(r),r.status,q.indicator,q.component,q.id,q.region || '',r.answers[q.id] ?? '']))))),
      action('Export BLHSD follow-up',()=>download('NHETE-November-BLHSD-follow-up.csv',[['Indicator','Title','Offices reporting data','Not ours','Possibly held / unsure','Follow-up'],...dataRows])));
    const comments=[];
    included.forEach(r=>content.questions.filter(q=>q.type==='text' && rules.relevant(q,r.answers,content) && r.answers[q.id]).forEach(q=>comments.push([rules.office(r),r.status,q.id,r.answers[q.id]])));
    main.append(el('h2',{text:'Office-attributed comments'}),table(['Office','Status','Reference','Answer'],comments));
    const select=el('select',{'aria-label':'Decision question'});
    content.questions.filter(q=>['choice','multi'].includes(q.type)).forEach(q=>select.append(el('option',{value:q.id,text:q.id+' · '+q.label.text})));
    const decision=el('textarea',{'aria-label':'Adopted decision'}),reason=el('textarea',{'aria-label':'Decision reason'});
    main.append(el('h2',{text:'Adopted TWG decisions'}),select,decision,reason,action('Record decision',async()=>{
      await rpc('recordDecision',token,{questionId:select.value,decision:decision.value,reason:reason.value});await showAdmin();
    }),table(['Question','Decision','Reason','Recorded at'],result.decisions.map(d=>[d.questionId,JSON.parse(d.decision),JSON.parse(d.reason),d.savedAt])));
  }
  async function load() {
    dirty={};furthest=0;retry=null;conflict=false;
    data=await rpc('bootstrap',token,device);content=data.content;qmap=Object.fromEntries([...(content.legacyQuestions || []),...content.questions].map(q=>[q.id,q]));
    storedKey='nhete:'+(content.storageVersion || content.version)+':'+data.response.owner;
    const saved=JSON.parse(localStorage.getItem(storedKey) || 'null');
    if(saved) {
      dirty=saved.dirty || {};furthest=saved.furthest || 0;
      const resume=content.legacyScreenMap[saved.screen] || saved.screen;
      const index=content.screens.findIndex(s=>s.id===resume);screenIndex=Math.max(0,index);
      if(saved.moduleVersion!==content.version)furthest=screenIndex;
      if(saved.response.version!==data.response.version && Object.keys(dirty).length){showConflict(data.response);return;}
    } else screenIndex=Math.max(0,content.screens.findIndex(s=>s.id===(content.legacyScreenMap[data.response.screen] || data.response.screen)));
    if(!rules.screenVisible(currentScreen(),answers(),content))screenIndex=Math.max(0,screenIndex-1);
    if(data.person.entry && data.response.version===0 && !rules.has(answers()['0.1'])) {
      const agency=data.person.entry.agency;
      const option=qmap['0.1'].options.find(o=>o.text.toLowerCase()===agency.toLowerCase());
      dirty['0.1']=option?option.text:'Other (specify)';
      if(!option)dirty['0.1:extra']=agency;
    }
    furthest=Math.max(furthest,screenIndex);persist();render();status(data.response.version?ui('D-nav.3'):'');
  }
  async function leaveModule() {
    if(!await flush())return;
    await rpc('signOut',token);
    sessionStorage.removeItem('nhete-token');localStorage.removeItem('nhete-public-token');token='';
    login();
  }
  function login(message) {
    main.replaceChildren(el('section',{class:'card intro'},el('h1',{text:'NHETE indicator consultation'})));
    document.getElementById('signout').hidden=true;
    const card=main.firstChild;
    if(message)card.append(el('p',{class:'error',role:'alert',text:message}));
    card.append(el('p',{text:'Enter your details to begin. No account activation or Google sign-in is needed. Entries will be reviewed by the secretariat.'}));
    const form=el('form',{'aria-label':'Participant entry'});
    const fields={};
    for(const [name,label,type,max] of [['email','Email address','email',254],['name','Name','text',200],['agency','Agency represented','text',300]]) {
      fields[name]=el('input',{id:'entry-'+name,name,type,maxlength:String(max),autocomplete:name==='agency'?'organization':name});fields[name].required=true;
      form.append(el('label',{for:'entry-'+name,class:'proposal-label',text:label}),fields[name]);
    }
    const remembered=JSON.parse(localStorage.getItem('nhete-entry-profile') || 'null');
    if(remembered)Object.keys(fields).forEach(k=>{fields[k].value=remembered[k] || '';});
    form.append(el('p',{class:'help',text:'Your email, name, agency and answers will be recorded for secretariat review. Email addresses are self-reported.'}));
    const start=el('button',{type:'submit',class:'btn',text:'Begin consultation'});form.append(start);
    form.onsubmit=async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      start.disabled=true;
      try {
        const profile=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));
        const result=await rpc('enterConsultation',profile,device);
        token=result.token;sessionStorage.removeItem('nhete-token');localStorage.setItem('nhete-public-token',token);
        localStorage.setItem('nhete-entry-profile',JSON.stringify(result.profile));
        await load();main.focus();window.scrollTo(0,0);
      }catch(err){notice(err.message,true);}finally{start.disabled=false;}
    };
    if(window.google?.script?.run)card.append(form,action('Secretariat sign-in',()=>adminLogin()));
    else card.append(el('p',{text:'Live entries are collected through the Apps Script deployment.'}),el('a',{href:'?demo=1',class:'btn',text:'Explore a demonstration'}));
  }
  function adminLogin() {
    main.replaceChildren(el('section',{class:'card intro'},el('h1',{text:'Secretariat sign-in'}),
      el('p',{text:'Google sign-in is required for the protected secretariat dashboard.'})));
    main.firstChild.append(action('Continue with Google',async()=>{
      const verifier=crypto.randomUUID()+crypto.randomUUID();sessionStorage.setItem('nhete-oauth-verifier',verifier);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
      const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
      sessionStorage.setItem('nhete-admin-intent','true');
      const url=await rpc('beginGoogleSignIn',hash);main.firstChild.append(el('a',{href:url,target:'_top',class:'btn',text:'Continue to Google'}));
    }),action('Return to participant entry',()=>login()));
  }
  let demoResponse={owner:'demonstration',version:0,status:'not started',answers:{},savedAt:'',screen:'welcome'};
  async function demoRpc(name,args) {
    if(name==='bootstrap') {
      const res=await fetch('content.json');if(!res.ok)throw new Error('Could not load content.');
      const stored=JSON.parse(localStorage.getItem('nhete-demo:'+device) || 'null');if(stored)demoResponse=stored;
      return {content:await res.json(),person:{admin:true},response:structuredClone(demoResponse),open:true};
    }
    if(name==='saveAnswers') {
      const r=args[1];if(r.expectedVersion!==demoResponse.version)return {ok:false,conflict:true,response:structuredClone(demoResponse)};
      const patch=rules.normalizeChanges(content,demoResponse.answers,r.changes);
      const next={...demoResponse.answers,...patch};
      const missing=rules.missing(content,next,r.submit?null:r.validateScreen || '__none__');if(missing.length)return {ok:false,missing};
      demoResponse={owner:'demonstration',version:demoResponse.version+1,status:r.submit?'submitted':Object.keys(r.changes).length?'draft':demoResponse.status,answers:next,savedAt:new Date().toISOString(),screen:r.screen};
      localStorage.setItem('nhete-demo:'+device,JSON.stringify(demoResponse));return {ok:true,response:structuredClone(demoResponse)};
    }
    if(name==='adminData')return {responses:[structuredClone(demoResponse)],decisions:[]};
    if(name==='setEntryReview'){demoResponse.review={included:args[1].included,reason:args[1].reason};localStorage.setItem('nhete-demo:'+device,JSON.stringify(demoResponse));return {ok:true};}
    if(name==='recordDecision')throw new Error('Use the live deployment to record adopted decisions.');
    return true;
  }
  window.addEventListener('beforeunload',e=>{if(Object.keys(dirty).length || busy){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{if(data&&!conflict)flush().catch(e=>notice(e.message));});
  try {
    device=localStorage.getItem('nhete-device-id');
    if(!device){device=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem('nhete-device-id',device);}
    if(boot.pending) {
      token=await rpc('completeGoogleSignIn',boot.pending,sessionStorage.getItem('nhete-oauth-verifier') || '');
      sessionStorage.removeItem('nhete-oauth-verifier');sessionStorage.setItem('nhete-token',token);
    }
    if(demo||token) {
      await load();
      if(data.person.admin && sessionStorage.getItem('nhete-admin-intent')==='true') {sessionStorage.removeItem('nhete-admin-intent');await showAdmin();}
    }else login(boot.error);
  } catch(err){login(err.message);}
})();
