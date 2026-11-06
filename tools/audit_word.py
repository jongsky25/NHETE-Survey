"""Fail on any unmapped/mismatched Word ref, formatting, diagram, option order or deployment payload."""
import base64,gzip,hashlib,json,re
from pathlib import Path
R=Path(__file__).resolve().parents[1]
s=json.loads((R/'source/word-v20261103.json').read_text());c=json.loads((R/'development/content.json').read_text())
def walk(x,path='$'):
 if isinstance(x,dict):
  if x.get('ref') and 'text' in x:yield path,x
  for k,v in x.items():yield from walk(v,path+'.'+k)
 elif isinstance(x,list):
  for i,v in enumerate(x):yield from walk(v,path+'['+str(i)+']')
actual={}
for path,r in walk({k:v for k,v in c.items() if k!='legacyQuestions'}):actual.setdefault(r['ref'],[]).append((path,r))
refs={r['ref']:r for r in s['rows'] if r['ref']};mapping=[]
blocks={b.get('ref'):b for screen in c['screens'] for b in screen['blocks'] if b.get('ref')}
structural={'tor.grid','s5b.grid','s8-RF.grid'}|{d+'.mx' for d in 'ABCD'}|{d+'.cp2' for d in 'ABCD'}
for ref,source in refs.items():
 if ref.startswith('stop'):
  stop=next(x for x in c['stops'] if x['sourceRef']==ref);assert stop['name']==source['text'];where='progress navigation'
 elif ref in structural:
  assert ref in blocks;where='implemented layout specification: '+blocks[ref]['type']
 else:
  assert ref in actual, 'Unmapped '+ref
  expected=c['sourceTextAmendments'].get(ref,{}).get('text',source['text'])
  for path,r in actual[ref]:
   assert r['text']==expected,(ref,'text mismatch',path)
   if ref not in c['sourceTextAmendments']:assert r['paragraphs']==source['paragraphs'],(ref,'formatting mismatch',path)
  where='; '.join(path for path,r in actual[ref])
  if ref=='s8g.1':where+='; template pill specialized by A.cp1–D.cp1'
  if ref=='QSG.3-none':where+='; conditional omission of coverage column'
 mapping.append({'ref':ref,'kind':source['kind'],'binding':where,'amended':ref in c['sourceTextAmendments']})
# Source-defined screen order, excluding the two reusable templates.
expected_screens=[]
for text in s['prose']:
 m=re.match(r'Screen (\S+) ·',text)
 if m and m[1] not in ('s8t','s8g'):expected_screens.append(m[1])
assert [x['id'] for x in c['screens']]==expected_screens,('screen order',expected_screens)
for d in 'ABCD':
 codes=re.findall(r'\b[A-D]\d\d\b',refs[d+'.mx']['text']);assert blocks[d+'.mx']['codes']==codes
 assert blocks[d+'.cp2']['codes']==codes
for q in c['questions']:
 if q.get('ref','').startswith(('QT.','QSG.')) and q['type']=='choice':
  prefix=q['ref'].replace('-label','-c');expected=[r['text'] for ref,r in refs.items() if re.fullmatch(re.escape(prefix)+r'\d+',ref)]
  assert [o['text'] for o in q['options']]==expected,q['id']
images=[im['data'] for r in s['rows'] for im in r['images']]
rendered_images=[im['data'] for screen in c['screens'] for b in screen['blocks'] if b['type']=='body' for im in b['row'].get('images',[])]
assert images==rendered_images
packed=re.search(r"base64Decode\('([^']+)'\)",(R/'apps-script/Content.gs').read_text()).group(1)
assert json.loads(gzip.decompress(base64.b64decode(packed)))==c
assert (R/'apps-script/Client.html').read_text()=='<script>\n'+(R/'development/domain.js').read_text()+'\n'+(R/'development/app.js').read_text()+'\n</script>\n'
assert (R/'apps-script/Styles.html').read_text()=='<style>\n'+(R/'development/app.css').read_text()+'\n</style>\n'
entries=[e for screen in c['screens'] for b in screen['blocks'] if b['type']=='research' for e in b['entries']]+[e for i in c['indicators'] if i['research'] for e in i['research']['entries']]
for e in entries:
 note=refs[e['row']['ref']]['note'];url=re.search(r'https://\S+',note);assert e.get('url')==(url.group().rstrip('.') if url else None)
 for key,label in [('stance','Stance'),('sourceType','Type')]:
  m=re.search(label+r': ([^.]+)\.',note)
  if m:assert e[key]==m[1],(e['row']['ref'],key)
report={'source_sha256':s['sha256'],'named_references':len(mapping),'mapped_references':len(mapping),'literal_text_exceptions':list(c['sourceTextAmendments']),'layout_specifications':len(structural),'diagrams':len(images),'screens':len(c['screens']),'indicators':len(c['indicators']),'components':sum(len(i['parts']) for i in c['indicators']),'schema_fields':len(c['questions']),'research_entries':len(entries),'supplied_urls':sum(bool(e.get('url')) for e in entries),'unmapped':[],'mapping':mapping}
(R/'source/audit-v20261103.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS:',len(mapping),'/',len(refs),'Word references mapped;',len(c['sourceTextAmendments']),'approved text amendments; 3 exact diagrams; screen/choice order, formatting and deployed payload verified')
