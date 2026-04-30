import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, MapPin } from 'lucide-react';

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function StudentUpcoming() {
  const [nextSession, setNextSession] = useState(null);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      const today = getTodayString();

      // Next session (first one > today)
      const { data: nextData } = await supabase.from('sessions')
        .select('*')
        .gt('date', today)
        .order('date', { ascending: true })
        .limit(1);

      // Other upcoming (next 5)
      const { data: upcomingData } = await supabase.from('sessions')
        .select('*')
        .gt('date', today)
        .order('date', { ascending: true })
        .limit(6);

      // Last 3 past
      const { data: pastData } = await supabase.from('sessions')
        .select('*')
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(3);

      setNextSession(nextData?.[0] || null);
      
      // Filter out the 'next' session from the upcoming list
      const filteredUpcoming = (upcomingData || []).filter(s => s.id !== nextData?.[0]?.id).slice(0, 5);
      
      setUpcomingSessions(filteredUpcoming);
      setPastSessions(pastData || []);
      setLoading(false);
    }
    fetchSchedule();
  }, []);

  if (loading) return <div className="card h-64 animate-pulse"></div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-2">
        <h1 className="text-h1">Schedule</h1>
        <p className="text-body-lg text-fg-secondary">View your upcoming classes and past sessions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Next Session Hero */}
        <div className="lg:col-span-2">
          <p className="text-label text-fg-tertiary mb-4">NEXT CLASS</p>
          {nextSession ? (
            <div className="card !p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Calendar size={120} strokeWidth={1} />
              </div>
              <div className="relative z-10 space-y-6">
                <div>
                  <p className="text-accent-glow font-mono mb-2">{formatDate(nextSession.date)}</p>
                  <h2 className="text-display-md text-fg-primary">{nextSession.topic}</h2>
                </div>
                
                <div className="flex flex-wrap gap-6 pt-6 border-t border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-inset flex items-center justify-center text-fg-secondary">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-caption text-fg-tertiary">Duration</p>
                      <p className="text-body font-medium">{nextSession.duration_hours} Hours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-inset flex items-center justify-center text-fg-secondary">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-caption text-fg-tertiary">Mode</p>
                      <p className="text-body font-medium capitalize">{nextSession.session_type}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center flex flex-col items-center justify-center border-dashed">
              <Calendar size={48} className="text-border-strong mb-4" strokeWidth={1} />
              <h3 className="text-h3 text-fg-primary mb-2">No upcoming classes</h3>
              <p className="text-body text-fg-secondary">You're all caught up. Check back later for new schedules.</p>
            </div>
          )}
        </div>

        {/* Schedule Lists */}
        <div className="lg:col-span-1 space-y-8">
          
          <div>
            <p className="text-label text-fg-tertiary mb-4">LATER THIS MONTH</p>
            {upcomingSessions.length === 0 ? (
              <p className="text-body text-fg-secondary bg-surface-inset p-4 rounded-lg">No other upcoming sessions scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map(session => (
                  <div key={session.id} className="p-4 rounded-xl bg-surface border border-border-subtle hover:border-border-default transition-colors">
                    <p className="text-caption text-accent-glow font-mono mb-1">{formatDate(session.date)}</p>
                    <p className="text-body font-medium text-fg-primary">{session.topic}</p>
                    <p className="text-caption text-fg-tertiary mt-2 capitalize">{session.session_type} • {session.duration_hours}h</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-label text-fg-tertiary mb-4">RECENTLY COMPLETED</p>
            <div className="space-y-3 opacity-70 hover:opacity-100 transition-opacity">
              {pastSessions.map(session => (
                <div key={session.id} className="p-4 rounded-xl bg-surface-inset border border-border-default">
                  <p className="text-caption text-fg-tertiary font-mono mb-1">{formatDate(session.date)}</p>
                  <p className="text-body text-fg-secondary">{session.topic}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
