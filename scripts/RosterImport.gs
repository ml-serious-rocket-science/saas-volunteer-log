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
 *   5. NOTE: Drive API advanced service is NOT required — removed in this version
 *   6. Run authoriseScript() once from the function dropdown to grant permissions
 *   7. The "SAAS Roster" menu will appear in your Sheet after refresh
 *
 * Usage:
 *   Sheet menu → SAAS Roster → Import all new rosters   (backfill / weekly)
 *   Sheet menu → SAAS Roster → Import latest roster     (single file)
 *   Safe to run repeatedly — already-imported rosters are skipped automatically.
 */


// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CONFIG = {
  rosterSender:    'jazz_vincent@hotmail.com',
  attachmentPrefix: 'BURRA ROSTER WEEK',
  calendarName:    'SAAS Volunteering',
  shiftsTab:       'Shifts',
  importLogTab:    'Import Log',
  volunteerName:   'Liddy',
  station:         'Burra',
  // TEAL = Eucalyptus — closest to SAAS green available in Google Calendar
  eventColour:     CalendarApp.EventColor.TEAL,
};

// Column positions — proven consistent across all 11 historical files
const DAY_COLS = {
  Monday: 3, Tuesday: 7, Wednesday: 11, Thursday: 15,
  Friday: 19, Saturday: 23, Sunday: 27,
};

// Shifts tab columns (0-based)
const SHIFTS_COLS = {
  shift_id: 0, calendar_event_id: 1, status: 2, date: 3,
  start_time: 4, end_time: 5, actual_start_time: 6, actual_end_time: 7,
  duration_hours: 8, overnight: 9, station: 10, callout_ids: 11,
  notes: 12, created_at: 13,
};

// Import Log columns (0-based)
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
    .addItem('Authorise script (run once after setup)', 'authoriseScript')
    .addToUi();
}

function authoriseScript() {
  GmailApp.getInboxThreads(0, 1);
  CalendarApp.getCalendarsByName(CONFIG.calendarName);
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.getUi().alert(
    'Authorisation complete.\n\nYou can now use SAAS Roster → Import all new rosters.'
  );
}


// ─── MAIN ENTRY POINTS ────────────────────────────────────────────────────────

function importAllNewRosters() {
  const ui = SpreadsheetApp.getUi();

  const threads = findRosterEmails_();
  if (threads.length === 0) {
    ui.alert('No roster emails found from ' + CONFIG.rosterSender + '.');
    return;
  }

  const attachments = collectRosterAttachments_(threads);
  if (attachments.length === 0) {
    ui.alert('Emails found but no attachments matching "' + CONFIG.attachmentPrefix + '".');
    return;
  }

  const importedNames = getImportedFilenames_();
  const toProcess = attachments.filter(a => !importedNames.has(a.filename));
  const alreadyDone = attachments.length - toProcess.length;

  if (toProcess.length === 0) {
    ui.alert('All ' + attachments.length + ' roster file(s) already imported. Nothing to do.');
    return;
  }

  // Parse all files before showing confirmation
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

  // Build confirmation dialog
  const lines = [];
  lines.push('Ready to import from ' + toProcess.length + ' new roster file(s).' +
    (alreadyDone > 0 ? ' (' + alreadyDone + ' already done.)' : ''));
  lines.push('');

  toProcess.forEach(att => {
    const fileShifts = allShifts.filter(s => s._sourceFile === att.filename);
    const err = parseErrors.find(e => e.filename === att.filename);
    lines.push('📄 ' + att.filename);
    if (err) {
      lines.push('   ⚠ Error: ' + err.error);
    } else if (fileShifts.length === 0) {
      lines.push('   (no shifts for ' + CONFIG.volunteerName + ' this week)');
    } else {
      fileShifts.forEach(s => lines.push(
        '   • ' + s.day + ' ' + s.date + ': ' + s.startTime + '–' + s.endTime +
        (s.overnight ? ' (overnight)' : '')
      ));
    }
  });

  lines.push('', 'Continue?');

  const response = ui.alert('Confirm roster import', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('Import cancelled — nothing was changed.');
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;

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

  ui.alert(
    'Import complete!\n\nFiles processed: ' + toProcess.length +
    '\nShifts created: ' + totalCreated +
    '\nDuplicates skipped: ' + totalSkipped +
    '\n\nCheck the Import Log tab and your Google Calendar.'
  );
}


function importLatestRoster() {
  const ui = SpreadsheetApp.getUi();

  const threads = findRosterEmails_();
  if (threads.length === 0) {
    ui.alert('No roster emails found from ' + CONFIG.rosterSender + '.');
    return;
  }

  const attachments = collectRosterAttachments_(threads);
  const importedNames = getImportedFilenames_();
  const toProcess = attachments.filter(a => !importedNames.has(a.filename));

  if (toProcess.length === 0) {
    ui.alert('Latest roster already imported. Check back after the next one arrives.');
    return;
  }

  const latest = toProcess[0];
  let shifts;
  try {
    shifts = parseRosterBlob_(latest.blob, latest.filename);
  } catch(e) {
    ui.alert('Could not parse ' + latest.filename + ':\n\n' + e.message);
    return;
  }

  if (shifts.length === 0) {
    ui.alert('No shifts found for "' + CONFIG.volunteerName + '" in:\n\n' + latest.filename);
    logImport_(latest.filename, 0, 0, 'No shifts found');
    return;
  }

  const lines = [latest.filename, '', 'Shifts found:'];
  shifts.forEach(s => lines.push(
    '  • ' + s.day + ' ' + s.date + ': ' + s.startTime + '–' + s.endTime +
    (s.overnight ? ' (overnight)' : '')
  ));
  lines.push('', 'Continue?');

  const response = ui.alert('Confirm roster import', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) { ui.alert('Import cancelled.'); return; }

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
        const nameLower = name.toLowerCase();
        if (nameLower.startsWith(prefix) &&
            (nameLower.endsWith('.xlsm') || nameLower.endsWith('.xlsx'))) {
          results.push({ filename: name, blob: att.copyBlob(), date: message.getDate() });
        }
      });
    });
  });

  results.sort((a, b) => b.date - a.date);

  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.filename)) return false;
    seen.add(r.filename);
    return true;
  });
}


// ─── ROSTER PARSING ───────────────────────────────────────────────────────────

/**
 * Parses a roster .xlsm blob into shift objects.
 * Uploads to Drive via UrlFetchApp (multipart, convert=true) to get a
 * temporary Google Sheet, reads the RDP tab, then deletes the temp file.
 * No Drive API advanced service required.
 */
function parseRosterBlob_(blob, filename) {
  const tempFileId = uploadAndConvert_(blob, filename);
  let data;
  try {
    const tempSS = SpreadsheetApp.openById(tempFileId);
    const rdpSheet = tempSS.getSheetByName('RDP');
    if (!rdpSheet) throw new Error('No RDP sheet found in ' + filename);
    const lastRow = Math.min(rdpSheet.getLastRow(), 90);
    const lastCol = Math.min(rdpSheet.getLastColumn(), 32);
    data = rdpSheet.getRange(1, 1, lastRow, lastCol).getValues();
  } finally {
    try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch(e) {}
  }
  return extractShifts_(data, filename);
}

/**
 * Uploads a blob to Drive using UrlFetchApp multipart upload with convert=true.
 * This converts the Excel file to Google Sheets format automatically.
 * Returns the new Google Sheet file ID.
 */
function uploadAndConvert_(blob, filename) {
  const token = ScriptApp.getOAuthToken();
  const safeName = '_roster_tmp_' + filename.replace(/\.xlsm?$/i, '');

  // Build multipart body manually
  const boundary = 'saas_roster_boundary_' + Date.now();
  const metadata = JSON.stringify({
    name: safeName,
    mimeType: 'application/vnd.google-apps.spreadsheet',
  });

  const bodyParts = [
    '--' + boundary + '\r\n',
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadata + '\r\n',
    '--' + boundary + '\r\n',
    'Content-Type: application/vnd.ms-excel.sheet.macroenabled.12\r\n',
    'Content-Transfer-Encoding: base64\r\n\r\n',
    Utilities.base64Encode(blob.getBytes()) + '\r\n',
    '--' + boundary + '--',
  ];

  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      payload: bodyParts.join(''),
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Drive upload failed (' + response.getResponseCode() + '): ' +
      response.getContentText().substring(0, 200));
  }

  const result = JSON.parse(response.getContentText());
  if (!result.id) throw new Error('Drive upload succeeded but no file ID returned.');
  return result.id;
}

/**
 * Extracts shifts for our volunteer from the RDP sheet data array.
 */
function extractShifts_(data, filename) {
  const dateRow = data[3];
  const nameFragment = CONFIG.volunteerName.toLowerCase();
  const shifts = [];

  Object.entries(DAY_COLS).forEach(([dayName, nameCol]) => {
    if (nameCol >= (data[0] || []).length) return;

    const rawDate = (dateRow[nameCol] || '').toString().trim();
    const shiftDate = parseRosterDate_(rawDate);
    if (!shiftDate) return;

    const matchingRows = [];
    data.forEach((row, rowIdx) => {
      if (rowIdx < 4) return;
      if (nameCol >= row.length) return;
      if (!(row[nameCol] || '').toString().toLowerCase().includes(nameFragment)) return;

      let timeLabel = '';
      for (let r = rowIdx; r >= 4; r--) {
        const t = (data[r][0] || '').toString().trim();
        if (/^\d+:\d+/.test(t)) { timeLabel = t; break; }
      }
      matchingRows.push({ rowIdx, timeLabel });
    });

    if (matchingRows.length === 0) return;

    const startHour = parseTimeLabel_(matchingRows[0].timeLabel);
    const lastHour  = parseTimeLabel_(matchingRows[matchingRows.length - 1].timeLabel);
    if (startHour === null || lastHour === null) {
      Logger.log('Could not parse times for ' + dayName + ' in ' + filename);
      return;
    }

    const endHour = lastHour + 1;
    const isOvernight = endHour > 23 || endHour <= startHour;

    const startDate = new Date(shiftDate);
    const endDate   = new Date(shiftDate);
    startDate.setHours(startHour, 0, 0, 0);
    if (isOvernight) endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(endHour % 24, 0, 0, 0);

    shifts.push({
      day: dayName, date: formatDate_(shiftDate),
      startTime: pad_(startHour) + ':00',
      endTime: pad_(endHour % 24) + ':00',
      overnight: isOvernight, startDate, endDate,
      station: CONFIG.station, hours: matchingRows.length,
    });
  });

  return shifts;
}


// ─── CALENDAR + SHEET ─────────────────────────────────────────────────────────

function createEventsAndRows_(shifts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shiftsSheet = ss.getSheetByName(CONFIG.shiftsTab);
  if (!shiftsSheet) throw new Error('Shifts tab "' + CONFIG.shiftsTab + '" not found.');

  const calendars = CalendarApp.getCalendarsByName(CONFIG.calendarName);
  if (calendars.length === 0) throw new Error('Calendar "' + CONFIG.calendarName + '" not found.');
  const calendar = calendars[0];

  let created = 0, skipped = 0;

  shifts.forEach(shift => {
    if (shiftExists_(shiftsSheet, shift.date, shift.startTime)) {
      skipped++;
      return;
    }

    const shiftId = generateShiftId_(shift.date, shiftsSheet);

    const event = calendar.createEvent(
      'On-call — ' + shift.station,
      shift.startDate, shift.endDate,
      { description: 'Sheet record: ' + shiftId }
    );
    event.setColor(CONFIG.eventColour);
    const eventId = event.getId();

    const row = new Array(14).fill('');
    row[SHIFTS_COLS.shift_id]          = shiftId;
    row[SHIFTS_COLS.calendar_event_id] = eventId;
    row[SHIFTS_COLS.status]            = 'Scheduled';
    row[SHIFTS_COLS.date]              = shift.date;
    row[SHIFTS_COLS.start_time]        = shift.startTime;
    row[SHIFTS_COLS.end_time]          = shift.endTime;
    row[SHIFTS_COLS.overnight]         = shift.overnight ? 'Yes' : 'No';
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

function parseRosterDate_(raw) {
  if (!raw || !raw.toString().trim()) return null;
  const str = raw.toString().trim();
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]);
    const day   = parseInt(slashMatch[2]);
    const year  = parseInt(slashMatch[3]) < 100 ? 2000 + parseInt(slashMatch[3]) : parseInt(slashMatch[3]);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  // Handles Date objects returned by getValues() when the temp Sheet formats dates natively
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseTimeLabel_(label) {
  if (!label) return null;
  const m = label.toString().trim().match(/^(\d+):\d+/);
  return m ? parseInt(m[1]) : null;
}

function formatDate_(d) {
  return d.getFullYear() + '-' + pad_(d.getMonth() + 1) + '-' + pad_(d.getDate());
}

function formatDateTime_(d) {
  return formatDate_(d) + ' ' + pad_(d.getHours()) + ':' + pad_(d.getMinutes()) + ':' + pad_(d.getSeconds());
}

function pad_(n) { return String(n).padStart(2, '0'); }

function shiftExists_(sheet, date, startTime) {
  if (sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues().some(row =>
    row[SHIFTS_COLS.date].toString().trim() === date &&
    row[SHIFTS_COLS.start_time].toString().trim() === startTime
  );
}

function generateShiftId_(dateStr, sheet) {
  const datePart = dateStr.replace(/-/g, '');
  let maxSeq = 0;
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().forEach(id => {
      const m = id.toString().match(/^SH-(\d{8})-(\d{3})$/);
      if (m && m[1] === datePart) maxSeq = Math.max(maxSeq, parseInt(m[2]));
    });
  }
  return 'SH-' + datePart + '-' + String(maxSeq + 1).padStart(3, '0');
}
