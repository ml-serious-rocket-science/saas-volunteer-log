/**
 * compare-rosters.js
 *
 * Runs the same structural analysis across ALL roster files in a folder
 * and reports any inconsistencies in column positions, sheet names, or date formats.
 *
 * Usage:
 *   node compare-rosters.js "../../rosters" Liddy
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const folderPath = process.argv[2];
const searchName = (process.argv[3] || '').toLowerCase();

if (!folderPath) {
  console.error('Usage: node compare-rosters.js <rosters-folder> [name-fragment]');
  process.exit(1);
}

const absFolder = path.resolve(__dirname, folderPath);
const files = fs.readdirSync(absFolder).filter(f => f.endsWith('.xlsm') || f.endsWith('.xlsx'));

console.log(`\nFound ${files.length} roster files in ${absFolder}\n`);

const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const results = [];

files.forEach(file => {
  const absPath = path.join(absFolder, file);
  let wb;
  try {
    wb = XLSX.readFile(absPath, { cellStyles: true });
  } catch(e) {
    console.error(`  ERROR reading ${file}: ${e.message}`);
    return;
  }

  const result = { file, sheets: wb.SheetNames, days: {}, volunteer: null, shifts: [] };

  // --- Column map from RDP row 3 ---
  const rdp = wb.Sheets['RDP'];
  if (!rdp) { result.error = 'No RDP sheet'; results.push(result); return; }

  const rows = XLSX.utils.sheet_to_json(rdp, { header: 1, defval: '', raw: false });
  const dayHeaderRow = rows[2];
  const dateRow = rows[3];

  dayHeaderRow.forEach((val, colIdx) => {
    if (DAY_NAMES.includes((val||'').trim())) {
      result.days[(val||'').trim()] = { col: colIdx, date: dateRow[colIdx] };
    }
  });

  // --- Find volunteer in Staff List ---
  const staffSheet = wb.Sheets['Staff List'];
  if (staffSheet && searchName) {
    const staffRows = XLSX.utils.sheet_to_json(staffSheet, { header: 1, defval: '', raw: false });
    staffRows.forEach(row => {
      if (row.join(' ').toLowerCase().includes(searchName)) {
        result.volunteer = { num: row[0], first: row[1], last: row[2], id: row[3], qual: row[4], concat: row[5] };
      }
    });
  }

  // --- Find shifts ---
  if (searchName) {
    Object.entries(result.days).forEach(([day, { col, date }]) => {
      const matchRows = [];
      rows.forEach((row, rowIdx) => {
        if (rowIdx < 4) return;
        if ((row[col] || '').toLowerCase().includes(searchName)) {
          // Find nearest time label at or above
          let timeLabel = '';
          for (let r = rowIdx; r >= 4; r--) {
            const t = (rows[r][0] || '').toString().trim();
            if (t.match(/^\d+:\d+/)) { timeLabel = t; break; }
          }
          matchRows.push({ rowIdx: rowIdx+1, time: timeLabel });
        }
      });

      if (matchRows.length > 0) {
        const startTime = matchRows[0].time;
        const endTime = matchRows[matchRows.length - 1].time;
        // End time is the label of the last hour slot — shift ends at start of NEXT hour
        const endHour = parseInt(endTime.split(':')[0]) + 1;
        const endTimeActual = `${endHour}:00`;
        result.shifts.push({ day, date, startTime, endTime: endTimeActual, rows: matchRows.length });
      }
    });
  }

  results.push(result);
});

// --- Report ---
console.log('=== COLUMN CONSISTENCY ===');
const colMaps = results.map(r => JSON.stringify(
  Object.fromEntries(Object.entries(r.days).map(([d, v]) => [d, v.col]))
));
const uniqueMaps = [...new Set(colMaps)];
if (uniqueMaps.length === 1) {
  console.log('  ✓ Column positions are CONSISTENT across all files');
  const dayMap = Object.entries(results[0].days).map(([d, v]) => `${d}=col${v.col}`).join(', ');
  console.log(`  ${dayMap}`);
} else {
  console.log('  ✗ Column positions VARY between files:');
  results.forEach(r => {
    const map = Object.entries(r.days).map(([d,v]) => `${d}=${v.col}`).join(', ');
    console.log(`    ${r.file}: ${map}`);
  });
}
console.log('');

console.log('=== SHEET NAME CONSISTENCY ===');
const sheetMaps = results.map(r => JSON.stringify(r.sheets));
const uniqueSheets = [...new Set(sheetMaps)];
if (uniqueSheets.length === 1) {
  console.log(`  ✓ Sheet names consistent: ${results[0].sheets.join(', ')}`);
} else {
  console.log('  ✗ Sheet names vary:');
  results.forEach(r => console.log(`    ${r.file}: ${r.sheets.join(', ')}`));
}
console.log('');

if (searchName) {
  console.log(`=== VOLUNTEER RECORD CONSISTENCY (${searchName}) ===`);
  const volMaps = results.map(r => JSON.stringify(r.volunteer));
  const uniqueVols = [...new Set(volMaps)];
  if (uniqueVols.length === 1) {
    const v = results[0].volunteer;
    if (v) console.log(`  ✓ Consistent: #${v.num} ${v.concat}`);
    else console.log(`  ! Not found in any file`);
  } else {
    console.log('  ✗ Varies between files:');
    results.forEach(r => console.log(`    ${r.file}: ${JSON.stringify(r.volunteer)}`));
  }
  console.log('');

  console.log(`=== SHIFTS FOR "${searchName}" ACROSS ALL FILES ===`);
  results.forEach(r => {
    console.log(`\n  ${r.file}`);
    if (r.shifts.length === 0) {
      console.log('    (no shifts found)');
    } else {
      r.shifts.forEach(s => {
        console.log(`    ${s.day} ${s.date}: ${s.startTime} – ${s.endTime} (${s.rows} hour-rows)`);
      });
    }
  });
}
