# Sheet setup — minimal (for roster importer)

Create just enough of the Sheet for the roster importer to work.
Full Sheet implementation is a separate session — do not add other tabs yet.

---

## Create the Sheet

1. Go to Google Drive → your `SAAS Volunteering` folder
2. New → Google Sheets → rename to **SAAS Volunteer Log**
3. Paste the Sheet URL into `README.md` in the repo

---

## Tab 1: Shifts

Rename the default `Sheet1` tab to `Shifts`.

Add these column headers in Row 1, exactly as written:

| Col | Header | Notes |
|-----|--------|-------|
| A | `shift_id` | e.g. `2026-04-21-N-001` |
| B | `calendar_event_id` | |
| C | `status` | |
| D | `date` | |
| E | `start_time` | |
| F | `end_time` | |
| G | `actual_start_time` | Pre-filled by importer |
| H | `actual_end_time` | Pre-filled by importer |
| I | `duration_hours` | |
| J | `shift_type` | `Day` or `Night` |
| K | `station` | e.g. `Burra` |
| L | `shift_number` | e.g. `60` or `180` — reads naturally as e.g. "Burra 60" left to right |
| M | `callout_ids` | |
| N | `notes` | |
| O | `created_at` | |

- Bold Row 1
- Freeze Row 1: View → Freeze → 1 row
- Tab colour: Green (right-click tab → Change colour)

**Note:** `actual_start_time` and `actual_end_time` are pre-filled by the importer from scheduled times — edit only if the actual times differed. Columns K and L read as station then shift number (e.g. Burra | 60) which matches SAAS shift designation convention (Burra60, Burra180).

That's it for this tab — the importer will populate rows automatically.

---

## Tab 2: Import Log

Create a new tab named `Import Log`.

Add these column headers in Row 1:

| Col | Header |
|-----|--------|
| A | `filename` |
| B | `imported_at` |
| C | `shifts_created` |
| D | `shifts_skipped` |
| E | `status` |

- Bold Row 1
- Freeze Row 1
- Tab colour: Grey (right-click tab → Change colour)

This tab is written by the Apps Script. Do not edit it manually.

---

## Done

That's all that's needed for the importer. Do not create any other tabs yet.
Full Sheet setup (Callouts, Training, Expenses, Summary, _lists tabs) is a separate session.
