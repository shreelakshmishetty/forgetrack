import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { readSpreadsheets, analyzeSheetWithAI, suggestDatesByDayOfWeek } from '../../services/aiImportService';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Layers, Calendar as CalendarIcon, ServerCrash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown Date';
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function AttendanceUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Database existing sessions
  const [dbSessions, setDbSessions] = useState([]);

  // File & Sheets
  const [file, setFile] = useState(null);
  const [extractedSheets, setExtractedSheets] = useState([]); // { name, headers, rows, selected }
  
  // Processing Pipeline
  const [status, setStatus] = useState('idle'); 
  // 'idle' -> 'sheet_selection' -> 'ai_processing' -> 'needs_date_resolution' -> 'duplicate_resolution' -> 'preview' -> 'uploading' -> 'success'
  
  const [processedSheets, setProcessedSheets] = useState([]); 
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  
  const [flatSessions, setFlatSessions] = useState([]); // Array of { id, sheetName, rows, usn_col, present_col, date }

  // Date Resolution State
  const [daysOfWeekInput, setDaysOfWeekInput] = useState('');
  const [suggestedDates, setSuggestedDates] = useState([]);
  const [resolvingDates, setResolvingDates] = useState(false);
  const [dateResolutions, setDateResolutions] = useState({}); // { [sessionId]: dateStr }

  // Duplicate Resolution State
  const [duplicateConflict, setDuplicateConflict] = useState(null); // { date, sessionA, sessionB }

  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase.from('sessions').select('*').order('date', { ascending: false });
      setDbSessions(data || []);
    }
    fetchSessions();
  }, []);

  const reset = () => {
    setFile(null);
    setExtractedSheets([]);
    setProcessedSheets([]);
    setCurrentProcessingIndex(0);
    setFlatSessions([]);
    setDateResolutions({});
    setDuplicateConflict(null);
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
      if (sheets.length === 0) {
        throw new Error("No valid data found in spreadsheet.");
      }
      
      const selectableSheets = sheets.map((s, i) => ({ ...s, selected: i === 0 })); // Auto-select first
      setExtractedSheets(selectableSheets);
      
      if (sheets.length === 1) {
        startAIProcessing(selectableSheets);
      } else {
        setStatus('sheet_selection');
      }
    } catch (err) {
      setError("Error reading file: " + err.message);
      setStatus('idle');
    }
  };

  const toggleSheetSelection = (index) => {
    const newSheets = [...extractedSheets];
    newSheets[index].selected = !newSheets[index].selected;
    setExtractedSheets(newSheets);
  };

  const handleSheetSelectionConfirm = () => {
    const selected = extractedSheets.filter(s => s.selected);
    if (selected.length === 0) {
      setError("Please select at least one sheet.");
      return;
    }
    setError('');
    startAIProcessing(selected);
  };

  const startAIProcessing = (sheetsToProcess) => {
    setExtractedSheets(sheetsToProcess);
    setProcessedSheets([]);
    setCurrentProcessingIndex(0);
    setStatus('ai_processing');
  };

  // AI Pipeline Execution Loop
  useEffect(() => {
    if (status !== 'ai_processing') return;

    async function processNext() {
      if (currentProcessingIndex >= extractedSheets.length) {
        // Finished processing all sheets! Flatten the sessions.
        buildFlatSessions(processedSheets);
        return;
      }

      const sheet = extractedSheets[currentProcessingIndex];
      try {
        const aiMapping = await analyzeSheetWithAI(sheet.name, sheet.headers, sheet.rows.slice(0, 3));
        
        const sheetData = { ...sheet, mapping: aiMapping };
        setProcessedSheets(prev => [...prev, sheetData]);
        setCurrentProcessingIndex(prev => prev + 1);

      } catch (err) {
        setError(err.message);
        setStatus('idle');
      }
    }
    processNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentProcessingIndex]);


  const buildFlatSessions = (sheets) => {
    let flat = [];
    let idCounter = 0;

    sheets.forEach(sheet => {
      sheet.mapping.sessions.forEach(sess => {
        flat.push({
          id: idCounter++,
          sheetName: sheet.name,
          rows: sheet.rows, // reference to data
          usn_col: sheet.mapping.usn_col,
          present_col: sess.present_col,
          date: sess.date
        });
      });
    });

    setFlatSessions(flat);

    // Check for missing dates
    const missingDates = flat.filter(s => !s.date);
    if (missingDates.length > 0) {
      setStatus('needs_date_resolution');
    } else {
      checkForDuplicates(flat);
    }
  };

  // Resolve Missing Date
  const handleGetDateSuggestions = async () => {
    if (!daysOfWeekInput.trim()) return;
    setResolvingDates(true);
    const suggestions = await suggestDatesByDayOfWeek(daysOfWeekInput);
    setSuggestedDates(suggestions);
    
    // Auto-fill dropdowns with the first suggestion if empty
    const newRes = { ...dateResolutions };
    const missingDates = flatSessions.filter(s => !s.date);
    missingDates.forEach(s => {
      if (!newRes[s.id] && suggestions.length > 0) {
        newRes[s.id] = suggestions[0];
      }
    });
    setDateResolutions(newRes);
    
    setResolvingDates(false);
  };

  const handleApplyDateResolutions = () => {
    const newFlat = flatSessions.map(s => {
      if (!s.date && dateResolutions[s.id]) {
        return { ...s, date: dateResolutions[s.id] };
      }
      return s;
    });
    
    setFlatSessions(newFlat);
    
    // Ensure all missing are resolved
    if (newFlat.some(s => !s.date)) {
      setError("Please assign a date for all missing columns.");
      return;
    }
    
    setError('');
    checkForDuplicates(newFlat);
  };


  // Duplicate Check
  const checkForDuplicates = (sessionsArray) => {
    const dateMap = {}; // { [date]: [sessionA, sessionB] }
    let conflict = null;

    for (const sess of sessionsArray) {
      if (!dateMap[sess.date]) dateMap[sess.date] = [];
      dateMap[sess.date].push(sess);
    }

    for (const date in dateMap) {
      const sessGroup = dateMap[date];
      // Find if multiple DIFFERENT sheets claim the same date
      const uniqueSheets = new Set(sessGroup.map(s => s.sheetName));
      if (uniqueSheets.size > 1) {
        // Conflict! Pick first two from different sheets
        const sA = sessGroup[0];
        const sB = sessGroup.find(s => s.sheetName !== sA.sheetName);
        conflict = { date, sessionA: sA, sessionB: sB };
        break;
      }
    }

    if (conflict) {
      setDuplicateConflict(conflict);
      setStatus('duplicate_resolution');
    } else {
      setStatus('preview');
    }
  };

  const handleResolveDuplicate = (keepSession, discardSession) => {
    // Remove the discarded sheet's session for this date
    const newFlat = flatSessions.filter(s => s.id !== discardSession.id);
    setFlatSessions(newFlat);
    setDuplicateConflict(null);
    checkForDuplicates(newFlat); // check recursively
  };

  // Final Upload
  const handleConfirmUpload = async () => {
    setStatus('uploading');
    setError('');

    try {
      let totalImported = 0;
      let totalSkipped = 0;

      // 1. Get mapping of USN -> Student ID
      const { data: studentsData, error: stdError } = await supabase.from('students').select('id, usn');
      if (stdError) throw stdError;
      const usnToId = {};
      studentsData.forEach(s => usnToId[s.usn] = s.id);

      for (const sess of flatSessions) {
        setUploadProgress(`Processing column ${sess.present_col} from ${sess.sheetName}...`);

        // 2. Resolve Session ID in DB
        let sessionId;
        const existingSession = dbSessions.find(s => s.date === sess.date);
        
        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          setUploadProgress(`Creating new DB session for ${sess.date}...`);
          const month = new Date(sess.date).getMonth() + 1;
          const { data: newSess, error: sessErr } = await supabase.from('sessions').insert({
            date: sess.date,
            topic: `Imported Session (${sess.present_col})`,
            duration_hours: 2.0,
            session_type: 'offline',
            month_number: month
          }).select().single();
          if (sessErr) throw sessErr;
          sessionId = newSess.id;
          setDbSessions(prev => [...prev, newSess]); // update local cache
        }

        // 3. Create Import Log
        const { data: logEntry, error: logError } = await supabase.from('import_log').insert({
          filename: `${file.name} - ${sess.sheetName} (${sess.present_col})`,
          uploaded_by: user.display_name,
          total_rows: sess.rows.length,
          imported_rows: 0,
          skipped_rows: 0,
          status: 'processing',
          column_mapping: JSON.stringify({ usn: sess.usn_col, present: sess.present_col, date: sess.date })
        }).select().single();
        if (logError) throw logError;

        // 4. Prepare Attendance Rows
        const rowsToInsert = [];
        let skippedCount = 0;

        sess.rows.forEach(row => {
          const usn = String(row[sess.usn_col] || '').trim();
          const rawPresent = String(row[sess.present_col] || '').toLowerCase().trim();
          const isPresent = ['p', 'present', 'true', '1', 'yes', 'y'].includes(rawPresent);
          
          const studentId = usnToId[usn];
          if (studentId) {
            rowsToInsert.push({
              student_id: studentId,
              session_id: sessionId,
              present: isPresent,
              marked_by: `AI Bulk Import`,
              import_id: logEntry.id
            });
          } else if (usn) {
            skippedCount++;
          }
        });

        // 5. Upsert Attendance
        if (rowsToInsert.length > 0) {
          const { error: upsertError } = await supabase.from('attendance')
            .upsert(rowsToInsert, { onConflict: 'student_id,session_id' });
          if (upsertError) throw upsertError;
        }

        // 6. Update Log
        await supabase.from('import_log').update({
          imported_rows: rowsToInsert.length,
          skipped_rows: skippedCount,
          status: 'completed'
        }).eq('id', logEntry.id);

        totalImported += rowsToInsert.length;
        totalSkipped += skippedCount;
      }

      setStatus('success');
      
    } catch (err) {
      console.error(err);
      setError("Upload failed: " + err.message);
      setStatus('preview');
    }
  };

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-h2 flex items-center gap-3">
          <UploadCloud className="text-accent-glow" size={28} />
          AI Attendance Import
        </h2>
        <p className="text-body-lg text-fg-secondary">Upload CSV/XLSX spreadsheets. The AI Agent will parse wide-format sheets, detect multiple sessions, resolve gaps, and fill the database.</p>
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
          <h3 className="text-h2 text-fg-primary mb-2">Select Spreadsheet</h3>
          <p className="text-body-lg text-fg-secondary">Drop your .csv or .xlsx file here, or click to browse.</p>
        </div>
      )}

      {status === 'sheet_selection' && (
        <div className="card space-y-6 mt-8">
          <div className="border-b border-border-subtle pb-4">
            <h3 className="text-h3 text-fg-primary flex items-center gap-2">
              <Layers size={20} className="text-accent-glow"/> 
              Multiple Sheets Detected
            </h3>
            <p className="text-body text-fg-secondary mt-1">Select the sheets you want the AI to process.</p>
          </div>
          <div className="space-y-2">
            {extractedSheets.map((sheet, i) => (
              <label key={i} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${sheet.selected ? 'border-accent-glow bg-accent-glow/5' : 'border-border-default hover:bg-surface-raised'}`}>
                <input type="checkbox" className="w-5 h-5 accent-accent-glow" checked={sheet.selected} onChange={() => toggleSheetSelection(i)} />
                <div className="flex-1">
                  <p className="text-body-lg font-medium text-fg-primary">{sheet.name}</p>
                  <p className="text-caption text-fg-tertiary">{sheet.rows.length} rows</p>
                </div>
              </label>
            ))}
          </div>
          <button onClick={handleSheetSelectionConfirm} className="btn-primary w-full">Proceed with Selected Sheets</button>
        </div>
      )}

      {(status === 'parsing' || status === 'ai_processing' || status === 'uploading') && (
        <div className="card p-12 text-center space-y-6 mt-8">
          <Loader2 size={48} className="mx-auto text-accent-glow animate-spin" />
          <div>
            <h3 className="text-h2 text-fg-primary mb-2">
              {status === 'parsing' && "Reading Spreadsheet..."}
              {status === 'ai_processing' && `AI Agent Processing Sheet ${currentProcessingIndex + 1} of ${extractedSheets.length}...`}
              {status === 'uploading' && "Saving to Database..."}
            </h3>
            <p className="text-body-lg text-fg-secondary">
              {status === 'ai_processing' && "Analyzing columns to detect multiple sessions natively."}
              {status === 'uploading' && uploadProgress}
            </p>
          </div>
        </div>
      )}

      {status === 'needs_date_resolution' && (
        <div className="card space-y-8 mt-8 border-warning-border">
          <div className="flex items-start gap-4 p-4 bg-warning-bg/10 rounded-xl border border-warning-border">
            <CalendarIcon className="text-warning-fg shrink-0 mt-1" size={24}/>
            <div>
              <h3 className="text-h3 text-warning-fg mb-1">Missing Dates Detected</h3>
              <p className="text-body text-fg-secondary">
                The AI identified several attendance columns, but couldn't deduce the exact date from their headers (e.g., "Day 1").
              </p>
            </div>
          </div>
          
          <div className="space-y-4 bg-surface-inset p-4 rounded-xl border border-border-default">
            <h4 className="text-body-lg font-medium text-fg-primary">Ask AI for Date Suggestions</h4>
            <label className="block text-label text-fg-secondary">What days in a week is usually the class taken?</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                className="input flex-1" 
                placeholder="e.g. Tuesdays and Thursdays"
                value={daysOfWeekInput}
                onChange={e => setDaysOfWeekInput(e.target.value)}
              />
              <button onClick={handleGetDateSuggestions} disabled={resolvingDates || !daysOfWeekInput.trim()} className="btn-secondary whitespace-nowrap flex items-center justify-center gap-2">
                {resolvingDates ? <Loader2 size={16} className="animate-spin" /> : null}
                Generate Dates
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-h3 text-fg-primary">Assign Dates to Columns</h4>
            <div className="divide-y divide-border-subtle border border-border-default rounded-xl overflow-hidden">
              {flatSessions.filter(s => !s.date).map(sess => (
                <div key={sess.id} className="p-4 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-body font-medium text-fg-primary">{sess.present_col}</p>
                    <p className="text-caption text-fg-tertiary">Sheet: {sess.sheetName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      className="input !py-1.5 min-w-[160px]"
                      value={dateResolutions[sess.id] || ''}
                      onChange={(e) => setDateResolutions({...dateResolutions, [sess.id]: e.target.value})}
                    >
                      <option value="" disabled>Select Date...</option>
                      {suggestedDates.map(d => (
                        <option key={d} value={d}>{formatDate(d)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleApplyDateResolutions} className="btn-primary w-full">Confirm Dates & Proceed</button>
        </div>
      )}

      {status === 'duplicate_resolution' && duplicateConflict && (
        <div className="card space-y-6 mt-8 border-danger-border">
          <div className="flex items-start gap-4 p-4 bg-danger-bg/10 rounded-xl border border-danger-border">
            <ServerCrash className="text-danger-fg shrink-0 mt-1" size={24}/>
            <div>
              <h3 className="text-h3 text-danger-fg mb-1">Cross-Sheet Duplication Detected</h3>
              <p className="text-body text-fg-secondary">
                Multiple spreadsheets claim to have attendance data for <strong className="text-fg-primary">{formatDate(duplicateConflict.date)}</strong>.
                Please select which sheet's column you want to import. The other will be skipped.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card !p-6 border border-border-default hover:border-accent-glow transition-colors cursor-pointer" onClick={() => handleResolveDuplicate(duplicateConflict.sessionA, duplicateConflict.sessionB)}>
              <p className="text-label text-fg-tertiary mb-2">SHEET 1</p>
              <h4 className="text-h3 text-fg-primary mb-1">{duplicateConflict.sessionA.sheetName}</h4>
              <p className="text-body text-fg-secondary mt-1">Column: <span className="font-mono text-accent-glow text-sm">{duplicateConflict.sessionA.present_col}</span></p>
              <p className="text-caption text-fg-tertiary mt-2">{duplicateConflict.sessionA.rows.length} rows</p>
              <div className="mt-4 text-accent-glow text-caption font-medium flex items-center gap-1">Keep this sheet <ArrowRight size={14}/></div>
            </div>
            
            <div className="card !p-6 border border-border-default hover:border-accent-glow transition-colors cursor-pointer" onClick={() => handleResolveDuplicate(duplicateConflict.sessionB, duplicateConflict.sessionA)}>
              <p className="text-label text-fg-tertiary mb-2">SHEET 2</p>
              <h4 className="text-h3 text-fg-primary mb-1">{duplicateConflict.sessionB.sheetName}</h4>
              <p className="text-body text-fg-secondary mt-1">Column: <span className="font-mono text-accent-glow text-sm">{duplicateConflict.sessionB.present_col}</span></p>
              <p className="text-caption text-fg-tertiary mt-2">{duplicateConflict.sessionB.rows.length} rows</p>
              <div className="mt-4 text-accent-glow text-caption font-medium flex items-center gap-1">Keep this sheet <ArrowRight size={14}/></div>
            </div>
          </div>
        </div>
      )}

      {status === 'preview' && (
        <div className="card space-y-8 mt-8">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-h2 text-fg-primary">Import Preview</h2>
              <p className="text-body text-fg-secondary mt-1">{flatSessions.length} sessions detected across spreadsheets</p>
            </div>
            <button onClick={reset} className="btn-secondary !px-4">Cancel</button>
          </div>

          <div className="space-y-4">
            {flatSessions.map((sess) => {
              const isGap = !dbSessions.some(s => s.date === sess.date);
              
              return (
                <div key={sess.id} className="p-4 bg-surface-inset border border-border-default rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-body-lg font-medium text-fg-primary flex items-center gap-2">
                      {formatDate(sess.date)}
                      {isGap && <span className="pill pill-warning text-[10px]">NEW DB SESSION</span>}
                    </h4>
                    <p className="text-caption text-fg-secondary mt-1">Sheet: <strong className="text-fg-primary">{sess.sheetName}</strong></p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-caption font-mono">Status: <span className="text-accent-glow">{sess.present_col}</span></p>
                    <p className="text-caption font-mono mt-0.5">USN: <span className="text-fg-tertiary">{sess.usn_col}</span></p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4">
            <button onClick={handleConfirmUpload} className="btn-primary w-full flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> Confirm & Import All
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
            <h2 className="text-h2 text-fg-primary mb-2">Bulk Import Successful</h2>
            <p className="text-body-lg text-fg-secondary">
              Processed <strong>{flatSessions.length}</strong> attendance sessions from {file?.name}.
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
