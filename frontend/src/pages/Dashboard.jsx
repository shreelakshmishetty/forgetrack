import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Users, Activity, Clock, Plus, CheckCircle2, FileUp } from 'lucide-react';
import { 
  getTickerStats, 
  getTodaysSession, 
  getTodaysAttendance, 
  getProgramOverview, 
  getRecentActivity 
} from '../services/dashboardService';

function formatRelativeTime(dateString) {
  const diff = new Date() - new Date(dateString);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// 1. Top Stats Cards (formerly TickerStrip)
function TopStatsGrid() {
  const [stats, setStats] = useState({ sessions: 0, attendance: 0, students: 0, lastSession: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const data = await getTickerStats();
      setStats(data);
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card h-28 animate-pulse bg-surface-raised border-border-subtle" />
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="card !p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fg-tertiary">
          <Calendar size={18} />
          <p className="text-label">TOTAL SESSIONS</p>
        </div>
        <p className="text-display-md font-semibold tabular-nums text-fg-primary">{stats.sessions}</p>
      </div>

      <div className="card !p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fg-tertiary">
          <Activity size={18} />
          <p className="text-label">OVERALL ATTENDANCE</p>
        </div>
        <p className="text-display-md font-semibold tabular-nums text-fg-primary">{stats.attendance}%</p>
      </div>

      <div className="card !p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fg-tertiary">
          <Users size={18} />
          <p className="text-label">ACTIVE STUDENTS</p>
        </div>
        <p className="text-display-md font-semibold tabular-nums text-fg-primary">{stats.students}</p>
      </div>

      <div className="card !p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fg-tertiary">
          <Clock size={18} />
          <p className="text-label">LAST SESSION</p>
        </div>
        <p className="text-h2 font-semibold tabular-nums text-fg-primary pt-2">{stats.lastSession || '—'}</p>
      </div>
    </div>
  );
}

// 2. Card: Today's Session
function CardTodaysSession() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchToday() {
      const result = await getTodaysSession();
      setData(result);
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

  const { session, todayString } = data;

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
            <p className="text-body-lg text-fg-secondary">There is no active session for {todayString}</p>
          </>
        )}
      </div>
      <div className="mt-8">
        {!session && (
          <button onClick={() => navigate('/attendance')} className="btn-primary flex items-center justify-center gap-2 w-max">
            <Plus size={16} /> Create Session
          </button>
        )}
      </div>
    </div>
  );
}

// 3. Card: Today's Attendance
function CardTodaysAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      const result = await getTodaysAttendance();
      setData(result);
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
        
        {data.requiresSession ? (
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
        {(!data.requiresSession && !data.marked) && (
          <button onClick={() => navigate('/attendance')} className="btn-primary w-full flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> Mark Attendance
          </button>
        )}
      </div>
    </div>
  );
}

// 4. Card: Program Overview
function CardProgramOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const result = await getProgramOverview();
      setStats(result);
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

// 5. Card: Recent Activity
function CardRecentActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      const result = await getRecentActivity();
      setActivities(result);
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
          activities.map((item, i) => {
            const Icon = item.iconType === 'attendance' ? CheckCircle2 : FileUp;
            const colorClass = item.iconType === 'attendance' ? 'text-success-fg' : 'text-info-fg';
            const bgClass = item.iconType === 'attendance' ? 'bg-success-bg' : 'bg-info-bg';
            
            return (
              <div key={i} className="flex gap-4">
                <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${bgClass}`}>
                  <Icon size={16} className={colorClass} />
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
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-12 pb-12 w-full max-w-[1200px]">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="text-display-lg">Welcome Back, {user?.display_name?.split(' ')[0] || 'Mentor'}</h1>
        <p className="text-body-lg text-fg-secondary">Here's what's happening at The Forge.</p>
      </div>

      {/* Main Grid Top: Hero Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardTodaysSession />
        <CardTodaysAttendance />
      </div>

      {/* 4-up Stats Grid */}
      <TopStatsGrid />

      {/* Overview & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardProgramOverview />
        <CardRecentActivity />
      </div>
    </div>
  );
}
