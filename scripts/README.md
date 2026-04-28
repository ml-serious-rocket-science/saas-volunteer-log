# Scripts

Google Apps Script code and other utilities for the SAAS volunteer log.

## Files

| File | Purpose |
|---|---|
| `SetupSheet.gs` | One-time idempotent Sheet setup — creates all tabs, headers, validation, formulas |
| `RosterImport.gs` | Weekly roster importer — reads Gmail, creates Calendar events + Shifts rows |
| `roster-tools/` | Node.js dev scripts used to analyse roster format (not deployed) |

## New volunteer setup

To set up the SAAS Volunteer Log Sheet from scratch:

1. Create a new Google Sheet named **SAAS Volunteer Log**
2. Open Extensions → Apps Script
3. Paste the contents of `SetupSheet.gs` → Save → Run `setupSheet()`
4. Grant permissions when prompted
5. Paste the contents of `RosterImport.gs` → Save → Run `authoriseScript()`
6. Use **SAAS Roster → Import all new rosters** to populate shifts from Gmail

`SetupSheet.gs` is safe to run multiple times — it checks before creating and never deletes data.

## Planned scripts

- `monthly-summary.gs` — sends a monthly digest of callout count, shift hours, and unclaimed expenses
- `cert-expiry-alert.gs` — flags training certifications expiring within 60 days

## How to use Apps Script with the Google Sheet

1. Open the Sheet
2. Extensions → Apps Script
3. Paste script content, save, and set any required triggers (Time-driven or On open)
4. Copy the final script back into this folder for version control

## Notes

- Scripts that modify Sheet data always check for existing values before writing
- Keep secrets (email addresses, webhook URLs) out of this repo — use Script Properties instead (`PropertiesService.getScriptProperties()`)
