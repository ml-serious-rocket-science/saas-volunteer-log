# Data schema

This document defines every field in the data model. **Update this file before making structural changes to the Google Sheet.**

---

## Callout record

The most important record type. Captured via Google Form immediately after a callout.

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `callout_id` | String | `CO-YYYYMMDD-NNN` | Auto-generated. Date + sequence. Primary key. |
| `callout_number` | String | As issued by SAAS comms | The official dispatch number. Critical for expense claims. |
| `date` | Date | `YYYY-MM-DD` | Date of callout |
| `time_paged` | Time | `HH:MM` | Time the page came in |
| `time_cleared` | Time | `HH:MM` | Time back available / at station |
| `duration_minutes` | Integer | Calculated from above | Derived field — do not store manually |
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

## Shift record

Tracks on-call periods for monthly hours calculation.

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `shift_id` | String | `SH-YYYYMMDD-NNN` | Primary key |
| `date` | Date | `YYYY-MM-DD` | Date shift started |
| `start_time` | Time | `HH:MM` | On-call start |
| `end_time` | Time | `HH:MM` | On-call end |
| `duration_hours` | Decimal | Calculated | Derived — do not store manually |
| `overnight` | Boolean | `Yes` / `No` | Whether shift crossed midnight |
| `station` | String | Station name | e.g. "Stirling" |
| `callout_ids` | String | Comma-separated `CO-` IDs | Links to callout records during this shift |
| `notes` | String | Free text | Optional |
| `created_at` | Timestamp | `YYYY-MM-DD HH:MM:SS` | |

---

## Training record

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `training_id` | String | `TR-YYYYMMDD-NNN` | Primary key |
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
- **Callouts by incident type:** `COUNTIF(callouts.incident_type, type_value)` per type
- **Certs expiring within 60 days:** `COUNTIFS(training.cert_expiry, ">="&TODAY(), training.cert_expiry, "<="&TODAY()+60)`
- **Total claimed YTD:** `SUMIFS(expenses.amount_claimed, expenses.date_submitted, ">="&year_start)`

---

## Change log

| Date | Change | Reason |
|---|---|---|
| 2026-04-27 | Initial schema defined | Project kickoff |
