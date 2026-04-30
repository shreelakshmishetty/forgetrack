import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ChevronDown, Calendar } from 'lucide-react';

const getAttendanceColor = (pct) => {
  if (pct >= 75) return 'text-success-fg';
  if (pct >= 60) return 'text-warning-fg';
  return 'text-danger-fg';
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function History() {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all active students for dropdown
  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase.from('students').select('id, name, usn').eq('is_active', true).order('name');
      setStudents(data || []);
    }
    fetchStudents();
  }, []);

  // Fetch student data when selected
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentData(null);
      setAttendanceRecords([]);
      return;
    }

    async function fetchHistory() {
      setLoading(true);
      
      // 1. Student profile
      const { data: student } = await supabase.from('students').select('*').eq('id', selectedStudentId).single();
      
      // 2. All sessions
      const { data: allSessions } = await supabase.from('sessions').select('*').order('date', { ascending: true });
      
      // 3. Student's attendance
      const { data: attendance } = await supabase.from('attendance').select('*').eq('student_id', selectedStudentId);
      
      setStudentData(student);
      setSessions(allSessions || []);
      setAttendanceRecords(attendance || []);
      setLoading(false);
    }
    fetchHistory();
  }, [selectedStudentId]);

  // Compute Stats
  const stats = useMemo(() => {
    if (!sessions.length) return null;
    
    // Total sessions active
    const activeSessions = sessions; // In a real app, filter sessions after student's admission date
    const attendanceMap = {};
    attendanceRecords.forEach(a => attendanceMap[a.session_id] = a.present);

    let present = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    activeSessions.forEach(s => {
      const isPresent = attendanceMap[s.id];
      if (isPresent) {
        present++;
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        currentStreak = tempStreak; // Because they are sorted by date
      } else if (isPresent === false) {
        tempStreak = 0;
        currentStreak = 0;
      }
    });

    const pct = activeSessions.length > 0 ? Math.round((present / activeSessions.length) * 100) : 0;

    return { total: activeSessions.length, present, pct, currentStreak, longestStreak, attendanceMap };
  }, [sessions, attendanceRecords]);

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-2">
        <h1 className="text-h1">Student History</h1>
        <p className="text-body-lg text-fg-secondary">View detailed attendance records for individual students.</p>
      </div>

      {/* Student Selector */}
      <div className="card p-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <select 
            className="input !pl-9 appearance-none"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="">Search and select a student...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.usn})</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-tertiary pointer-events-none" />
        </div>
      </div>

      {loading && <div className="card animate-pulse h-64" />}

      {studentData && stats && !loading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Card */}
            <div className="card lg:col-span-1 space-y-6">
              <div>
                <h2 className="text-display-sm text-fg-primary">{studentData.name}</h2>
                <div className="flex gap-2 mt-2">
                  <span className="pill bg-surface-raised text-fg-secondary border border-border-default font-mono">{studentData.usn}</span>
                  <span className="pill bg-surface-raised text-fg-secondary border border-border-default">{studentData.branch_code}</span>
                </div>
              </div>
              
              <div className="pt-6 border-t border-border-subtle text-center">
                <p className="text-caption text-fg-tertiary mb-2">OVERALL ATTENDANCE</p>
                <p className={`text-display-md tabular-nums ${getAttendanceColor(stats.pct)}`}>
                  {stats.pct}%
                </p>
                <p className="text-body text-fg-secondary mt-1">{stats.present} out of {stats.total} sessions</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border-subtle">
                <div className="text-center bg-surface-inset py-3 rounded-lg border border-border-default">
                  <p className="text-caption text-fg-tertiary mb-1">Current Streak</p>
                  <p className="text-h2 tabular-nums text-fg-primary">{stats.currentStreak} <span className="text-body text-fg-tertiary">days</span></p>
                </div>
                <div className="text-center bg-surface-inset py-3 rounded-lg border border-border-default">
                  <p className="text-caption text-fg-tertiary mb-1">Longest Streak</p>
                  <p className="text-h2 tabular-nums text-fg-primary">{stats.longestStreak} <span className="text-body text-fg-tertiary">days</span></p>
                </div>
              </div>
            </div>

            {/* Heatmap Card */}
            <div className="card lg:col-span-2">
              <p className="text-label text-fg-tertiary mb-6">ATTENDANCE HEATMAP</p>
              
              <div className="flex flex-wrap gap-2">
                {sessions.map(session => {
                  const status = stats.attendanceMap[session.id];
                  let bgClass = "bg-surface-inset";
                  let borderClass = "";
                  
                  if (status === true) {
                    bgClass = "bg-success-bg";
                    borderClass = "border border-success-border";
                  } else if (status === false) {
                    bgClass = "bg-danger-bg";
                    borderClass = "border border-danger-border";
                  }

                  return (
                    <div 
                      key={session.id} 
                      className={`w-8 h-8 rounded-md ${bgClass} ${borderClass} flex items-center justify-center`}
                      title={`${formatDate(session.date)}: ${session.topic} (${status === true ? 'Present' : status === false ? 'Absent' : 'No Record'})`}
                    >
                    </div>
                  );
                })}
              </div>
              
              <div className="flex gap-4 mt-8 pt-6 border-t border-border-subtle">
                <div className="flex items-center gap-2 text-caption text-fg-secondary">
                  <div className="w-3 h-3 rounded-sm bg-success-bg border border-success-border"></div> Present
                </div>
                <div className="flex items-center gap-2 text-caption text-fg-secondary">
                  <div className="w-3 h-3 rounded-sm bg-danger-bg border border-danger-border"></div> Absent
                </div>
                <div className="flex items-center gap-2 text-caption text-fg-secondary">
                  <div className="w-3 h-3 rounded-sm bg-surface-inset"></div> No Record
                </div>
              </div>
            </div>
          </div>

          {/* Session Table */}
          <div className="card !p-0 overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Topic</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => {
                  const status = stats.attendanceMap[session.id];
                  return (
                    <tr key={session.id}>
                      <td className="font-mono text-fg-tertiary">{formatDate(session.date)}</td>
                      <td className="font-medium text-fg-primary">{session.topic}</td>
                      <td>
                        {status === true ? (
                          <span className="pill pill-success">Present</span>
                        ) : status === false ? (
                          <span className="pill pill-danger">Absent</span>
                        ) : (
                          <span className="text-body text-fg-tertiary">—</span>
                        )}
                      </td>
                      <td className="text-fg-tertiary">{session.duration_hours}h</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!studentData && !loading && selectedStudentId === '' && (
        <div className="card h-64 flex flex-col items-center justify-center text-center">
          <Calendar size={48} className="text-border-strong mb-4" strokeWidth={1} />
          <h2 className="text-h2 text-fg-primary mb-2">No student selected</h2>
          <p className="text-body-lg text-fg-secondary">Search and select a student above to view their attendance history.</p>
        </div>
      )}
    </div>
  );
}
