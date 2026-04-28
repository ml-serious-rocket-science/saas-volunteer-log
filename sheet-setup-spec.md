# Google Sheet — full setup spec

Complete setup guide for the SAAS Volunteer Log Google Sheet.
The Shifts and Import Log tabs already exist from sheet-setup-minimal.md.
This document covers the remaining tabs.

---

## Tab overview

| Tab | Colour | Status |
|---|---|---|
| `Shifts` | Green | ✓ Already exists |
| `Callouts` | Red | Build now |
| `Training` | Teal | Build now |
| `Expenses` | Yellow | Build now |
| `Summary` | Blue | Build now |
| `_lists` | Grey | Build now — hide when done |
| `Import Log` | Grey | ✓ Already exists |

Tab order should match the table above — drag to reorder if needed.

---

## Tab: `_lists`

Create this first — all other tabs reference it for dropdown validation.
**Hide when done:** right-click tab → Hide sheet.

Create a new tab named `_lists` and enter the following lists, each in its own column with a bold header in row 1.

### Column A — Incident type
```
Incident type
Cardiac / chest pain
Respiratory
Trauma / injury
Unconscious / collapse
Stroke / neurological
Mental health
Obstetric
Medical — other
Non-clinical assist
Cancelled en route
Other
```

### Column B — Priority
```
Priority
PR:1
PR:2
PR:3
```
*(SAAS response priority. PR:1 = highest urgency. Replaces generic "Code 1/2/3" terminology.)*

### Column C — Outcome
```
Outcome
Transported to hospital
Treated on scene — no transport
Patient refused treatment
No patient found
Cancelled prior to arrival
Other
```

### Column D — Status (shifts and training)
```
Status
Scheduled
Completed
Cancelled
```

### Column E — Yes / No
```
Yes / No
Yes
No
```

### Column F — Training category
```
Training category
Clinical skills
Driver training
Leadership / management
Safety and compliance
Communications / comms
Equipment familiarisation
CPD — online / self-directed
Other
```

### Column G — Expense claim type
```
Claim type
Callout
Training
Other
```

### Column H — Expense status
```
Expense status
Submitted
Approved
Paid
Rejected
```

### Column I — Shift type
```
Shift type
Day
Night
```

### Named ranges
After entering the lists, create named ranges for clean dropdown references.
Data → Named ranges, then add each of the following:

| Range | Name |
|---|---|
| `_lists!A2:A12` | `list_incident_type` |
| `_lists!B2:B4` | `list_priority` |
| `_lists!C2:C7` | `list_outcome` |
| `_lists!D2:D4` | `list_status` |
| `_lists!E2:E3` | `list_yes_no` |
| `_lists!F2:F9` | `list_training_category` |
| `_lists!G2:G4` | `list_claim_type` |
| `_lists!H2:H5` | `list_expense_status` |
| `_lists!I2:I3` | `list_shift_type` |

---

## Tab: `Shifts` — additions to existing tab

The Shifts tab exists but needs dropdown validation added now that `_lists` exists.
Do not change the column headers — just add validation to data columns.

**Current column order:**

| Col | Header | Notes |
|-----|--------|-------|
| A | `shift_id` | |
| B | `calendar_event_id` | |
| C | `status` | Dropdown |
| D | `date` | |
| E | `start_time` | |
| F | `end_time` | |
| G | `actual_start_time` | |
| H | `actual_end_time` | |
| I | `duration_hours` | Formula |
| J | `shift_type` | Dropdown |
| K | `station` | e.g. `Burra` |
| L | `shift_number` | e.g. `60` — reads left-to-right as "Burra \| 60" = Burra60 |
| M | `callout_ids` | |
| N | `notes` | |
| O | `created_at` | |

**Add dropdown validation:**
- Column C (`status`): select C2:C1000 → Data → Data validation → Dropdown from range → `list_status`
- Column J (`shift_type`): select J2:J1000 → Data → Data validation → Dropdown from range → `list_shift_type`

**Add duration formula:**
In I2, enter and drag down:
```
=IF(G2="","",IF(H2="","",IF(H2>G2,(H2-G2)*24,((H2+1)-G2)*24)))
```
**Important formatting notes:**
- Columns G and H must be formatted as **Time** (Format → Number → Time)
- Column I must be formatted as **Number** (Format → Number → Number) — NOT Time. If I is formatted as Time, a result of 0.5 (= 12 hours) displays as `12:00:00` instead of `12`. Format I2:I1000 as Number with 1 decimal place.
- The overnight logic works because Google Sheets stores 18:00 as 0.75 and 06:00 as 0.25. When end < start, the formula adds 1 (= 24 hours) before subtracting.

---

## Tab: `Callouts`

Create a new tab named `Callouts`. Tab colour: Red.

### Column headers (Row 1)

| Col | Header | Format | Dropdown source |
|---|---|---|---|
| A | `callout_id` | Plain text | e.g. `CO-20260306-001` |
| B | `callout_number` | Plain text | From SAAS comms — critical for expenses |
| C | `date` | Date | YYYY-MM-DD |
| D | `time_paged` | Time | HH:MM |
| E | `time_cleared` | Time | HH:MM |
| F | `duration_minutes` | Number | Formula — see below |
| G | `parent_shift_id` | Plain text | e.g. `2026-03-06-D-001` |
| H | `incident_type` | Plain text | Dropdown: `list_incident_type` |
| I | `priority` | Plain text | Dropdown: `list_priority` — PR:1, PR:2, PR:3 |
| J | `patient_count` | Number | 0–9 |
| K | `patient_presentation` | Plain text | Clinical summary only — no identifying info |
| L | `clinical_actions` | Plain text | |
| M | `outcome` | Plain text | Dropdown: `list_outcome` |
| N | `learning_reflection` | Plain text | |
| O | `expense_claimable` | Plain text | Dropdown: `list_yes_no` |
| P | `expense_claim_id` | Plain text | e.g. `EX-20260306-001` |
| Q | `created_at` | Plain text | Timestamp |

### Formatting
- Freeze Row 1: View → Freeze → 1 row
- Bold Row 1
- Format D and E columns as Time: select D2:E1000 → Format → Number → Time

### Duration formula
In F2, enter and drag down:
```
=IF(D2="","",IF(E2="","",IF(E2>D2,(E2-D2)*1440,(E2+1-D2)*1440)))
```
This calculates minutes between time_paged and time_cleared, handling the case where a callout crosses midnight.

### Dropdown validation
- H2:H1000 → `list_incident_type`
- I2:I1000 → `list_priority`
- M2:M1000 → `list_outcome`
- O2:O1000 → `list_yes_no`

### Note on callout_id
The callout ID is not auto-generated (unlike shift_id which is created by the importer).
Format: `CO-YYYYMMDD-NNN` e.g. `CO-20260306-001`
This will be auto-populated by the Google Form once it is connected to this sheet.
Until then, enter manually if needed.

---

## Tab: `Training`

Create a new tab named `Training`. Tab colour: Teal.

### Column headers (Row 1)

| Col | Header | Format | Dropdown source |
|---|---|---|---|
| A | `training_id` | Plain text | e.g. `TR-20260301-001` |
| B | `calendar_event_id` | Plain text | |
| C | `status` | Plain text | Dropdown: `list_status` |
| D | `date` | Date | YYYY-MM-DD |
| E | `event_name` | Plain text | e.g. "CPR Recertification" |
| F | `provider` | Plain text | e.g. "SAAS Training" |
| G | `category` | Plain text | Dropdown: `list_training_category` |
| H | `duration_hours` | Number | |
| I | `cert_issued` | Plain text | Dropdown: `list_yes_no` |
| J | `cert_name` | Plain text | e.g. "HLTAID011 Provide First Aid" |
| K | `cert_expiry` | Date | YYYY-MM-DD — blank if no expiry |
| L | `days_until_expiry` | Number | Formula — see below |
| M | `expense_claimable` | Plain text | Dropdown: `list_yes_no` |
| N | `expense_claim_id` | Plain text | |
| O | `notes` | Plain text | |
| P | `created_at` | Plain text | |

### Formatting
- Freeze Row 1, bold Row 1
- Format K column as Date: select K2:K1000 → Format → Number → Date

### Days until expiry formula
In L2, enter and drag down:
```
=IF(K2="","",K2-TODAY())
```
Format L2:L1000 as Number (integer). Negative = already expired. Colour-code with conditional formatting:
- L2:L1000 < 0 → Red background (expired)
- L2:L1000 <= 60 → Orange background (expiring soon)
- L2:L1000 > 60 → No formatting

To add conditional formatting: select L2:L1000 → Format → Conditional formatting → add rules.

### Dropdown validation
- C2:C1000 → `list_status`
- G2:G1000 → `list_training_category`
- I2:I1000 → `list_yes_no`
- M2:M1000 → `list_yes_no`

---

## Tab: `Expenses`

Create a new tab named `Expenses`. Tab colour: Yellow.

### Column headers (Row 1)

| Col | Header | Format | Dropdown source |
|---|---|---|---|
| A | `expense_id` | Plain text | e.g. `EX-20260306-001` |
| B | `date_submitted` | Date | YYYY-MM-DD |
| C | `claim_type` | Plain text | Dropdown: `list_claim_type` |
| D | `linked_record_id` | Plain text | Shift ID or Training ID |
| E | `callout_number` | Plain text | Copied from callout record |
| F | `amount_claimed` | Number (2dp) | AUD |
| G | `status` | Plain text | Dropdown: `list_expense_status` |
| H | `date_paid` | Date | YYYY-MM-DD — blank until paid |
| I | `notes` | Plain text | |
| J | `created_at` | Plain text | |

### Formatting
- Freeze Row 1, bold Row 1
- Format B and H as Date
- Format F as Number with 2 decimal places: select F2:F1000 → Format → Number → Custom → `0.00`

### Dropdown validation
- C2:C1000 → `list_claim_type`
- G2:G1000 → `list_expense_status`

---

## Tab: `Summary`

Create a new tab named `Summary`. Tab colour: Blue.

This tab is your dashboard — a read-only view you glance at to understand your activity.
All cells are formulas referencing the other tabs. Do not enter data directly here.

### Layout

**Section 1: Period selector (Row 1–2)**

| Cell | Content |
|---|---|
| A1 | `Month` (bold) |
| B1 | Enter a month start date e.g. `2026-04-01` — this drives all monthly calculations |
| A2 | `Month end` |
| B2 | `=EOMONTH(B1,0)` |

Format B1 as Date.

**Section 2: Shift summary (Row 4–10)**

| Cell | Content |
|---|---|
| A4 | `SHIFTS` (bold) |
| A5 | `Total shifts this month` |
| B5 | `=COUNTIFS(Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2)` |
| A6 | `Day shifts` |
| B6 | `=COUNTIFS(Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2,Shifts!J:J,"Day")` |
| A7 | `Night shifts` |
| B7 | `=COUNTIFS(Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2,Shifts!J:J,"Night")` |
| A8 | `Total hours on shift` |
| B8 | `=SUMIFS(Shifts!I:I,Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2)` |
| A9 | `Shifts not yet completed` |
| B9 | `=COUNTIFS(Shifts!C:C,"Scheduled",Shifts!D:D,"<"&TODAY())` |
| A10 | `Upcoming shifts (next 14 days)` |
| B10 | `=COUNTIFS(Shifts!C:C,"Scheduled",Shifts!D:D,">="&TODAY(),Shifts!D:D,"<="&TODAY()+14)` |

**Section 3: Callout summary (Row 12–20)**

| Cell | Content |
|---|---|
| A12 | `CALLOUTS` (bold) |
| A13 | `Total callouts this month` |
| B13 | `=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2)` |
| A14 | `Expense claimable (unclaimed)` |
| B14 | `=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2,Callouts!O:O,"Yes",Callouts!P:P,"")` |
| A15 | `PR:1 callouts` |
| B15 | `=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2,Callouts!I:I,"PR:1")` |
| A16 | `PR:2 callouts` |
| B16 | `=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2,Callouts!I:I,"PR:2")` |
| A17 | `PR:3 callouts` |
| B17 | `=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2,Callouts!I:I,"PR:3")` |

**Section 4: Training and certs (Row 22–27)**

| Cell | Content |
|---|---|
| A22 | `TRAINING & CERTS` (bold) |
| A23 | `Training events this month` |
| B23 | `=COUNTIFS(Training!D:D,">="&B1,Training!D:D,"<="&B2,Training!C:C,"Completed")` |
| A24 | `Training hours this month` |
| B24 | `=SUMIFS(Training!H:H,Training!D:D,">="&B1,Training!D:D,"<="&B2,Training!C:C,"Completed")` |
| A25 | `Certs expiring within 60 days` |
| B25 | `=COUNTIFS(Training!K:K,">="&TODAY(),Training!K:K,"<="&TODAY()+60)` |
| A26 | `Certs already expired` |
| B26 | `=COUNTIFS(Training!K:K,"<"&TODAY(),Training!K:K,"<>"&"")` |

**Section 5: Expenses (Row 29–34)**

| Cell | Content |
|---|---|
| A29 | `EXPENSES` (bold) |
| A30 | `Total claimed this month` |
| B30 | `=SUMIFS(Expenses!F:F,Expenses!B:B,">="&B1,Expenses!B:B,"<="&B2)` |
| A31 | `Total claimed YTD` |
| B31 | `=SUMIFS(Expenses!F:F,Expenses!B:B,">="&DATE(YEAR(B1),1,1),Expenses!B:B,"<="&B2)` |
| A32 | `Awaiting payment` |
| B32 | `=SUMIFS(Expenses!F:F,Expenses!G:G,"Submitted")` |
| A33 | `Callouts with unclaimed expenses` |
| B33 | `=COUNTIFS(Callouts!O:O,"Yes",Callouts!P:P,"")` |

### Formatting tips
- Make column A width ~220px so labels don't truncate
- Bold the section headers (SHIFTS, CALLOUTS, TRAINING & CERTS, EXPENSES)
- Highlight B9 with orange background if > 0 (shifts needing follow-up)
- Highlight B25 with orange if > 0, B26 with red if > 0

---

## Final checklist

- [ ] `_lists` tab created and hidden
- [ ] Named ranges created for all lists
- [ ] `Shifts` tab has dropdown validation added (status, shift_type)
- [ ] `Shifts` tab duration formula in column I, formatted as Number
- [ ] `Callouts` tab created with headers, validation, duration formula
- [ ] `Training` tab created with headers, validation, expiry formula + conditional formatting
- [ ] `Expenses` tab created with headers and validation
- [ ] `Summary` tab created with all formulas and period selector in B1
- [ ] Tabs in correct order: Shifts, Callouts, Training, Expenses, Summary, _lists, Import Log
- [ ] Sheet URL added to README.md

---

## Notes

- The Google Form (callout capture) will be set up separately and linked to the Callouts tab. When connected, it will auto-populate rows and generate callout_ids.
- The Summary tab period selector (B1) needs to be updated each month — or you can remove the date filter from the formulas to show all-time totals.
