# Google Calendar setup

How to configure Google Calendar as the entry point for the volunteer logging workflow. Do this before setting up the Sheet.

---

## What the calendar is for

The calendar has two jobs and only two jobs:

1. **Rostering** — seeing upcoming shifts and training at a glance, for you and your wife
2. **Navigation** — a reference back to the Sheet record where the detail lives

It is deliberately not a data capture tool. Callout details, clinical notes, expense information, and reflections all live in the Sheet. The calendar event is the lightweight front door — not the record itself.

**Why this boundary matters:**
- No sensitive clinical or operational detail in the calendar (privacy)
- No double data entry — you log once, in the Sheet
- Your wife sees what she needs (when you're on shift) without seeing operational detail
- The calendar stays clean and scannable

---

## Calendar strategy

Use a **dedicated `SAAS Volunteering` calendar**, separate from your personal calendar, shared with your wife's Google Workspace account.

**Why not your personal calendar:**
- No way to filter to just volunteer events
- Your wife sees everything mixed together — harder to scan for your shifts
- Harder to target with the roster automation script (Layer 2)

**Why a shared dedicated calendar:**
- Your wife sees your shifts as a separate overlay — she can toggle it on/off
- You can show/hide it independently on your own calendar
- Apps Script targets it cleanly by calendar ID for roster automation

---

## Create the calendar

1. Open Google Calendar on desktop
2. In the left sidebar, next to "Other calendars" click **+**
3. Select **Create new calendar**
4. Name it: `SAAS Volunteering`
5. Description: `Michael's SAAS on-call shifts and training — rostering only`
6. Click **Create calendar**

On Android the new calendar appears automatically once it syncs.

---

## Share with your wife

1. Hover over `SAAS Volunteering` in the sidebar → three dots → **Settings and sharing**
2. Under **Share with specific people or groups** → **+ Add people**
3. Enter her Google Workspace email address
4. Permission: **See all event details**
5. Click **Send**

Once she accepts, `SAAS Volunteering` appears in her "Other calendars". She can set her own colour for it and toggle visibility independently.

---

## Colour coding convention

Colours chosen to align with SAAS organisational branding where possible.

| Event type | Colour | Notes |
|---|---|---|
| On-call shift | Eucalyptus | Closest available Google Calendar colour to SAAS green |
| Training event | Sage | Confirmed training only |
| Other volunteer activity | Graphite | Station meetings, admin days |

Callouts do **not** get calendar events. They are logged in the Sheet via the capture Form. The shift event already covers the time period.

To set a colour: open the event → click the colour dot next to the title → select colour.

---

## Standard event format

Keep event content minimal — just enough to identify the event and link to the Sheet record.

### On-call shift

**Title:** `On-call — [Station]`
Example: `On-call — Stirling`

**Description:**
```
Sheet record: SH-YYYYMMDD-001
```
*(Leave blank until the Sheet row is created, then add the Shift ID)*

**Duration:** Set actual start and end times — not all-day

---

### Training event

**Title:** `Training — [Event name]`
Example: `Training — CPR Recertification`

**Description:**
```
Sheet record: TR-YYYYMMDD-001
```

**Duration:** Set actual start and end times

---

## Android setup

1. Open the Google Calendar app
2. Hamburger menu → find `SAAS Volunteering` → ensure it has a tick (visible)
3. Tap the calendar name → set colour to Eucalyptus

**Recommended notifications for shifts:**
- 1 day before — shift is tomorrow
- 1 hour before — time to get ready

Set default notifications on desktop: Settings → click `SAAS Volunteering` → Event notifications → add 1 day + 1 hour.

---

## Workflow in practice

### When the roster arrives (Wednesday)

1. Open the Excel roster email
2. Find your shifts for the coming week
3. For each shift, create a Calendar event:
   - Calendar: `SAAS Volunteering` (not personal)
   - Title: `On-call — [Station]`
   - Start/end times from the roster
   - Colour: Eucalyptus
   - Description: leave blank for now
4. Your wife's calendar updates automatically

### Creating the Sheet row (anytime before or after the shift)

1. Open the Sheet → Shifts tab → create a new row
2. Generate the Shift ID: `SH-YYYYMMDD-001`
3. Copy the Calendar event ID from the event URL
4. Paste into `calendar_event_id` in the Sheet row
5. Go back to the Calendar event → add `Sheet record: SH-YYYYMMDD-001` to the description

This two-way link means you can navigate from either direction — Calendar event to Sheet row, or Sheet row to Calendar event.

### During/after a shift

- Callouts: open the capture Form on your phone — log there, not in the calendar
- After the shift: open the Sheet row, update status to Completed, fill in actuals

---

## What comes next

Once the Calendar is set up and shared, the next step is the Google Sheet. See `sheet-setup-spec.md` once it is written.
