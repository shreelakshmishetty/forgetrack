import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Users, Activity, Clock, CheckCircle2, FileUp, Video, CalendarDays, BarChart2, BookOpen } from 'lucide-react';
import { 
  getTickerStats, 
  getTodaysSession, 
  getTodaysAttendance, 
  getSessionProgressCounts,
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

// -------------------------------------------------------------
// TOP SECTION: TODAY'S OVERVIEW
// -------------------------------------------------------------

function TopOverviewSection() {
  const [sessionData, setSessionData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopData() {
      const [sData, aData, pData] = await Promise.all([
        getTodaysSession(),
        getTodaysAttendance(),
        getSessionProgressCounts()
      ]);
      setSessionData(sData);
      setAttendanceData(aData);
      setProgressData(pData);
      setLoading(false);
    }
    fetchTopData();
  }, []);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {[1, 2, 3, 4].map(i => <div key={i} className="card h-40 animate-pulse bg-surface-raised" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      
      {/* 1. Today's Session */}
      <div className="card !p-5 md:!p-6 flex flex-col justify-between border border-border-subtle shadow-md bg-surface/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-accent-glow" />
            <p className="text-[11px] font-bold tracking-wider text-fg-tertiary uppercase">Today's Session</p>
          </div>
          {sessionData.session ? (
            <>
              <h3 className="text-h3 text-fg-primary mb-1 line-clamp-1" title={sessionData.session.topic}>
                {sessionData.session.topic}
              </h3>
              <p className="text-caption text-fg-secondary capitalize">
                {sessionData.session.session_type} • {sessionData.session.duration_hours} Hours
              </p>
            </>
          ) : (
            <div className="py-2">
              <p className="text-body font-medium text-fg-primary">No session today</p>
              <p className="text-caption text-fg-secondary">Schedule is clear.</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Today's Attendance */}
      <div className="card !p-5 md:!p-6 flex flex-col justify-between border border-border-subtle shadow-md bg-surface/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-success-fg" />
            <p className="text-[11px] font-bold tracking-wider text-fg-tertiary uppercase">Today's Attendance</p>
          </div>
          {attendanceData.requiresSession ? (
            <p className="text-body font-medium text-fg-secondary py-2">No session</p>
          ) : !attendanceData.marked ? (
            <p className="text-body font-medium text-warning-fg py-2">Not marked yet</p>
          ) : (
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="text-h2 text-fg-primary tabular-nums leading-none">{attendanceData.percentage}%</h3>
              </div>
              <p className="text-caption text-fg-secondary">
                <span className="text-success-fg font-medium">{attendanceData.present} Present</span> • <span className="text-danger-fg font-medium">{attendanceData.total - attendanceData.present} Absent</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Completed Sessions */}
      <div className="card !p-5 md:!p-6 flex flex-col justify-between border border-border-subtle shadow-md bg-surface/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-info-fg" />
            <p className="text-[11px] font-bold tracking-wider text-fg-tertiary uppercase">Completed Classes</p>
          </div>
          <div className="py-1">
            <h3 className="text-display-sm text-fg-primary tabular-nums leading-none mb-1">{progressData.completed}</h3>
            <p className="text-caption text-fg-secondary">Classes taken so far</p>
          </div>
        </div>
      </div>

      {/* 4. Pending Sessions */}
      <div className="card !p-5 md:!p-6 flex flex-col justify-between border border-border-subtle shadow-md bg-surface/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-warning-fg" />
            <p className="text-[11px] font-bold tracking-wider text-fg-tertiary uppercase">Pending Sessions</p>
          </div>
          <div className="py-1">
            <h3 className="text-display-sm text-fg-primary tabular-nums leading-none mb-1">{progressData.upcoming}</h3>
            <p className="text-caption text-fg-secondary">Scheduled upcoming</p>
          </div>
        </div>
      </div>

    </div>
  );
}

// -------------------------------------------------------------
// MIDDLE SECTION: COMPACT ANALYTICS
// -------------------------------------------------------------

function CompactAnalyticsGrid() {
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-20 animate-pulse bg-surface-raised rounded-xl" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-surface-inset border border-border-default rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-wider mb-1">Total Sessions</p>
          <p className="text-h3 font-semibold tabular-nums text-fg-primary">{stats.sessions}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-fg-secondary">
          <Calendar size={14} />
        </div>
      </div>

      <div className="bg-surface-inset border border-border-default rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-wider mb-1">Overall Att %</p>
          <p className="text-h3 font-semibold tabular-nums text-fg-primary">{stats.attendance}%</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-fg-secondary">
          <Activity size={14} />
        </div>
      </div>

      <div className="bg-surface-inset border border-border-default rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-wider mb-1">Active Students</p>
          <p className="text-h3 font-semibold tabular-nums text-fg-primary">{stats.students}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-fg-secondary">
          <Users size={14} />
        </div>
      </div>

      <div className="bg-surface-inset border border-border-default rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-wider mb-1">Last Session</p>
          <p className="text-body font-semibold tabular-nums text-fg-primary">{stats.lastSession ? new Date(stats.lastSession).toLocaleDateString('en-GB', {day:'2-digit', month:'short'}) : '—'}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-fg-secondary">
          <Clock size={14} />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// BOTTOM SECTION: RECENT ACTIVITY
// -------------------------------------------------------------

function RecentActivityList() {
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

  if (loading) return <div className="card animate-pulse h-48 border border-border-subtle" />;

  return (
    <div className="card !p-0 overflow-hidden border border-border-subtle shadow-md">
      <div className="px-6 py-4 border-b border-border-subtle bg-surface-raised">
        <h3 className="text-h3 text-fg-primary">Recent Activity</h3>
      </div>
      
      <div className="divide-y divide-border-subtle">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-fg-secondary">No recent activity.</div>
        ) : (
          activities.map((item, i) => {
            const isAttendance = item.iconType === 'attendance';
            const Icon = isAttendance ? CheckCircle2 : FileUp;
            
            return (
              <div key={i} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-inset transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border 
                  ${isAttendance ? 'bg-success-bg/10 border-success-border text-success-fg' : 'bg-info-bg/10 border-info-border text-info-fg'}`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-body-lg font-medium text-fg-primary line-clamp-1" title={item.desc}>{item.desc}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-caption text-fg-tertiary">by {item.by}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-caption font-medium text-fg-secondary bg-surface-raised px-2.5 py-1 rounded-md border border-border-default">
                    {formatRelativeTime(item.time)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


// -------------------------------------------------------------
// MAIN DASHBOARD LAYOUT
// -------------------------------------------------------------

export default function Dashboard() {
  const { user } = useAuth();
  const mentorName = user?.display_name?.split(' ')[0] || 'Mentor';

  return (
    <div className="space-y-8 pb-12 w-full max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-fg-primary mb-1">Dashboard Overview</h1>
          <p className="text-body text-fg-secondary">Welcome back, {mentorName}. Here is your real-time summary.</p>
        </div>
      </div>

      {/* Top Section: Today's Overview */}
      <TopOverviewSection />

      {/* Middle Section: Compact Analytics */}
      <CompactAnalyticsGrid />

      {/* Bottom Section: Recent Activity */}
      <RecentActivityList />

    </div>
  );
}
