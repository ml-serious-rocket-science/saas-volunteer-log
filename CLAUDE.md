# CLAUDE.md — Project briefing for AI assistants

Read this file at the start of every session before making any changes.

---

## Current status

Last updated: 2026-04-27
Phase: Prototype — building foundations
Last completed: Repo setup, GitHub connected, full doc structure in place (schema, decisions, backlog), Calendar adopted as workflow entry point, roster automation approach documented
Next session: Write Sheet setup spec → create Google Sheet → set up callout capture Form
Blocked on: Nothing

---

## What this project is

A personal activity logging system for Michael, a SA Ambulance Service (SAAS) volunteer based in Adelaide. It tracks callouts, on-call shifts, and training events to simplify expense claims, CPD records, and monthly stats.

**Current phase:** Prototype using Google Workspace (Forms + Sheets + Calendar)
**Potential next phase:** Progressive web app — only if the prototype proves useful and the data model stabilises

---

## The problem being solved

- Callout numbers are hard to retrieve after the fact — critical for SAAS expense claims
- Monthly on-call hours need tracking for personal records
- The SAAS expenses app requires specific callout details that fade quickly without a log
- Clinical reflections and learning opportunities need a dedicated place
- Upcoming shifts need to be visible — the workflow starts with scheduling, not retrospective logging

---

## System components

| Component | Tool | Purpose |
|---|---|---|
| Schedule / forward view | Google Calendar | See upcoming shifts and training; entry point for the workflow |
| Master data store | Google Sheet | All records, tabs per activity type |
| Callout capture | Google Form (Android homescreen) | Quick entry post-callout |
| Expense prep view | Sheet tab | Pre-filled data for SAAS expenses app |
| Reflections log | Google Doc or Sheet tab | CPD and learning notes |

## Core workflow

```
SCHEDULE:   Shift rostered → add to Google Calendar (blue)
            Training scheduled → add to Google Calendar (green)

ON SHIFT:   Callout occurs → open Form on homescreen → log callout number + details

AFTER:      Open Sheet → update shift record (Scheduled → Completed)
            Add actual times, link callout IDs

EXPENSE:    Open expense view → all data pre-populated from callout/shift records
```

---

## Planned evolution — known intentional gaps

These are features that are deliberately deferred, not forgotten. They have a planned approach and should be raised if the user hasn't mentioned them after the prototype has been running for a month.

### Roster import automation

**Current state (Layer 1 — intentionally temporary):**
Shifts are added to Google Calendar manually after the weekly roster arrives by email on or around Wednesday of the prior week as an Excel attachment.

**This is a placeholder, not the end state.** Manual entry was chosen to start because we need to understand the roster format before automating it.

**Planned evolution:**
- **Layer 2:** Apps Script that watches Gmail for the roster email, parses the Excel attachment, and creates Calendar events + stub Sheet rows with one confirmation click. Prerequisites: collect 3–4 real roster files, confirm email sender/subject consistency, confirm Excel structure is stable week-to-week.
- **Layer 3:** Fully automated — script runs on a Wednesday trigger, finds the email, parses, creates events and rows, sends a confirmation summary.

**Prompt for future session:** "We planned to automate roster import from the weekly Excel email — the backlog has the full technical approach. Has the roster format been consistent enough to attempt Layer 2?"

### App / PWA

**Current state:** Google Workspace prototype.

**Planned evolution:** If the decision gate is met (stable data model, habit formed, other volunteers interested), port to a PWA. The `calendar_event_id` field on all records and the documented summary logic in `schema.md` are specifically there to make this port clean.

**Prompt for future session:** "Check the decision gate in this file — have all three conditions been met?"

---

## Repository purpose

This repo holds **project documentation only** — not the live tool. The live tool lives in Google Drive (links in README.md once created).

| File | Purpose |
|---|---|
| `README.md` | Project overview and quick-start |
| `schema.md` | Authoritative data model — all fields, types, controlled lists |
| `decisions.md` | Design decisions and reasoning |
| `backlog.md` | Deferred ideas — review monthly |
| `scripts/` | Apps Script and utility code |
| `CLAUDE.md` | This file |

---

## Process rules

These are the rules that govern how changes are made to this project. Follow them in every session.

### Schema changes
1. Update `schema.md` **before** changing the Google Sheet
2. Add a row to the `schema.md` change log with the date and reason
3. Commit with a message like: `schema: add response_code field to callout record`

### Decisions
- Any non-trivial choice (new field, changed approach, deferred feature) gets a `decisions.md` entry
- Format: date · decision · reasoning · alternatives considered
- Decisions are append-only — never edit past entries

### Backlog
- New ideas go to `backlog.md`, not directly into the schema or Sheet
- Don't implement backlog items until the data model has been stable for ~1 month
- Move completed items to the "Completed" section with a date

### Commits
- Single `main` branch — no feature branches for solo work
- Commit messages: `type: brief description` where type is one of `schema`, `docs`, `scripts`, `backlog`, `fix`
- No commit needed for trivial typo fixes

---

## Data model summary

Four record types. Full detail in `schema.md`.

**Shift** — the anchor record. Created in two stages: Stage 1 (scheduled, Calendar entry exists), Stage 2 (completed, actuals filled in). Has `calendar_event_id` linking to Google Calendar.

**Callout** — primary clinical record. Captured via Google Form on Android homescreen immediately post-callout. Key fields: `callout_number` (for expense claims), `incident_type` (dropdown), `patient_presentation`, `clinical_actions`, `learning_reflection`. Links to parent shift via `parent_shift_id`.

**Training** — courses and certifications. Same two-stage pattern as shifts (Scheduled → Completed). Includes `cert_expiry` for renewal tracking.

**Expense** — created when a claim is submitted to the SAAS app. Links back to callout or training records.

### Portability principle
All fields are typed and constrained. `calendar_event_id` stored on records so Calendar linkage survives a port to an app. Summary logic documented in `schema.md` — not locked inside Sheet formulas.

---

## Key constraints

- **No patient-identifying information** is stored. `patient_presentation` is a clinical summary only (e.g. "52yo male, chest pain, diaphoretic") — no names, DOBs, or addresses
- **No SAAS operational data** beyond what's needed for personal admin
- Keep the process lightweight — this is a personal tool, not an enterprise system. If a suggestion adds significant overhead, push it to the backlog

---

## Technology

- **Prototype:** Google Calendar + Google Forms + Google Sheets + (eventually) Google Apps Script
- **Potential app stack:** PWA, likely backed by Google Sheets API or Firebase/Supabase
- **This repo:** Markdown docs + Apps Script files. No build tooling needed.

---

## Decision gate — when to consider building the app

All three should be true before starting app development:
1. Data model stable for ~1 month (no new fields required)
2. Logging habit formed (used every shift)
3. At least one other SAAS volunteer has expressed interest

---

## What to do at the start of a session

1. Read this file — note the **current status** section at the top
2. Read `schema.md` if the session involves data model work
3. Check `backlog.md` if the user mentions wanting to add something new — it may already be there
4. Ask what the session goal is before making changes
5. If the prototype has been running for a while, check the "Planned evolution" section — are any deferred features now ready to build?
6. Update the **current status** section at the end of the session
