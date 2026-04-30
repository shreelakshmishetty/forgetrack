import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Check, Calendar as CalendarIcon, AlertTriangle, X } from 'lucide-react';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(getTodayString());
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { student_id: true/false }
  const [originalAttendance, setOriginalAttendance] = useState({}); // To check if updating
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Mini-form state for new session
  const [newTopic, setNewTopic] = useState('');
  const [newDuration, setNewDuration] = useState('2.0');
  const [newType, setNewType] = useState('offline');

  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase.from('students').select('*').eq('is_active', true).order('name');
      setStudents(data || []);
      setLoadingStudents(false);
    }
    fetchStudents();
  }, []);

  useEffect(() => {
    async function fetchSessionAndAttendance() {
      if (!date) return;
      setLoadingSession(true);
      setSession(null);
      setAttendance({});
      setOriginalAttendance({});

      // 1. Fetch Session
      const { data: sessionData } = await supabase.from('sessions').select('*').eq('date', date).single();
      
      if (sessionData) {
        setSession(sessionData);
        // 2. Fetch existing attendance
        const { data: attData } = await supabase.from('attendance').select('student_id, present').eq('session_id', sessionData.id);
        if (attData && attData.length > 0) {
          const map = {};
          attData.forEach(a => map[a.student_id] = a.present);
          setAttendance(map);
          setOriginalAttendance(map);
        }
      } else {
        // Preset topic suggestion
        setNewTopic('');
      }
      setLoadingSession(false);
    }
    fetchSessionAndAttendance();
  }, [date]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    const month = new Date(date).getMonth() + 1;
    const { data, error } = await supabase.from('sessions').insert({
      date,
      topic: newTopic,
      duration_hours: parseFloat(newDuration),
      session_type: newType,
      month_number: month
    }).select().single();

    if (!error && data) {
      setSession(data);
    }
    setSaving(false);
  };

  const toggleStudent = (id) => {
    setAttendance(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? true : !prev[id]
    }));
  };

  const markAll = (present) => {
    const map = {};
    students.forEach(s => map[s.id] = present);
    setAttendance(map);
  };

  const handleSaveInit = () => {
    // Check if we are overwriting existing attendance
    const isOverwriting = Object.keys(originalAttendance).length > 0;
    if (isOverwriting) {
      setShowConfirm(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setShowConfirm(false);
    setSaving(true);

    const rowsToInsert = students.map(s => ({
      student_id: s.id,
      session_id: session.id,
      present: attendance[s.id] || false,
      marked_by: user?.display_name || 'System'
    }));

    const { error } = await supabase.from('attendance').upsert(rowsToInsert, { onConflict: 'student_id,session_id' });
    
    setSaving(false);
    if (!error) {
      // Toast would go here
      navigate('/dashboard');
    } else {
      alert("Error saving attendance.");
    }
  };

  const isDirty = useMemo(() => {
    if (Object.keys(originalAttendance).length === 0 && Object.keys(attendance).length > 0) return true;
    for (const id of Object.keys(attendance)) {
      if (attendance[id] !== originalAttendance[id]) return true;
    }
    return false;
  }, [attendance, originalAttendance]);

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = students.length - presentCount; // Assuming anyone not explicitly true is false/absent

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Mark Attendance</h1>
          <p className="text-body-lg text-fg-secondary">Record attendance for a specific session.</p>
        </div>
      </div>

      <div className="card p-6 md:p-8 flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3 space-y-2">
          <label className="text-label text-fg-secondary">SESSION DATE</label>
          <input 
            type="date" 
            className="input w-full font-mono" 
            value={date}
            min="2025-08-04"
            max={getTodayString()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="md:w-2/3 border-l border-border-subtle pl-0 md:pl-8 pt-4 md:pt-0 border-t md:border-t-0">
          {loadingSession ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-24 bg-surface-raised rounded" />
              <div className="h-6 w-48 bg-surface-raised rounded" />
            </div>
          ) : session ? (
            <div>
              <p className="text-label text-fg-tertiary mb-2">SESSION DETAILS</p>
              <h3 className="text-h2 text-fg-primary mb-1">{session.topic}</h3>
              <p className="text-body text-fg-secondary capitalize">{session.session_type} • {session.duration_hours}h</p>
            </div>
          ) : (
            <form onSubmit={handleCreateSession} className="space-y-4">
              <p className="text-label text-accent-glow mb-2">CREATE SESSION</p>
              <div>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Session Topic (e.g., 8-Layer AI Stack)" 
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-4">
                <select className="input w-1/2 bg-surface" value={newType} onChange={(e) => setNewType(e.target.value)}>
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                </select>
                <input 
                  type="number" 
                  step="0.5"
                  className="input w-1/2" 
                  placeholder="Duration (hrs)" 
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Creating...' : 'Create Session'}
              </button>
            </form>
          )}
        </div>
      </div>

      {session && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-h3 text-fg-primary">Student Roster</h3>
            <div className="flex gap-3">
              <button onClick={() => markAll(true)} className="btn-secondary !text-caption !py-2">Select All Present</button>
              <button onClick={() => markAll(false)} className="btn-secondary !text-caption !py-2 !text-danger-fg">Select All Absent</button>
            </div>
          </div>
          
          {loadingStudents ? (
             <div className="p-8 text-center text-fg-secondary">Loading roster...</div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-[60vh] overflow-y-auto">
              {students.map(student => (
                <div 
                  key={student.id} 
                  className={`flex items-center p-4 hover:bg-surface-raised cursor-pointer transition-colors ${attendance[student.id] ? 'bg-success-bg/5' : ''}`}
                  onClick={() => toggleStudent(student.id)}
                >
                  <div className="flex-1 flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                      attendance[student.id] 
                        ? 'bg-success-fg border-success-fg text-canvas' 
                        : 'border-border-strong bg-surface-inset'
                    }`}>
                      {attendance[student.id] && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-body-lg font-medium text-fg-primary">{student.name}</p>
                      <p className="text-caption font-mono text-fg-tertiary">{student.usn}</p>
                    </div>
                  </div>
                  <div>
                    <span className="pill bg-surface-raised text-fg-secondary border border-border-default">{student.branch_code}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Bar */}
      {session && (
        <div className="fixed bottom-0 left-0 right-0 md:left-[260px] bg-surface/80 backdrop-blur-md border-t border-border-subtle p-4 px-6 md:px-12 flex items-center justify-between z-20">
          <div className="flex items-center gap-6">
            <div className="hidden sm:block">
              <p className="text-body font-medium text-fg-primary">{presentCount} Present</p>
              <p className="text-caption text-fg-tertiary">{absentCount} Absent</p>
            </div>
            {Object.keys(originalAttendance).length > 0 && (
              <span className="pill pill-warning bg-transparent border-warning-fg/50"><AlertTriangle size={12}/> Updating existing record</span>
            )}
          </div>
          <button 
            onClick={handleSaveInit} 
            disabled={saving || !isDirty} 
            className="btn-primary"
          >
            {saving ? 'Saving...' : Object.keys(originalAttendance).length > 0 ? 'Update Attendance' : 'Save Attendance'}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay z-50 flex items-center justify-center p-4">
          <div className="modal">
            <h2 className="text-h2 mb-4 text-fg-primary">Overwrite Attendance?</h2>
            <p className="text-body-lg text-fg-secondary mb-8">
              Attendance has already been recorded for this session. Are you sure you want to overwrite the existing records?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={executeSave} className="btn-primary !bg-danger-fg !text-white hover:!bg-danger-fg/80">Proceed & Overwrite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
