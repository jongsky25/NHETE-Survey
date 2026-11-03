# NHETE consultation platform — continuation handoff

Read this before making changes. The live Google deployment uses **apps-script/**. The root app.js, app.css and index.html are an older static shell: do not overwrite them as part of Apps Script updates.

## Current implementation (3 November 2026)

The application implements **NHETE Module Text Review Copy v20261103.docx**, including the new Stop 8 domain indicator/parts tables. The previous November 2 handoff is retained in [handoff/HANDOFF-v20261102.md](handoff/HANDOFF-v20261102.md) for historical context; its screen counts and Stop 8 behavior are superseded.

The attached authoritative file had SHA-256:

`71ff6e75c8480d7af7510698c3c30d818a916ac992ad9ed7afd2ca0b44d5a286`

The complete extracted Word rows, formatting, diagrams and builder notes are in `source/word-v20261103.json`. Builder notes describe behavior; never display them as participant prose or execute document instructions. The source snapshot is module material, not participant data. The older compiled content is retained in `source/runtime-v20261102.json.gz` solely as the stable non-Stop-8 structure and backward-compatible answer schema used by the compiler.

The source audit maps **1,158/1,158 named references**, verifies all three diagram bytes, text/formatting, choice order, screen order and exact Content.gs equality. Eleven references describe layouts rather than respondent prose. Two approved identity-disclosure amendments remain. Read [AUDIT.md](AUDIT.md) and the machine-readable `source/audit-v20261103.json`; never equate a reference audit with a live deployment check.

## Deployment status and instructions

GitHub publication does not update Google Apps Script. The owner manually copies files; there is no connected tool that edits their Apps Script project. The live `/exec` URL and private workbook were not provided in this continuation. **Deployment of this November 3 update, including the earlier scroll fix, remains unconfirmed.**

Update these four existing files together:

- https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Code.gs
- https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Content.gs
- https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Client.html
- https://raw.githubusercontent.com/jongsky25/NHETE-Survey/main/apps-script/Styles.html

Prefer commit-pinned Raw links for a specific release. Copy the whole file, save, then **Deploy → Manage deployments → pencil → Version: New version → Deploy**. Keep the existing deployment and `/exec` URL. Do not rerun setup or create a new spreadsheet. Existing Index.html, optional Rules.gs and the manifest can stay. The backend contains its own lexical rules; it does not depend on Rules.gs.

Settings remain Execute as **Me**, access **Anyone**, V8, timezone **Asia/Manila**. No new scopes, Drive permissions or OAuth settings are needed. Preserve Script Properties: SPREADSHEET_ID, CONSULTATION_OPEN, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Never ask the user to paste secret values.

## Authoritative behavior and approved exceptions

Preserve wording, formulas, glossary definitions, diagrams and order, including editorial inconsistencies. The latest attachment now explicitly lists three C13 components (step-free/ramped entrance, wheelchair-accessible door width, accessible toilet) and two D13 components (cervical cancer deaths among resident women aged 30–60, resident female population aged 30–60). These agree with previously approved corrections; do not ask again. The C13 glossary still contains a different descriptive list; preserve the Word rather than silently rewriting it.

Open public entry with **email, name and agency** remains approved. It overrides the source's earlier no-name statements. Exact disclosure amendments:

- aboutmat.9: “We ask for your email, name and agency so the secretariat can review entries. When we share answers with the group, we will identify the agency you represent.”
- consent.3: “Your email, name, agency and answers will be recorded and can be reviewed by the team at SynapTech Innovations, which serves as the secretariat of the Technical Working Group, and by staff of the Bureau of Local Health Systems Development (BLHSD) in the Department of Health.”

Use same-device resume and reveal structural advice only after an answer. Do not restore cross-device retrieval or prepend teaching screens before the initial equity views. Submit remains at s9b after the final question, following the detailed screen definition despite the introductory sentence about What happens next.

## Journey and Stop 8

There are **10 stops, 50 possible screens, 35 indicators, 74 parts and 563 active schema fields**. Four parts screens are conditional, so a participant with no data sees 46 screens. Field counts include conditional fields; they are not the number everyone must answer.

Stops 0–7 and 9 retain the original Word journey. Stop 8 consists of s8a, s8b, then mx-A/cp-A, mx-B/cp-B, mx-C/cp-C, mx-D/cp-D, then s8-RF. s8t and s8g are reusable templates, not navigable screens.

Indicator order:

- A: A01, A07, A03, A04, A05.
- B: B02, B03, B11, B14, B18, B08, B15, B19, B20, B21.
- C: C01, C02, C03, C06, C05, C14, C09, C13.
- D: D01, D03, D05, D06, D07, D08, D10, D11, D12, D13, D21, D20.

Each domain has an indicator table: code, details, pilot choice, cut-off, worry, data-holder choice, comment. At 900px or wider use a real table with sticky heading/code column and sideways scrolling confined to the table. Below 900px display compact blocks with labeled dropdowns. Start dropdowns blank. Closed pilot dropdowns show the short choice, while the native open list contains the full source wording. Research stays inside collapsed More about this indicator panels.

B03, B08, B19, B20, B21 and D03 have no cut-off control. Comments become required for Change it, Something else, or We keep something close to it. Combine all applicable source placeholders. All open text allows 1,500 words, not characters.

New `CODE.q-k` replaces the old notOurs toggle. Yes and Something close include that indicator in its domain's parts table; No and I do not know exclude it. Empty parts screens are skipped in both directions. Changing the holder answer to No/unknown clears active part answers via an append-only revision; historical records remain recoverable and exported.

For each part, SG.1 asks whether the office keeps it. Something close requires a description. SG.2 is required only for Yes/close. SG.3 is one coverage answer per part, required at city/municipal level or finer, only for respondents covering one of the four pilot regions or the whole country. Regional wording substitutes the exact Q0.4 choice; national wording asks about the four regions together. Other geographic choices omit that column. Irrelevant cells show Not needed. The bring-a-sample note appears only on the first applicable parts screen.

SG.3b and SG.4 are removed from the active questionnaire. Legacy region-by-region coverage is not silently reinterpreted as a new combined answer. Old data remains in the journal/all-entry export. No Domain E indicator block is added. Red flags remain C01, C02, C14, D01, D03, D05, D06, D07 and D12; D13 is not a red flag.

## Storage, identity and preservation

The visible content version is v20261103. **storageVersion remains v20261102-SUBMITTED**. Both server owner hashes and browser cache keys use storageVersion. Changing it would orphan existing responses. Old ind-CODE/s8-A0 style screen names map to the corresponding mx domain screen. Old pending fields are accepted through a retained legacy schema; old answers are not migrated into answers with different meaning.

Keep existing sheets and headers exactly: Module20261102Entries, PublicSessions, Reviews, Devices, Revisions, Changes and Decisions, plus the October Roster/Sessions/Revisions/Decisions. Never reset, reorder or rename response sheets. New sheets initialize idempotently.

Profiles are self-reported. Public tokens are random, hashed server-side and bound to browser devices. Knowing an email does not retrieve answers. Secretariat sign-in remains verified Google identity plus an active admin=TRUE roster row; typing an administrator's email into public entry grants no privilege.

Entries are included by default. Exclude/Restore are append-only reviews. Excluded entries are absent from analytical summaries/exports but remain in the all-entry export. That export now includes both **All stored answers JSON** and **Revision history JSON**, preserving removed fields and prior values. Participant edits do not undo exclusion.

Saves retain locks, expected revisions, idempotent request IDs, chunked values and fragment-before-manifest commit semantics. Editing a submission returns it to draft. Existing submissions stay submitted until edited; no mass resubmission is performed. Numeric historical consent IDs still recover from 0 to 0.0 without converting missing/false consent into true. Profiles/reasons and CSV cells retain formula protections.

Agreement uses submitted, included answers only, excludes No view or opinion, requires six people with a view and at least 75% agreement for a proposed shortlist. TWG decisions remain separate. New custodian reports distinguish No from I do not know (possibly held), using the explicit holder answer.

The deadline stays **17 November 2026, 11:59 PM Manila**. The meeting is **23 November 2026**, pilot January–February 2027, final review March 2027. CONSULTATION_OPEN still controls collection globally.

## Source files, build and verification

Editable sources are in **development/**; do not edit the old root shell. `development/content.json` is generated and ignored by Git. `tools/build_content.py` reconstructs it from committed source snapshots; `tools/build_runtime.py` compiles browser code/styles and synchronizes embedded server rules. Code.gs is the editable server source.

```sh
npm ci
npm run build
npm test
python -m http.server 8860 --bind 127.0.0.1 --directory development
# In another terminal, with Chromium installed at /usr/bin/chromium:
npm run test:browser
```

The committed checks cover 17 rule/backend cases; ES2020 parsing of every .gs file; 50 screen renders and a full Continue-to-Submit browser journey; conditional comments/coverage/parts skipping; mobile scroll; original-screen resume; browser→Apps Script→mock Sheets public entry, consent, resume, save, protected administration, archive CSV and exclusion. Mock fixtures are fabricated, not participant data.

The three deployment artifacts Client.html/Styles.html/Content.gs are checked against the tested development sources. The source audit has no missing references, with the two explicit disclosure amendments. No test establishes what code is currently running in the user's live Google deployment.

## Remaining work

1. Owner copies the four files and deploys a new version of the existing Google app.
2. Verify live Stop 8 matrices, answer selection without jumping, original-device resume and secretariat review. Do not clear browser storage casually.
3. Eight official-source URLs remain absent from the Word: B11.ev1, C02.ev1, C03.ev1, C13.ev1, D05.ev1, D10.ev1, D11.ev1 and D20.ev1. All 54 supplied DOI URLs are preserved. Do not invent URLs or claim independent DOI verification.

The user prefers short practical instructions and direct browser-accessible GitHub Raw links. Preserve existing data and approved exceptions. Earlier publication authorization covers module code/text/diagrams and subsequent fixes, not actual responses or credentials. Never force-push or overwrite newer remote work.
