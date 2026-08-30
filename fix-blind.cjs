// CodeType - one-click fixer for the blind 3CH "mpo instead of imp" bug.
// Run via FIX-BLIND.bat (double-click it inside your codetype folder).
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend', 'src', 'components', 'LineRow.jsx');

if (!fs.existsSync(file)) {
  console.log('NOT FOUND: frontend\\src\\components\\LineRow.jsx');
  console.log('Put FIX-BLIND.bat inside your codetype folder and run it again.');
  process.exit(1);
}

const t = fs.readFileSync(file, 'utf8');
const OLD = 'i > pointer && i <= pointer + blind';
const NEW = 'i >= pointer && i < pointer + blind';

if (t.includes(NEW)) {
  console.log('CHECK PASSED: your LineRow.jsx already has the fix.');
  console.log('');
  console.log('If the page still shows "mpo" with a gap, the OLD server is still');
  console.log('running the old code. Do exactly this:');
  console.log('  1) close ALL CodeType terminal windows');
  console.log('  2) Task Manager (Ctrl+Shift+Esc) > Details > end every "node.exe"');
  console.log('  3) double-click START-CODETYPE.bat');
  console.log('  4) in the browser press Ctrl+Shift+R');
  console.log('');
  console.log('Line 1 must then show:  imp  (yellow "i", no gap).');
} else if (t.includes(OLD)) {
  fs.writeFileSync(file, t.replace(OLD, NEW), 'utf8');
  console.log('FIXED: your LineRow.jsx was the OLD version. It is now patched in place.');
  console.log('Blind 3CH will now show "imp" (not "mpo").');
  console.log('');
  console.log('Now do this:');
  console.log('  1) close ALL CodeType terminal windows');
  console.log('  2) double-click START-CODETYPE.bat');
  console.log('  3) in the browser press Ctrl+Shift+R');
} else {
  console.log('COULD NOT FIND the expected line inside LineRow.jsx.');
  console.log('');
  console.log('Easiest fix: delete the whole codetype folder, then unzip');
  console.log('codetype-v1.7.2.zip fresh in the same place, then run START-CODETYPE.bat.');
}
