# Copy these files into Google Apps Script

Open a file below, choose **Raw**, then press **Ctrl+A → Ctrl+C**. In the matching Apps Script file, press **Ctrl+A → Ctrl+V** and save. Copy the whole file.

| File | Direct copy link | Apps Script file |
|---|---|---|
| Code.gs | [Open code](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Code.gs) | Script named Code |
| Content.gs | [Open full module content](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Content.gs) | Script named Content |
| Rules.gs | [Open shared rules](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Rules.gs) | Optional; existing copies may stay |
| Index.html | [Open HTML](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Index.html) | HTML named Index |
| Client.html | [Open client code](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Client.html) | HTML named Client |
| Styles.html | [Open styles](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Styles.html) | HTML named Styles |
| appsscript.json | [Open manifest](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/appsscript.json) | Existing manifest |

Add a missing Script or HTML file with **+** beside Files. Enter only the name (for example, Rules or Index); Apps Script adds the extension. The HTML names are case-sensitive.

Content.gs contains the complete November module and embedded diagrams as compressed text. The long encoded line is expected. It does **not** require uploading a data file to Google Drive or adding Drive permissions.

After updating all files, select **Deploy → Manage deployments → pencil → New version → Deploy**. Keep the existing deployment URL, spreadsheet ID and OAuth settings. Do not rerun spreadsheet setup; the November sheets initialize automatically during entry or administrator access. Existing October response sheets are preserved.

This is the November 2 Word-based test build: 10 stops, 81 screens and 35 indicator cards, with the approved C13 = 3 and D13 = 2 data components. Resume is device-specific and reports are attributed to offices. The source closing date is November 17, 2026 at 11:59 PM Manila time.

Local validation: all 1,325 named Word references mapped, 30 backend tests passed, and the browser test traversed all 81 screens. Eight official-source link addresses remain to be verified before final release. Live Google deployment testing is still required.

Navigation update: missing required answers are highlighted and brought into view. An incomplete office-details page stays on that page until all four required answers are supplied. The top stop buttons become available as the participant reaches those stops through Continue.

Server-rule fix: the current Code.gs contains its own validation rules. If an older deployment reports `NheteRules is not defined`, replace **Code.gs only**, save, then deploy a new version of the existing deployment. The server no longer relies on a separate Rules.gs file.

## Open entry and review update

Replace **Code.gs, Content.gs and Client.html**, save, and deploy a new version. Keep Execute as Me and Who has access Anyone. No new permissions or participant activation are required.

Participants enter email, name and agency represented, then begin the module. These details are self-reported, and the introductory disclosure reflects their collection. The agency is pre-filled in the questionnaire. Responses resume on the original device.

Use **Secretariat sign-in** on the entry page for the protected Google administrator flow. Only administrator rows in the existing Roster need to remain active. Publicly typing an administrator email does not grant dashboard access.

Under **Entry review**, Exclude removes an entry from agreement summaries, data-source follow-up and analytical exports without deleting it. Restore includes it again. **Export all entries (including excluded)** keeps all original answers with name, email, agency and review status. The profile and review sheets are created automatically.
