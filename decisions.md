# Decisions log

A record of design decisions — not just what was chosen, but why. This is the file that makes the project resumable after time away, and explainable to another developer.

Format: date · decision · reasoning · alternatives considered

---

## 2026-04-27 — Use Google Workspace as prototype, not a bespoke app

**Decision:** Build the initial system using Google Forms + Google Sheets, not a custom app.

**Reasoning:** The data model and workflow need to be validated through actual use before investing in app development. Google Workspace has zero setup friction, works on Android, and is already familiar. The prototype can be abandoned at low cost if the habit doesn't form.

**Alternatives considered:**
- Build a PWA from the start — rejected because the data model is unproven; premature to commit to an app architecture
- Use Notion or Airtable — rejected because it adds a subscription cost and a platform dependency for a personal tool

**Portability commitment:** The Sheet will be designed so that porting to an app later is a UI job. See `schema.md` and portability principles in `README.md`.

---

## 2026-04-27 — Store scope and docs in GitHub, not Google Drive

**Decision:** All project documentation (schema, decisions, backlog, scripts) lives in this GitHub repo. The Google Drive folder contains only the live tool (Sheet, Form, Doc).

**Reasoning:** Git provides dated history and structured reasoning that Google Drive cannot. The `decisions.md` file specifically depends on immutable history. The repo also serves as the handoff artefact if another developer builds the app.

**Alternatives considered:**
- Store everything in Google Drive — rejected because Drive has no diff/history for docs, and no good place to store scripts with version control
- Use a full project management tool (Jira, Linear, Trello) — rejected as overkill for a solo personal project

---

## 2026-04-27 — Use constrained dropdowns for incident_type and outcome, not free text

**Decision:** `incident_type`, `response_code`, `outcome`, `training_category` are all controlled enumerations, not free text fields.

**Reasoning:** Free text fields are unusable for filtering, reporting, or app-side validation. The primary purpose of this system is to support expense claims and monthly stats — both require consistent categorical values. A dropdown adds minimal friction at capture time and pays off immediately in the Summary view.

**Alternatives considered:**
- Free text with autocomplete — rejected because autocomplete doesn't enforce consistency; "cardiac" and "Cardiac arrest" become two different categories
- Tags / multi-select — deferred to backlog; single category is sufficient for v1

---

## 2026-04-27 — Capture form is the primary interface, not direct Sheet entry

**Decision:** Callout data is entered via a Google Form saved to the Android homescreen, not by opening the Sheet directly.

**Reasoning:** The core pain point is that callout numbers become hard to find as time passes. A Form on the homescreen reduces the activation energy to log — it should take under 2 minutes post-callout. Direct Sheet entry on mobile is clunky and error-prone.

**Alternatives considered:**
- Direct Sheet entry — rejected for mobile UX reasons
- A dedicated mobile app — deferred; the Form achieves the same capture goal without the build cost

---

## 2026-04-27 — No branching strategy; single main branch with descriptive commits

**Decision:** This repo uses a single `main` branch. No feature branches, no PRs.

**Reasoning:** This is a solo project. The overhead of branches and PRs serves collaboration, not individual work. Descriptive commit messages provide sufficient history.

**Review trigger:** If another contributor joins, introduce a simple branch-per-change workflow at that point.

---

## 2026-04-27 — Google Calendar is the entry point for the workflow, not the Sheet

**Decision:** Google Calendar is the primary interface for scheduling and viewing upcoming shifts and training events. The Sheet is the data store and reporting layer. The Calendar is where the workflow *starts*, not where it ends up.

**Reasoning:** The mental model of a volunteer starts with "when are my upcoming shifts" — not "what did I log last week." Making Calendar the front door means:
- Shifts are visible on Android alongside personal calendar
- Scheduling a shift is a natural first step, not an admin afterthought
- A calendar entry for an on-call shift becomes the trigger for filling in details once the shift is complete
- Retrospective logging is also supported — past events can be added to Calendar and then linked to Sheet records
- Training events and callouts can also appear on the calendar, giving a single view of all volunteer activity

**Portability note:** In a future app, the Calendar role would be replaced by an in-app schedule view. Google Calendar event IDs should be stored in shift and training records so the relationship is portable.

**Alternatives considered:**
- Sheet-only workflow (no calendar) — rejected because it has no forward-looking view; you can't see upcoming shifts
- Separate personal calendar (not integrated) — rejected because it duplicates effort and breaks the "log once, use everywhere" principle
- A third-party scheduling app — rejected because it adds a dependency and breaks out of the Google Workspace stack

**Workflow this defines:**

```
BEFORE shift:     Add shift to Google Calendar → visible on phone with reminders
DURING/AFTER:     Shift happens → fill in Sheet details (hours, callouts, notes)
AFTER callout:    Open callout form → log callout number and clinical details
EXPENSE TIME:     Open Sheet expense view → all data already there, pre-filled
```
