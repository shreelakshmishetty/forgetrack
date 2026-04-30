import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, XCircle } from 'lucide-react';

const getAttendanceColor = (pct) => {
  if (pct >= 75) return 'text-success-fg';
  if (pct >= 60) return 'text-warning-fg';
  return 'text-danger-fg';
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function StudentAttendance() {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user?.student_id) return;
      
      // 1. Student profile
      const { data: student } = await supabase.from('students').select('*').eq('id', user.student_id).single();
      
      // 2. All sessions
      const { data: allSessions } = await supabase.from('sessions').select('*').order('date', { ascending: true });
      
      // 3. My attendance (RLS will also enforce this)
      const { data: attendance } = await supabase.from('attendance').select('*').eq('student_id', user.student_id);
      
      setStudentData(student);
      setSessions(allSessions || []);
      setAttendanceRecords(attendance || []);
      setLoading(false);
    }
    fetchData();
  }, [user]);

  const stats = useMemo(() => {
    if (!sessions.length) return { total: 0, present: 0, pct: 0, attendanceMap: {} };
    
    const attendanceMap = {};
    attendanceRecords.forEach(a => attendanceMap[a.session_id] = a.present);

    let present = 0;
    sessions.forEach(s => {
      if (attendanceMap[s.id]) present++;
    });

    const pct = sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 0;

    return { total: sessions.length, present, pct, attendanceMap };
  }, [sessions, attendanceRecords]);

  if (loading) {
    return <div className="animate-pulse space-y-8 pb-12">
      <div className="h-24 bg-surface-raised rounded-2xl w-full max-w-lg" />
      <div className="h-64 bg-surface-raised rounded-2xl w-full" />
    </div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-2">
        <h1 className="text-display-lg text-fg-primary">{studentData?.name || user?.display_name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-body-sm text-fg-tertiary font-mono">
          <span>{studentData?.usn}</span>
          <span>•</span>
          <span>{studentData?.branch_code}</span>
          <span>•</span>
          <span>{studentData?.batch}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Giant Attendance % Card */}
        <div className="card lg:col-span-1 flex flex-col items-center justify-center text-center p-12">
          <p className="text-label text-fg-tertiary mb-4">YOUR ATTENDANCE</p>
          <p className={`text-display-hero tabular-nums ${getAttendanceColor(stats.pct)}`}>
            {stats.pct}%
          </p>
          <p className="text-body-lg text-fg-secondary mt-4">
            {stats.present} of {stats.total} sessions attended
          </p>
        </div>

        {/* Heatmap Calendar */}
        <div className="card lg:col-span-2">
          <p className="text-label text-fg-tertiary mb-6">ATTENDANCE CALENDAR</p>
          
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
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-md ${bgClass} ${borderClass} flex items-center justify-center`}
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
          <thead className="bg-surface-inset border-b border-border-subtle">
            <tr>
              <th>Date</th>
              <th>Topic</th>
              <th>Status</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sessions.slice().reverse().map(session => {
              const status = stats.attendanceMap[session.id];
              return (
                <tr key={session.id} className="hover:bg-surface-raised transition-colors">
                  <td className="font-mono text-fg-tertiary">{formatDate(session.date)}</td>
                  <td className="font-medium text-fg-primary">{session.topic}</td>
                  <td>
                    {status === true ? (
                      <span className="pill pill-success"><CheckCircle2 size={12} /> Present</span>
                    ) : status === false ? (
                      <span className="pill pill-danger"><XCircle size={12} /> Absent</span>
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
    </div>
  );
}
