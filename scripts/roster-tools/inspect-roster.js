/**
 * inspect-roster.js
 *
 * Reads a roster .xlsm file and dumps its structure so we can understand
 * the format before building the parser/importer.
 *
 * Usage:
 *   node inspect-roster.js "../../rosters/BURRA ROSTER WEEK 02-03-26 to 08-03-26.xlsm"
 *
 * Install dependency first (once only):
 *   npm install xlsx
 */

const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node inspect-roster.js <path-to-xlsm-file>');
  process.exit(1);
}

const absPath = path.resolve(__dirname, filePath);
console.log(`\nReading: ${absPath}\n`);

const workbook = XLSX.readFile(absPath, { cellStyles: true });

// --- Sheet names ---
console.log('=== SHEETS ===');
workbook.SheetNames.forEach((name, i) => console.log(`  [${i}] ${name}`));
console.log('');

// --- Inspect each sheet ---
workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const range = sheet['!ref'];
  if (!range) {
    console.log(`=== SHEET: "${sheetName}" (empty) ===\n`);
    return;
  }

  console.log(`=== SHEET: "${sheetName}" | Range: ${range} ===`);

  // Dump as array of arrays so we can see raw cell values
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,       // return arrays not objects
    defval: '',      // empty cells as empty string
    raw: false,      // format dates as strings
  });

  // Print first 30 rows max — enough to see structure
  const preview = rows.slice(0, 30);
  preview.forEach((row, i) => {
    // Skip completely empty rows
    if (row.every(cell => cell === '')) return;
    console.log(`  Row ${String(i + 1).padStart(3)}: ${JSON.stringify(row)}`);
  });

  if (rows.length > 30) {
    console.log(`  ... (${rows.length - 30} more rows not shown)`);
  }
  console.log('');
});
