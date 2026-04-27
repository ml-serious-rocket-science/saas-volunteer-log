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
 *   5. Run authoriseScript() once to grant permissions
 *   6. The "SAAS Roster" menu will appear in your Sheet after refresh
 *
 * Usage:
 *   Sheet menu → SAAS Roster → Import all new rosters
 *   (Safe to run repeatedly — already-imported rosters are skipped)
 */


// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CONFIG = {
  // Gmail sender to search for roster emails
  rosterSender: 'jazz_vincent@hotmail.com',

  // Attachment filename must start with this string (case-insensitive)
  attachmentPrefix: 'BURRA ROSTER WEEK',

  // Exact name of your SAAS Volunteering Google Calendar
  calendarName: 'SAAS Volunteering',

  // Tab names in the Sheet — must match exactly
  shiftsTab:    'Shifts',
  importLogTab: 'Import Log',

  // Your name fragment to find in the roster (case-insensitive)
  volunteerName: 'Liddy',

  // Station name for Calendar event titles
  station: 'Burra',

  // Calendar event colour
  // Options: TEAL, SAGE, BLUEBERRY, RED, GRAPHITE, PINK, ORANGE, YELLOW, GREEN, CYAN, MAUVE
  eventColour: CalendarApp.EventColor.TEAL,
};

// Roster column positions (proven consistent across all files)
const DAY_COLS = {
  Monday:    3,
  Tuesday:   7,
  Wednesday: 11,
  Thursday:  15,
  Friday:    19,
  Saturday:  23,
  Sunday:    27,
};

// Shifts tab column indices (0-based)
const SHIFTS_COLS = {
  shift_id:          0,
  calendar_event_id: 1,
  status:            2,
  date:              3,
  start_time:        4,
  end_time:          5,
  actual_start_time: 6,
  actual_end_time:   7,
  duration_hours:    8,
  overnight:         9,
  station:           10,
  callout_ids:       11,
  notes:             12,
  created_at:        13,
};

// Import Log column indices (0-based)
const LOG_COLS = {
  filename:       0,
  imported_at:    1,
  shifts_created: 2,
  shifts_skipped: 3,
  status:         4,
};


// ─── MENU ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SAAS Roster')
    .addItem('Import all new rosters', 'importAllNewRosters')
    .addItem('Import latest roster only', 'importLatestRoster')
    .addSeparator()
    .addItem('Authorise script (run once)', 'authoriseScript')
    .addToUi();
}

// Run this once after pasting the script to grant all required permissions
function authoriseScript() {
  GmailApp.getInboxThreads(0, 1);
  CalendarApp.getCalendarsByName(CONFIG.calendarName);
  SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.getUi().alert('Authorisation complete. You can now use the SAAS Roster menu.');
}


// ─── MAIN ENTRY POINTS ────────────────────────────────────────────────────────

/**
 * Finds all unprocessed roster emails and imports them.
 * Safe to run repeatedly — skips already-imported files.
 */
function importAllNewRosters() {
  const threads = findRosterEmails_();
  if (threads.length === 0) {
    SpreadsheetApp.getUi().alert('No roster emails found from ' + CONFIG.rosterSender + '.');
    return;
  }

  const attachments = collectRosterAttachments_(threads);
  if (attachments.length === 0) {
    SpreadsheetApp.getUi().alert('No roster attachments found matching "' + CONFIG.attachmentPrefix + '".');
    return;
  }

  const importedNames = getImportedFilenames_();
  const toProcess = attachments.filter(a => !importedNames.has(a.filename));
  const alreadyDone = attachments.length - toProcess.length;

  if (toProcess.length === 0) {
    SpreadsheetApp.getUi().alert(
      'All ' + attachments.length + ' roster file(s) have already been imported.\n\nNothing to do.'
    );
    return;
  }

  // Build preview of shifts across all files
  const allShifts = [];
  const parseErrors = [];

  toProcess.forEach(att => {
    try {
      const shifts = parseRosterBlob_(att.blob, att.filename);
      shifts.forEach(s => { s._sourceFile = att.filename; });
      allShifts.push(...shifts);
    } catch (e) {
      parseErrors.push(att.filename + ': ' + e.message);
    }
  });

  if (allShifts.length === 0 && parseErrors.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Found ' + toProcess.length + ' unprocessed file(s) but no shifts for "' +
      CONFIG.volunteerName + '" were found in any of them.'
    );
    return;
  }

  // Confirmation dialog
  const lines = [];
  lines.push('Ready to import shifts from ' + toProcess.length + ' roster file(s):');
  if (alreadyDone > 0) lines.push('(' + alreadyDone + ' already imported — will be skipped)');
  lines.push('');

  // Group by file
  toProcess.forEach(att => {
    const fileShifts = allShifts.filter(s => s._sourceFile === att.filename);
    lines.push('📄 ' + att.filename);
    if (fileShifts.length === 0) {
      lines.push('   (no shifts for ' + CONFIG.volunteerName + ')');
    } else {
      fileShifts.forEach(s => {
        const overnight = s.overnight ? ' (overnight)' : '';
        lines.push('   • ' + s.day + ' ' + s.date + ': ' + s.startTime + '–' + s.endTime + overnight);
      });
    }
  });

  if (parseErrors.length > 0) {
    lines.push('');
    lines.push('⚠ Parse errors:');
    parseErrors.forEach(e => lines.push('   ' + e));
  }

  lines.push('');
  lines.push('Continue?');

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirm roster import', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('Import cancelled.');
    return;
  }

  // Process each file
  let totalCreated = 0;
  let totalSkipped = 0;

  toProcess.forEach(att => {
    const fileShifts = allShifts.filter(s => s._sourceFile === att.filename);
    const result = createEventsAndRows_(fileShifts);
    logImport_(att.filename, result.created, result.skipped, 'OK');
    totalCreated += result.created;
    totalSkipped += result.skipped;
  });

  parseErrors.forEach(e => {
    const filename = e.split(':')[0];
    logImport_(filename, 0, 0, 'ERROR: ' + e);
  });

  ui.alert(
    'Import complete!\n\n' +
    'Files processed: ' + toProcess.length + '\n' +
    'Shifts created: ' + totalCreated + '\n' +
    'Shifts skipped (duplicates): ' + totalSkipped + '\n\n' +
    'Check the Import Log tab for details.'
  );
}


/**
 * Imports only the most recent unprocessed roster email.
 */
function importLatestRoster() {
  const threads = findRosterEmails_();
  if (threads.length === 0) {
    SpreadsheetApp.getUi().alert('No roster emails found from ' + CONFIG.rosterSender + '.');
    return;
  }

  const attachments = collectRosterAttachments_(threads);
  const importedNames = getImportedFilenames_();
  const toProcess = attachments.filter(a => !importedNames.has(a.filename));

  if (toProcess.length === 0) {
    SpreadsheetApp.getUi().alert('Latest roster has already been imported.');
    return;
  }

  // Take the most recent (last in list — Gmail returns newest first)
  const latest = toProcess[0];
  let shifts;
  try {
    shifts = parseRosterBlob_(latest.blob, latest.filename);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error parsing ' + latest.filename + ':\n\n' + e.message);
    return;
  }

  if (shifts.length === 0) {
    SpreadsheetApp.getUi().alert(
      'No shifts found for "' + CONFIG.volunteerName + '" in:\n' + latest.filename
    );
    logImport_(latest.filename, 0, 0, 'No shifts found');
    return;
  }

  // Confirmation
  const lines = ['Roster: ' + latest.filename, '', 'Shifts found:'];
  shifts.forEach(s => {
    const overnight = s.overnight ? ' (overnight)' : '';
    lines.push('  • ' + s.day + ' ' + s.date + ': ' + s.startTime + '–' + s.endTime + overnight);
  });
  lines.push('', 'Continue?');

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirm roster import', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('Import cancelled.');
    return;
  }

  const result = createEventsAndRows_(shifts);
  logImport_(latest.filename, result.created, result.skipped, 'OK');

  ui.alert(
    'Import complete!\n\nShifts created: ' + result.created + '\nSkipped (duplicates): ' + result.skipped
  );
}


// ─── GMAIL ────────────────────────────────────────────────────────────────────

/**
 * Searches Gmail for all emails from the roster sender
 */
function findRosterEmails_() {
  const query = 'from:' + CONFIG.rosterSender + ' has:attachment';
  const threads = GmailApp.search(query, 0, 50); // max 50 emails — more than enough
  return threads;
}

/**
 * Extracts all roster attachments from a list of Gmail threads
 * Returns [{filename, blob}] sorted newest first
 */
function collectRosterAttachments_(threads) {
  const results = [];
  const prefix = CONFIG.attachmentPrefix.toLowerCase();

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      message.getAttachments().forEach(att => {
        const name = att.getName();
        if (name.toLowerCase().startsWith(prefix) &&
           (name.toLowerCase().endsWith('.xlsm') || name.toLowerCase().endsWith('.xlsx'))) {
          results.push({
            filename: name,
            blob: att.copyBlob(),
            date: message.getDate(),
          });
        }
      });
    });
  });

  // Sort newest first
  results.sort((a, b) => b.date - a.date);

  // Deduplicate by filename (same file might appear in multiple emails)
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.filename)) return false;
    seen.add(r.filename);
    return true;
  });
}


// ─── ROSTER PARSING ───────────────────────────────────────────────────────────

/**
 * Parses a roster .xlsm blob and returns an array of shift objects for our volunteer.
 * This is the core parsing logic — same algorithm as the Node.js parse-roster.js script.
 */
function parseRosterBlob_(blob, filename) {
  // Read the Excel file using the Sheets API trick:
  // Convert blob to a temporary Spreadsheet, read the data, then delete it
  const tempFile = DriveApp.createFile(blob.setName(filename));
  let sheets;
  try {
    const tempSS = SpreadsheetApp.openById(
      Drive.Files.copy({ title: filename }, tempFile.getId()).id
    );
    sheets = tempSS;
  } catch(e) {
    // Fallback: use Drive advanced service to convert
    tempFile.setTrashed(true);
    throw new Error('Could not open Excel file. Make sure Drive API advanced service is enabled in Apps Script.');
  }

  let rdpSheet;
  try {
    rdpSheet = sheets.getSheetByName('RDP');
  } catch(e) {
    SpreadsheetApp.openById(sheets.getId()).getSheets(); // force load
    rdpSheet = sheets.getSheetByName('RDP');
  }

  if (!rdpSheet) {
    // Clean up temp file
    DriveApp.getFileById(sheets.getId()).setTrashed(true);
    tempFile.setTrashed(true);
    throw new Error('No RDP sheet found in ' + filename);
  }

  const lastRow = rdpSheet.getLastRow();
  const lastCol = rdpSheet.getLastColumn();
  const data = rdpSheet.getRange(1, 1, lastRow, lastCol).getValues();

  // Clean up temp files immediately
  DriveApp.getFileById(sheets.getId()).setTrashed(true);
  tempFile.setTrashed(true);

  // Date row is index 3 (row 4)
  const dateRow = data[3];
  const nameFragment = CONFIG.volunteerName.toLowerCase();
  const shifts = [];

  Object.entries(DAY_COLS).forEach(([dayName, nameCol]) => {
    const rawDate = (dateRow[nameCol] || '').toString().trim();
    const shiftDate = parseRosterDate_(rawDate);
    if (!shiftDate) return;

    // Find all rows where volunteer appears in this day's column
    const matchingRows = [];
    data.forEach((row, rowIdx) => {
      if (rowIdx < 4) return;
      const cellVal = (row[nameCol] || '').toString().toLowerCase();
      if (cellVal.includes(nameFragment)) {
        // Find nearest time label at or above (column A = index 0)
        let timeLabel = '';
        for (let r = rowIdx; r >= 4; r--) {
          const t = (data[r][0] || '').toString().trim();
          if (/^\d+:\d+/.test(t)) { timeLabel = t; break; }
        }
        matchingRows.push({ rowIdx, timeLabel });
      }
    });

    if (matchingRows.length === 0) return;

    const startHour = parseTimeLabel_(matchingRows[0].timeLabel);
    const lastHour  = parseTimeLabel_(matchingRows[matchingRows.length - 1].timeLabel);
    if (startHour === null || lastHour === null) return;

    const endHour = lastHour + 1;
    const isOvernight = endHour > 23 || endHour <= startHour;

    const startDate = new Date(shiftDate);
    const endDate   = new Date(shiftDate);
    if (isOvernight) endDate.setDate(endDate.getDate() + 1);

    startDate.setHours(startHour, 0, 0, 0);
    endDate.setHours(endHour % 24, 0, 0, 0);

    shifts.push({
      day:       dayName,
      date:      formatDate_(shiftDate),
      startTime: pad_(startHour) + ':00',
      endTime:   pad_(endHour % 24) + ':00',
      overnight: isOvernight,
      startDate,
      endDate,
      station:   CONFIG.station,
      hours:     matchingRows.length,
    });
  });

  return shifts;
}


// ─── CALENDAR + SHEET ─────────────────────────────────────────────────────────

/**
 * Creates Calendar events and Shifts tab rows for an array of shifts.
 * Returns { created, skipped }
 */
function createEventsAndRows_(shifts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shiftsSheet = ss.getSheetByName(CONFIG.shiftsTab);
  const calendars = CalendarApp.getCalendarsByName(CONFIG.calendarName);

  if (!shiftsSheet) throw new Error('Shifts tab not found');
  if (calendars.length === 0) throw new Error('Calendar "' + CONFIG.calendarName + '" not found');
  const calendar = calendars[0];

  let created = 0;
  let skipped = 0;

  shifts.forEach(shift => {
    // Duplicate check: look for existing row with same date and start time
    if (shiftExists_(shiftsSheet, shift.date, shift.startTime)) {
      skipped++;
      return;
    }

    // Generate shift ID
    const shiftId = generateShiftId_(shift.date, shiftsSheet);

    // Create Calendar event
    const event = calendar.createEvent(
      'On-call — ' + shift.station,
      shift.startDate,
      shift.endDate,
      { description: 'Sheet record: ' + shiftId }
    );
    event.setColor(CONFIG.eventColour);
    const eventId = event.getId();

    // Add row to Shifts tab
    const now = new Date();
    const row = new Array(14).fill('');
    row[SHIFTS_COLS.shift_id]          = shiftId;
    row[SHIFTS_COLS.calendar_event_id] = eventId;
    row[SHIFTS_COLS.status]            = 'Scheduled';
    row[SHIFTS_COLS.date]              = shift.date;
    row[SHIFTS_COLS.start_time]        = shift.startTime;
    row[SHIFTS_COLS.end_time]          = shift.endTime;
    row[SHIFTS_COLS.overnight]         = shift.overnight ? 'Yes' : 'No';
    row[SHIFTS_COLS.station]           = shift.station;
    row[SHIFTS_COLS.created_at]        = formatDateTime_(now);

    shiftsSheet.appendRow(row);
    created++;
  });

  return { created, skipped };
}


// ─── IMPORT LOG ───────────────────────────────────────────────────────────────

/**
 * Returns a Set of filenames already in the Import Log
 */
function getImportedFilenames_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.importLogTab);
  if (!logSheet || logSheet.getLastRow() < 2) return new Set();

  const values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 1).getValues();
  return new Set(values.flat().filter(v => v !== ''));
}

/**
 * Appends a row to the Import Log
 */
function logImport_(filename, created, skipped, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.importLogTab);
  if (!logSheet) return;

  const row = new Array(5).fill('');
  row[LOG_COLS.filename]       = filename;
  row[LOG_COLS.imported_at]    = formatDateTime_(new Date());
  row[LOG_COLS.shifts_created] = created;
  row[LOG_COLS.shifts_skipped] = skipped;
  row[LOG_COLS.status]         = status;

  logSheet.appendRow(row);
}


// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseRosterDate_(raw) {
  if (!raw || !raw.trim()) return null;
  // Handles M/D/YY and M/D/YYYY and Date objects formatted as strings
  const str = raw.toString().trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0]);
    const day   = parseInt(parts[1]);
    const year  = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseTimeLabel_(label) {
  if (!label) return null;
  const m = label.toString().trim().match(/^(\d+):\d+/);
  return m ? parseInt(m[1]) : null;
}

function formatDate_(d) {
  return d.getFullYear() + '-' +
    pad_(d.getMonth() + 1) + '-' +
    pad_(d.getDate());
}

function formatDateTime_(d) {
  return formatDate_(d) + ' ' +
    pad_(d.getHours()) + ':' +
    pad_(d.getMinutes()) + ':' +
    pad_(d.getSeconds());
}

function pad_(n) {
  return String(n).padStart(2, '0');
}

function shiftExists_(sheet, date, startTime) {
  if (sheet.getLastRow() < 2) return false;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues();
  return data.some(row =>
    row[SHIFTS_COLS.date].toString().trim() === date &&
    row[SHIFTS_COLS.start_time].toString().trim() === startTime
  );
}

function generateShiftId_(dateStr, sheet) {
  const datePart = dateStr.replace(/-/g, '');
  let maxSeq = 0;

  if (sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    ids.forEach(id => {
      const m = id.toString().match(/^SH-(\d{8})-(\d{3})$/);
      if (m && m[1] === datePart) {
        maxSeq = Math.max(maxSeq, parseInt(m[2]));
      }
    });
  }

  return 'SH-' + datePart + '-' + String(maxSeq + 1).padStart(3, '0');
}
