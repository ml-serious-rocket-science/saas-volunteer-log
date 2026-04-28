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
  // GREEN is the closest to the Eucalyptus colour set on the calendar manually
  eventColour:      CalendarApp.EventColor.GREEN,

  // SAAS operational shift numbers by station and shift type.
  // Add new stations here as needed — leave blank if unknown.
  shiftNumbers: {
    'Burra': { Day: '60', Night: '180' },
  },
};

const DAY_COLS = {
  Monday: 3, Tuesday: 7, Wednesday: 11, Thursday: 15,
  Friday: 19, Saturday: 23, Sunday: 27,
};

// Shifts tab column indices (0-based) — must match sheet-setup-minimal.md
const SHIFTS_COLS = {
  shift_id:          0,  // A  e.g. 2026-03-06-D-001
  calendar_event_id: 1,  // B
  status:            2,  // C
  date:              3,  // D
  start_time:        4,  // E
  end_time:          5,  // F
  actual_start_time: 6,  // G  pre-filled from start_time
  actual_end_time:   7,  // H  pre-filled from end_time
  duration_hours:    8,  // I
  shift_type:        9,  // J  Day / Night
  station:           10, // K
  shift_number:      11, // L  SAAS operational number e.g. 60 / 180 — reads left-to-right as Burra60
  callout_ids:       12, // M
  notes:             13, // N
  created_at:        14, // O
};

const LOG_COLS = {
  filename: 0, imported_at: 1, shifts_created: 2, shifts_skipped: 3, status: 4,
};


// ─── MENU ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SAAS Roster')
    .addItem('Import all new rosters', 'importAllNewRosters')
    .addItem('Import latest roster only', 'importLatestRoster')
    .addSeparator()
    .addItem('DEBUG: Inspect latest roster', 'debugInspectLatestRoster')
    .addItem('Authorise script (run once after setup)', 'authoriseScript')
    .addToUi();
}

function authoriseScript() {
  GmailApp.getInboxThreads(0, 1);
  CalendarApp.getCalendarsByName(CONFIG.calendarName);
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.getUi().alert('Authorisation complete.');
}


// ─── DEBUG ────────────────────────────────────────────────────────────────────

function debugInspectLatestRoster() {
  const ui = SpreadsheetApp.getUi();
  const threads = findRosterEmails_();
  if (threads.length === 0) { ui.alert('No roster emails found.'); return; }
  const attachments = collectRosterAttachments_(threads);
  if (attachments.length === 0) { ui.alert('No matching attachments found.'); return; }

  const att = attachments[1] || attachments[0];
  ui.alert('Inspecting: ' + att.filename + '\n\nConverting — check Logs when done (View → Logs).');

  const tempFileId = uploadAndConvert_(att.blob, att.filename);
  try {
    const tempSS = SpreadsheetApp.openById(tempFileId);
    const rdpSheet = tempSS.getSheetByName('RDP');
    if (!rdpSheet) { ui.alert('No RDP sheet found.'); return; }

    const lastRow = Math.min(rdpSheet.getLastRow(), 45);
    const lastCol = Math.min(rdpSheet.getLastColumn(), 32);
    const display = rdpSheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    Logger.log('=== FILE: ' + att.filename + ' ===');
    Logger.log('--- Column A display values (rows 4-45) ---');
    display.forEach((row, i) => {
      if (i < 3) return;
      if (row[0] && row[0].trim()) Logger.log('  Row ' + (i+1) + ': "' + row[0] + '"');
    });

    Logger.log('--- Date row (row 4) display values ---');
    const dateRow = display[3] || [];
    [3,7,11,15,19,23,27].forEach(col => {
      Logger.log('  Col ' + col + ': "' + (dateRow[col] || '') + '"');
    });

    Logger.log('--- Searching day columns for "' + CONFIG.volunteerName + '" ---');
    Object.entries(DAY_COLS).forEach(([day, col]) => {
      display.forEach((row, i) => {
        if (i < 4) return;
        if ((row[col] || '').toLowerCase().includes(CONFIG.volunteerName.toLowerCase())) {
          let nearestTime = '';
          for (let r = i; r >= 4; r--) {
            if (display[r][0] && display[r][0].trim()) { nearestTime = display[r][0]; break; }
          }
          Logger.log('  ' + day + ' row' + (i+1) + ': "' + row[col] + '" | time: "' + nearestTime + '"');
        }
      });
    });

  } finally {
    try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch(e) {}
  }
  ui.alert('Done. Check View → Logs.');
}


// ─── MAIN ENTRY POINTS ────────────────────────────────────────────────────────

function importAllNewRosters() {
  const ui = SpreadsheetApp.getUi();

  const threads = findRosterEmails_();
  if (threads.length === 0) { ui.alert('No roster emails found from ' + CONFIG.rosterSender + '.'); return; }

  const attachments = collectRosterAttachments_(threads);
  if (attachments.length === 0) { ui.alert('No attachments matching "' + CONFIG.attachmentPrefix + '".'); return; }

  const importedNames = getImportedFilenames_();
  const toProcess = attachments.filter(a => !importedNames.has(a.filename));
  const alreadyDone = attachments.length - toProcess.length;

  if (toProcess.length === 0) { ui.alert('All rosters already imported. Nothing to do.'); return; }

  const allShifts = [];
  const parseErrors = [];

  toProcess.forEach(att => {
    try {
      const shifts = parseRosterBlob_(att.blob, att.filename);
      shifts.forEach(s => { s._sourceFile = att.filename; });
      allShifts.push(...shifts);
    } catch(e) {
      parseErrors.push({ filename: att.filename, error: e.message });
    }
  });

  const lines = ['Ready to import from ' + toProcess.length + ' new roster file(s).' +
    (alreadyDone > 0 ? ' (' + alreadyDone + ' already done.)' : ''), ''];

  toProcess.forEach(att => {
    const fileShifts = allShifts.filter(s => s._sourceFile === att.filename);
    const err = parseErrors.find(e => e.filename === att.filename);
    lines.push('📄 ' + att.filename);
    if (err) lines.push('   ⚠ Error: ' + err.error);
    else if (fileShifts.length === 0) lines.push('   (no shifts for ' + CONFIG.volunteerName + ' this week)');
    else fileShifts.forEach(s => lines.push(
      '   • ' + s.date + ' (' + s.shiftType + ')  ' + s.startTime + '–' + s.endTime +
      '  shift #' + (s.shiftNumber || '?')
    ));
  });

  lines.push('', 'Continue?');
  const response = ui.alert('Confirm roster import', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) { ui.alert('Import cancelled — nothing was changed.'); return; }

  let totalCreated = 0, totalSkipped = 0;

  toProcess.forEach(att => {
    const err = parseErrors.find(e => e.filename === att.filename);
    if (err) { logImport_(att.filename, 0, 0, 'PARSE ERROR: ' + err.error); return; }
    const fileShifts = allShifts.filter(s => s._sourceFile === att.filename);
    if (fileShifts.length === 0) { logImport_(att.filename, 0, 0, 'No shifts found'); return; }
    const result = createEventsAndRows_(fileShifts);
    logImport_(att.filename, result.created, result.skipped, 'OK');
    totalCreated += result.created;
    totalSkipped += result.skipped;
  });

  ui.alert('Import complete!\n\nFiles processed: ' + toProcess.length +
    '\nShifts created: ' + totalCreated + '\nDuplicates skipped: ' + totalSkipped +
    '\n\nCheck the Import Log tab and your Google Calendar.');
}


function importLatestRoster() {
  const ui = SpreadsheetApp.getUi();
  const threads = findRosterEmails_();
  if (threads.length === 0) { ui.alert('No roster emails found.'); return; }

  const attachments = collectRosterAttachments_(threads);
  const importedNames = getImportedFilenames_();
  const toProcess = attachments.filter(a => !importedNames.has(a.filename));
  if (toProcess.length === 0) { ui.alert('Latest roster already imported.'); return; }

  const latest = toProcess[0];
  let shifts;
  try { shifts = parseRosterBlob_(latest.blob, latest.filename); }
  catch(e) { ui.alert('Could not parse ' + latest.filename + ':\n\n' + e.message); return; }

  if (shifts.length === 0) {
    ui.alert('No shifts found for "' + CONFIG.volunteerName + '" in:\n\n' + latest.filename);
    logImport_(latest.filename, 0, 0, 'No shifts found');
    return;
  }

  const lines = [latest.filename, '', 'Shifts found:'];
  shifts.forEach(s => lines.push(
    '  • ' + s.date + ' (' + s.shiftType + ')  ' + s.startTime + '–' + s.endTime +
    '  shift #' + (s.shiftNumber || '?')
  ));
  lines.push('', 'Continue?');

  const response = ui.alert('Confirm', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) { ui.alert('Cancelled.'); return; }

  const result = createEventsAndRows_(shifts);
  logImport_(latest.filename, result.created, result.skipped, 'OK');
  ui.alert('Done!\n\nShifts created: ' + result.created + '\nDuplicates skipped: ' + result.skipped);
}


// ─── GMAIL ────────────────────────────────────────────────────────────────────

function findRosterEmails_() {
  return GmailApp.search('from:' + CONFIG.rosterSender + ' has:attachment', 0, 50);
}

function collectRosterAttachments_(threads) {
  const results = [];
  const prefix = CONFIG.attachmentPrefix.toLowerCase();
  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      message.getAttachments().forEach(att => {
        const name = att.getName();
        const lower = name.toLowerCase();
        if (lower.startsWith(prefix) && (lower.endsWith('.xlsm') || lower.endsWith('.xlsx'))) {
          results.push({ filename: name, blob: att.copyBlob(), date: message.getDate() });
        }
      });
    });
  });
  results.sort((a, b) => b.date - a.date);
  const seen = new Set();
  return results.filter(r => { if (seen.has(r.filename)) return false; seen.add(r.filename); return true; });
}


// ─── ROSTER PARSING ───────────────────────────────────────────────────────────

function parseRosterBlob_(blob, filename) {
  const tempFileId = uploadAndConvert_(blob, filename);
  let display;
  try {
    const tempSS = SpreadsheetApp.openById(tempFileId);
    const rdpSheet = tempSS.getSheetByName('RDP');
    if (!rdpSheet) throw new Error('No RDP sheet found in ' + filename);
    const lastRow = Math.min(rdpSheet.getLastRow(), 90);
    const lastCol = Math.min(rdpSheet.getLastColumn(), 32);
    display = rdpSheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  } finally {
    try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch(e) {}
  }
  return extractShifts_(display, filename);
}

function uploadAndConvert_(blob, filename) {
  const token = ScriptApp.getOAuthToken();
  const boundary = 'saas_roster_' + Date.now();
  const metadata = JSON.stringify({
    name: '_roster_tmp_' + filename.replace(/\.xlsm?$/i, ''),
    mimeType: 'application/vnd.google-apps.spreadsheet',
  });

  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      payload: '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + metadata + '\r\n' +
               '--' + boundary + '\r\nContent-Type: application/vnd.ms-excel.sheet.macroenabled.12\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
               Utilities.base64Encode(blob.getBytes()) + '\r\n--' + boundary + '--',
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Drive upload failed (' + response.getResponseCode() + '): ' +
      response.getContentText().substring(0, 200));
  }
  const result = JSON.parse(response.getContentText());
  if (!result.id) throw new Error('No file ID returned from Drive.');
  return result.id;
}

function extractShifts_(display, filename) {
  const dateRow = display[3];
  const nameFragment = CONFIG.volunteerName.toLowerCase();
  const shifts = [];

  Object.entries(DAY_COLS).forEach(([dayName, nameCol]) => {
    if (nameCol >= (display[0] || []).length) return;

    const rawDate = (dateRow[nameCol] || '').toString().trim();
    const shiftDate = parseDisplayDate_(rawDate);
    if (!shiftDate) return;

    const matchingRows = [];
    display.forEach((row, rowIdx) => {
      if (rowIdx < 4) return;
      if (nameCol >= row.length) return;
      if (!(row[nameCol] || '').toLowerCase().includes(nameFragment)) return;

      let timeStr = '';
      for (let r = rowIdx; r >= 4; r--) {
        const t = (display[r][0] || '').trim();
        if (t) { timeStr = t; break; }
      }
      matchingRows.push({ rowIdx, timeStr });
    });

    if (matchingRows.length === 0) return;

    const startHour = parseDisplayTime_(matchingRows[0].timeStr);
    const lastHour  = parseDisplayTime_(matchingRows[matchingRows.length - 1].timeStr);

    if (startHour === null || lastHour === null) {
      Logger.log('Could not parse times for ' + dayName + ' in ' + filename +
        ' | first: "' + matchingRows[0].timeStr + '" last: "' +
        matchingRows[matchingRows.length - 1].timeStr + '"');
      return;
    }

    const endHour = lastHour + 1;
    const isNight = endHour > 23 || endHour <= startHour;
    const shiftType = isNight ? 'Night' : 'Day';

    // Build dates using explicit year/month/day from the parsed shift date.
    // Use addDays_() for the overnight end date to handle month-boundary correctly.
    const y = shiftDate.getFullYear();
    const mo = shiftDate.getMonth();
    const d = shiftDate.getDate();

    const startDate = new Date(y, mo, d, startHour, 0, 0, 0);
    const endDate = isNight
      ? new Date(y, mo, d + 1, endHour % 24, 0, 0, 0)  // JS Date handles month rollover correctly
      : new Date(y, mo, d, endHour, 0, 0, 0);

    const dateStr = y + '-' + pad_(mo + 1) + '-' + pad_(d);

    const stationNumbers = CONFIG.shiftNumbers[CONFIG.station] || {};
    const shiftNumber = stationNumbers[shiftType] || '';

    shifts.push({
      day: dayName, date: dateStr,
      startTime: pad_(startHour) + ':00',
      endTime:   pad_(endHour % 24) + ':00',
      shiftType, shiftNumber, startDate, endDate,
      station: CONFIG.station, hours: matchingRows.length,
      shiftId: null, // assigned in createEventsAndRows_
    });
  });

  return shifts;
}


// ─── CALENDAR + SHEET ─────────────────────────────────────────────────────────

function createEventsAndRows_(shifts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shiftsSheet = ss.getSheetByName(CONFIG.shiftsTab);
  if (!shiftsSheet) throw new Error('Shifts tab not found.');

  const calendars = CalendarApp.getCalendarsByName(CONFIG.calendarName);
  if (calendars.length === 0) throw new Error('Calendar "' + CONFIG.calendarName + '" not found.');
  const calendar = calendars[0];

  let created = 0, skipped = 0;

  shifts.forEach(shift => {
    if (shiftExists_(shiftsSheet, shift.date, shift.startTime)) { skipped++; return; }

    const shiftId = generateShiftId_(shift.date, shift.shiftType, shiftsSheet);
    shift.shiftId = shiftId;

    const event = calendar.createEvent(
      'On-call — ' + shift.station,
      shift.startDate, shift.endDate,
      { description: 'Sheet record: ' + shiftId }
    );
    event.setColor(CONFIG.eventColour);
    const eventId = event.getId();

    const row = new Array(15).fill('');
    row[SHIFTS_COLS.shift_id]          = shiftId;
    row[SHIFTS_COLS.calendar_event_id] = eventId;
    row[SHIFTS_COLS.status]            = 'Scheduled';
    row[SHIFTS_COLS.date]              = shift.date;
    row[SHIFTS_COLS.start_time]        = shift.startTime;
    row[SHIFTS_COLS.end_time]          = shift.endTime;
    row[SHIFTS_COLS.actual_start_time] = shift.startTime;
    row[SHIFTS_COLS.actual_end_time]   = shift.endTime;
    row[SHIFTS_COLS.shift_type]        = shift.shiftType;
    row[SHIFTS_COLS.shift_number]      = shift.shiftNumber;
    row[SHIFTS_COLS.station]           = shift.station;
    row[SHIFTS_COLS.created_at]        = formatDateTime_(new Date());
    shiftsSheet.appendRow(row);
    created++;
  });

  return { created, skipped };
}


// ─── IMPORT LOG ───────────────────────────────────────────────────────────────

function getImportedFilenames_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.importLogTab);
  if (!logSheet || logSheet.getLastRow() < 2) return new Set();
  return new Set(
    logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 1).getValues()
      .flat().filter(v => v !== '')
  );
}

function logImport_(filename, created, skipped, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.importLogTab);
  if (!logSheet) return;
  const row = ['', '', '', '', ''];
  row[LOG_COLS.filename]       = filename;
  row[LOG_COLS.imported_at]    = formatDateTime_(new Date());
  row[LOG_COLS.shifts_created] = created;
  row[LOG_COLS.shifts_skipped] = skipped;
  row[LOG_COLS.status]         = status;
  logSheet.appendRow(row);
}


// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Parses a date display string produced by Google Sheets on an Australian
 * Workspace account. Format is DD/M/YYYY or D/M/YYYY (day-first).
 *
 * Examples: "6/3/2026" = 6 March 2026, "20/4/2026" = 20 April 2026
 *
 * Disambiguation rules for slash-separated dates:
 *   - If first number > 12: must be day (DD/MM/YYYY)
 *   - If second number > 12: must be month-first (MM/DD/YYYY) — shouldn't occur
 *   - Otherwise: assume day-first (Australian locale)
 *
 * The new Date(str) fallback is intentionally removed — if the format is
 * unexpected it returns null so the caller can log a warning rather than
 * silently inserting a wrong date.
 */
function parseDisplayDate_(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();

  // Primary format: D/M/YYYY or DD/MM/YYYY (Australian locale from Workspace)
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const year = parseInt(slashMatch[3]) < 100 ? 2000 + parseInt(slashMatch[3]) : parseInt(slashMatch[3]);

    let day, month;
    if (a > 12) {
      // First number can only be a day
      day = a; month = b;
    } else if (b > 12) {
      // Second number can only be a day — unexpected for AU locale but handle it
      day = b; month = a;
    } else {
      // Ambiguous — default to day-first (Australian DD/MM/YYYY)
      day = a; month = b;
    }

    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Log unexpected format rather than silently misparse
  Logger.log('parseDisplayDate_: unexpected format "' + str + '" — returning null');
  return null;
}

/**
 * Parses a time display string to an hour (0-23).
 * Handles: "6:00", "18:00", "6:00 AM", "6:00 PM", "18:00:00"
 */
function parseDisplayTime_(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();

  // "6:00 AM" / "6:00 PM"
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1]);
    const isPM = ampmMatch[3].toUpperCase() === 'PM';
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h;
  }

  // "6:00" / "18:00" / "18:00:00"
  const plainMatch = str.match(/^(\d{1,2}):\d{2}/);
  if (plainMatch) return parseInt(plainMatch[1]);

  return null;
}

function formatDate_(d) {
  return d.getFullYear() + '-' + pad_(d.getMonth() + 1) + '-' + pad_(d.getDate());
}

function formatDateTime_(d) {
  return formatDate_(d) + ' ' +
    pad_(d.getHours()) + ':' + pad_(d.getMinutes()) + ':' + pad_(d.getSeconds());
}

function pad_(n) { return String(n).padStart(2, '0'); }

function shiftExists_(sheet, date, startTime) {
  if (sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues().some(row =>
    row[SHIFTS_COLS.date].toString().trim() === date &&
    row[SHIFTS_COLS.start_time].toString().trim() === startTime
  );
}

/**
 * Generates a shift ID in format YYYY-MM-DD-{D|N}-NNN
 * D = Day shift, N = Night shift
 * Sequence suffix handles the rare case of two shifts on the same date.
 */
function generateShiftId_(dateStr, shiftType, sheet) {
  const typeCode = shiftType === 'Night' ? 'N' : 'D';
  const prefix = dateStr + '-' + typeCode + '-';
  let maxSeq = 0;

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().forEach(id => {
      const idStr = id.toString();
      if (idStr.startsWith(prefix)) {
        const seq = parseInt(idStr.slice(prefix.length));
        if (!isNaN(seq)) maxSeq = Math.max(maxSeq, seq);
      }
    });
  }

  return prefix + String(maxSeq + 1).padStart(3, '0');
}
