/**
 * SetupSheet.gs
 *
 * Idempotent setup script for the SAAS Volunteer Log Google Sheet.
 * Safe to run on a blank sheet or a partially configured sheet.
 * Never deletes existing data — only adds or fixes structure.
 *
 * USAGE:
 *   1. Open your Google Sheet
 *   2. Extensions → Apps Script
 *   3. Paste this file as SetupSheet.gs
 *   4. Save, then run setupSheet() from the function dropdown
 *   5. Grant permissions when prompted
 *
 * WHAT IT CREATES / CONFIGURES:
 *   - _lists tab        Dropdown values for all controlled fields
 *   - Shifts tab        Headers, dropdown validation, duration formula, formatting
 *   - Callouts tab      Headers, dropdown validation, duration formula, formatting
 *   - Training tab      Headers, dropdown validation, expiry formula, conditional formatting
 *   - Expenses tab      Headers, dropdown validation, formatting
 *   - Summary tab       Dashboard with all formulas and period selector
 *   - Import Log tab    Headers only (data written by RosterImport.gs)
 *   Tab order and colours are also set.
 *
 * IDEMPOTENCY:
 *   - If a tab exists, its structure is updated but existing data is preserved
 *   - Headers are only written if row 1 is empty
 *   - Named ranges are always recreated (metadata only, not data)
 *   - Validation, formulas, and formatting are always reapplied
 *   - Running multiple times is safe
 */


// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'SAAS Volunteer Log — Sheet Setup',
    'This will create and configure all tabs.\n\n' +
    'Safe to run on an existing sheet — data is never deleted.\n\n' +
    'Takes about 30 seconds. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  try {
    Logger.log('Starting sheet setup...');

    setupListsTab_(ss);
    setupNamedRanges_(ss);
    setupShiftsTab_(ss);
    setupCalloutsTab_(ss);
    setupTrainingTab_(ss);
    setupExpensesTab_(ss);
    setupSummaryTab_(ss);
    setupImportLogTab_(ss);
    reorderTabs_(ss);

    Logger.log('Setup complete.');

    ui.alert(
      'Setup complete! ✓\n\n' +
      'All tabs created and configured.\n\n' +
      'Next steps:\n' +
      '• Right-click the _lists tab → Hide sheet\n' +
      '• On the Summary tab, set cell B1 to the first day of the current month (e.g. 2026-05-01) — this drives all monthly stats\n' +
      '• Link your Google Form to the Callouts tab when ready'
    );

  } catch(e) {
    Logger.log('Setup error: ' + e.message);
    Logger.log(e.stack);
    ui.alert('Error during setup:\n\n' + e.message + '\n\nCheck Extensions → Apps Script → Logs for details.');
  }
}


// ─── _lists TAB ───────────────────────────────────────────────────────────────

function setupListsTab_(ss) {
  const sheet = getOrCreateSheet_(ss, '_lists');
  sheet.setTabColor('#9E9E9E');

  // Only write if row 1 is empty
  if (sheet.getRange('A1').getValue() !== '') {
    Logger.log('_lists: headers already present, skipping header write');
  } else {
    // Headers in row 1
    const headers = [
      'Incident type', 'Priority', 'Outcome', 'Status', 'Yes / No',
      'Training category', 'Claim type', 'Expense status', 'Shift type'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

    // Column A — Incident type (11 values)
    const incidentTypes = [
      'Cardiac / chest pain', 'Respiratory', 'Trauma / injury',
      'Unconscious / collapse', 'Stroke / neurological', 'Mental health',
      'Obstetric', 'Medical — other', 'Non-clinical assist',
      'Cancelled en route', 'Other'
    ];
    sheet.getRange(2, 1, incidentTypes.length, 1).setValues(incidentTypes.map(v => [v]));

    // Column B — Priority (9 values: PR:1–PR:8 + PR:Other)
    const priorities = [['PR:1'], ['PR:2'], ['PR:3'], ['PR:4'], ['PR:5'], ['PR:6'], ['PR:7'], ['PR:8'], ['PR:Other']];
    sheet.getRange(2, 2, priorities.length, 1).setValues(priorities);

    // Column C — Outcome (6 values)
    const outcomes = [
      'Transported to hospital', 'Treated on scene — no transport',
      'Patient refused treatment', 'No patient found',
      'Cancelled prior to arrival', 'Other'
    ];
    sheet.getRange(2, 3, outcomes.length, 1).setValues(outcomes.map(v => [v]));

    // Column D — Status (3 values)
    const statuses = [['Scheduled'], ['Completed'], ['Cancelled']];
    sheet.getRange(2, 4, statuses.length, 1).setValues(statuses);

    // Column E — Yes / No (2 values)
    const yesNo = [['Yes'], ['No']];
    sheet.getRange(2, 5, yesNo.length, 1).setValues(yesNo);

    // Column F — Training category (8 values)
    const trainingCats = [
      'Clinical skills', 'Driver training', 'Leadership / management',
      'Safety and compliance', 'Communications / comms',
      'Equipment familiarisation', 'CPD — online / self-directed', 'Other'
    ];
    sheet.getRange(2, 6, trainingCats.length, 1).setValues(trainingCats.map(v => [v]));

    // Column G — Claim type (3 values)
    const claimTypes = [['Callout'], ['Training'], ['Other']];
    sheet.getRange(2, 7, claimTypes.length, 1).setValues(claimTypes);

    // Column H — Expense status (4 values)
    const expenseStatuses = [['Submitted'], ['Approved'], ['Paid'], ['Rejected']];
    sheet.getRange(2, 8, expenseStatuses.length, 1).setValues(expenseStatuses);

    // Column I — Shift type (2 values)
    const shiftTypes = [['Day'], ['Night']];
    sheet.getRange(2, 9, shiftTypes.length, 1).setValues(shiftTypes);

    Logger.log('_lists: values written');
  }
}


// ─── NAMED RANGES ─────────────────────────────────────────────────────────────

function setupNamedRanges_(ss) {
  // Delete existing named ranges to allow clean recreation
  const existing = ss.getNamedRanges();
  const ourRanges = [
    'list_incident_type', 'list_priority', 'list_outcome', 'list_status',
    'list_yes_no', 'list_training_category', 'list_claim_type',
    'list_expense_status', 'list_shift_type'
  ];
  existing.forEach(nr => {
    if (ourRanges.includes(nr.getName())) nr.remove();
  });

  const sheet = ss.getSheetByName('_lists');
  if (!sheet) throw new Error('_lists tab not found — run setupListsTab_ first');

  ss.setNamedRange('list_incident_type',    sheet.getRange('A2:A12'));
  ss.setNamedRange('list_priority',         sheet.getRange('B2:B10'));
  ss.setNamedRange('list_outcome',          sheet.getRange('C2:C7'));
  ss.setNamedRange('list_status',           sheet.getRange('D2:D4'));
  ss.setNamedRange('list_yes_no',           sheet.getRange('E2:E3'));
  ss.setNamedRange('list_training_category',sheet.getRange('F2:F9'));
  ss.setNamedRange('list_claim_type',       sheet.getRange('G2:G4'));
  ss.setNamedRange('list_expense_status',   sheet.getRange('H2:H5'));
  ss.setNamedRange('list_shift_type',       sheet.getRange('I2:I3'));

  Logger.log('Named ranges created');
}


// ─── SHIFTS TAB ───────────────────────────────────────────────────────────────

function setupShiftsTab_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Shifts');
  sheet.setTabColor('#2E7D32');
  sheet.setFrozenRows(1);

  const headers = [
    'shift_id', 'calendar_event_id', 'status', 'date', 'start_time', 'end_time',
    'actual_start_time', 'actual_end_time', 'duration_hours', 'shift_type',
    'station', 'shift_number', 'callout_ids', 'notes', 'created_at'
  ];
  writeHeadersIfEmpty_(sheet, headers);

  // Format actual time columns as Time
  sheet.getRange('G2:H1000').setNumberFormat('HH:mm');
  // Format duration_hours as number
  sheet.getRange('I2:I1000').setNumberFormat('0.0');

  // Duration formula in column I — only set where G and H have values
  // Apply formula to I2:I1000 using arrayformula-style per-cell
  // We set I2 as a template — user can drag, or we set for a reasonable range
  const durationFormula = '=IF(G2="","",IF(H2="","",IF(H2>G2,(H2-G2)*24,((H2+1)-G2)*24)))';
  // Only write formula if I2 is empty (preserve existing)
  if (sheet.getRange('I2').getValue() === '' && sheet.getRange('I2').getFormula() === '') {
    sheet.getRange('I2').setFormula(durationFormula);
  }

  // Dropdown validation
  setDropdownFromRange_(sheet, 'C2:C1000', ss.getRange('list_status'));
  setDropdownFromRange_(sheet, 'J2:J1000', ss.getRange('list_shift_type'));

  Logger.log('Shifts tab configured');
}


// ─── CALLOUTS TAB ─────────────────────────────────────────────────────────────

function setupCalloutsTab_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Callouts');
  sheet.setTabColor('#C62828');
  sheet.setFrozenRows(1);

  const headers = [
    'callout_id', 'callout_number', 'date', 'time_paged', 'time_cleared',
    'duration_minutes', 'parent_shift_id', 'incident_type', 'priority',
    'patient_count', 'patient_presentation', 'clinical_actions', 'outcome',
    'learning_reflection', 'expense_claimable', 'expense_claim_id', 'created_at'
  ];
  writeHeadersIfEmpty_(sheet, headers);

  // Format time columns
  sheet.getRange('D2:E1000').setNumberFormat('HH:mm');
  // Format date column
  sheet.getRange('C2:C1000').setNumberFormat('yyyy-mm-dd');
  // Format duration as number
  sheet.getRange('F2:F1000').setNumberFormat('0');

  // Duration formula in F2
  const durationFormula = '=IF(D2="","",IF(E2="","",IF(E2>D2,(E2-D2)*1440,(E2+1-D2)*1440)))';
  if (sheet.getRange('F2').getValue() === '' && sheet.getRange('F2').getFormula() === '') {
    sheet.getRange('F2').setFormula(durationFormula);
  }

  // Dropdown validation
  setDropdownFromRange_(sheet, 'H2:H1000', ss.getRange('list_incident_type'));
  setDropdownFromRange_(sheet, 'I2:I1000', ss.getRange('list_priority'));
  setDropdownFromRange_(sheet, 'M2:M1000', ss.getRange('list_outcome'));
  setDropdownFromRange_(sheet, 'O2:O1000', ss.getRange('list_yes_no'));

  Logger.log('Callouts tab configured');
}


// ─── TRAINING TAB ─────────────────────────────────────────────────────────────

function setupTrainingTab_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Training');
  sheet.setTabColor('#00695C');
  sheet.setFrozenRows(1);

  const headers = [
    'training_id', 'calendar_event_id', 'status', 'date', 'event_name',
    'provider', 'category', 'duration_hours', 'cert_issued', 'cert_name',
    'cert_expiry', 'days_until_expiry', 'expense_claimable', 'expense_claim_id',
    'notes', 'created_at'
  ];
  writeHeadersIfEmpty_(sheet, headers);

  // Format columns
  sheet.getRange('D2:D1000').setNumberFormat('yyyy-mm-dd');   // date
  sheet.getRange('K2:K1000').setNumberFormat('yyyy-mm-dd');   // cert_expiry
  sheet.getRange('H2:H1000').setNumberFormat('0.0');           // duration_hours
  sheet.getRange('L2:L1000').setNumberFormat('0');              // days_until_expiry

  // Days until expiry formula in L2
  const expiryFormula = '=IF(K2="","",K2-TODAY())';
  if (sheet.getRange('L2').getValue() === '' && sheet.getRange('L2').getFormula() === '') {
    sheet.getRange('L2').setFormula(expiryFormula);
  }

  // Dropdown validation
  setDropdownFromRange_(sheet, 'C2:C1000', ss.getRange('list_status'));
  setDropdownFromRange_(sheet, 'G2:G1000', ss.getRange('list_training_category'));
  setDropdownFromRange_(sheet, 'I2:I1000', ss.getRange('list_yes_no'));
  setDropdownFromRange_(sheet, 'M2:M1000', ss.getRange('list_yes_no'));

  // Conditional formatting for days_until_expiry (col L)
  // Clear existing rules first for clean reapply
  sheet.clearConditionalFormatRules();

  const expiredRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)
    .setBackground('#FFCDD2')
    .setFontColor('#B71C1C')
    .setRanges([sheet.getRange('L2:L1000')])
    .build();

  const soonRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0, 60)
    .setBackground('#FFE0B2')
    .setFontColor('#E65100')
    .setRanges([sheet.getRange('L2:L1000')])
    .build();

  sheet.setConditionalFormatRules([expiredRule, soonRule]);

  Logger.log('Training tab configured');
}


// ─── EXPENSES TAB ─────────────────────────────────────────────────────────────

function setupExpensesTab_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Expenses');
  sheet.setTabColor('#F9A825');
  sheet.setFrozenRows(1);

  const headers = [
    'expense_id', 'date_submitted', 'claim_type', 'linked_record_id',
    'callout_number', 'amount_claimed', 'status', 'date_paid', 'notes', 'created_at'
  ];
  writeHeadersIfEmpty_(sheet, headers);

  // Format columns
  sheet.getRange('B2:B1000').setNumberFormat('yyyy-mm-dd');  // date_submitted
  sheet.getRange('H2:H1000').setNumberFormat('yyyy-mm-dd');  // date_paid
  sheet.getRange('F2:F1000').setNumberFormat('0.00');         // amount_claimed

  // Dropdown validation
  setDropdownFromRange_(sheet, 'C2:C1000', ss.getRange('list_claim_type'));
  setDropdownFromRange_(sheet, 'G2:G1000', ss.getRange('list_expense_status'));

  Logger.log('Expenses tab configured');
}


// ─── SUMMARY TAB ──────────────────────────────────────────────────────────────

function setupSummaryTab_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Summary');
  sheet.setTabColor('#1565C0');

  // Only build if the sheet is essentially empty (just created or blank)
  const hasContent = sheet.getRange('A1').getValue() !== '';
  if (hasContent) {
    Logger.log('Summary: content exists, skipping rebuild to preserve any customisation');
    return;
  }

  sheet.setFrozenRows(0);
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 140);

  // ── Period selector ──
  sheet.getRange('A1').setValue('Month').setFontWeight('bold');
  sheet.getRange('A2').setValue('Month end');
  sheet.getRange('B1').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('B2').setFormula('=IFERROR(EOMONTH(B1,0),"← Set B1 to month start")');
  sheet.getRange('B2').setNumberFormat('yyyy-mm-dd');

  // ── Shifts ──
  sheet.getRange('A4').setValue('SHIFTS').setFontWeight('bold').setFontSize(11);
  sheet.getRange('A4:B4').setBackground('#E3F2FD');

  const shiftData = [
    ['Total shifts this month',       '=COUNTIFS(Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2)'],
    ['Day shifts',                     '=COUNTIFS(Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2,Shifts!J:J,"Day")'],
    ['Night shifts',                   '=COUNTIFS(Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2,Shifts!J:J,"Night")'],
    ['Total hours on shift',           '=SUMIFS(Shifts!I:I,Shifts!D:D,">="&B1,Shifts!D:D,"<="&B2)'],
    ['Past shifts still Scheduled',     '=COUNTIFS(Shifts!C:C,"Scheduled",Shifts!D:D,"<"&TODAY())'],
    ['Upcoming shifts (next 14 days)', '=COUNTIFS(Shifts!C:C,"Scheduled",Shifts!D:D,">="&TODAY(),Shifts!D:D,"<="&TODAY()+14)'],
  ];
  writeSection_(sheet, 5, shiftData);

  // Orange alert for shifts not yet completed (row 9)
  const shiftAlertRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground('#FFE0B2')
    .setFontColor('#E65100')
    .setRanges([sheet.getRange('B9')])
    .build();
  sheet.setConditionalFormatRules([shiftAlertRule]);

  // ── Callouts ──
  sheet.getRange('A12').setValue('CALLOUTS').setFontWeight('bold').setFontSize(11);
  sheet.getRange('A12:B12').setBackground('#FFEBEE');

  const calloutData = [
    ['Total callouts this month',      '=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2)'],
    ['Expense claimable (unclaimed)',   '=COUNTIFS(Callouts!C:C,">="&B1,Callouts!C:C,"<="&B2,Callouts!O:O,"Yes",Callouts!P:P,"")'],
    ['High priority (PR:1-3)',          '=SUMPRODUCT((Callouts!C2:C10000>=$B$1)*(Callouts!C2:C10000<=$B$2)*((Callouts!I2:I10000="PR:1")+(Callouts!I2:I10000="PR:2")+(Callouts!I2:I10000="PR:3")))'],
    ['Medium priority (PR:4-6)',        '=SUMPRODUCT((Callouts!C2:C10000>=$B$1)*(Callouts!C2:C10000<=$B$2)*((Callouts!I2:I10000="PR:4")+(Callouts!I2:I10000="PR:5")+(Callouts!I2:I10000="PR:6")))'],
    ['Low priority (PR:7-Other)',       '=SUMPRODUCT((Callouts!C2:C10000>=$B$1)*(Callouts!C2:C10000<=$B$2)*((Callouts!I2:I10000="PR:7")+(Callouts!I2:I10000="PR:8")+(Callouts!I2:I10000="PR:Other")))'],
  ];
  writeSection_(sheet, 13, calloutData);

  // ── Training & Certs ──
  sheet.getRange('A20').setValue('TRAINING & CERTS').setFontWeight('bold').setFontSize(11);
  sheet.getRange('A20:B20').setBackground('#E8F5E9');

  const trainingData = [
    ['Training events this month',     '=COUNTIFS(Training!D:D,">="&B1,Training!D:D,"<="&B2,Training!C:C,"Completed")'],
    ['Training hours this month',      '=SUMIFS(Training!H:H,Training!D:D,">="&B1,Training!D:D,"<="&B2,Training!C:C,"Completed")'],
    ['Certs expiring within 60 days',  '=COUNTIFS(Training!K:K,">="&TODAY(),Training!K:K,"<="&TODAY()+60)'],
    ['Certs already expired',          '=COUNTIFS(Training!K:K,"<"&TODAY(),Training!K:K,"<>""")'],
  ];
  writeSection_(sheet, 21, trainingData);

  // Alert rules for cert expiry
  const rules = sheet.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground('#FFE0B2').setFontColor('#E65100')
    .setRanges([sheet.getRange('B23')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground('#FFCDD2').setFontColor('#B71C1C')
    .setRanges([sheet.getRange('B24')]).build());
  sheet.setConditionalFormatRules(rules);

  // ── Expenses ──
  sheet.getRange('A27').setValue('EXPENSES').setFontWeight('bold').setFontSize(11);
  sheet.getRange('A27:B27').setBackground('#FFFDE7');

  const expenseData = [
    ['Total claimed this month',       '=SUMIFS(Expenses!F:F,Expenses!B:B,">="&B1,Expenses!B:B,"<="&B2)'],
    ['Total claimed YTD',              '=SUMIFS(Expenses!F:F,Expenses!B:B,">="&DATE(YEAR(B1),1,1),Expenses!B:B,"<="&B2)'],
    ['Awaiting payment',               '=SUMIFS(Expenses!F:F,Expenses!G:G,"Submitted")'],
    ['Callouts with unclaimed expenses','=COUNTIFS(Callouts!O:O,"Yes",Callouts!P:P,"")'],
  ];
  writeSection_(sheet, 28, expenseData);

  // Format currency rows
  sheet.getRange('B28:B30').setNumberFormat('$#,##0.00');

  Logger.log('Summary tab configured');
}


// ─── IMPORT LOG TAB ───────────────────────────────────────────────────────────

function setupImportLogTab_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Import Log');
  sheet.setTabColor('#9E9E9E');
  sheet.setFrozenRows(1);

  const headers = ['filename', 'imported_at', 'shifts_created', 'shifts_skipped', 'status'];
  writeHeadersIfEmpty_(sheet, headers);

  Logger.log('Import Log tab configured');
}


// ─── TAB ORDER ────────────────────────────────────────────────────────────────

function reorderTabs_(ss) {
  const order = ['Shifts', 'Callouts', 'Training', 'Expenses', 'Summary', '_lists', 'Import Log'];
  order.forEach((name, i) => {
    const sheet = ss.getSheetByName(name);
    if (sheet) ss.setActiveSheet(sheet) && ss.moveActiveSheet(i + 1);
  });
  // Activate Shifts tab at end
  const shifts = ss.getSheetByName('Shifts');
  if (shifts) ss.setActiveSheet(shifts);
  Logger.log('Tabs reordered');
}


// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Returns existing sheet or creates a new one with the given name.
 */
function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    Logger.log('Created tab: ' + name);
  }
  return sheet;
}

/**
 * Writes headers to row 1 only if row 1 col 1 is empty.
 * Also bolds row 1 and freezes it.
 */
function writeHeadersIfEmpty_(sheet, headers) {
  if (sheet.getRange(1, 1).getValue() === '') {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold');
    Logger.log(sheet.getName() + ': headers written');
  } else {
    Logger.log(sheet.getName() + ': headers already present, skipping');
  }
  sheet.setFrozenRows(1);
}

/**
 * Sets a dropdown validation from a named range on a given A1 notation range.
 */
function setDropdownFromRange_(sheet, a1notation, namedRange) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(namedRange, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(a1notation).setDataValidation(rule);
}

/**
 * Writes label/formula pairs to a sheet starting at the given row.
 * Column A = label, Column B = formula.
 */
function writeSection_(sheet, startRow, rows) {
  rows.forEach((row, i) => {
    const r = startRow + i;
    sheet.getRange(r, 1).setValue(row[0]);
    sheet.getRange(r, 2).setFormula(row[1]);
  });
}
