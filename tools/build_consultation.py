"""Build the standalone facilitator HTML from the current questionnaire."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
c=json.loads((R/'development/content.json').read_text())
keep=('version','questions','screens','stops','indicators','templateBindings')
data={k:c[k] for k in keep}
# Keep question text and context; discard irrelevant legacy/runtime source metadata.
html=(R/'consultation/index.template.html').read_text()
for key,value in {'CSS':(R/'consultation/room.css').read_text(),'DATA':json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'),'RULES':(R/'development/domain.js').read_text(),'APP':(R/'consultation/room.js').read_text()}.items():
 html=html.replace('__'+key+'__',value)
out=R/'consultation/dist';out.mkdir(exist_ok=True)
(out/'index.html').write_text(html)
print('Built offline Consultation Room:',len(html.encode()),'bytes')
