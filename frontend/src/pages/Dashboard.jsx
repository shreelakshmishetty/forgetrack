import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Users, Activity, Clock, Plus, AlertCircle, FileUp, CheckCircle2 } from 'lucide-react';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function formatRelativeTime(dateString) {
  const diff = new Date() - new Date(dateString);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// 1. Ticker Strip
function TickerStrip() {
  const [stats, setStats] = useState({ sessions: 0, attendance: 0, students: 0, lastSession: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // 1. Total sessions
      const { count: sessionCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
      
      // 2. Active students
      const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true);
      
      // 3. Last session date
      const { data: lastSessionData } = await supabase.from('sessions').select('date').order('date', { ascending: false }).limit(1);
      
      // 4. Overall Attendance % (simplified aggregate for ticker)
      const { count: presentCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('present', true);
      const { count: totalAttendance } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
      
      const avg = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

      setStats({
        sessions: sessionCount || 0,
        students: studentCount || 0,
        lastSession: lastSessionData?.[0]?.date || null,
        attendance: avg,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) return (
    <div className="flex gap-4 overflow-x-auto pb-4 border-b border-border-subtle">
      <div className="h-6 w-32 bg-surface-raised rounded animate-pulse" />
      <div className="h-6 w-32 bg-surface-raised rounded animate-pulse" />
      <div className="h-6 w-32 bg-surface-raised rounded animate-pulse" />
    </div>
  );

  return (
    <div className="flex items-center gap-6 overflow-x-auto pb-4 border-b border-border-subtle whitespace-nowrap">
      <div className="flex items-center gap-3 pr-6 border-r border-border-subtle">
        <Calendar size={16} className="text-fg-secondary" />
        <div>
          <p className="text-caption text-fg-tertiary">Total Sessions</p>
          <p className="text-body-lg font-semibold tabular-nums text-fg-primary">{stats.sessions}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 pr-6 border-r border-border-subtle">
        <Activity size={16} className="text-fg-secondary" />
        <div>
          <p className="text-caption text-fg-tertiary">Overall Attendance</p>
          <p className="text-body-lg font-semibold tabular-nums text-fg-primary">{stats.attendance}%</p>
        </div>
      </div>
      <div className="flex items-center gap-3 pr-6 border-r border-border-subtle">
        <Users size={16} className="text-fg-secondary" />
        <div>
          <p className="text-caption text-fg-tertiary">Active Students</p>
          <p className="text-body-lg font-semibold tabular-nums text-fg-primary">{stats.students}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 pr-6">
        <Clock size={16} className="text-fg-secondary" />
        <div>
          <p className="text-caption text-fg-tertiary">Last Session</p>
          <p className="text-body-lg font-semibold tabular-nums text-fg-primary">{stats.lastSession || '—'}</p>
        </div>
      </div>
    </div>
  );
}

// 2. Card 1: Today's Session
function CardTodaysSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchToday() {
      const today = getTodayString();
      const { data } = await supabase.from('sessions').select('*').eq('date', today).single();
      setSession(data);
      setLoading(false);
    }
    fetchToday();
  }, []);

  if (loading) return (
    <div className="card h-full">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 bg-surface-raised rounded" />
        <div className="h-8 w-48 bg-surface-raised rounded" />
        <div className="h-4 w-32 bg-surface-raised rounded" />
      </div>
    </div>
  );

  return (
    <div className="card h-full flex flex-col justify-between p-10 !rounded-[24px]">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-label text-fg-tertiary">TODAY'S SESSION</p>
          {session && <span className="w-2 h-2 rounded-full bg-accent-glow animate-pulse" />}
        </div>
        {session ? (
          <>
            <h2 className="text-display-sm text-fg-primary mb-2">{session.topic}</h2>
            <p className="text-body-lg text-fg-secondary capitalize">{session.session_type} • {session.duration_hours}h</p>
          </>
        ) : (
          <>
            <h2 className="text-display-sm text-fg-primary mb-2">No session scheduled</h2>
            <p className="text-body-lg text-fg-secondary">There is no active session for {getTodayString()}</p>
          </>
        )}
      </div>
      <div className="mt-8">
        {!session && (
          <button onClick={() => navigate('/attendance')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Create Session
          </button>
        )}
      </div>
    </div>
  );
}

// 3. Card 2: Today's Attendance
function CardTodaysAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      const today = getTodayString();
      const { data: session } = await supabase.from('sessions').select('id').eq('date', today).single();
      
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: attendance } = await supabase.from('attendance')
        .select('present, students(id, name)')
        .eq('session_id', session.id);

      if (!attendance || attendance.length === 0) {
        setData({ marked: false });
      } else {
        const presentCount = attendance.filter(a => a.present).length;
        const totalCount = attendance.length;
        const absentStudents = attendance.filter(a => !a.present).map(a => a.students.name);
        
        setData({
          marked: true,
          present: presentCount,
          total: totalCount,
          percentage: Math.round((presentCount / totalCount) * 100),
          absent: absentStudents
        });
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return (
    <div className="card h-full">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 bg-surface-raised rounded" />
        <div className="h-8 w-48 bg-surface-raised rounded" />
        <div className="h-16 w-full bg-surface-raised rounded" />
      </div>
    </div>
  );

  return (
    <div className="card h-full flex flex-col justify-between p-10 !rounded-[24px]">
      <div>
        <p className="text-label text-fg-tertiary mb-4">TODAY'S ATTENDANCE</p>
        
        {!data ? (
          <>
            <h2 className="text-display-sm text-fg-primary mb-2">—</h2>
            <p className="text-body-lg text-fg-secondary">Requires a session</p>
          </>
        ) : !data.marked ? (
          <>
            <h2 className="text-display-sm text-fg-primary mb-2">Not yet marked</h2>
            <p className="text-body-lg text-fg-secondary">Attendance hasn't been recorded for today.</p>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-display-md tabular-nums">{data.percentage}%</span>
              <span className="text-body-lg text-fg-secondary">{data.present} / {data.total} Present</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-3 bg-surface-inset rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-accent-glow rounded-full transition-all" 
                style={{ width: `${data.percentage}%` }}
              />
            </div>

            {/* Absent List */}
            {data.absent.length > 0 && (
              <div className="space-y-2">
                <p className="text-caption text-fg-secondary uppercase tracking-wider">Absent Today</p>
                <div className="flex flex-wrap gap-2">
                  {data.absent.slice(0, 5).map((name, i) => (
                    <span key={i} className="px-2 py-1 bg-danger-bg text-danger-fg text-xs rounded-md border border-danger-border">
                      {name}
                    </span>
                  ))}
                  {data.absent.length > 5 && (
                    <span className="px-2 py-1 bg-surface-inset text-fg-secondary text-xs rounded-md">
                      +{data.absent.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {data.absent.length === 0 && data.total > 0 && (
              <span className="pill pill-success"><CheckCircle2 size={12}/> 100% Attendance</span>
            )}
          </>
        )}
      </div>
      
      <div className="mt-8">
        {(data && !data.marked) && (
          <button onClick={() => navigate('/attendance')} className="btn-primary w-full flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> Mark Attendance
          </button>
        )}
      </div>
    </div>
  );
}

// 4. Card 3: Program Overview
function CardProgramOverview() {
  // Aggregate queries — total sessions count, avg attendance %, highest and lowest attendance students.
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // Simplification for the demo: fetch all attendance to find highest/lowest
      const { data: allAttendance } = await supabase.from('attendance').select('present, students(name)');
      
      if (!allAttendance || allAttendance.length === 0) {
        setLoading(false);
        return;
      }

      // Group by student
      const studentMap = {};
      let totalPresent = 0;
      
      allAttendance.forEach(a => {
        const name = a.students?.name || 'Unknown';
        if (!studentMap[name]) studentMap[name] = { present: 0, total: 0 };
        studentMap[name].total += 1;
        if (a.present) {
          studentMap[name].present += 1;
          totalPresent += 1;
        }
      });

      let highest = { name: '-', pct: 0 };
      let lowest = { name: '-', pct: 100 };

      Object.entries(studentMap).forEach(([name, counts]) => {
        if (counts.total === 0) return;
        const pct = (counts.present / counts.total) * 100;
        if (pct >= highest.pct) highest = { name, pct };
        if (pct <= lowest.pct) lowest = { name, pct };
      });

      const avg = Math.round((totalPresent / allAttendance.length) * 100);

      setStats({ avg, highest, lowest });
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) return <div className="card animate-pulse h-[300px]" />;

  return (
    <div className="card h-full">
      <p className="text-label text-fg-tertiary mb-6">PROGRAM OVERVIEW</p>
      
      {stats ? (
        <div className="space-y-6">
          <div>
            <p className="text-caption text-fg-tertiary">Cohort Average</p>
            <p className="text-display-sm text-fg-primary tabular-nums">{stats.avg}%</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-inset rounded-lg border border-border-default">
              <p className="text-caption text-success-fg mb-1">Highest</p>
              <p className="text-body font-medium truncate" title={stats.highest.name}>{stats.highest.name}</p>
              <p className="text-h3 tabular-nums">{Math.round(stats.highest.pct)}%</p>
            </div>
            <div className="p-4 bg-surface-inset rounded-lg border border-border-default">
              <p className="text-caption text-danger-fg mb-1">Lowest</p>
              <p className="text-body font-medium truncate" title={stats.lowest.name}>{stats.lowest.name}</p>
              <p className="text-h3 tabular-nums">{Math.round(stats.lowest.pct)}%</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-body text-fg-secondary">Not enough data.</p>
      )}
    </div>
  );
}

// 5. Card 4: Recent Activity
function CardRecentActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      // 1. Get last 5 distinct session attendances marked
      const { data: attData } = await supabase.from('attendance')
        .select('marked_at, sessions(id, topic), marked_by')
        .order('marked_at', { ascending: false })
        .limit(20);
      
      // Dedupe by session
      const seenSessions = new Set();
      const mappedAtt = (attData || []).filter(a => {
        if (!a.sessions) return false;
        if (seenSessions.has(a.sessions.id)) return false;
        seenSessions.add(a.sessions.id);
        return true;
      }).map(a => ({
        type: 'attendance',
        desc: `Attendance marked for ${a.sessions.topic}`,
        by: a.marked_by,
        time: a.marked_at,
        icon: CheckCircle2,
        color: 'text-success-fg',
        bg: 'bg-success-bg'
      })).slice(0, 3);

      // 2. Get last 3 imports
      const { data: impData } = await supabase.from('import_log')
        .select('uploaded_at, filename, uploaded_by')
        .order('uploaded_at', { ascending: false })
        .limit(3);

      const mappedImp = (impData || []).map(i => ({
        type: 'import',
        desc: `CSV Imported: ${i.filename}`,
        by: i.uploaded_by,
        time: i.uploaded_at,
        icon: FileUp,
        color: 'text-info-fg',
        bg: 'bg-info-bg'
      }));

      // Combine and sort
      const combined = [...mappedAtt, ...mappedImp]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 5);

      setActivities(combined);
      setLoading(false);
    }
    fetchActivity();
  }, []);

  if (loading) return <div className="card animate-pulse h-[300px]" />;

  return (
    <div className="card h-full">
      <p className="text-label text-fg-tertiary mb-6">RECENT ACTIVITY</p>
      <div className="space-y-6">
        {activities.length === 0 ? (
          <p className="text-body text-fg-secondary">No recent activity.</p>
        ) : (
          activities.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.bg}`}>
                <item.icon size={16} className={item.color} />
              </div>
              <div>
                <p className="text-body font-medium text-fg-primary line-clamp-1" title={item.desc}>{item.desc}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-caption text-fg-tertiary">{item.by}</span>
                  <span className="text-fg-tertiary text-[10px]">•</span>
                  <span className="text-caption text-fg-tertiary">{formatRelativeTime(item.time)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="text-display-hero">Welcome Back, {user?.display_name?.split(' ')[0] || 'Mentor'}</h1>
        <p className="text-body-lg text-fg-secondary">Here's what's happening at The Forge.</p>
      </div>

      <TickerStrip />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardTodaysSession />
        <CardTodaysAttendance />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardProgramOverview />
        <CardRecentActivity />
      </div>
    </div>
  );
}
