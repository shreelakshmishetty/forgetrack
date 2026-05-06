import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Check, AlertTriangle, ChevronLeft, ChevronRight, Save, UserCheck, UserX, Calendar as CalendarIcon, Clock, Video, Users } from 'lucide-react';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateObj = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Date and Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(getTodayString());
  const [monthSessions, setMonthSessions] = useState([]);
  
  // Data states
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { student_id: true/false }
  const [originalAttendance, setOriginalAttendance] = useState({});
  
  // UI states
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Mini-form state for new session
  const [newTopic, setNewTopic] = useState('');
  const [newDuration, setNewDuration] = useState('2.0');
  const [newType, setNewType] = useState('offline');

  // Load students once
  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase.from('students').select('*').eq('is_active', true).order('name');
      setStudents(data || []);
      setLoadingStudents(false);
    }
    fetchStudents();
  }, []);

  // Fetch month sessions for calendar dots
  useEffect(() => {
    async function fetchMonthSessions() {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const { data } = await supabase.from('sessions').select('date').gte('date', startStr).lte('date', endStr);
      setMonthSessions((data || []).map(s => s.date));
    }
    fetchMonthSessions();
  }, [currentMonth, session]); // Refetch when month changes or a new session is created

  // Fetch session & attendance for selected date
  useEffect(() => {
    async function fetchSessionAndAttendance() {
      if (!selectedDateStr) return;
      setLoadingSession(true);
      setSession(null);
      setAttendance({});
      setOriginalAttendance({});

      const { data: sessionData } = await supabase.from('sessions').select('*').eq('date', selectedDateStr).single();
      
      if (sessionData) {
        setSession(sessionData);
        const { data: attData } = await supabase.from('attendance').select('student_id, present').eq('session_id', sessionData.id);
        if (attData && attData.length > 0) {
          const map = {};
          attData.forEach(a => map[a.student_id] = a.present);
          setAttendance(map);
          setOriginalAttendance(map);
        }
      } else {
        setNewTopic(''); // Reset creation form
      }
      setLoadingSession(false);
    }
    fetchSessionAndAttendance();
  }, [selectedDateStr]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    const month = new Date(selectedDateStr).getMonth() + 1;
    const { data, error } = await supabase.from('sessions').insert({
      date: selectedDateStr,
      topic: newTopic,
      duration_hours: parseFloat(newDuration),
      session_type: newType,
      month_number: month
    }).select().single();

    if (!error && data) {
      setSession(data);
    } else {
      alert("Error creating session");
    }
    setSaving(false);
  };

  const markStudent = (id, present) => {
    setAttendance(prev => ({ ...prev, [id]: present }));
  };

  const markAll = (present) => {
    const map = {};
    students.forEach(s => map[s.id] = present);
    setAttendance(map);
  };

  const executeSave = async () => {
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
      // Update original attendance so button disables
      setOriginalAttendance({...attendance});
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
  const absentCount = students.length - presentCount; // Treats unmarked as absent for count

  // Calendar rendering helpers
  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  
  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 md:h-12"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = formatDateObj(dateObj);
      const isSelected = dateStr === selectedDateStr;
      const isToday = dateStr === getTodayString();
      const hasSession = monthSessions.includes(dateStr);
      
      days.push(
        <button
          key={d}
          onClick={() => setSelectedDateStr(dateStr)}
          className={`h-10 md:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all duration-200
            ${isSelected ? 'bg-fg-primary text-canvas shadow-md scale-105' : 'hover:bg-surface-raised text-fg-primary'}
            ${!isSelected && isToday ? 'border border-accent-glow' : ''}
          `}
        >
          <span className={`text-body font-medium ${isSelected ? 'text-canvas' : ''}`}>{d}</span>
          {hasSession && (
             <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-canvas' : 'bg-accent-glow shadow-[0_0_8px_rgba(99,102,241,0.6)]'}`}></span>
          )}
        </button>
      );
    }
    return days;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Attendance Dashboard</h1>
          <p className="text-body-lg text-fg-secondary">Manage sessions and track student attendance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT SIDE: Attendance Panel */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* Summary Card */}
          <div className="card !p-4 md:!p-6 flex flex-wrap items-center justify-between gap-4 border border-border-subtle shadow-sm bg-surface/50 backdrop-blur-sm">
            <div>
              <h2 className="text-h3 text-fg-primary">Student Attendance</h2>
              <p className="text-caption text-fg-tertiary">Mark attendance for selected session</p>
            </div>
            
            <div className="flex gap-4 sm:gap-8 bg-surface-inset p-3 rounded-xl border border-border-default">
              <div className="text-center px-2 border-r border-border-default">
                <p className="text-[11px] font-bold tracking-wider text-fg-tertiary uppercase mb-1">Total</p>
                <p className="text-h3 text-fg-primary font-mono leading-none">{students.length}</p>
              </div>
              <div className="text-center px-2 border-r border-border-default">
                <p className="text-[11px] font-bold tracking-wider text-success-fg uppercase mb-1">Present</p>
                <p className="text-h3 text-success-fg font-mono leading-none">{presentCount}</p>
              </div>
              <div className="text-center px-2">
                <p className="text-[11px] font-bold tracking-wider text-danger-fg uppercase mb-1">Absent</p>
                <p className="text-h3 text-danger-fg font-mono leading-none">{absentCount}</p>
              </div>
            </div>
          </div>

          {/* Roster & Controls */}
          {session ? (
            <div className="card !p-0 overflow-hidden flex-1 border border-border-subtle shadow-lg">
              
              {/* Quick Actions Header */}
              <div className="p-4 bg-surface-raised border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button onClick={() => markAll(true)} className="btn-secondary !py-2 !px-3 flex items-center gap-2 hover:border-success-border hover:bg-success-bg/10 transition-colors">
                    <UserCheck size={16} className="text-success-fg"/>
                    <span className="text-caption font-medium">Mark All Present</span>
                  </button>
                  <button onClick={() => markAll(false)} className="btn-secondary !py-2 !px-3 flex items-center gap-2 hover:border-danger-border hover:bg-danger-bg/10 transition-colors">
                    <UserX size={16} className="text-danger-fg"/>
                    <span className="text-caption font-medium">Mark All Absent</span>
                  </button>
                </div>
                
                <button 
                  onClick={executeSave} 
                  disabled={saving || !isDirty} 
                  className={`btn-primary !py-2 flex items-center gap-2 ${!isDirty ? 'opacity-50 cursor-not-allowed' : 'shadow-[0_0_15px_rgba(255,255,255,0.15)]'}`}
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving...' : Object.keys(originalAttendance).length > 0 ? 'Update Changes' : 'Save Attendance'}</span>
                </button>
              </div>

              {/* Roster List */}
              {loadingStudents ? (
                <div className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-accent-glow border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-fg-secondary">Loading students...</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto divide-y divide-border-subtle bg-surface">
                  {students.map(student => {
                    const isPresent = attendance[student.id];
                    return (
                      <div key={student.id} className="flex items-center justify-between p-4 hover:bg-surface-inset transition-colors group">
                        
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-surface-raised border border-border-default flex items-center justify-center font-medium text-fg-secondary group-hover:border-fg-tertiary transition-colors">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-body-lg font-medium text-fg-primary group-hover:text-white transition-colors">{student.name}</p>
                            <p className="text-caption font-mono text-fg-tertiary">{student.usn}</p>
                          </div>
                        </div>

                        {/* Fast Marking Toggles */}
                        <div className="flex bg-surface-raised p-1 rounded-lg border border-border-default">
                          <button
                            onClick={() => markStudent(student.id, true)}
                            className={`px-4 py-1.5 rounded-md text-caption font-medium transition-all duration-200 flex items-center gap-1.5
                              ${isPresent === true ? 'bg-success-fg text-canvas shadow-sm' : 'text-fg-secondary hover:text-success-fg hover:bg-success-bg/10'}
                            `}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => markStudent(student.id, false)}
                            className={`px-4 py-1.5 rounded-md text-caption font-medium transition-all duration-200 flex items-center gap-1.5
                              ${isPresent === false ? 'bg-danger-fg text-white shadow-sm' : 'text-fg-secondary hover:text-danger-fg hover:bg-danger-bg/10'}
                            `}
                          >
                            Absent
                          </button>
                        </div>
                        
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="card flex-1 flex flex-col items-center justify-center text-center p-12 border border-border-subtle border-dashed bg-surface-inset/50">
              <div className="w-16 h-16 rounded-full bg-surface-raised border border-border-default flex items-center justify-center mb-6">
                <CalendarIcon size={24} className="text-fg-tertiary" />
              </div>
              <h3 className="text-h3 text-fg-primary mb-2">No Session Selected</h3>
              <p className="text-body text-fg-secondary max-w-sm">
                Select a date from the calendar to mark attendance, or create a new session for the selected date.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Calendar & Session */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          
          {/* Aesthetic Calendar */}
          <div className="card !p-6 border border-border-subtle shadow-xl bg-surface/80 backdrop-blur-md">
            
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-h3 font-semibold tracking-tight">
                {monthNames[currentMonth.getMonth()]} <span className="text-fg-tertiary font-normal">{currentMonth.getFullYear()}</span>
              </h3>
              <div className="flex gap-1">
                <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-surface-raised text-fg-secondary transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-surface-raised text-fg-secondary transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-[11px] font-bold tracking-widest text-fg-tertiary uppercase py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {renderCalendarDays()}
            </div>
            
          </div>

          {/* Session Details / Creation */}
          <div className="card !p-6 border border-border-subtle shadow-md relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-glow/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            {loadingSession ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-24 bg-surface-raised rounded" />
                <div className="h-8 w-full bg-surface-raised rounded" />
                <div className="h-4 w-32 bg-surface-raised rounded" />
              </div>
            ) : session ? (
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="pill bg-surface-inset border-border-default text-fg-secondary tracking-widest">SESSION DETAILS</span>
                  {Object.keys(originalAttendance).length > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-warning-fg flex items-center gap-1 bg-warning-bg/20 px-2 py-0.5 rounded-full border border-warning-border">
                      <Check size={10}/> Logged
                    </span>
                  )}
                </div>
                
                <h3 className="text-2xl font-bold text-fg-primary mb-6 leading-tight">{session.topic}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-fg-secondary">
                    <div className="w-8 h-8 rounded-lg bg-surface-inset flex items-center justify-center border border-border-default">
                      {session.session_type === 'online' ? <Video size={16}/> : <Users size={16}/>}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-fg-tertiary">Mode</p>
                      <p className="text-body font-medium capitalize">{session.session_type}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-fg-secondary">
                    <div className="w-8 h-8 rounded-lg bg-surface-inset flex items-center justify-center border border-border-default">
                      <Clock size={16}/>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-fg-tertiary">Duration</p>
                      <p className="text-body font-medium">{session.duration_hours} Hours</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSession} className="space-y-5 relative z-10">
                <div className="mb-2">
                  <h3 className="text-h3 text-fg-primary">Create Session</h3>
                  <p className="text-caption text-fg-tertiary">No session found for selected date</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold tracking-wider text-fg-secondary uppercase mb-1.5">Topic</label>
                    <input 
                      type="text" 
                      className="input !bg-surface-inset" 
                      placeholder="e.g., 8-Layer AI Stack" 
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold tracking-wider text-fg-secondary uppercase mb-1.5">Mode</label>
                      <select className="input !bg-surface-inset" value={newType} onChange={(e) => setNewType(e.target.value)}>
                        <option value="offline">Offline</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-wider text-fg-secondary uppercase mb-1.5">Duration (hrs)</label>
                      <input 
                        type="number" 
                        step="0.5"
                        className="input !bg-surface-inset font-mono" 
                        placeholder="2.0" 
                        value={newDuration}
                        onChange={(e) => setNewDuration(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <button type="submit" disabled={saving} className="btn-primary w-full mt-2">
                  {saving ? 'Creating...' : 'Create Session'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
