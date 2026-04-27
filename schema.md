# Data schema

This document defines every field in the data model. **Update this file before making structural changes to the Google Sheet.**

---

## How Google Calendar fits

Google Calendar is the entry point for the workflow. Each shift and training event gets a Calendar entry when scheduled. The Calendar event ID is stored in the Sheet record so the two stay linked.

**Calendar event types and their Sheet record:**

| Calendar event type | Colour code | Sheet record |
|---|---|---|
| On-call shift | Blue | Shift record |
| Callout (attended) | Red | Callout record |
| Training event | Green | Training record |

**Workflow:**
1. Shift is rostered → create Calendar event (shift type, start/end time, station in title)
2. Shift occurs → open Sheet, fill in shift details, paste Calendar event ID
3. Callout occurs during shift → fill in callout form on phone
4. Training scheduled → create Calendar event → add training record when complete
5. Retrospective logging → add past Calendar event, then create Sheet record linked to it

---

## Shift record

The shift record is created in two stages:
- **Stage 1 (before shift):** Calendar event created — this is the scheduling step
- **Stage 2 (after shift):** Sheet row filled in with actuals — hours, callouts, notes

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `shift_id` | String | `SH-YYYYMMDD-NNN` | Primary key |
| `calendar_event_id` | String | Google Calendar event ID | Links Calendar entry to this record. Copy from Calendar event URL. |
| `status` | Enum | `Scheduled`, `Completed`, `Cancelled` | `Scheduled` = Calendar entry exists, Sheet not yet filled. `Completed` = both done. |
| `date` | Date | `YYYY-MM-DD` | Date shift started |
| `start_time` | Time | `HH:MM` | Scheduled on-call start |
| `end_time` | Time | `HH:MM` | Scheduled on-call end |
| `actual_start_time` | Time | `HH:MM` | Actual start if different — blank if same as scheduled |
| `actual_end_time` | Time | `HH:MM` | Actual end if different — blank if same as scheduled |
| `duration_hours` | Decimal | Calculated | Derived from actual times if present, else scheduled times |
| `overnight` | Boolean | `Yes` / `No` | Whether shift crossed midnight |
| `station` | String | Station name | e.g. "Stirling" |
| `callout_ids` | String | Comma-separated `CO-` IDs | Links to callout records during this shift |
| `notes` | String | Free text | Optional |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | When Sheet row was created |

**Stage 1 fields (fill in when scheduling):** `shift_id`, `calendar_event_id`, `status = Scheduled`, `date`, `start_time`, `end_time`, `station`

**Stage 2 fields (fill in after shift):** `status → Completed`, `actual_start_time`, `actual_end_time`, `callout_ids`, `notes`

---

## Callout record

The most important record type. Captured via Google Form immediately after a callout.

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `callout_id` | String | `CO-YYYYMMDD-NNN` | Auto-generated. Date + sequence. Primary key. |
| `calendar_event_id` | String | Google Calendar event ID | Optional — populated if a Calendar entry was created for this callout |
| `callout_number` | String | As issued by SAAS comms | The official dispatch number. Critical for expense claims. |
| `date` | Date | `YYYY-MM-DD` | Date of callout |
| `time_paged` | Time | `HH:MM` | Time the page came in |
| `time_cleared` | Time | `HH:MM` | Time back available / at station |
| `duration_minutes` | Integer | Calculated from above | Derived field — do not store manually |
| `parent_shift_id` | String | `SH-` ID | Which shift this callout occurred during. Optional for standalone callouts. |
| `incident_type` | Enum | See controlled list below | Constrained dropdown |
| `response_code` | Enum | `Code 1`, `Code 2`, `Code 3` | Urgency of response |
| `patient_count` | Integer | 0–9 | Number of patients |
| `patient_presentation` | String | Free text, max 200 chars | Brief clinical summary — no identifying info |
| `clinical_actions` | String | Free text, max 500 chars | What you did |
| `outcome` | Enum | See controlled list below | Patient outcome / disposition |
| `learning_reflection` | String | Free text | Optional CPD note |
| `expense_claimable` | Boolean | `Yes` / `No` | Whether a claim will be submitted |
| `expense_claim_id` | String | Links to expense record | Foreign key — populated after claim submitted |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | Auto-populated by Form |

### Incident type controlled list
*(Refine this list based on SAAS dispatch categories — these are starting values)*

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
| `days_until_expiry` | Integer | Calculated | Derived — formula: `cert_expiry - TODAY()` |
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

These calculations live in the Sheet's Summary tab. Documented here so they can be reimplemented in an app.

- **Monthly callout count:** `COUNTIFS(callouts.date, ">="&month_start, callouts.date, "<="&month_end)`
- **Monthly shift hours:** `SUMIFS(shifts.duration_hours, shifts.date, ">="&month_start, shifts.date, "<="&month_end)`
- **Upcoming shifts (next 14 days):** `FILTER(shifts, shifts.status="Scheduled", shifts.date<=TODAY()+14)`
- **Callouts by incident type:** `COUNTIF(callouts.incident_type, type_value)` per type
- **Certs expiring within 60 days:** `COUNTIFS(training.cert_expiry, ">="&TODAY(), training.cert_expiry, "<="&TODAY()+60)`
- **Total claimed YTD:** `SUMIFS(expenses.amount_claimed, expenses.date_submitted, ">="&year_start)`
- **Shifts logged but not completed:** `COUNTIF(shifts.status, "Scheduled")` where date is in the past — these need following up

---

## Change log

| Date | Change | Reason |
|---|---|---|
| 2026-04-27 | Initial schema defined | Project kickoff |
| 2026-04-27 | Added `calendar_event_id` to shift, callout, training records | Google Calendar adopted as workflow entry point |
| 2026-04-27 | Added `status` field to shift and training records | Supports two-stage workflow: Scheduled → Completed |
| 2026-04-27 | Added `actual_start_time`, `actual_end_time` to shift record | Actual times may differ from scheduled |
| 2026-04-27 | Added `parent_shift_id` to callout record | Links callout to the shift it occurred during |
| 2026-04-27 | Added Calendar event type / colour convention | Single calendar view for all volunteer activity |
