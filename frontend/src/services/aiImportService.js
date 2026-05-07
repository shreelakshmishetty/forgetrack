import { genAI } from '../lib/gemini';
import * as XLSX from 'xlsx';

/**
 * Helper to convert a JS Date object to YYYY-MM-DD string
 */
function toDateStr(d) {
  if (!(d instanceof Date) || isNaN(d)) return String(d);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Reads a file (CSV or XLSX) and extracts its sheets, handling double-headers and Excel dates.
 */
export async function readSpreadsheets(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        // cellDates: true converts Excel serial dates into JS Date objects
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const sheets = [];
        workbook.SheetNames.forEach(sheetName => {
          const ws = workbook.Sheets[sheetName];
          const jsonRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          
          // Filter out completely empty rows
          const rows = jsonRaw.filter(row => row.some(cell => cell !== null && cell !== ''));
          
          if (rows.length > 1) {
            // Attempt to build consolidated headers (handling merged top rows)
            const row1 = rows[0];
            const row2 = rows[1];
            
            const finalHeaders = [];
            let lastTopVal = '';

            // Detect if row 1 is a "grouping" header (like "Day 1", "", "")
            let isDoubleHeader = false;
            let emptyCountRow1 = 0;
            row1.forEach(c => { if(c === '') emptyCountRow1++; });
            if (emptyCountRow1 > row1.length / 2 && rows.length > 2) {
               isDoubleHeader = true;
            }

            const headerRowIndex = isDoubleHeader ? 1 : 0;
            const dataStartIndex = isDoubleHeader ? 2 : 1;

            for (let i = 0; i < Math.max(row1.length, row2 ? row2.length : 0); i++) {
              let val1 = isDoubleHeader ? row1[i] : '';
              let val2 = isDoubleHeader ? row2[i] : row1[i];
              
              if (val1 instanceof Date) val1 = toDateStr(val1);
              if (val2 instanceof Date) val2 = toDateStr(val2);
              
              val1 = String(val1).trim();
              val2 = String(val2).trim();

              if (isDoubleHeader) {
                if (val1) lastTopVal = val1;
                else val1 = lastTopVal;
              }

              let colName = val1 && val2 ? `${val1} | ${val2}` : (val1 || val2 || `Column_${i}`);
              finalHeaders.push(colName);
            }

            // Convert to objects
            const dataRows = rows.slice(dataStartIndex).map(row => {
              const obj = {};
              finalHeaders.forEach((h, i) => {
                let cellVal = row[i];
                if (cellVal instanceof Date) cellVal = toDateStr(cellVal);
                obj[h] = cellVal;
              });
              return obj;
            });

            // Ensure unique headers (in case of duplicates like "Attendance")
            const uniqueHeaders = [];
            const counts = {};
            finalHeaders.forEach(h => {
              let finalH = h;
              if (counts[h]) {
                finalH = `${h} (${counts[h]})`;
                counts[h]++;
              } else {
                counts[h] = 1;
              }
              uniqueHeaders.push(finalH);
            });

            // Re-map objects to unique headers
            const uniqueDataRows = rows.slice(dataStartIndex).map(row => {
              const obj = {};
              uniqueHeaders.forEach((h, i) => {
                let cellVal = row[i];
                if (cellVal instanceof Date) cellVal = toDateStr(cellVal);
                obj[h] = cellVal;
              });
              return obj;
            });

            sheets.push({
              name: sheetName,
              headers: uniqueHeaders,
              rows: uniqueDataRows
            });
          }
        });
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * AI function to map columns and extract MULTIPLE sessions from a sheet.
 */
export async function analyzeSheetWithAI(sheetName, headers, sampleRows) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
  
  const prompt = `
You are a data mapping assistant. I have a messy spreadsheet tracking student attendance.
It may be in a "Wide Format", meaning attendance for multiple different days is tracked in different columns.

Sheet Name: "${sheetName}"
Source Columns: ${JSON.stringify(headers)}
Sample Rows: ${JSON.stringify(sampleRows)}

I need you to:
1. Identify the single "usn_col": The column containing the student's unique university serial number (e.g. 4SH24CS001, roll number, identifier).
2. Identify all columns that represent attendance for a specific session.
3. For each attendance column you find, attempt to extract its Date. 
   - The date might be in the column name itself (e.g., "30/04/26", "2026-04-30").
   - Or it might be a generic name like "Day 1 | Attendance". If it's generic and you cannot deduce the exact date from the context, return null for "date".
   - If found, format the date exactly as "YYYY-MM-DD". Assume the current year is 2026 if the year is missing.

Return ONLY a valid JSON object in this exact format, with no markdown, no backticks, and no extra text:
{
  "usn_col": "Exact Source Column Name",
  "sessions": [
    {"present_col": "Exact Source Column Name for Session 1", "date": "YYYY-MM-DD" | null},
    {"present_col": "Exact Source Column Name for Session 2", "date": "YYYY-MM-DD" | null}
  ]
}
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiMapping = JSON.parse(jsonStr);

    if (!aiMapping.usn_col || !aiMapping.sessions || aiMapping.sessions.length === 0) {
      throw new Error("AI returned invalid mapping columns: " + jsonStr);
    }

    return aiMapping; // { usn_col, sessions: [{ present_col, date }] }
  } catch (err) {
    console.error("AI Analysis failed for sheet", sheetName, err);
    throw new Error("Could not automatically map sheet: " + sheetName + " Details: " + err.message);
  }
}

/**
 * AI function to suggest possible dates based on day of week.
 */
export async function suggestDatesByDayOfWeek(daysOfWeek) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
  
  const prompt = `
The user indicated that their classes usually happen on the following days of the week: "${daysOfWeek}".
Today's date is: ${new Date().toISOString().split('T')[0]}

Generate the 4 most recent dates (in the past, including today if applicable) that fall on those days of the week.
Return ONLY a JSON array of strings in "YYYY-MM-DD" format. No markdown.
Example: ["2026-05-06", "2026-05-01", "2026-04-29", "2026-04-24"]
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to suggest dates", err);
    const d = new Date();
    return [1, 2, 3, 4].map(i => {
      const past = new Date(d);
      past.setDate(d.getDate() - i);
      return past.toISOString().split('T')[0];
    });
  }
}
