import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Check, AlertTriangle, ChevronLeft, ChevronRight, Save, UserCheck, UserX, Calendar as CalendarIcon, Clock, Video, Users, Search, Filter, Download, FileText, UserPlus, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import AttendanceCharts from '../components/Charts/AttendanceCharts';
import SaveConfirmationModal from '../components/Attendance/SaveConfirmationModal';

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
  const [showSuccess, setShowSuccess] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, present, absent
  const [branchFilter, setBranchFilter] = useState('all');
  
  // Analytics States
  const [todayClasses, setTodayClasses] = useState(0);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState([]);
  const [subjectAnalytics, setSubjectAnalytics] = useState([]);

  // Mini-form state for new session
  const [newTopic, setNewTopic] = useState('');
  const [newDuration, setNewDuration] = useState('2.0');
  const [newType, setNewType] = useState('offline');

  // Load dashboard stats & analytics
  useEffect(() => {
    async function fetchDashboardStats() {
      const today = getTodayString();
      
      // Fetch today's classes
      const { count: classesToday } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);
      setTodayClasses(classesToday || 0);

      // Fetch weekly analytics (last 7 sessions)
      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('id, date, topic')
        .order('date', { ascending: false })
        .limit(7);

      if (recentSessions) {
        const analytics = await Promise.all(recentSessions.reverse().map(async (s) => {
          const { data: att } = await supabase.from('attendance').select('present').eq('session_id', s.id);
          const total = att?.length || 1; // avoid div by zero
          const present = att?.filter(a => a.present).length || 0;
          return {
            date: s.date.split('-').slice(1).join('/'),
            percentage: Math.round((present / total) * 100)
          };
        }));
        setWeeklyAnalytics(analytics);
      }

      // Fetch subject-wise analytics
      const { data: subjects } = await supabase.rpc('get_subject_attendance'); // Hypothetical or manual calculation
      // For now, let's calculate manually from recent sessions
      if (recentSessions) {
        const subjMap = {};
        for (const s of recentSessions) {
          const { data: att } = await supabase.from('attendance').select('present').eq('session_id', s.id);
          if (!subjMap[s.topic]) subjMap[s.topic] = { total: 0, present: 0 };
          subjMap[s.topic].total += att?.length || 0;
          subjMap[s.topic].present += att?.filter(a => a.present).length || 0;
        }
        const subjAnalytics = Object.entries(subjMap).map(([topic, stats]) => ({
          subject: topic.length > 10 ? topic.substring(0, 10) + '...' : topic,
          percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
        }));
        setSubjectAnalytics(subjAnalytics);
      }
    }
    fetchDashboardStats();
  }, [session]);

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
      present: (attendance[s.id] === true || attendance[s.id] === 'late'),
      marked_by: user?.display_name || 'System'
    }));

    const { error } = await supabase.from('attendance').upsert(rowsToInsert, { onConflict: 'student_id,session_id' });
    setSaving(false);
    
    if (!error) {
      setOriginalAttendance({...attendance});
      setShowSuccess(true);
    } else {
      alert("Error saving attendance.");
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.usn.toLowerCase().includes(searchQuery.toLowerCase());
      const isPresent = attendance[s.id];
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'present' && (isPresent === true || isPresent === 'late')) ||
                           (statusFilter === 'absent' && isPresent === false);
      const matchesBranch = branchFilter === 'all' || s.branch_code === branchFilter;
      
      return matchesSearch && matchesStatus && matchesBranch;
    });
  }, [students, searchQuery, statusFilter, branchFilter, attendance]);

  const branches = useMemo(() => {
    return Array.from(new Set(students.map(s => s.branch_code)));
  }, [students]);

  const presentCount = Object.values(attendance).filter(v => v === true || v === 'late').length;
  const absentCount = students.length - presentCount; // Treats unmarked as absent for count

  const attendancePercentage = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;
  
  const pieData = [
    { name: 'Present', value: presentCount },
    { name: 'Absent', value: absentCount },
  ];

  const isDirty = useMemo(() => {
    if (Object.keys(originalAttendance).length === 0 && Object.keys(attendance).length > 0) return true;
    for (const id of Object.keys(attendance)) {
      if (attendance[id] !== originalAttendance[id]) return true;
    }
    return false;
  }, [attendance, originalAttendance]);

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
          <h1 className="text-h1 flex items-center gap-3">
            <TrendingUp className="text-accent-glow" />
            Attendance Dashboard
          </h1>
          <p className="text-body-lg text-fg-secondary">Manage sessions, track analytics, and student rosters.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary !py-2 flex items-center gap-2">
            <Download size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button className="btn-primary !py-2 flex items-center gap-2">
            <UserPlus size={16} />
            <span className="hidden sm:inline">Add Student</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Students', value: students.length, icon: Users, color: 'text-accent-glow' },
          { label: 'Present Today', value: presentCount, icon: UserCheck, color: 'text-success-fg' },
          { label: 'Absent Today', value: absentCount, icon: UserX, color: 'text-danger-fg' },
          { label: 'Attendance %', value: `${attendancePercentage}%`, icon: PieChartIcon, color: 'text-warning-fg' },
          { label: "Today's Classes", value: todayClasses, icon: CalendarIcon, color: 'text-info-fg' }
        ].map((stat, i) => (
          <div key={i} className="card !p-4 border border-border-subtle bg-surface/50 backdrop-blur-md shadow-sm hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={18} className={stat.color} />
              <span className="text-[10px] font-bold text-fg-tertiary uppercase tracking-wider">Live</span>
            </div>
            <p className="text-h2 font-mono leading-none mb-1">{stat.value}</p>
            <p className="text-[11px] font-medium text-fg-secondary uppercase tracking-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT SIDE: Attendance Panel */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* Analytics Section */}
          <AttendanceCharts 
            weeklyData={weeklyAnalytics} 
            monthlyData={subjectAnalytics} 
            statusData={pieData} 
          />

          {/* Roster & Controls */}
          {session ? (
            <div className="card !p-0 overflow-hidden flex-1 border border-border-subtle shadow-xl flex flex-col">
              
              {/* Search & Filters */}
              <div className="p-4 bg-surface-raised border-b border-border-subtle grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
                  <input 
                    type="text" 
                    placeholder="Search Name or USN..." 
                    className="input !pl-10 !py-2 text-sm bg-surface-inset"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                  <div className="relative">
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
                    <select 
                      className="input !pl-9 !py-2 text-sm bg-surface-inset"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="present">Present Only</option>
                      <option value="absent">Absent Only</option>
                    </select>
                  </div>
                </div>
                <div className="md:col-span-4">
                  <select 
                    className="input !py-2 text-sm bg-surface-inset"
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                  >
                    <option value="all">All Sections</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Quick Actions Header */}
              <div className="p-4 bg-surface-inset border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                  className={`btn-primary !py-2 flex items-center gap-2 ${!isDirty ? 'opacity-50 cursor-not-allowed' : 'shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-105 transition-all'}`}
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
                  {filteredStudents.length > 0 ? filteredStudents.map(student => {
                    const isPresent = attendance[student.id];
                    const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2);
                    return (
                      <div key={student.id} className="flex items-center justify-between p-4 hover:bg-surface-raised transition-colors group relative">
                        {/* Status Left Indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${isPresent === true ? 'bg-success-fg' : isPresent === 'late' ? 'bg-warning-fg' : isPresent === false ? 'bg-danger-fg' : 'bg-transparent'}`} />
                        
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all duration-300 shadow-sm
                            ${isPresent === true ? 'bg-success-bg/20 text-success-fg border border-success-border/50' : 
                              isPresent === 'late' ? 'bg-warning-bg/20 text-warning-fg border border-warning-border/50' :
                              isPresent === false ? 'bg-danger-bg/20 text-danger-fg border border-danger-border/50' : 
                              'bg-surface-inset text-fg-tertiary border border-border-default'}`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-body-lg font-bold text-fg-primary group-hover:text-white transition-colors">{student.name}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-inset border border-border-default text-fg-tertiary font-mono">
                                {student.branch_code}
                              </span>
                            </div>
                            <p className="text-caption font-mono text-fg-tertiary tracking-tight uppercase">{student.usn}</p>
                          </div>
                        </div>

                        {/* Fast Marking Toggles */}
                        <div className="flex bg-surface-inset p-1 rounded-xl border border-border-default shadow-inner">
                          <button
                            onClick={() => markStudent(student.id, true)}
                            className={`px-4 py-2 rounded-lg text-caption font-bold transition-all duration-300 flex items-center gap-1.5
                              ${isPresent === true ? 'bg-success-fg text-canvas shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105' : 'text-fg-secondary hover:text-success-fg'}`}
                          >
                            {isPresent === true && <Check size={14} />}
                            Present
                          </button>
                          <button
                            onClick={() => markStudent(student.id, 'late')}
                            className={`px-4 py-2 rounded-lg text-caption font-bold transition-all duration-300 flex items-center gap-1.5
                              ${isPresent === 'late' ? 'bg-warning-fg text-canvas shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105' : 'text-fg-secondary hover:text-warning-fg'}`}
                          >
                            Late
                          </button>
                          <button
                            onClick={() => markStudent(student.id, false)}
                            className={`px-4 py-2 rounded-lg text-caption font-bold transition-all duration-300 flex items-center gap-1.5
                              ${isPresent === false ? 'bg-danger-fg text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] scale-105' : 'text-fg-secondary hover:text-danger-fg'}`}
                          >
                            {isPresent === false && <X size={14} />}
                            Absent
                          </button>
                        </div>
                        
                      </div>
                    );
                  }) : (
                    <div className="p-12 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-surface-inset rounded-full flex items-center justify-center mb-4 text-fg-tertiary">
                        <Search size={32} />
                      </div>
                      <p className="text-fg-secondary">No students found matching your filters.</p>
                      <button onClick={() => {setSearchQuery(''); setStatusFilter('all'); setBranchFilter('all');}} className="text-accent-glow text-sm mt-2 hover:underline">Clear all filters</button>
                    </div>
                  )}
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
      
      {/* Popups */}
      <SaveConfirmationModal show={showSuccess} onClose={() => setShowSuccess(false)} />
    </div>
  );
}
