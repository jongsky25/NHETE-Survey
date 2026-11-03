# November 3 module verification

The implementation accounts for **1,158 of 1,158 named Word references**, with no unmapped references. The audit compares the compiled module with the attached document's text, formatting, choice order, screen order and all three diagram files. It also decodes the deployable Content.gs and verifies that it equals the tested content.

Source: **NHETE Module Text Review Copy v20261103.docx**. SHA-256: `71ff6e75c8480d7af7510698c3c30d818a916ac992ad9ed7afd2ca0b44d5a286`.

[Machine-readable reference mapping](source/audit-v20261103.json) · [Extracted Word source](source/word-v20261103.json) · [Deployment instructions](apps-script/README.md)

## What “complete” means

Respondent text is preserved, except for the **two already-approved identity disclosures** at aboutmat.9 and consent.3. They explain the collection of email, name and agency. These exceptions are explicit in the reference mapping and HANDOFF.md.

Eleven named references are layout specifications, implemented as grids or tables rather than displayed as builder prose. The generic parts-screen pill is specialized by the four domain pills. The empty QSG.3-none reference means the coverage column is omitted for respondents outside the specified geographic scopes. Reusable templates are expanded into actual controls and screens. Builder notes are not respondent text.

The document contains 50 actual screens plus two template descriptions. Four actual parts screens are conditional. The app contains 35 indicators, 74 parts and 563 active fields, including conditional questions. C13 has three parts and D13 has two, matching the new Word and earlier approved corrections.

## Verified behavior

- Domain tables at widths of 900px or greater; compact, labeled mobile blocks below that width. Table headings and code columns stay in view; sideways scrolling stays inside the table.
- Blank dropdowns in source order, full pilot-choice wording in the open list, short wording in the closed control. Collapsed details and research retain their state through selections.
- All three required-comment triggers, including combined placeholders. Six specified indicators have no cut-off control.
- Indicator-level Yes/close selects the parts rows. Empty parts screens are skipped both forward and backward. Close data requires a description.
- Coverage follows Q0.4, the component holder answer and smallest geographic level. National coverage asks about all four pilot regions together; other scopes omit the column. Fresh coverage in a batched save is retained.
- All text fields accept up to 1,500 words. Consent, exclusive No view, conditional questions and agreement thresholds remain enforced.
- Existing response identity and old screen positions survive the module-version change. Removed answers and cleared part answers remain in append-only history and the all-entry archive export.
- Public entry cannot grant administrator privileges. Protected review, exclusion/restoration, closure, idempotent retries, stale-tab conflicts and long-answer chunking remain enforced.

## Checks run

- `python tools/audit_word.py`: complete source mapping, formatting, exact diagrams, order and deployment payload parity.
- `node --test tests/backend.test.cjs tests/rules.test.cjs`: **17 passing tests**, including every .gs file parsed as ES2020 and Code.gs running without optional Rules.gs.
- `node tests/browser.cjs`: all 50 screens rendered; full Continue-to-Submit journey; conditional controls; forward/back skipping; mobile scroll; old-screen resume.
- `node tests/integration.cjs`: browser → actual Apps Script code → mock Sheets, covering entry, consent, resume, domain/parts saving, protected administration, archive export and exclusion.

Fixtures are fabricated. No live participant responses or credentials were accessed or published.

## Limits

These results verify the published implementation, not the current code in the owner's live Google app. The owner must copy the four updated files and deploy a new version of the existing deployment before live confirmation is possible.

The Word supplies 54 DOI links and leaves eight official-source URLs unspecified. All supplied links and 62 research summaries are preserved. No missing URLs were invented, and these checks do not claim independent verification that the publications or links are correct.
