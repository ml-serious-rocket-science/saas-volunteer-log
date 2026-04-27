# CLAUDE.md — Project briefing for AI assistants

Read this file at the start of every session before making any changes.

---

## What this project is

A personal activity logging system for Michael, a SA Ambulance Service (SAAS) volunteer based in Adelaide. It tracks callouts, on-call shifts, and training events to simplify expense claims, CPD records, and monthly stats.

**Current phase:** Prototype using Google Workspace (Forms + Sheets)  
**Potential next phase:** Progressive web app — only if the prototype proves useful and the data model stabilises

---

## The problem being solved

- Callout numbers are hard to retrieve after the fact — critical for SAAS expense claims
- Monthly on-call hours need tracking for personal records
- The SAAS expenses app requires specific callout details that fade quickly without a log
- Clinical reflections and learning opportunities need a dedicated place

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

**Callout** — primary record. Captured via Google Form on Android homescreen immediately post-callout. Key fields: `callout_number` (for expense claims), `incident_type` (dropdown), `patient_presentation`, `clinical_actions`, `learning_reflection`.

**Shift** — on-call periods. Tracks start/end time, station, and links to callout IDs that occurred during the shift. Used for monthly hours calculation.

**Training** — courses and certifications. Includes `cert_expiry` for renewal tracking.

**Expense** — created when a claim is submitted to the SAAS app. Links back to callout or training records. Includes claim status and date paid.

### Portability principle
All fields are typed and constrained (no logic-only formula fields, no ambiguous free text where a dropdown applies). This means the Google Sheet can be ported to an app without redesigning the data model — it becomes a UI job, not a data job.

---

## Key constraints

- **No patient-identifying information** is stored. `patient_presentation` is a clinical summary only (e.g. "52yo male, chest pain, diaphoretic") — no names, DOBs, or addresses
- **No SAAS operational data** beyond what's needed for personal admin
- Keep the process lightweight — this is a personal tool, not an enterprise system. If a suggestion adds significant overhead, push it to the backlog

---

## Technology

- **Prototype:** Google Forms + Google Sheets + (eventually) Google Apps Script
- **Potential app stack:** PWA, likely backed by Google Sheets API (lowest friction) or Firebase/Supabase (if it needs to scale to multiple volunteers)
- **This repo:** Markdown docs + Apps Script files. No build tooling needed.

---

## Decision gate — when to consider building the app

All three should be true before starting app development:
1. Data model stable for ~1 month (no new fields required)
2. Logging habit formed (used every shift)
3. At least one other SAAS volunteer has expressed interest

---

## What to do at the start of a session

1. Read this file
2. Read `schema.md` if the session involves data model work
3. Check `backlog.md` if the user mentions wanting to add something new — it may already be there
4. Ask what the session goal is before making changes
