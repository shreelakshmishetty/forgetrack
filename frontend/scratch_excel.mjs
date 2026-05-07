import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = process.argv[2];
const buf = fs.readFileSync(filePath);
const workbook = XLSX.read(buf, {type: 'buffer'});

console.log("Sheets:", workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const ws = workbook.Sheets[sheetName];
  const jsonRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  
  // Find first non-empty row to show headers
  let firstRow = 0;
  while(firstRow < jsonRaw.length && jsonRaw[firstRow].every(c => c === '')) {
      firstRow++;
  }
  
  console.log(`\n--- Sheet: ${sheetName} ---`);
  if (jsonRaw[firstRow]) console.log("Headers/Row 1:", jsonRaw[firstRow]);
  if (jsonRaw[firstRow + 1]) console.log("Row 2:", jsonRaw[firstRow + 1]);
  if (jsonRaw[firstRow + 2]) console.log("Row 3:", jsonRaw[firstRow + 2]);
});
