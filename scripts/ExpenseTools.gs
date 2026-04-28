/**
 * ExpenseTools.gs
 *
 * Tools for managing expense claims in the SAAS Volunteer Log.
 *
 * FUNCTIONS:
 *   generateExpenseRows()   — scans Callouts AND Training for expense_claimable=Yes
 *                             and creates Expense rows for any not yet linked.
 *                             Safe to run repeatedly.
 *
 * USAGE:
 *   Sheet menu → SAAS Roster → Generate expense rows
 *   Or run generateExpenseRows() directly from Apps Script editor.
 */


// ─── COLUMN INDICES ───────────────────────────────────────────────────────────

// Callouts tab (0-based)
// A=callout_id, B=callout_number, C=location, D=date, E=time_paged, F=time_cleared,
// G=duration_minutes, H=parent_shift_id, I=incident_type, J=priority,
// K=patient_count, L=patient_presentation, M=clinical_actions, N=outcome,
// O=learning_reflection, P=expense_claimable, Q=expense_claim_id, R=created_at
const CALLOUT_COLS = {
  callout_id:        0,  // A
  callout_number:    1,  // B
  location:          2,  // C
  date:              3,  // D
  expense_claimable: 15, // P
  expense_claim_id:  16, // Q
};

// Training tab (0-based)
// A=training_id, B=calendar_event_id, C=status, D=date, E=event_name,
// F=provider, G=category, H=duration_hours, I=cert_issued, J=cert_name,
// K=cert_expiry, L=days_until_expiry, M=expense_claimable, N=expense_claim_id,
// O=notes, P=created_at
const TRAINING_COLS = {
  training_id:       0,  // A
  date:              3,  // D
  event_name:        4,  // E
  expense_claimable: 12, // M
  expense_claim_id:  13, // N
};

// Expenses tab (0-based)
// A=expense_id, B=date_submitted, C=claim_type, D=linked_record_id,
// E=callout_number, F=amount_claimed, G=status, H=date_paid, I=notes, J=created_at
const EXPENSE_COLS = {
  expense_id:       0,  // A
  date_submitted:   1,  // B
  claim_type:       2,  // C
  linked_record_id: 3,  // D
  callout_number:   4,  // E  used for callout number or training event name
  amount_claimed:   5,  // F
  status:           6,  // G
  date_paid:        7,  // H
  notes:            8,  // I
  created_at:       9,  // J
};


// ─── GENERATE EXPENSE ROWS ────────────────────────────────────────────────────

/**
 * Scans Callouts and Training tabs for rows where expense_claimable = Yes
 * and expense_claim_id is blank. Creates an Expense row for each and writes
 * the expense_id back to prevent duplicate generation on subsequent runs.
 *
 * Safe to run repeatedly.
 */
function generateExpenseRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const calloutsSheet = ss.getSheetByName('Callouts');
  const trainingSheet = ss.getSheetByName('Training');
  const expensesSheet = ss.getSheetByName('Expenses');

  if (!calloutsSheet) { ui.alert('Callouts tab not found.'); return; }
  if (!trainingSheet) { ui.alert('Training tab not found.'); return; }
  if (!expensesSheet) { ui.alert('Expenses tab not found.'); return; }

  // Collect claimable callouts not yet linked
  const calloutItems = collectClaimableCallouts_(calloutsSheet);

  // Collect claimable training records not yet linked
  const trainingItems = collectClaimableTraining_(trainingSheet);

  const total = calloutItems.length + trainingItems.length;

  if (total === 0) {
    ui.alert('No new expense rows to generate.\n\nAll claimable callouts and training records already have expense records.');
    return;
  }

  // Preview
  const lines = ['Ready to create ' + total + ' expense row(s):\n'];

  if (calloutItems.length > 0) {
    lines.push('CALLOUTS (' + calloutItems.length + '):');
    calloutItems.forEach(item => {
      lines.push('  • ' + item.id + '  ' + item.dateStr + '  callout #' + item.reference);
    });
    lines.push('');
  }

  if (trainingItems.length > 0) {
    lines.push('TRAINING (' + trainingItems.length + '):');
    trainingItems.forEach(item => {
      lines.push('  • ' + item.id + '  ' + item.dateStr + '  ' + item.reference);
    });
    lines.push('');
  }

  lines.push('Amount claimed will be blank — fill in before submitting to SAAS.\nContinue?');

  const response = ui.alert('Generate expense rows', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) { ui.alert('Cancelled.'); return; }

  const now = new Date();
  const nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  let created = 0;

  // Create expense rows for callouts
  calloutItems.forEach(item => {
    const expenseId = generateExpenseId_(item.dateStr, expensesSheet);
    appendExpenseRow_(expensesSheet, expenseId, 'Callout', item.id, item.reference, nowStr);
    calloutsSheet.getRange(item.rowIndex, CALLOUT_COLS.expense_claim_id + 1).setValue(expenseId);
    Logger.log('Created expense ' + expenseId + ' for callout ' + item.id);
    created++;
  });

  // Create expense rows for training
  trainingItems.forEach(item => {
    const expenseId = generateExpenseId_(item.dateStr, expensesSheet);
    appendExpenseRow_(expensesSheet, expenseId, 'Training', item.id, item.reference, nowStr);
    trainingSheet.getRange(item.rowIndex, TRAINING_COLS.expense_claim_id + 1).setValue(expenseId);
    Logger.log('Created expense ' + expenseId + ' for training ' + item.id);
    created++;
  });

  ui.alert(
    '✓ Done!\n\n' +
    created + ' expense row(s) created in the Expenses tab.\n\n' +
    'Next steps:\n' +
    '• Fill in the Amount claimed column for each row\n' +
    '• Submit via the SAAS expenses app\n' +
    '• Update the Status column to Submitted'
  );
}


// ─── COLLECTORS ───────────────────────────────────────────────────────────────

function collectClaimableCallouts_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  const items = [];
  data.forEach((row, i) => {
    const claimable   = row[CALLOUT_COLS.expense_claimable].toString().trim();
    const alreadyLinked = row[CALLOUT_COLS.expense_claim_id].toString().trim();
    if (claimable === 'Yes' && alreadyLinked === '') {
      const date = row[CALLOUT_COLS.date];
      items.push({
        rowIndex:  i + 2,
        id:        row[CALLOUT_COLS.callout_id].toString(),
        reference: row[CALLOUT_COLS.callout_number].toString(),
        dateStr:   formatDateStr_(date),
      });
    }
  });
  return items;
}

function collectClaimableTraining_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  const items = [];
  data.forEach((row, i) => {
    const claimable    = row[TRAINING_COLS.expense_claimable].toString().trim();
    const alreadyLinked = row[TRAINING_COLS.expense_claim_id].toString().trim();
    if (claimable === 'Yes' && alreadyLinked === '') {
      const date = row[TRAINING_COLS.date];
      items.push({
        rowIndex:  i + 2,
        id:        row[TRAINING_COLS.training_id].toString(),
        reference: row[TRAINING_COLS.event_name].toString(),
        dateStr:   formatDateStr_(date),
      });
    }
  });
  return items;
}


// ─── HELPERS ──────────────────────────────────────────────────────────────────

function appendExpenseRow_(sheet, expenseId, claimType, linkedId, reference, nowStr) {
  const row = new Array(10).fill('');
  row[EXPENSE_COLS.expense_id]       = expenseId;
  row[EXPENSE_COLS.date_submitted]   = '';           // fill when submitted
  row[EXPENSE_COLS.claim_type]       = claimType;
  row[EXPENSE_COLS.linked_record_id] = linkedId;
  row[EXPENSE_COLS.callout_number]   = reference;    // callout number or training event name
  row[EXPENSE_COLS.amount_claimed]   = '';           // fill before submitting
  row[EXPENSE_COLS.status]           = 'Not submitted';
  row[EXPENSE_COLS.date_paid]        = '';
  row[EXPENSE_COLS.notes]            = '';
  row[EXPENSE_COLS.created_at]       = nowStr;
  sheet.appendRow(row);
}

function generateExpenseId_(dateStr, sheet) {
  const datePart = dateStr.replace(/-/g, '');
  const prefix = 'EX-' + datePart + '-';
  let maxSeq = 0;
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().forEach(id => {
      const m = id.toString().match(/^EX-(\d{8})-(\d{3})$/);
      if (m && m[1] === datePart) maxSeq = Math.max(maxSeq, parseInt(m[2]));
    });
  }
  return prefix + String(maxSeq + 1).padStart(3, '0');
}

function formatDateStr_(date) {
  if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return date.toString();
}
