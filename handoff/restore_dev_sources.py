"""Recover local preview sources from the published Apps Script deployment files.
Uses only Python's standard library. Never overwrites an existing nonempty folder.
This recovers runtime content, not the original Word document or its audit manifest.
"""
import argparse
import base64
import gzip
import json
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='/tmp/nhete-development')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
source = repo / 'apps-script'
output = Path(args.output).resolve()
if output.exists() and any(output.iterdir()):
    raise SystemExit('Output folder is not empty. Choose a new --output path; nothing was overwritten.')

client = (source / 'Client.html').read_text()
body = client[client.index('<script>') + len('<script>'):client.rindex('</script>')].strip('\n')
marker = "'use strict';\n(async function () {"
boundary = body.index(marker)
domain = body[:boundary].rstrip() + '\n'
app = body[boundary:].rstrip() + '\n'
styles = (source / 'Styles.html').read_text()
styles = styles[styles.index('<style>') + len('<style>'):styles.rindex('</style>')].strip('\n') + '\n'
packed = re.search(r"base64Decode\('([^']+)'\)", (source / 'Content.gs').read_text()).group(1)
content = json.loads(gzip.decompress(base64.b64decode(packed)))
assert len(content['screens']) == 81 and len(content['indicators']) == 35
index = (source / 'Index.html').read_text()
index = index.replace('<?!= HtmlService.createHtmlOutputFromFile("Styles").getContent(); ?>', '<link rel="stylesheet" href="app.css">')
index = index.replace('<?!= HtmlService.createHtmlOutputFromFile("Client").getContent(); ?>', '<script src="domain.js"></script>\n<script src="app.js"></script>')
index = index.replace('<?!= boot ?>', "{pending: '', error: ''}")
index = index.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">')
output.mkdir(parents=True, exist_ok=True)
for name, text in {'domain.js': domain, 'app.js': app, 'app.css': styles, 'index.html': index}.items():
    (output / name).write_text(text)
(output / 'content.json').write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')
shutil.copytree(source, output / 'apps-script')
(output / 'RECOVERED-SOURCES.md').write_text('''# Recovered runtime sources

These files were recovered from the published Apps Script deployment folder.
Run `python -m http.server 8860 --bind 127.0.0.1` here for a local preview.
Append `?demo=1` to run the browser-only module demonstration.

- app.js: participant UI, open-entry form, review dashboard and demo adapter.
- domain.js: shared validation and aggregation rules.
- app.css: styling.
- content.json: complete runtime module, including embedded diagrams.
- apps-script/: original deployable files.

The original Word source and full source-manifest.json are not reconstructed.
Do not claim a fresh Word-parity audit without obtaining those sources.
The original test suite is not part of this recovery; reconstruct targeted tests
or request the private development snapshot/original documents as needed.

For deployment, publish files under apps-script/, not the static preview index.
If editing extracted browser code, rebuild Client.html with one script tag
containing domain.js followed by app.js. Wrap app.css in a style tag for Styles.html.
Content.gs uses base64-encoded gzip JSON. Keep Code.gs's embedded server validation in
sync with domain.js if validation rules change. Read HANDOFF.md in the repository.
''')
print('Recovered runtime sources into:', output)
print('Module:', content['version'], '| Screens:', len(content['screens']), '| Indicators:', len(content['indicators']))
