# NHETE Consultation Room

A separate facilitator tool for face-to-face consultation. Open `dist/index.html`
in Chrome or Edge, or use the privately hosted copy. The HTML is self-contained:
no internet connection or Apps Script deployment is needed for offline use.

1. Create a session and enter its date and venue.
2. Add each attendee's name, full agency name, and office coverage area.
3. Search or filter the discussion agenda and choose a question.
4. Use **Present question** for a projector. Individual feedback and group notes
   are hidden in presentation mode. Exit presentation (or press Escape) to record
   an attendee's answer and explanation.
5. Capture group notes separately from individual answers.
6. Export the feedback CSV, question summary CSV, and a JSON backup.

This version is for a facilitator recording feedback on one laptop. It does not
synchronize attendees' phones or write to the existing pre-work database. Records
are stored in that browser's local storage. Different devices, browsers, hosted
URLs and offline files can have separate storage. Back up after each session and
restore the JSON when moving devices; CSV exports are analysis files, not backups.
Restore creates a separate session, never overwrites an existing one. Presentation
mode is for projector display, not an access-control boundary for someone with
physical access to the laptop.

The 374 discussion prompts use the 415-field current module. Identity/consent
screens are replaced by the attendee register; dependent comment/Other fields
are captured with the parent question. Existing pilot/holder/coverage conditions
are respected. Counts reflect this workshop only; they do not imply formal TWG
agreement or combine with pre-work responses.

Editable files: `room.js`, `room.css`, `index.template.html`. Run the normal survey
build first, then `python tools/build_consultation.py`. The resulting HTML embeds
only questionnaire content, never participant records. The "Download offline HTML"
button downloads a clean tool; use "Download session backup" to preserve feedback.

Verification: JavaScript parsing and DOM interaction tests cover registration,
recording, revisions, presentation mode, exports, backups and conditional questions.
Visual browser verification requires the supported Sites preview/browser tools.
