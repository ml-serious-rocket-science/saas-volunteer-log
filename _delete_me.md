## How Google Calendar fits

Google Calendar is for **rostering and visibility only** — not data capture. It shows upcoming shifts and training for Michael and his wife. All operational detail (callouts, clinical notes, expenses, reflections) lives in the Sheet.

**Calendar event types:**

| Event type | Colour | Sheet record |
|---|---|---|
| On-call shift | Blueberry | Shift record |
| Training event | Sage | Training record |
| Other volunteer activity | Graphite | Optional — shift or training record |

Callouts do **not** get calendar events. They are captured via the Google Form and stored in the Callouts tab.

**The link between Calendar and Sheet:**
- Sheet records store `calendar_event_id` — the Google Calendar event ID, copied from the event URL
- Calendar event descriptions store `Sheet record: SH-YYYYMMDD-001` — a reference back to the Sheet row
- This two-way link allows navigation in either direction and survives a future port to an app

**Workflow:**
1. Roster arrives → create Calendar shift events (rostering step)
2. Sheet row created → paste Calendar event ID into `calendar_event_id`, add Sheet record ID to Calendar description
3. Callout occurs during shift → fill in capture Form on phone
4. After shift → update Sheet row status to Completed, fill in actuals
5. Training scheduled → Calendar event created → Sheet row filled in when complete

