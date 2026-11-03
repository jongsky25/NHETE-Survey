"""Compile the November 3 Word snapshot over the preserved non-Stop-8 screen structure."""
import copy,gzip,json,re,base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'source/word-v20261103.json').read_text())
base=json.loads(gzip.decompress((ROOT/'source/runtime-v20261102.json.gz').read_bytes()))
rows={r['ref']:r for r in source['rows'] if r['ref']}
def row(ref):
 r={k:copy.deepcopy(rows[ref][k]) for k in ('ref','kind','text','paragraphs','images')}
 if ref in base['sourceTextAmendments']:
  r['text']=base['sourceTextAmendments'][ref]['text'];r['paragraphs']=[[{'text':r['text']}]]
 return r
def refresh(v):
 if isinstance(v,dict):
  if 'text' in v and v.get('ref') in rows:return row(v['ref'])
  return {k:refresh(x) for k,x in v.items()}
 if isinstance(v,list):return [refresh(x) for x in v]
 return v
c=refresh(base)
c['version']='v20261103';c['storageVersion']=base['version'];c['sourceSha256']=source['sha256']
c['legacyScreenMap']={s['id']:'mx-'+s['id'][4] for s in base['screens'] if s['id'].startswith('ind-')}
c['legacyScreenMap'].update({'s8-'+d+'0':'mx-'+d for d in 'ABCD'})
c['legacyScreenMap'].update({'s8t':'mx-A','s8g':'cp-A'})
c['screens']=[s for s in c['screens'] if s['stop']!=8 or s['id'] in ('s8a','s8b','s8-RF')]
c['questions']=[q for q in c['questions'] if not q['screen'].startswith('ind-')]
c['legacyQuestions']=[{k:q[k] for k in ('id','type','options','required') if k in q} for q in base['questions'] if q['screen'].startswith('ind-')]
c['templateBindings']={ref:row(ref) for ref in rows if ref.startswith(('MX.','CP.','QT.','QSG.','s8g.')) or ref=='T.o'}
c['ui']={ref:row(ref) for ref in rows if ref.startswith('D-')}
c.pop('notOursHelp',None)
def opts(prefix):return [row(ref) for ref in rows if re.fullmatch(re.escape(prefix)+r'-c\d+',ref)]
def question(id,prefix,screen,required=True,**attrs):
 q={'id':id,'ref':prefix+'-label','label':row(prefix+'-label'),'options':opts(prefix),'type':'choice','required':required,'screen':screen,'help':[row(prefix+'-help')] if prefix+'-help' in rows else [],**attrs}
 c['questions'].append(q);return q
def textq(id,label,screen,required=False,**attrs):
 q={'id':id,'label':row(label),'options':[],'type':'text','maxWords':1500,'required':required,'screen':screen,**attrs};c['questions'].append(q);return q
new=[]
for domain in 'ABCD':
 inds=[i for i in base['indicators'] if i['code'].startswith(domain)]
 mx={'id':'mx-'+domain,'stop':8,'blocks':[{'type':'body','row':row(domain+'0.'+str(n))} for n in (1,2,3)]}
 mx['blocks'].append({'type':'indicatorMatrix','ref':domain+'.mx','codes':[i['code'] for i in inds]})
 cp={'id':'cp-'+domain,'stop':8,'domain':domain,'blocks':[{'type':'body','row':row(domain+'.cp1')},{'type':'partsMatrix','ref':domain+'.cp2','codes':[i['code'] for i in inds]}]}
 new.extend([mx,cp])
 for old in inds:
  code=old['code'];ind=next(i for i in c['indicators'] if i['code']==code)
  ind['screen']=mx['id'];ind['partsScreen']=cp['id'];ind['title']=row(code+'.2')['text'];ind['rows']=[row(ref) for ref in rows if re.match(re.escape(code)+r'\.(?!p\d+$)',ref)]
  ind['parts']=[row(ref) for ref in rows if re.fullmatch(re.escape(code)+r'\.p\d+',ref)];ind['components']=[r['text'] for r in ind['parts']]
  oldScreen=next(s for s in base['screens'] if s['id']==old['screen'])
  research=next((b for b in oldScreen['blocks'] if b['type']=='research'),None)
  ind['research']=refresh(research) if research else None
  for suffix in ('v','c','w','k'):
   if suffix=='c' and code in ('B03','B08','B19','B20','B21','D03'):continue
   question(code+'.q-'+suffix,'QT.'+suffix,mx['id'],suffix!='w',shortOptions=suffix=='v',indicator=code)
  textq(code+'.q-o','T.o',mx['id'],requiredAny=[{'question':code+'.q-c','values':[row('QT.c-c3')['text']]},{'question':code+'.q-w','values':[row('QT.w-c8')['text']]},{'question':code+'.q-k','values':[row('QT.k-c2')['text']]}],indicator=code)
  for i,part in enumerate(ind['parts'],1):
   prefix=code+':part'+str(i)+':';attrs={'indicator':code,'component':part['text'],'holder':code+'.q-k'}
   q=question(prefix+'SG.1','QSG.1',cp['id'],**attrs)
   q.update(extra=prefix+'SG.1:extra',extraChoices=['QSG.1-c2'])
   textq(prefix+'SG.1:extra','D-mx.14',cp['id'],True,whenChoiceRefs={'question':q['id'],'refs':['QSG.1-c2']},**attrs)
   question(prefix+'SG.2','QSG.2',cp['id'],when={'question':q['id'],'values':[row('QSG.1-c1')['text'],row('QSG.1-c2')['text']]},**attrs)
   question(prefix+'SG.3','QSG.3',cp['id'],coverage=True,when={'question':q['id'],'values':[row('QSG.1-c1')['text'],row('QSG.1-c2')['text']]},alsoWhen={'question':prefix+'SG.2','values':[row('QSG.2-c'+str(n))['text'] for n in range(1,5)]},**attrs)
idx=next(i for i,s in enumerate(c['screens']) if s['id']=='s8-RF');c['screens'][idx:idx]=new
for stop in c['stops']:stop['screens']=[s['id'] for s in c['screens'] if s['stop']==stop['id']]
# Use the actual attached diagrams, including their binary bytes, not the old image cache.
for s in c['screens']:
 diagrams=[r for r in source['rows'] if not r['ref'] and r['context'].startswith('Screen '+s['id']+' ')]
 for b in s['blocks']:
  if b['type']=='body' and 'diagram' in b['row']['kind'].lower():
   d=diagrams.pop(0);b['row']={k:d[k] for k in ('ref','kind','text','paragraphs','images')}
assert len(c['indicators'])==35 and sum(len(i['parts']) for i in c['indicators'])==74
assert len({q['id'] for q in c['questions']})==len(c['questions'])
(ROOT/'development/content.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
packed=base64.b64encode(gzip.compress(json.dumps(c,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
(ROOT/'apps-script/Content.gs').write_text('// Generated from the November 3 Word module. See source/word-v20261103.json and AUDIT.md.\nconst NHETE_CONTENT = JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(\''+packed+'\'))).getDataAsString());\n')
print('Built',len(c['screens']),'screens,',len(c['questions']),'fields, 35 indicators, 74 parts')
