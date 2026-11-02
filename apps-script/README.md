# Copy these files into Google Apps Script

Open a file below, choose **Raw**, then press **Ctrl+A → Ctrl+C**. In the matching Apps Script file, press **Ctrl+A → Ctrl+V** and save. Copy the whole file.

| File | Direct copy link | Apps Script file |
|---|---|---|
| Code.gs | [Open code](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Code.gs) | Script named Code |
| Content.gs | [Open full module content](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Content.gs) | Script named Content |
| Rules.gs | [Open validation rules](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Rules.gs) | Script named Rules |
| Index.html | [Open HTML](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Index.html) | HTML named Index |
| Client.html | [Open client code](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Client.html) | HTML named Client |
| Styles.html | [Open styles](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Styles.html) | HTML named Styles |
| appsscript.json | [Open manifest](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/appsscript.json) | Existing manifest |

Add a missing Script or HTML file with **+** beside Files. Enter only the name (for example, Rules or Index); Apps Script adds the extension. The HTML names are case-sensitive.

Content.gs contains the complete November module and embedded diagrams as compressed text. The long encoded line is expected. It does **not** require uploading a data file to Google Drive or adding Drive permissions.

After updating all files, select **Deploy → Manage deployments → pencil → New version → Deploy**. Keep the existing deployment URL, spreadsheet ID and OAuth settings. Do not rerun spreadsheet setup; the November sheets initialize automatically after an approved account signs in. Existing October response sheets are preserved.

This is the November 2 Word-based test build: 10 stops, 81 screens and 35 indicator cards, with the approved C13 = 3 and D13 = 2 data components. Resume is device-specific and reports are attributed to offices. The source closing date is November 17, 2026 at 11:59 PM Manila time.

Local validation: all 1,325 named Word references mapped, 20 backend tests passed, and the browser test traversed all 81 screens. Eight official-source link addresses remain to be verified before final release. Live Google deployment testing is still required.
