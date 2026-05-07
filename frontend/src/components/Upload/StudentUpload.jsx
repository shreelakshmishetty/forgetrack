import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { readSpreadsheets } from '../../services/aiImportService';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const matchColumn = (headers, possibleNames) => {
  for (const h of headers) {
    const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const p of possibleNames) {
      if (lower.includes(p.replace(/[^a-z0-9]/g, ''))) return h;
    }
  }
  return null;
};

export default function StudentUpload() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, parsing, preview, uploading, success
  const [error, setError] = useState('');
  
  const [validStudents, setValidStudents] = useState([]);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [uploadStats, setUploadStats] = useState({ added: 0, updated: 0 });

  const reset = () => {
    setFile(null);
    setValidStudents([]);
    setDuplicatesRemoved(0);
    setStatus('idle');
    setError('');
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    reset();
    setFile(uploadedFile);
    setStatus('parsing');

    try {
      const sheets = await readSpreadsheets(uploadedFile);
      if (sheets.length === 0) throw new Error("No valid data found in spreadsheet.");
      
      // Merge all rows from all sheets
      let allRows = [];
      let mergedHeaders = new Set();
      
      sheets.forEach(sheet => {
        sheet.headers.forEach(h => mergedHeaders.add(h));
        allRows = [...allRows, ...sheet.rows];
      });

      const headers = Array.from(mergedHeaders);

      // Auto-detect columns
      const usnCol = matchColumn(headers, ['usn', 'rollno', 'rollnumber']);
      const nameCol = matchColumn(headers, ['name', 'studentname', 'fullname']);
      const emailCol = matchColumn(headers, ['email', 'mailid']);
      const branchCol = matchColumn(headers, ['branch', 'branchcode', 'department']);
      const admCol = matchColumn(headers, ['admission', 'admno']);

      if (!usnCol || !nameCol) {
        throw new Error("Could not automatically detect 'USN' and 'Name' columns. Please check your headers.");
      }

      const extracted = [];
      let dupCount = 0;
      const seenUsns = new Set();

      allRows.forEach(row => {
        const usnRaw = String(row[usnCol] || '').trim();
        const nameRaw = String(row[nameCol] || '').trim();
        
        if (!usnRaw || !nameRaw) return; // skip empty
        
        const usnUpper = usnRaw.toUpperCase();

        if (seenUsns.has(usnUpper)) {
          dupCount++;
          return; // skip duplicate in file
        }

        seenUsns.add(usnUpper);
        
        extracted.push({
          usn: usnUpper,
          name: nameRaw,
          email: emailCol ? String(row[emailCol] || '').trim() : null,
          branch_code: branchCol ? String(row[branchCol] || '').trim() : 'UNKNOWN',
          admission_number: admCol ? String(row[admCol] || '').trim() : null,
          batch: '2024-2028' // default as per schema
        });
      });

      if (extracted.length === 0) {
        throw new Error("No valid student records found.");
      }

      setValidStudents(extracted);
      setDuplicatesRemoved(dupCount);
      setStatus('preview');

    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const handleConfirmUpload = async () => {
    setStatus('uploading');
    setError('');

    try {
      // Supabase UPSERT based on USN
      const { data, error: upsertError } = await supabase.from('students')
        .upsert(validStudents, { onConflict: 'usn' })
        .select('id');

      if (upsertError) throw upsertError;

      // Because Supabase upsert doesn't perfectly return "inserted vs updated" easily in one query without xmax,
      // we just report total processed.
      setUploadStats({
        total: validStudents.length,
        duplicatesFile: duplicatesRemoved
      });
      
      setStatus('success');
      
    } catch (err) {
      console.error(err);
      setError("Database Upload failed: " + err.message);
      setStatus('preview');
    }
  };

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-h2 flex items-center gap-3">
          <Users className="text-accent-glow" size={28} />
          Student Roster Import
        </h2>
        <p className="text-body-lg text-fg-secondary">Upload a CSV/XLSX to add or update students. Duplicates in the file are removed, and existing database records are safely updated.</p>
      </div>

      {error && (
        <div className="p-4 bg-danger-bg border border-danger-border rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-danger-fg shrink-0 mt-0.5" size={20} />
          <p className="text-body text-danger-fg break-all">{error}</p>
        </div>
      )}

      {status === 'idle' && (
        <div className="card p-12 border-2 border-dashed border-border-strong text-center hover:bg-surface-raised transition-colors cursor-pointer relative mt-8">
          <input 
            type="file" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <FileSpreadsheet size={48} className="mx-auto text-fg-tertiary mb-4" strokeWidth={1} />
          <h3 className="text-h2 text-fg-primary mb-2">Select Roster File</h3>
          <p className="text-body-lg text-fg-secondary">Drop your .csv or .xlsx file here, or click to browse.</p>
        </div>
      )}

      {status === 'parsing' && (
        <div className="card p-12 text-center space-y-6 mt-8">
          <Loader2 size={48} className="mx-auto text-accent-glow animate-spin" />
          <h3 className="text-h2 text-fg-primary">Analyzing Roster...</h3>
        </div>
      )}

      {status === 'uploading' && (
        <div className="card p-12 text-center space-y-6 mt-8">
          <Loader2 size={48} className="mx-auto text-accent-glow animate-spin" />
          <h3 className="text-h2 text-fg-primary">Syncing with Database...</h3>
          <p className="text-body-lg text-fg-secondary">Performing safe UPSERTs to ensure no duplicates.</p>
        </div>
      )}

      {status === 'preview' && (
        <div className="card space-y-8 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-h2 text-fg-primary">Import Preview</h2>
              <p className="text-body text-fg-secondary mt-1">
                Found <strong>{validStudents.length}</strong> valid students. 
                {duplicatesRemoved > 0 && <span className="text-warning-fg ml-2">({duplicatesRemoved} duplicates removed from file)</span>}
              </p>
            </div>
            <button onClick={reset} className="btn-secondary !px-4">Cancel</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-default">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-inset border-b border-border-default">
                  <th className="p-3 text-caption font-medium text-fg-secondary">USN</th>
                  <th className="p-3 text-caption font-medium text-fg-secondary">NAME</th>
                  <th className="p-3 text-caption font-medium text-fg-secondary">BRANCH</th>
                  <th className="p-3 text-caption font-medium text-fg-secondary">EMAIL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {validStudents.slice(0, 50).map((student, i) => (
                  <tr key={i} className="hover:bg-surface-raised transition-colors">
                    <td className="p-3 text-body font-mono text-accent-glow">{student.usn}</td>
                    <td className="p-3 text-body text-fg-primary">{student.name}</td>
                    <td className="p-3 text-body text-fg-secondary">{student.branch_code}</td>
                    <td className="p-3 text-body text-fg-tertiary">{student.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validStudents.length > 50 && (
              <div className="p-3 text-center text-caption text-fg-tertiary bg-surface-inset border-t border-border-default">
                Showing first 50 of {validStudents.length} students
              </div>
            )}
          </div>

          <div className="pt-4">
            <button onClick={handleConfirmUpload} className="btn-primary w-full flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> Sync Students to Database
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="card text-center p-12 space-y-6 flex flex-col items-center mt-8 border-success-border">
          <div className="w-20 h-20 bg-success-bg rounded-full flex items-center justify-center text-success-fg">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <h2 className="text-h2 text-fg-primary mb-2">Upload Successful</h2>
            <p className="text-body-lg text-fg-secondary">
              Processed <strong>{uploadStats.total}</strong> students into the database. 
              {uploadStats.duplicatesFile > 0 && ` Removed ${uploadStats.duplicatesFile} duplicates from the file.`}
            </p>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={reset} className="btn-secondary">Upload Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
