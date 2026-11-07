# NHETE Live Consultation

Live URL: https://nhete-consultation-room.social-mesa-9100.chatgpt.site

## Start a meeting

1. Sign in with ChatGPT. The account email must match the email used for pre-work.
   The public page is open to everyone; attendance, answers and pre-work require
   verified sign-in. A ChatGPT account is required.
2. The configured facilitator chooses **Create meeting**, enters its date and venue,
   and shares the eight-character meeting code and site link.
3. Participants complete attendance (name, office/bureau and role), then join.
4. The facilitator selects an agenda item. Everyone sees the same current item;
   totals refresh every four seconds while connected. Participant drafts are not
   overwritten by polling. Failed saves must be retried after reconnecting.
5. Review the description/formula, collect suggested changes, and discuss. For
   indicators, open **data** to confirm each component. One respondent must
   confirm all required components for their office; partial confirmations across
   different offices are not combined.
6. When no office has all components, use **Revise definition / formula**, select
   barangay-level collection and describe a collection approach without household
   interviews. Revise the components as needed, then return to discussion.
7. Open **final** voting on the final proposal. More than 50% of valid votes must
   agree; abstentions are excluded, ties and zero valid votes do not pass.
8. The facilitator records the official decision and rationale. An indicator is
   listed for the pilot only after that decision. Revising a decided proposal
   removes its current approval, preserves the previous decision in the archive,
   and requires fresh votes and component confirmations.
9. Choose **Generate results** for the dashboard, attendance, feedback, decisions,
   pre-work revision CSVs and a full JSON session archive.

The facilitator account is configured in the Site's server-only
`FACILITATOR_EMAILS` environment variable (comma-separated verified emails).
Participants cannot use facilitator endpoints or read other attendees' individual
comments, contact details or pre-work. Projector mode displays consolidated results
and reviewed summaries; it hides the individual-feedback controls.

## Load existing pre-work: one-time setup

Nothing in this process edits the original pre-work answers.

1. In the existing Google Apps Script project, add a script file named
   **ConsultationBridge**. Paste [ConsultationBridge.gs](../../apps-script/ConsultationBridge.gs).
2. Update `appsscript.json` to the [repository manifest](../../apps-script/appsscript.json).
   The new `drive.file` scope permits creation of the private JSON export; it does
   not grant access to all existing Drive files.
3. Save, select **runConsultationPreworkExport**, and run it as the project owner.
   Accept Google's authorization for the newly requested permission.
4. Open the private Drive file link in the execution log and download the JSON.
5. On the Consultation Room start screen, use **Import pre-work JSON** as facilitator.
6. Participants join a meeting and choose **Review / edit my pre-work**. The server
   returns only entries matching their verified email. If that email has several
   entries, they choose one explicitly; the tool never silently merges them.

This is a snapshot import. Repeat the export/import to bring in newer pre-work.
An already loaded participant consultation copy is preserved, so a later import
cannot overwrite consultation edits. Importing/loading pre-work does not cast votes.
Individual original answers and revisions are included separately in exports.
The existing pre-work still runs on Google Apps Script. The shared live meeting
uses a separate hosted database, not the original spreadsheet.

## Optional direct sync

After adding ConsultationBridge.gs, set Script Property
`CONSULTATION_BRIDGE_KEY` to a random secret of at least 32 characters. Set the
same secret as the Site runtime `PREWORK_KEY`; set `PREWORK_URL` to the existing
Apps Script deployment `/exec` URL. Deploy a new Apps Script version and republish
this Site to apply its runtime variables. Do not put the secret in chat, source
files, a query string or browser code. Then **Sync pre-work from Google Sheet**
refreshes the private import on demand. No Apps Script code/deployment or secret
has been changed automatically by this implementation.

## Consolidation

**Consolidate comments** creates an extractive draft grouped into definition,
formula, data availability, barangay collection, implementation and other themes.
It keeps source comments and counts and can place a comment in several themes.
It is not generative AI: a facilitator edits and approves the draft before it is
shown to participants. Unrecognized phrasing is retained under other suggestions.
Source responses are never discarded. Changed votes invalidate the draft.

## Development and storage

Run `npm run test:live` from the repository root. `npm run build:live` embeds the
current question bank, client, styles and offline HTML into the Worker entrypoint
`consultation/live/dist/server/index.js`. The question bank supplies 92 agenda
items, including indicators and the non-indicator discussion prompts. The pre-work
editor retains all original questionnaire fields.

D1 binding: `DB`. Migration: `drizzle/0000_live_records.sql`. Records are keyed by
session and stable Site user ID. Email is used only for pre-work matching and
server-side facilitator allowlisting. Every record update uses a compare-and-swap
version to avoid lost updates; stale proposal rounds are rejected. Tables are
created by deployment migrations, never during requests. Original offline browser
records remain in their original browser storage and can still be exported using
the separate downloadable offline HTML; they are not silently imported into live
meetings. Download the full session archive for independent recordkeeping.

Automated verification covers actual SQLite-backed API interactions and DOM UI
flows. Managed Sites browser tools were unavailable, so visual rendering and the
hosted sign-in journey require a facilitator/participant smoke check before a meeting.
