# Editable Apps Script browser sources

These sources drive the current Google Apps Script app; the repository root's static shell is older.

Run `npm run build` from the repository root to generate content.json and the deployable files under apps-script/. Serve this directory for a local browser demonstration with `?demo=1`. The demonstration stores fabricated/test answers only in that browser.

The Word snapshot and source audit are in ../source/. Code.gs is edited directly in ../apps-script/; its validation rules are rebuilt from domain.js. Do not edit the generated Client.html, Styles.html or Content.gs independently.
