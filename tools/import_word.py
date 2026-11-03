"""Extract literal Word rows, formatting, diagrams and builder notes; never execute notes."""
import base64, hashlib, json, mimetypes, re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def extract(path):
 with ZipFile(path) as z:
  root=ET.fromstring(z.read('word/document.xml'))
  rels={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
  def txt(e):return ''.join(t.text or '' for t in e.findall('.//w:t',NS))
  def row(cell):
   paragraphs=[]
   for p in cell.findall('.//w:p',NS):
    runs=[]
    for r in p.findall('.//w:r',NS):
     text=''.join(t.text or '' if t.tag.endswith('}t') else '\n' if t.tag.endswith('}br') else '\t' for t in r if t.tag.rsplit('}',1)[-1] in ('t','br','tab'))
     if not text:continue
     run={'text':text}
     for name,key in [('b','bold'),('i','italic')]:
      prop=r.find('w:rPr/w:'+name,NS)
      if prop is not None and prop.get('{'+NS['w']+'}val','true') not in ('0','false'):run[key]=True
     if r.find('w:rPr/w:u',NS) is not None:run['glossary']=True
     runs.append(run)
    paragraphs.append(runs)
   images=[]
   for blip in cell.findall('.//a:blip',NS):
    target=rels[blip.get('{'+NS['r']+'}embed')];name='word/'+target
    images.append({'path':name,'data':'data:'+ (mimetypes.guess_type(name)[0] or 'image/png')+';base64,'+base64.b64encode(z.read(name)).decode()})
   return {'text':'\n'.join(''.join(r['text'] for r in p) for p in paragraphs),'paragraphs':paragraphs,'images':images}
  rows=[]; context='';prose=[]
  for node in root.find('w:body',NS):
   if node.tag.endswith('}p'):
    text=txt(node)
    if text:prose.append(text)
    if re.match(r'(Screen |Row |Stop |Part |Domain )',text):context=text
   elif node.tag.endswith('}tbl'):
    for tr in node.findall('w:tr',NS)[1:]:
     cells=tr.findall('w:tc',NS)
     if len(cells)<3:raise ValueError('Unexpected table')
     ref=txt(cells[0]).strip();kind=txt(cells[1]);data=row(cells[2])
     rows.append({'ref':ref,'kind':kind,**data,'note':txt(cells[3]) if len(cells)>3 else '', 'context':context})
  refs=[r['ref'] for r in rows if r['ref']]
  assert len(refs)==len(set(refs)), 'Duplicate references'
  return {'filename':Path(path).name,'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'rows':rows,'prose':prose}
if __name__=='__main__':
 import sys
 result=extract(sys.argv[1]);out=Path(sys.argv[2])
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(len(result['rows']),'rows;',sum(bool(r['ref']) for r in result['rows']),'named references;',sum(len(r['images']) for r in result['rows']),'images')
