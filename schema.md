# Data schema

This document defines every field in the data model. **Update this file before making structural changes to the Google Sheet.**

---

## How Google Calendar fits

Google Calendar is for **rostering and visibility only** — not data capture. It shows upcoming shifts and training for Michael and his wife. All operational detail (callouts, clinical notes, expenses, reflections) lives in the Sheet.

**Calendar event types:**

| Event type | Colour | Sheet record |
|---|---|---|
| On-call shift | Eucalyptus | Shift record — closest available colour to SAAS green |
| Training event | Sage | Training record |
| Other volunteer activity | Graphite | Optional |

Callouts do **not** get calendar events. They are captured via the Google Form and stored in the Callouts tab. The shift event covers the time period.

**The two-way link between Calendar and Sheet:**
- Sheet records store `calendar_event_id` — the Google Calendar event ID, copied from the event URL
- Calendar event descriptions store `Sheet record: 2026-04-21-N-001` — a reference back to the Sheet row
- This allows navigation in either direction and survives a future port to an app

**Workflow:**
1. Roster arrives → Apps Script importer creates Calendar events + Shifts tab stub rows automatically
2. Callout occurs during shift → fill in capture Form on phone — no calendar event needed
3. After shift → update Sheet row status to Completed, correct actual times only if they differed
4. Training scheduled → Calendar event (Sage) → Sheet row filled in when complete

---

## Shift record

The shift record is created in two stages:
- **Stage 1 (import):** Apps Script creates the row from the roster email — all scheduled fields populated automatically including actual times pre-filled from scheduled times
- **Stage 2 (after shift):** Update status to Completed; correct actual times only if they differed from scheduled; add callout IDs and notes

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `shift_id` | String | `YYYY-MM-DD-{D\|N}-NNN` | Primary key. Date + shift type code + sequence. e.g. `2026-04-21-N-001`. Portable across stations. |
| `calendar_event_id` | String | Google Calendar event ID | Populated by importer |
| `status` | Enum | `Scheduled`, `Completed`, `Cancelled` | `Scheduled` = imported, not yet completed |
| `date` | Date | `YYYY-MM-DD` | Date shift started |
| `start_time` | Time | `HH:MM` | Scheduled on-call start — from roster |
| `end_time` | Time | `HH:MM` | Scheduled on-call end — from roster |
| `actual_start_time` | Time | `HH:MM` | Pre-filled from `start_time` by importer — edit only if different |
| `actual_end_time` | Time | `HH:MM` | Pre-filled from `end_time` by importer — edit only if different |
| `duration_hours` | Decimal | Calculated | Derived from actual times |
| `shift_type` | Enum | `Day` / `Night` | SAAS vocabulary. Day = starts AM ends before midnight. Night = crosses midnight. Set by importer. |
| `station` | String | Station name | e.g. `Burra` — column K, before shift_number for readability |
| `shift_number` | String | e.g. `60`, `180` | SAAS operational shift number. Station-specific — Burra: Day=60, Night=180. Column L — reads left-to-right as "Burra \| 60" = Burra60. |
| `callout_ids` | String | Comma-separated shift IDs | Links to callout records during this shift — filled in Stage 2 |
| `notes` | String | Free text | Optional |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | When Sheet row was created |

### shift_id format rationale
The ID is `YYYY-MM-DD-{D|N}-NNN` rather than station-specific (e.g. `burra60`) because:
- It remains valid if you work at another station
- The date and shift type are immediately readable
- Station and shift number are captured in `station` and `shift_number` fields where they belong
- The sequence suffix (`001`) handles the rare case of two shifts on the same date

**Stage 1 fields (auto-populated by importer):** `shift_id`, `calendar_event_id`, `status = Scheduled`, `date`, `start_time`, `end_time`, `actual_start_time`, `actual_end_time`, `shift_type`, `station`, `shift_number`, `created_at`

**Stage 2 fields (fill in after shift):** `status → Completed`, `actual_start_time` (if changed), `actual_end_time` (if changed), `callout_ids`, `notes`

### Station shift number reference
| Station | Day shift number | Night shift number |
|---|---|---|
| Burra | 60 | 180 |
| *(add others as encountered)* | | |

---

## Callout record

Captured via Google Form immediately after a callout. No calendar event — the parent shift covers the time period.

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `callout_id` | String | `CO-YYYYMMDD-NNN` | Primary key |
| `callout_number` | String | As issued by SAAS comms | Critical for expense claims |
| `location` | String | Free text | Location from pager dispatch e.g. "Burra Community School" |
| `date` | Date | `YYYY-MM-DD` | Date of callout |
| `time_paged` | Time | `HH:MM` | Time the page came in |
| `time_cleared` | Time | `HH:MM` | Time back available / at station |
| `duration_minutes` | Integer | Calculated | Derived — do not store manually |
| `parent_shift_id` | String | Shift ID | Which shift this callout occurred during |
| `incident_type` | Enum | See controlled list below | Constrained dropdown |
| `priority` | Enum | `PR:1`, `PR:2`, `PR:3` | SAAS response priority. PR:1 = highest urgency. |
| `patient_count` | Integer | 0–9 | Number of patients |
| `patient_presentation` | String | Free text, max 200 chars | Clinical summary — no identifying info |
| `clinical_actions` | String | Free text, max 500 chars | What you did |
| `outcome` | Enum | See controlled list below | Patient outcome / disposition |
| `learning_reflection` | String | Free text | Optional CPD note |
| `expense_claimable` | Boolean | `Yes` / `No` | Whether a claim will be submitted |
| `expense_claim_id` | String | Links to expense record | Populated after claim submitted |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | Auto-populated by Form |

### Incident type controlled list
*(Refine based on SAAS dispatch categories — these are starting values)*

- Cardiac / chest pain
- Respiratory
- Trauma / injury
- Unconscious / collapse
- Stroke / neurological
- Mental health
- Obstetric
- Medical — other
- Non-clinical assist
- Cancelled en route
- Other

### Priority controlled list

- PR:1
- PR:2
- PR:3
- PR:4
- PR:5
- PR:6
- PR:7
- PR:8
- PR:Other

*(PR:9 = PR:Other)*

### Outcome controlled list

- Transported to hospital
- Treated on scene — no transport
- Patient refused treatment
- No patient found
- Cancelled prior to arrival
- Other

---

## Training record

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `training_id` | String | `TR-YYYYMMDD-NNN` | Primary key |
| `calendar_event_id` | String | Google Calendar event ID | Links Calendar entry to this record |
| `status` | Enum | `Scheduled`, `Completed`, `Cancelled` | Same two-stage pattern as shifts |
| `date` | Date | `YYYY-MM-DD` | |
| `event_name` | String | Free text | e.g. "CPR Recertification" |
| `provider` | String | Free text | e.g. "SAAS Training", "St John" |
| `category` | Enum | See controlled list below | |
| `duration_hours` | Decimal | e.g. `2.5` | |
| `cert_issued` | Boolean | `Yes` / `No` | |
| `cert_name` | String | Free text | e.g. "HLTAID011 Provide First Aid" |
| `cert_expiry` | Date | `YYYY-MM-DD` | Blank if no expiry |
| `days_until_expiry` | Integer | Calculated | Derived: `cert_expiry - TODAY()` |
| `expense_claimable` | Boolean | `Yes` / `No` | |
| `expense_claim_id` | String | Links to expense record | |
| `notes` | String | Free text | |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | |

### Training category controlled list

- Clinical skills
- Driver training
- Leadership / management
- Safety and compliance
- Communications / comms
- Equipment familiarisation
- CPD — online / self-directed
- Other

---

## Expense record

Created when an expense claim is submitted to SAAS.

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `expense_id` | String | `EX-YYYYMMDD-NNN` | Primary key |
| `date_submitted` | Date | `YYYY-MM-DD` | When submitted to SAAS app |
| `claim_type` | Enum | `Callout`, `Training`, `Other` | |
| `linked_record_id` | String | Shift or Training ID | Foreign key back to source record |
| `callout_number` | String | Copied from callout record | Denormalised for easy claim reference |
| `amount_claimed` | Decimal | e.g. `45.50` | In AUD |
| `status` | Enum | `Submitted`, `Approved`, `Paid`, `Rejected` | |
| `date_paid` | Date | `YYYY-MM-DD` | Blank until paid |
| `notes` | String | Free text | |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | |

---

## Summary logic

Documented here so calculations can be reimplemented in an app — not locked in Sheet formulas.

- **Monthly callout count:** `COUNTIFS(callouts.date, ">="&month_start, callouts.date, "<="&month_end)`
- **Monthly shift hours:** `SUMIFS(shifts.duration_hours, shifts.date, ">="&month_start, shifts.date, "<="&month_end)`
- **Upcoming shifts (next 14 days):** `FILTER(shifts, shifts.status="Scheduled", shifts.date<=TODAY()+14)`
- **Callouts by priority:** `COUNTIF(callouts.priority, "PR:1")` etc. per priority level
- **Callouts by incident type:** `COUNTIF(callouts.incident_type, type_value)` per type
- **Certs expiring within 60 days:** `COUNTIFS(training.cert_expiry, ">="&TODAY(), training.cert_expiry, "<="&TODAY()+60)`
- **Total claimed YTD:** `SUMIFS(expenses.amount_claimed, expenses.date_submitted, ">="&year_start)`
- **Past shifts still Scheduled:** `COUNTIFS(shifts.status, "Scheduled", shifts.date, "<"&TODAY())` — past shifts not yet marked Completed, need follow-up

---

## Change log

| Date | Change | Reason |
|---|---|---|
| 2026-04-27 | Initial schema defined | Project kickoff |
| 2026-04-27 | Added `calendar_event_id` to shift and training records | Google Calendar adopted as workflow entry point |
| 2026-04-27 | Added `status` field to shift and training records | Supports two-stage workflow: Scheduled → Completed |
| 2026-04-27 | Added `actual_start_time`, `actual_end_time` to shift record | Actual times may differ from scheduled |
| 2026-04-27 | Added `parent_shift_id` to callout record | Links callout to the shift it occurred during |
| 2026-04-27 | Removed `calendar_event_id` from callout record | Callouts not given calendar events — shift event covers the period |
| 2026-04-27 | Calendar is rostering only — callouts log to Sheet via Form | Privacy and simplicity — no operational detail in Calendar |
| 2026-04-27 | Shift colour changed from Blueberry to Eucalyptus | Closest available Google Calendar colour to SAAS green |
| 2026-04-28 | Renamed `overnight` to `shift_type`, values `Day`/`Night` | Aligns with SAAS vocabulary; more meaningful than Yes/No |
| 2026-04-28 | `actual_start_time` and `actual_end_time` pre-filled by importer | Defaults to scheduled times — edit by exception only |
| 2026-04-28 | `shift_id` format changed from `SH-YYYYMMDD-NNN` to `YYYY-MM-DD-{D\|N}-NNN` | Portable across stations; date and type readable at a glance |
| 2026-04-28 | Added `shift_number` field | SAAS operational shift number (station-specific: Burra Day=60, Night=180); auto-populated by importer |
| 2026-04-28 | Renamed `response_code` to `priority`, values `PR:1/PR:2/PR:3` | Aligns with SAAS terminology; more meaningful than Code 1/2/3 |
| 2026-04-28 | Swapped `station` and `shift_number` column order (K/L) | Reads left-to-right as "Burra \| 60" matching SAAS designation Burra60 |
