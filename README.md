# SAAS Volunteer Log

A personal activity logging system for SA Ambulance Service volunteers.

## What this is

This project helps manage the admin associated with volunteering — logging callouts, on-call shifts, and training events so that expense claims, CPD records, and monthly stats are always easy to produce.

**Current phase:** Prototype (Google Workspace)  
**Potential future phase:** Progressive web app (PWA)

## The problem it solves

- Callout numbers are hard to find after the fact — this captures them immediately
- Monthly hours on shift need to be tracked for personal records
- Expense claims via the SAAS app require callout details that fade quickly
- Clinical reflections and learning opportunities deserve a dedicated log

## System components

| Component | Tool | Purpose |
|---|---|---|
| Callout capture | Google Form (Android homescreen) | Quick entry post-callout |
| Master data store | Google Sheet | All records, tabs per activity type |
| Expense prep view | Sheet tab | Pre-filled data for SAAS expenses app |
| Reflections log | Google Doc or Sheet tab | CPD and learning notes |

## Repository structure

```
saas-volunteer-log/
├── README.md          # This file
├── schema.md          # Data model — every field, type, and meaning
├── decisions.md       # Log of design decisions and why
├── backlog.md         # Future ideas and deferred features
└── scripts/           # Apps Script and utility code
    └── .gitkeep
```

## Portability principles

This prototype is designed so that porting to an app later is a UI job, not a data redesign:

1. Every record has a clean unique ID
2. All fields are typed (dates, numbers, constrained dropdowns — not free text)
3. Summary logic is documented in `schema.md`, not locked inside Sheet formulas
4. `schema.md` is updated before any structural change to the Sheet

## Decision gate (prototype → app)

Before building an app, three conditions should be true:
- Data model has been stable for ~1 month (no new fields needed)
- The logging habit has formed (used every shift)
- At least one other volunteer has expressed interest

## Links

- Google Sheet: https://docs.google.com/spreadsheets/d/1fFZY2i1y8erqrhLECrlJJS5cWMlwAVtSS4d8GTdub9k/edit?gid=0#gid=0
- Google Form: *(add link once created)*
- SAAS Expenses App: *(add link)*

## Contact

Personal project — Michael, SAAS volunteer.
