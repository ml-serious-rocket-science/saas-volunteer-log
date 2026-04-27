/**
 * inspect-roster-structure.js
 *
 * Deeper inspection focused on understanding:
 * 1. The column structure of the RDP sheet (which columns = which days)
 * 2. How to find a specific volunteer's shifts
 * 3. How start/end times work (row-based)
 * 4. Consistency across files
 *
 * Usage:
 *   node inspect-roster-structure.js "../../rosters/BURRA ROSTER WEEK 02-03-26 to 08-03-26.xlsm" Liddy
 *
 * Second arg is a name fragment to search for (case-insensitive)
 */

const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2];
const searchName = (process.argv[3] || '').toLowerCase();

if (!filePath) {
  console.error('Usage: node inspect-roster-structure.js <path-to-xlsm> [name-fragment]');
  process.exit(1);
}

const absPath = path.resolve(__dirname, filePath);
console.log(`\nReading: ${path.basename(absPath)}`);
if (searchName) console.log(`Searching for: "${searchName}"\n`);

const workbook = XLSX.readFile(absPath, { cellStyles: true });

// --- Staff List ---
const staffSheet = workbook.Sheets['Staff List'];
if (staffSheet) {
  const staffRows = XLSX.utils.sheet_to_json(staffSheet, { header: 1, defval: '', raw: false });
  console.log('=== STAFF LIST ===');
  staffRows.forEach((row, i) => {
    if (row.every(c => c === '')) return;
    const line = `  [${i+1}] ${JSON.stringify(row)}`;
    if (searchName && row.join(' ').toLowerCase().includes(searchName)) {
      console.log(`>>> ${line}  <-- MATCH`);
    } else {
      console.log(line);
    }
  });
  console.log('');
}

// --- RDP sheet: column map and volunteer appearances ---
const rdp = workbook.Sheets['RDP'];
if (!rdp) { console.error('No RDP sheet found'); process.exit(1); }

const rows = XLSX.utils.sheet_to_json(rdp, { header: 1, defval: '', raw: false });

// Row 3 = day headers, Row 4 = dates
const dayHeaderRow = rows[2];   // 0-indexed: row 3
const dateRow = rows[3];        // 0-indexed: row 4

console.log('=== COLUMN MAP (Row 3 - day headers) ===');
dayHeaderRow.forEach((val, i) => {
  if (val && val.trim()) console.log(`  Col ${i} (${colLetter(i)}): "${val}"`);
});
console.log('');

console.log('=== DATE ROW (Row 4) ===');
dateRow.forEach((val, i) => {
  if (val && val.trim()) console.log(`  Col ${i} (${colLetter(i)}): "${val}"`);
});
console.log('');

// Find all rows where the search name appears
if (searchName) {
  console.log(`=== ALL ROWS CONTAINING "${searchName}" ===`);
  rows.forEach((row, i) => {
    const rowStr = row.join('|').toLowerCase();
    if (rowStr.includes(searchName)) {
      console.log(`  Row ${i+1}: ${JSON.stringify(row)}`);
    }
  });
  console.log('');

  // Now try to extract shift blocks: find contiguous time rows for each day
  console.log(`=== SHIFT ANALYSIS FOR "${searchName}" ===`);
  console.log('(Looking for which day-columns contain this volunteer and what time range)\n');

  // Day column start positions from header row
  // Columns with "Monday", "Tuesday" etc in row 3
  const dayColumns = {};
  dayHeaderRow.forEach((val, colIdx) => {
    const v = (val || '').trim();
    if (['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(v)) {
      dayColumns[v] = { nameCol: colIdx, date: dateRow[colIdx] };
    }
  });

  console.log('Day column positions:');
  Object.entries(dayColumns).forEach(([day, info]) => {
    console.log(`  ${day}: name column = ${info.nameCol} (${colLetter(info.nameCol)}), date = "${info.date}"`);
  });
  console.log('');

  // For each day, find the time range where our volunteer appears
  Object.entries(dayColumns).forEach(([day, { nameCol, date }]) => {
    const matchingTimes = [];
    rows.forEach((row, rowIdx) => {
      if (rowIdx < 4) return; // skip headers
      const cellVal = (row[nameCol] || '').toLowerCase();
      if (cellVal.includes(searchName)) {
        // Time is in column A (index 0) of the nearest time-labelled row at or above
        let timeLabel = '';
        for (let r = rowIdx; r >= 4; r--) {
          if (rows[r][0] && rows[r][0].toString().match(/^\d+:\d+/)) {
            timeLabel = rows[r][0];
            break;
          }
        }
        matchingTimes.push({ rowIdx: rowIdx+1, time: timeLabel, cell: row[nameCol] });
      }
    });

    if (matchingTimes.length > 0) {
      const firstTime = matchingTimes[0].time;
      const lastTime = matchingTimes[matchingTimes.length - 1].time;
      console.log(`  ${day} (${date}): found in ${matchingTimes.length} rows`);
      console.log(`    First appearance: row ${matchingTimes[0].rowIdx}, time "${firstTime}"`);
      console.log(`    Last appearance:  row ${matchingTimes[matchingTimes.length-1].rowIdx}, time "${lastTime}"`);
      console.log(`    Cell value: "${matchingTimes[0].cell}"`);
    }
  });
}

function colLetter(n) {
  let s = '';
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
