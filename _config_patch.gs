/**
 * RosterImport.gs
 *
 * Imports SAAS shift rosters from Gmail into Google Calendar and the Shifts tab.
 *
 * Setup:
 *   1. Open your SAAS Volunteer Log Google Sheet
 *   2. Extensions → Apps Script
 *   3. Paste this entire file as RosterImport.gs
 *   4. Save (Ctrl+S)
 *   5. Run authoriseScript() once from the function dropdown to grant permissions
 *   6. The "SAAS Roster" menu will appear in your Sheet after refresh
 *
 * Usage:
 *   Sheet menu → SAAS Roster → Import all new rosters   (backfill / weekly)
 *   Sheet menu → SAAS Roster → Import latest roster     (single file)
 *   Safe to run repeatedly — already-imported rosters are skipped automatically.
 */


// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CONFIG = {
  rosterSender:     'jazz_vincent@hotmail.com',
  attachmentPrefix: 'BURRA ROSTER WEEK',
  calendarName:     'SAAS Volunteering',
  shiftsTab:        'Shifts',
  importLogTab:     'Import Log',
  volunteerName:    'Liddy',
  station:          'Burra',
  // Valid CalendarApp.EventColor values:
  // PALE_BLUE, PALE_GREEN, MAUVE, PALE_RED, YELLOW, ORANGE, CYAN, GRAY, BLUE, GREEN, RED
  // GREEN is the closest available to the Eucalyptus colour set on the calendar manually
  eventColour:      CalendarApp.EventColor.GREEN,

  // SAAS operational shift numbers by station and shift type.
  // Add new stations here as needed — leave blank if unknown.
  shiftNumbers: {
    'Burra': { Day: '60', Night: '180' },
  },
};
