/**
 * parse-roster.js
 *
 * Reads a BURRA ROSTER .xlsm file, finds your shifts, and writes a JSON
 * file ready for import into Google Calendar via the companion Apps Script.
 *
 * Usage:
 *   node parse-roster.js "../../rosters/BURRA ROSTER WEEK 27-04-26 to 03-05-26.xlsm"
 *
 * Output:
 *   ../../rosters/parsed/BURRA ROSTER WEEK 27-04-26 to 03-05-26.json
 *
 * Config:
 *   Edit the CONFIG block below to set your name and station.
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  // Name fragment to match in the roster — case insensitive
  volunteerName: 'Liddy',

  // Station name — used in Calendar event titles
  station: 'Burra',

  // Calendar event colour name (used in output, applied by Apps Script)
  // Must match a valid Google Calendar colour name
  calendarColour: 'eucalyptus',
};
// ─────────────────────────────────────────────────────────────────────────────

const DAY_COLS = {
  Monday:    3,
  Tuesday:   7,
  Wednesday: 11,
  Thursday:  15,
  Friday:    19,
  Saturday:  23,
  Sunday:    27,
};

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node parse-roster.js <path-to-xlsm-file>');
  process.exit(1);
}

const absPath = path.resolve(__dirname, filePath);
if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

console.log(`\nParsing: ${path.basename(absPath)}`);

const wb = XLSX.readFile(absPath);
const rdp = wb.Sheets['RDP'];
if (!rdp) { console.error('ERROR: No RDP sheet found'); process.exit(1); }

const rows = XLSX.utils.sheet_to_json(rdp, { header: 1, defval: '', raw: false });

// Date row is row index 3 (row 4 in spreadsheet)
const dateRow = rows[3];

// ─── Parse dates for each day ─────────────────────────────────────────────────
// Dates appear as M/D/YY e.g. "3/6/26" or "4/10/26"
function parseRosterDate(raw) {
  if (!raw || !raw.trim()) return null;
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0]);
  const day   = parseInt(parts[1]);
  const year  = 2000 + parseInt(parts[2]);
  return new Date(year, month - 1, day);
}

function formatDate(d) {
  // Returns YYYY-MM-DD
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseTimeLabel(label) {
  // "6:00" -> 6, "20:00" -> 20
  if (!label) return null;
  const m = label.trim().match(/^(\d+):(\d+)/);
  if (!m) return null;
  return parseInt(m[1]);
}

// ─── Find volunteer's shifts ──────────────────────────────────────────────────
const nameFragment = CONFIG.volunteerName.toLowerCase();
const shifts = [];

Object.entries(DAY_COLS).forEach(([dayName, nameCol]) => {
  const rawDate = dateRow[nameCol];
  const shiftDate = parseRosterDate(rawDate);
  if (!shiftDate) return;

  // Find all rows where our volunteer appears in this day's column
  const matchingRows = [];
  rows.forEach((row, rowIdx) => {
    if (rowIdx < 4) return; // skip header rows
    const cellVal = (row[nameCol] || '').toLowerCase();
    if (cellVal.includes(nameFragment)) {
      // Find nearest time label at or above this row (column A)
      let timeLabel = '';
      for (let r = rowIdx; r >= 4; r--) {
        const t = (rows[r][0] || '').toString().trim();
        if (t.match(/^\d+:\d+/)) { timeLabel = t; break; }
      }
      matchingRows.push({ rowIdx, timeLabel });
    }
  });

  if (matchingRows.length === 0) return;

  const startHour = parseTimeLabel(matchingRows[0].timeLabel);
  const lastHour  = parseTimeLabel(matchingRows[matchingRows.length - 1].timeLabel);

  if (startHour === null || lastHour === null) {
    console.warn(`  WARNING: Could not parse times for ${dayName} ${rawDate} — skipping`);
    return;
  }

  // End hour is last time label + 1
  const endHour = lastHour + 1;

  // Handle overnight: if end hour >= 24 or end hour < start hour, shift crosses midnight
  let startDate = new Date(shiftDate);
  let endDate   = new Date(shiftDate);

  const isOvernight = endHour > 24 || endHour <= startHour;

  if (endHour >= 24) {
    // e.g. last slot is 23:00 -> ends at 24:00 = midnight = start of next day
    endDate = new Date(shiftDate);
    endDate.setDate(endDate.getDate() + 1);
  } else if (endHour < startHour) {
    // e.g. starts 20:00, ends 6:00 next day
    endDate = new Date(shiftDate);
    endDate.setDate(endDate.getDate() + 1);
  }

  const startISO = `${formatDate(startDate)}T${String(startHour).padStart(2,'0')}:00:00`;
  const endISO   = `${formatDate(endDate)}T${String(endHour % 24).padStart(2,'0')}:00:00`;

  const shift = {
    day:       dayName,
    date:      formatDate(shiftDate),
    startTime: `${String(startHour).padStart(2,'0')}:00`,
    endTime:   `${String(endHour % 24).padStart(2,'0')}:00`,
    overnight: isOvernight,
    startISO,
    endISO,
    station:   CONFIG.station,
    title:     `On-call — ${CONFIG.station}`,
    colour:    CONFIG.calendarColour,
    hours:     matchingRows.length,
    // Placeholder — Apps Script will populate after creating the Calendar event
    calendarEventId: null,
    // Placeholder — will be populated after Sheet row is created
    shiftId: null,
  };

  shifts.push(shift);
  console.log(`  Found: ${dayName} ${shift.date} ${shift.startTime}–${shift.endTime}${isOvernight ? ' (overnight)' : ''}`);
});

if (shifts.length === 0) {
  console.log(`\n  No shifts found for "${CONFIG.volunteerName}" in this file.`);
  process.exit(0);
}

// ─── Write output JSON ────────────────────────────────────────────────────────
const outputDir = path.resolve(__dirname, '../../rosters/parsed');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const baseName = path.basename(absPath, path.extname(absPath));
const outputPath = path.join(outputDir, `${baseName}.json`);

const output = {
  sourceFile:  path.basename(absPath),
  parsedAt:    new Date().toISOString(),
  volunteer:   CONFIG.volunteerName,
  station:     CONFIG.station,
  shiftCount:  shifts.length,
  shifts,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\n  ✓ Written ${shifts.length} shift(s) to:\n    ${outputPath}\n`);
console.log('Next step: run the Apps Script importer against this JSON file to create Calendar events.\n');
