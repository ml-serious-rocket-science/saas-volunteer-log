# Scripts

Google Apps Script code and other utilities for the SAAS volunteer log.

## Files

*(empty — scripts will be added here as they are written)*

## Planned scripts

- `monthly-summary.gs` — sends a monthly digest of callout count, shift hours, and unclaimed expenses
- `cert-expiry-alert.gs` — flags training certifications expiring within 60 days
- `expense-prefill.gs` — populates an expense claim doc from a callout record

## How to use Apps Script with the Google Sheet

1. Open the Sheet
2. Extensions → Apps Script
3. Paste script content, save, and set any required triggers (Time-driven or On open)
4. Copy the final script back into this folder for version control

## Notes

- Scripts that modify Sheet data should always check for an existing value before writing (don't overwrite manual corrections)
- Keep secrets (email addresses, webhook URLs) out of this repo — use Script Properties instead (`PropertiesService.getScriptProperties()`)
