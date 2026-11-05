# Update the existing Google Apps Script app

This is the **November 3 Word module with the November 5 layout revision**: full-width pages, tables that grow with the page, wrapping choices, simplified parts questions, and first-mention glossary links. The follow-up disables subsequent indicator columns for Defer, Drop and No view or opinion. Replace **Code.gs, Client.html, Styles.html and Content.gs together**, including the updated server validation rules. The full refresh instructions below also remain valid.

Replace these **four existing files together**. Open each Raw link, select all and copy; select all in the matching Apps Script file and paste the complete content.

| File | Direct GitHub Raw link |
|---|---|
| Code.gs | [Copy Code.gs](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Code.gs) |
| Content.gs | [Copy Content.gs](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Content.gs) |
| Client.html | [Copy Client.html](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Client.html) |
| Styles.html | [Copy Styles.html](https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Styles.html) |

1. Save all four files. Content.gs contains a long encoded line; copy the whole file.
2. Select **Deploy → Manage deployments → pencil → Version: New version → Deploy**.
3. Reopen the existing app URL. Stop 8 should show domain tables on a wide screen and compact indicator blocks on a phone.
4. Check answer selection around F06–F08 and inside the new tables, and confirm your earlier response resumes on the original device.

Keep the existing deployment URL, spreadsheet, Script Properties, OAuth settings, Index.html and manifest. An existing Rules.gs can stay; Code.gs contains its own rules. Do not rerun setup, clear browser storage or create a new spreadsheet. No new permissions are needed.

GitHub publication does not deploy the Google app. Live deployment still needs the owner to perform these steps.

## What was checked

[Source audit and test results](../AUDIT.md): all 1,158 named Word references mapped; the two approved identity disclosures retained; three diagrams preserved exactly; 35 indicators and 74 parts; all 50 possible screens rendered and traversed; backend and browser behavior tested using fabricated responses and a mock Sheets service. Existing response identifiers, sheets and historical answers are preserved.

## Readable response analysis

Copy the latest **Code.gs and Client.html** and redeploy to add **Secretariat → Refresh analysis sheets**. The button rebuilds six analysis tabs in the existing workbook from the latest committed answers, including full question labels and indicator/part context. You can also run `refreshAnalysis_` in the script editor. Analysis tabs are snapshots; refresh before analysis. Draft and excluded entries are labeled in detail views; Choice Summary uses only submitted, included responses. Original storage tabs remain intact.
