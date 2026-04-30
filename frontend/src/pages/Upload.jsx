import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { genAI } from '../lib/gemini';
import { useAuth } from '../contexts/AuthContext';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  
  const [file, setFile] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'parsing' | 'mapping' | 'preview' | 'uploading' | 'success'
  const [mapping, setMapping] = useState(null);
  const [mappedData, setMappedData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase.from('sessions').select('*').order('date', { ascending: false });
      setSessions(data || []);
      if (data && data.length > 0) setSelectedSessionId(data[0].id);
    }
    fetchSessions();
  }, []);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    setStatus('parsing');
    setError('');

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.data.length === 0) {
          setError("Invalid CSV format.");
          setStatus('idle');
          return;
        }
        
        setRawHeaders(results.meta.fields);
        setRawRows(results.data);
        determineMapping(results.meta.fields, results.data);
      },
      error: (err) => {
        setError("Error parsing CSV: " + err.message);
        setStatus('idle');
      }
    });
  };

  const determineMapping = async (headers, rows) => {
    setStatus('mapping');
    
    // Fast path check
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    let usnCol = null;
    let presentCol = null;

    headers.forEach((h, i) => {
      const norm = normalizedHeaders[i];
      if (norm === 'usn' || norm === 'roll no' || norm === 'roll number') usnCol = h;
      if (norm === 'present' || norm === 'attendance' || norm === 'attended' || norm === 'status') presentCol = h;
    });

    if (usnCol && presentCol) {
      // Fast path success
      applyMapping(rows, { usn_col: usnCol, present_col: presentCol });
      return;
    }

    // AI Path
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const sampleData = rows.slice(0, 3);
      
      const prompt = `
You are a data mapping assistant. I have a messy CSV file containing student attendance records.
Source Columns: ${JSON.stringify(headers)}
Sample Rows: ${JSON.stringify(sampleData)}

I need to map these source columns to two target concepts:
1. "usn_col": The column containing the student's unique university serial number (e.g. 4SH24CS001, roll number, identifier).
2. "present_col": The column indicating whether they attended (e.g. Present, P, Yes, Attended, Status).

Return ONLY a valid JSON object in this exact format, with no markdown, no backticks, and no extra text:
{"usn_col": "Exact Source Column Name", "present_col": "Exact Source Column Name"}
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiMapping = JSON.parse(jsonStr);

      if (!aiMapping.usn_col || !aiMapping.present_col || !headers.includes(aiMapping.usn_col) || !headers.includes(aiMapping.present_col)) {
        throw new Error("AI returned invalid mapping columns: " + jsonStr);
      }

      applyMapping(rows, aiMapping);

    } catch (err) {
      console.error("AI Mapping failed", err);
      setError("Could not automatically map columns. Please check your API Key or CSV format. Details: " + err.message);
      setStatus('idle');
    }
  };

  const applyMapping = (rows, mappingConf) => {
    setMapping(mappingConf);
    
    const transformed = rows.map(row => {
      const rawPresent = String(row[mappingConf.present_col]).toLowerCase().trim();
      const isPresent = ['p', 'present', 'true', '1', 'yes', 'y'].includes(rawPresent);
      return {
        usn: row[mappingConf.usn_col]?.trim(),
        present: isPresent
      };
    }).filter(r => r.usn);

    setMappedData(transformed);
    setStatus('preview');
  };

  const handleConfirm = async () => {
    setStatus('uploading');
    setError('');

    try {
      // 1. Create import log entry
      const { data: logEntry, error: logError } = await supabase.from('import_log').insert({
        filename: file.name,
        uploaded_by: user.display_name,
        total_rows: mappedData.length,
        imported_rows: 0,
        skipped_rows: 0,
        status: 'processing',
        column_mapping: JSON.stringify(mapping)
      }).select().single();

      if (logError) throw logError;

      // 2. Map USNs to Student IDs
      const { data: studentsData, error: stdError } = await supabase.from('students').select('id, usn');
      if (stdError) throw stdError;

      const usnToId = {};
      studentsData.forEach(s => usnToId[s.usn] = s.id);

      const rowsToInsert = [];
      let skippedCount = 0;

      mappedData.forEach(row => {
        const studentId = usnToId[row.usn];
        if (studentId) {
          rowsToInsert.push({
            student_id: studentId,
            session_id: selectedSessionId,
            present: row.present,
            marked_by: `CSV: ${logEntry.id}`,
            import_id: logEntry.id
          });
        } else {
          skippedCount++;
        }
      });

      // 3. Upsert into attendance
      if (rowsToInsert.length > 0) {
         const { error: upsertError } = await supabase.from('attendance')
           .upsert(rowsToInsert, { onConflict: 'student_id,session_id' });
         
         if (upsertError) throw upsertError;
      }

      // 4. Update import log
      await supabase.from('import_log')
        .update({
          imported_rows: rowsToInsert.length,
          skipped_rows: skippedCount,
          status: 'completed'
        })
        .eq('id', logEntry.id);

      setStatus('success');
      
    } catch (err) {
      console.error(err);
      setError("Upload failed: " + err.message);
      setStatus('preview');
    }
  };

  const reset = () => {
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setMapping(null);
    setMappedData([]);
    setStatus('idle');
    setError('');
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-2">
        <h1 className="text-h1 flex items-center gap-3">
          <UploadCloud className="text-accent-glow" size={32} />
          Upload CSV
        </h1>
        <p className="text-body-lg text-fg-secondary">Smart import using Gemini AI to automatically map messy attendance data.</p>
      </div>

      {error && (
        <div className="p-4 bg-danger-bg border border-danger-border rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-danger-fg shrink-0 mt-0.5" size={20} />
          <p className="text-body text-danger-fg break-all">{error}</p>
        </div>
      )}

      {status === 'success' ? (
        <div className="card text-center p-12 space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center text-success-fg">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h2 className="text-h2 text-fg-primary mb-2">Import Successful</h2>
            <p className="text-body-lg text-fg-secondary">
              Successfully processed <strong>{file?.name}</strong>.
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={reset} className="btn-secondary">Upload Another</button>
            <button onClick={() => navigate('/dashboard')} className="btn-primary">Return to Dashboard</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="card space-y-4">
              <label className="block text-label text-fg-secondary">TARGET SESSION</label>
              <select 
                className="input bg-surface w-full"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={status !== 'idle'}
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{formatDate(s.date)} — {s.topic}</option>
                ))}
              </select>
            </div>

            {status === 'idle' && (
              <div className="card p-8 border-2 border-dashed border-border-strong text-center hover:bg-surface-raised transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileSpreadsheet size={40} className="mx-auto text-fg-tertiary mb-4" strokeWidth={1} />
                <h3 className="text-body-lg font-medium text-fg-primary mb-1">Select a CSV File</h3>
                <p className="text-caption text-fg-tertiary">or click to browse</p>
              </div>
            )}

            {(status === 'parsing' || status === 'mapping' || status === 'uploading') && (
              <div className="card p-8 text-center space-y-4">
                <Loader2 size={32} className="mx-auto text-accent-glow animate-spin" />
                <p className="text-body font-medium text-fg-primary">
                  {status === 'parsing' && "Parsing CSV..."}
                  {status === 'mapping' && "AI Agent mapping columns..."}
                  {status === 'uploading' && "Saving to database..."}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {status === 'preview' && (
              <div className="card space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                  <div>
                    <h3 className="text-h3 text-fg-primary">Data Preview</h3>
                    <p className="text-caption text-fg-secondary mt-1">{mappedData.length} valid rows found</p>
                  </div>
                  <button onClick={reset} className="btn-secondary !py-1.5 !px-3 !text-caption">Cancel</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-inset border border-border-default rounded-lg">
                    <p className="text-caption text-fg-tertiary mb-1">Mapped USN Column</p>
                    <p className="text-body font-medium font-mono text-accent-glow">{mapping?.usn_col}</p>
                  </div>
                  <div className="p-4 bg-surface-inset border border-border-default rounded-lg">
                    <p className="text-caption text-fg-tertiary mb-1">Mapped Attendance Column</p>
                    <p className="text-body font-medium font-mono text-accent-glow">{mapping?.present_col}</p>
                  </div>
                </div>

                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <table className="table">
                    <thead className="bg-surface-inset">
                      <tr>
                        <th>USN</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedData.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          <td className="font-mono">{row.usn}</td>
                          <td>
                            {row.present ? 
                              <span className="pill pill-success">Present</span> : 
                              <span className="pill pill-danger">Absent</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mappedData.length > 5 && (
                    <div className="bg-surface text-center py-2 text-caption text-fg-tertiary border-t border-border-subtle">
                      + {mappedData.length - 5} more rows
                    </div>
                  )}
                </div>

                <button onClick={handleConfirm} className="btn-primary w-full flex items-center justify-center gap-2">
                  Confirm & Import <ArrowRight size={16} />
                </button>
              </div>
            )}

            {status === 'idle' && (
              <div className="card h-full flex flex-col items-center justify-center text-center p-12 opacity-50 border-dashed border-2">
                <p className="text-body-lg text-fg-secondary">Upload a CSV to preview AI mappings here.</p>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
