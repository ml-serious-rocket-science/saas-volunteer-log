# CLAUDE.md — Project briefing for AI assistants

Read this file at the start of every session before making any changes.

---

## Current status

Last updated: 2026-04-28
Phase: Prototype — roster importer working ✓
Last completed: RosterImport.gs fully working — parses Gmail attachments, creates Calendar events (GREEN), writes Shifts + Import Log rows with correct AU dates, shift IDs (YYYY-MM-DD-D/N-NNN), shift numbers (60/180), actual times pre-filled. All 11 historical rosters ready to import.
Next session: Full Sheet implementation (sheet-setup-spec.md) — Callouts, Training, Expenses, Summary, _lists tabs. Then callout capture Google Form.
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
SCHEDULE:   Roster email arrives Wednesday → SAAS Roster → Import latest roster
            → Calendar events created + Shifts tab populated automatically

ON SHIFT:   Callout occurs → open Form on homescreen → log callout number + details

AFTER:      Open Sheet → update shift record (Scheduled → Completed)
            Correct actual times only if they differed; add callout IDs

EXPENSE:    Open expense view → all data pre-populated from callout/shift records
```

---

## Planned evolution — known intentional gaps

### Roster import automation

**Current state:** RosterImport.gs complete and working.

**What it does:**
- Searches Gmail for all emails from jazz_vincent@hotmail.com with .xlsm attachments
- Parses BURRA ROSTER WEEK files for Liddy shifts using getDisplayValues() (AU locale DD/MM/YYYY)
- Shows confirmation dialog before creating anything
- Creates Calendar events (GREEN = closest to Eucalyptus) + Shifts tab rows
- Shift IDs: YYYY-MM-DD-D-001 / YYYY-MM-DD-N-001
- Shift numbers: Burra Day=60, Night=180 (configurable in CONFIG.shiftNumbers)
- Actual times pre-filled from scheduled — edit by exception after shift
- Logs processed filenames in Import Log tab to prevent duplicates
- Two menu options: "Import all new rosters" (backfill) and "Import latest roster" (weekly)

**Layer 3 (stretch):** Automatic Wednesday trigger — add after manual workflow is proven for a month.

**Prompt for future session:** "Has the roster import been running reliably for a month? Consider adding a Wednesday auto-trigger."

### App / PWA

**Current state:** Google Workspace prototype.

**Planned evolution:** If the decision gate is met (stable data model, habit formed, other volunteers interested), port to a PWA.

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
| `scripts/RosterImport.gs` | Apps Script — Gmail → Calendar + Shifts tab importer |
| `scripts/roster-tools/` | Node.js scripts used to analyse roster format (dev only) |
| `calendar-setup.md` | Step-by-step Google Calendar configuration guide |
| `sheet-setup-minimal.md` | Minimal Sheet setup — Shifts + Import Log tabs (already built) |
| `CLAUDE.md` | This file |

---

## Process rules

### Schema changes
1. Update `schema.md` **before** changing the Google Sheet
2. Add a row to the `schema.md` change log with the date and reason
3. Commit with message: `schema: description`

### Decisions
- Non-trivial choices get a `decisions.md` entry
- Format: date · decision · reasoning · alternatives considered
- Append-only — never edit past entries

### Backlog
- New ideas go to `backlog.md`, not directly into schema or Sheet
- Promote items only when data model has been stable ~1 month

### Commits
- Single `main` branch
- Message format: `type: description` where type is `schema`, `docs`, `scripts`, `backlog`, `fix`

---

## Data model summary

Four record types — full detail in `schema.md`.

**Shift** — two-stage: Scheduled (Calendar event + Sheet row created by importer) → Completed (actuals updated after shift). shift_id format: `YYYY-MM-DD-D-001` or `YYYY-MM-DD-N-001`. `shift_number` = SAAS operational number (Burra: 60/180).

**Callout** — captured via Google Form post-callout. Key fields: `callout_number`, `incident_type`, `patient_presentation`, `clinical_actions`, `learning_reflection`. Links to parent shift via `parent_shift_id`.

**Training** — same two-stage pattern as shifts. Includes `cert_expiry`.

**Expense** — created when claim submitted to SAAS app. Links back to callout or training record.

---

## Key constraints

- No patient-identifying information stored — `patient_presentation` is clinical summary only
- No SAAS operational data beyond personal admin needs
- Keep it lightweight — if a suggestion adds significant overhead, push to backlog

---

## Technology

- **Prototype:** Google Calendar + Google Forms + Google Sheets + Google Apps Script
- **Potential app stack:** PWA backed by Google Sheets API or Firebase/Supabase
- **This repo:** Markdown docs + Apps Script. No build tooling.

---

## Decision gate — when to consider building the app

1. Data model stable for ~1 month (no new fields required)
2. Logging habit formed (used every shift)
3. At least one other SAAS volunteer has expressed interest

---

## What to do at the start of a session

1. Read this file — note **current status** at the top
2. Read `schema.md` if the session involves data model work
3. Check `backlog.md` if the user mentions adding something new
4. Ask what the session goal is before making changes
5. Check "Planned evolution" section if prototype has been running a while
6. Update **current status** at the end of the session
