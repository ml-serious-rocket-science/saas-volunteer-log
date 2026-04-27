# Backlog

Ideas and deferred features. Review monthly — promote to active work only when the data model is stable and the habit has formed.

Items are roughly grouped by theme, not prioritised within groups.

---

## Capture improvements

- [ ] Add a "quick repeat" option to the callout form — prefills most fields from the previous callout for multi-patient or back-to-back jobs
- [ ] Investigate Google Forms offline behaviour on Android — confirm form saves locally if submitted without signal and syncs when reconnected
- [ ] Add a voice-to-text prompt for `patient_presentation` and `clinical_actions` fields — reduces typing time post-callout
- [ ] Consider a "shift start" button that automatically logs shift start time without opening the full form

## Expense workflow

- [ ] Build an Apps Script that pre-populates a Google Doc expense claim template from callout records — reduces copy-paste into SAAS app
- [ ] Add a filtered view to the Sheet that shows all `expense_claimable = Yes` records where `expense_claim_id` is blank (unclaimed items)
- [ ] Explore whether the SAAS expenses app has any import or API capability

## Reporting and stats

- [ ] Monthly summary email/notification — Apps Script trigger that sends a digest on the 1st of each month
- [ ] Cert expiry alerts — Apps Script that flags certs expiring within 60 days
- [ ] Year-to-date callout breakdown by incident type (chart in Summary tab)
- [ ] Rolling 12-month shift hours chart

## CPD and reflections

- [ ] Investigate whether reflections should link to the Australian College of Paramedicine CPD framework categories
- [ ] Consider a structured reflection template (What happened / What went well / What would I do differently / Learning action)
- [ ] Annual CPD summary export — list of training events + hours for the year, formatted for submission

## App / sharing

- [ ] If habit forms and data model is stable: scope a PWA with a proper mobile capture UI
- [ ] Create a "volunteer template" version of the Sheet — anonymised, with sample data, shareable with other SAAS volunteers
- [ ] Investigate whether SAAS has any interest in a shared tool vs individual volunteer spreadsheets
- [ ] If multiple volunteers adopt it: consider a shared backend (Firebase / Supabase) with per-user data isolation

## Data quality

- [ ] Add data validation rules to Sheet columns to enforce schema types (date formats, dropdown constraints)
- [ ] Periodic review: are the incident_type and outcome lists accurate to SAAS dispatch categories? Update schema.md if adjusted.
- [ ] Consider `callout_number` format validation — does SAAS use a consistent format that can be regex-checked?

---

## Completed

*(Move items here when done, with a date)*
