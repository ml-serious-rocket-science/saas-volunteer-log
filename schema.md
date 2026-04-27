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
- Calendar event descriptions store `Sheet record: SH-YYYYMMDD-001` — a reference back to the Sheet row
- This allows navigation in either direction and survives a future port to an app

**Workflow:**
1. Roster arrives → create Calendar shift events (rostering step, Eucalyptus)
2. Sheet row created → paste Calendar event ID into `calendar_event_id`, add Sheet record ID to Calendar description
3. Callout occurs during shift → fill in capture Form on phone — no calendar event needed
4. After shift → update Sheet row status to Completed, fill in actuals
5. Training scheduled → Calendar event (Sage) → Sheet row filled in when complete

---

## Shift record

The shift record is created in two stages:
- **Stage 1 (before shift):** Calendar event created — the rostering step
- **Stage 2 (after shift):** Sheet row filled in with actuals — hours, callouts, notes

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `shift_id` | String | `SH-YYYYMMDD-NNN` | Primary key |
| `calendar_event_id` | String | Google Calendar event ID | Copy from Calendar event URL |
| `status` | Enum | `Scheduled`, `Completed`, `Cancelled` | `Scheduled` = Calendar entry exists, Sheet not yet filled in |
| `date` | Date | `YYYY-MM-DD` | Date shift started |
| `start_time` | Time | `HH:MM` | Scheduled on-call start |
| `end_time` | Time | `HH:MM` | Scheduled on-call end |
| `actual_start_time` | Time | `HH:MM` | Actual start — blank if same as scheduled |
| `actual_end_time` | Time | `HH:MM` | Actual end — blank if same as scheduled |
| `duration_hours` | Decimal | Calculated | Derived from actual times if present, else scheduled |
| `overnight` | Boolean | `Yes` / `No` | Whether shift crossed midnight |
| `station` | String | Station name | e.g. "Stirling" |
| `callout_ids` | String | Comma-separated `CO-` IDs | Links to callout records during this shift |
| `notes` | String | Free text | Optional |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | When Sheet row was created |

**Stage 1 fields:** `shift_id`, `calendar_event_id`, `status = Scheduled`, `date`, `start_time`, `end_time`, `station`
**Stage 2 fields:** `status → Completed`, `actual_start_time`, `actual_end_time`, `callout_ids`, `notes`

---

## Callout record

Captured via Google Form immediately after a callout. No calendar event — the parent shift covers the time period.

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `callout_id` | String | `CO-YYYYMMDD-NNN` | Primary key |
| `callout_number` | String | As issued by SAAS comms | Critical for expense claims |
| `date` | Date | `YYYY-MM-DD` | Date of callout |
| `time_paged` | Time | `HH:MM` | Time the page came in |
| `time_cleared` | Time | `HH:MM` | Time back available / at station |
| `duration_minutes` | Integer | Calculated | Derived — do not store manually |
| `parent_shift_id` | String | `SH-` ID | Which shift this callout occurred during |
| `incident_type` | Enum | See controlled list below | Constrained dropdown |
| `response_code` | Enum | `Code 1`, `Code 2`, `Code 3` | Urgency of response |
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
| `linked_record_id` | String | `CO-` or `TR-` ID | Foreign key back to source record |
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
- **Callouts by incident type:** `COUNTIF(callouts.incident_type, type_value)` per type
- **Certs expiring within 60 days:** `COUNTIFS(training.cert_expiry, ">="&TODAY(), training.cert_expiry, "<="&TODAY()+60)`
- **Total claimed YTD:** `SUMIFS(expenses.amount_claimed, expenses.date_submitted, ">="&year_start)`
- **Shifts not yet completed:** `COUNTIFS(shifts.status, "Scheduled", shifts.date, "<"&TODAY())` — past shifts still marked Scheduled

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
