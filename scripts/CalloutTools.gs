/**
 * CalloutTools.gs
 *
 * Tools for managing callout records in the SAAS Volunteer Log.
 *
 * FUNCTIONS:
 *   newCalloutFromShift()      — creates a new callout row pre-filled from a
 *                                selected shift row. Assigns a correct callout_id.
 *   fixCalloutIds()            — scans Callouts tab and repairs any duplicate or
 *                                incorrectly formatted callout_ids (e.g. from
 *                                copy-paste). Safe to run repeatedly.
 *
 * USAGE:
 *   Sheet menu → SAAS Roster → New callout from shift
 *   Sheet menu → SAAS Roster → Fix callout IDs
 *
 * callout_id format: CO-YYYYMMDD-NNN
 *   YYYYMMDD = date of callout
 *   NNN      = sequence for that date (001, 002, ...)
 */


// ─── COLUMN INDICES ───────────────────────────────────────────────────────────

// Callouts tab (0-based)
// A=callout_id, B=callout_number, C=location, D=date, E=time_paged, F=time_cleared,
// G=duration_minutes, H=parent_shift_id, I=incident_type, J=priority,
// K=patient_count, L=patient_presentation, M=clinical_actions, N=outcome,
// O=learning_reflection, P=expense_claimable, Q=expense_claim_id, R=created_at
const CO_COLS = {
  callout_id:        0,   // A
  callout_number:    1,   // B
  location:          2,   // C
  date:              3,   // D
  time_paged:        4,   // E
  time_cleared:      5,   // F
  duration_minutes:  6,   // G
  parent_shift_id:   7,   // H
  incident_type:     8,   // I
  priority:          9,   // J
  patient_count:     10,  // K
  patient_presentation: 11, // L
  clinical_actions:  12,  // M
  outcome:           13,  // N
  learning_reflection: 14, // O
  expense_claimable: 15,  // P
  expense_claim_id:  16,  // Q
  created_at:        17,  // R
};

// Shifts tab (0-based) — matches RosterImport.gs SHIFTS_COLS
const SH_COLS = {
  shift_id:   0,  // A
  status:     2,  // C
  date:       3,  // D
  start_time: 4,  // E
  end_time:   5,  // F
  shift_type: 9,  // J
  station:    10, // K
};


// ─── NEW CALLOUT FROM SHIFT ───────────────────────────────────────────────────

/**
 * Creates a new callout row in the Callouts tab, pre-filled with data
 * from the selected shift row in the Shifts tab.
 *
 * How to use:
 *   1. Select any cell in the shift row you want to create a callout for
 *   2. Run: SAAS Roster → New callout from shift
 *   3. Confirm the pre-filled details
 *   4. A new row is appended to the Callouts tab with correct callout_id,
 *      date, and parent_shift_id already filled in
 *   5. Fill in the remaining callout details (callout_number, location, times etc)
 */
function newCalloutFromShift() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();

  // Validate we are on the Shifts tab
  if (activeSheet.getName() !== 'Shifts') {
    ui.alert(
      'Wrong tab',
      'Please select a row in the Shifts tab first, then run this again.',
      ui.ButtonSet.OK
    );
    return;
  }

  const activeRow = activeSheet.getActiveRange().getRow();
  if (activeRow < 2) {
    ui.alert('Please select a shift row (not the header row).');
    return;
  }

  // Read the selected shift row
  const shiftData = activeSheet.getRange(activeRow, 1, 1, 15).getValues()[0];
  const shiftId   = shiftData[SH_COLS.shift_id].toString().trim();
  const shiftDate = shiftData[SH_COLS.date];
  const station   = shiftData[SH_COLS.station].toString().trim();

  if (!shiftId) {
    ui.alert('The selected row does not have a shift_id. Please select a valid shift row.');
    return;
  }

  // Format date for callout_id and display
  const dateStr = formatDateStr_(shiftDate);
  if (!dateStr) {
    ui.alert('Could not read the date from the selected shift row.');
    return;
  }

  // Get Callouts sheet
  const calloutsSheet = ss.getSheetByName('Callouts');
  if (!calloutsSheet) {
    ui.alert('Callouts tab not found.');
    return;
  }

  // Generate the next callout_id for this date
  const calloutId = generateCalloutId_(dateStr, calloutsSheet);

  // Confirm with user
  const message = [
    'Ready to create a new callout row:',
    '',
    '  callout_id:    ' + calloutId,
    '  date:          ' + dateStr,
    '  parent_shift:  ' + shiftId,
    '  station:       ' + (station || '(from shift)'),
    '',
    'The row will be added to the Callouts tab.',
    'Fill in callout_number, location, times and other details after.',
    '',
    'Continue?'
  ].join('\n');

  const response = ui.alert('New callout from shift', message, ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('Cancelled — nothing was changed.');
    return;
  }

  // Build the new callout row
  const now    = new Date();
  const nowStr = formatDateTimeStr_(now);

  const row = new Array(18).fill('');
  row[CO_COLS.callout_id]      = calloutId;
  row[CO_COLS.date]            = dateStr;
  row[CO_COLS.parent_shift_id] = shiftId;
  row[CO_COLS.expense_claimable] = 'No';   // safe default
  row[CO_COLS.created_at]      = nowStr;

  calloutsSheet.appendRow(row);

  // Update the parent shift's callout_ids field
  updateShiftCalloutIds_(activeSheet, activeRow, calloutId);

  ui.alert(
    '✓ Callout row created!',
    calloutId + ' has been added to the Callouts tab.\n\n' +
    'Next steps:\n' +
    '• Fill in callout_number (from pager/SAAS comms)\n' +
    '• Fill in location, time_paged, time_cleared\n' +
    '• Fill in incident_type, priority, patient details\n' +
    '• Set expense_claimable to Yes if applicable',
    ui.ButtonSet.OK
  );
}


// ─── FIX CALLOUT IDS ─────────────────────────────────────────────────────────

/**
 * Scans all rows in the Callouts tab and fixes any callout_ids that are:
 *   - Duplicated (from copy-paste)
 *   - Incorrectly formatted
 *   - Missing
 *
 * Only reassigns IDs where necessary. Rows with valid unique IDs are left
 * unchanged. Safe to run repeatedly.
 *
 * After running, check the Callouts tab to confirm the IDs look correct,
 * and update any linked expense records manually if needed.
 */
function fixCalloutIds() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calloutsSheet = ss.getSheetByName('Callouts');

  if (!calloutsSheet) {
    ui.alert('Callouts tab not found.');
    return;
  }

  const lastRow = calloutsSheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('No callout rows found.');
    return;
  }

  const data = calloutsSheet.getRange(2, 1, lastRow - 1, 18).getValues();

  // Count issues
  const idsSeen    = new Map();  // id → first row index that had it
  const problems   = [];         // { rowIndex, currentId, issue }

  data.forEach((row, i) => {
    const rowIndex = i + 2;  // 1-based, header is row 1
    const currentId = row[CO_COLS.callout_id].toString().trim();
    const date = row[CO_COLS.date];

    // Skip entirely empty rows (no date and no callout_id)
    const dateStr = date instanceof Date ? date.toISOString() : date.toString().trim();
    if (!dateStr && !currentId) return;
    // Also skip rows where date is a zero-value Date (empty date cell read as Date)
    if (date instanceof Date && date.getFullYear() < 2000) return;

    if (!currentId) {
      problems.push({ rowIndex, currentId, date, issue: 'missing' });
    } else if (!isValidCalloutId_(currentId)) {
      problems.push({ rowIndex, currentId, date, issue: 'invalid format' });
    } else if (idsSeen.has(currentId)) {
      problems.push({ rowIndex, currentId, date, issue: 'duplicate of row ' + idsSeen.get(currentId) });
    } else {
      idsSeen.set(currentId, rowIndex);
    }
  });

  if (problems.length === 0) {
    ui.alert('All callout IDs look correct. Nothing to fix.');
    return;
  }

  // Preview
  const lines = ['Found ' + problems.length + ' callout ID issue(s):\n'];
  problems.forEach(p => {
    lines.push('  Row ' + p.rowIndex + ':  ' +
      (p.currentId || '(blank)') + '  →  ' + p.issue);
  });
  lines.push('');
  lines.push('New IDs will be assigned based on each row\'s date.');
  lines.push('Rows with correct unique IDs will not be changed.');
  lines.push('');
  lines.push('Note: if any expense records reference the old IDs,');
  lines.push('you will need to update them manually.');
  lines.push('');
  lines.push('Continue?');

  const response = ui.alert('Fix callout IDs', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('Cancelled — nothing was changed.');
    return;
  }

  // Fix each problem row
  let fixed = 0;
  problems.forEach(p => {
    const dateStr = formatDateStr_(p.date);
    if (!dateStr) {
      Logger.log('Row ' + p.rowIndex + ': could not format date "' + p.date + '" — skipping');
      return;
    }
    const newId = generateCalloutId_(dateStr, calloutsSheet);
    calloutsSheet.getRange(p.rowIndex, CO_COLS.callout_id + 1).setValue(newId);
    Logger.log('Row ' + p.rowIndex + ': ' + (p.currentId || '(blank)') + ' → ' + newId);
    fixed++;
  });

  ui.alert(
    '✓ Done!',
    fixed + ' callout ID(s) fixed.\n\n' +
    'If any expense records referenced the old IDs, update them manually\n' +
    'in the Expenses tab (linked_record_id column).',
    ui.ButtonSet.OK
  );
}


// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Generates the next available callout_id for a given date.
 * Format: CO-YYYYMMDD-NNN
 * Scans all existing callout_ids to find the highest sequence for that date.
 */
function generateCalloutId_(dateStr, sheet) {
  const datePart = dateStr.replace(/-/g, '');  // YYYYMMDD
  const prefix   = 'CO-' + datePart + '-';
  let maxSeq = 0;

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getValues().flat()
      .forEach(id => {
        const m = id.toString().match(/^CO-(\d{8})-(\d{3})$/);
        if (m && m[1] === datePart) {
          maxSeq = Math.max(maxSeq, parseInt(m[2]));
        }
      });
  }

  return prefix + String(maxSeq + 1).padStart(3, '0');
}

/**
 * Validates a callout_id string matches CO-YYYYMMDD-NNN format.
 */
function isValidCalloutId_(id) {
  return /^CO-\d{8}-\d{3}$/.test(id);
}

/**
 * Updates the callout_ids field of a shift row to include a new callout ID.
 * Appends to any existing callout IDs (comma-separated).
 */
function updateShiftCalloutIds_(shiftsSheet, shiftRow, newCalloutId) {
  const calloutIdsCol = 13;  // Column M (1-based) = callout_ids
  const cell = shiftsSheet.getRange(shiftRow, calloutIdsCol);
  const existing = cell.getValue().toString().trim();
  const updated  = existing ? existing + ', ' + newCalloutId : newCalloutId;
  cell.setValue(updated);
}

/**
 * Formats a date value (Date object or string) to YYYY-MM-DD.
 */
function formatDateStr_(date) {
  if (date instanceof Date && !isNaN(date.getTime())) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const str = date.toString().trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or D/M/YYYY (Australian locale)
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  return null;
}

/**
 * Formats a Date to YYYY-MM-DD HH:MM:SS string.
 */
function formatDateTimeStr_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}
