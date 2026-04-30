import { supabase } from '../lib/supabase';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function getTickerStats() {
  const { count: sessionCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true);
  const { data: lastSessionData } = await supabase.from('sessions').select('date').order('date', { ascending: false }).limit(1);
  const { count: presentCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('present', true);
  const { count: totalAttendance } = await supabase.from('attendance').select('*', { count: 'exact', head: true });

  const avg = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  return {
    sessions: sessionCount || 0,
    students: studentCount || 0,
    lastSession: lastSessionData?.[0]?.date || null,
    attendance: avg,
  };
}

export async function getTodaysSession() {
  const today = getTodayString();
  const { data } = await supabase.from('sessions').select('*').eq('date', today).single();
  return { session: data, todayString: today };
}

export async function getTodaysAttendance() {
  const today = getTodayString();
  const { data: session } = await supabase.from('sessions').select('id').eq('date', today).single();
  
  if (!session) {
    return { marked: false, requiresSession: true };
  }

  const { data: attendance } = await supabase.from('attendance')
    .select('present, students(id, name)')
    .eq('session_id', session.id);

  if (!attendance || attendance.length === 0) {
    return { marked: false, requiresSession: false };
  }

  const presentCount = attendance.filter(a => a.present).length;
  const totalCount = attendance.length;
  const absentStudents = attendance.filter(a => !a.present).map(a => a.students.name);
  
  return {
    marked: true,
    requiresSession: false,
    present: presentCount,
    total: totalCount,
    percentage: Math.round((presentCount / totalCount) * 100),
    absent: absentStudents
  };
}

export async function getProgramOverview() {
  const { data: allAttendance } = await supabase.from('attendance').select('present, students(name)');
  
  if (!allAttendance || allAttendance.length === 0) {
    return null;
  }

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

  return { avg, highest, lowest };
}

export async function getRecentActivity() {
  // 1. Get last 5 distinct session attendances marked
  const { data: attData } = await supabase.from('attendance')
    .select('marked_at, sessions(id, topic), marked_by')
    .order('marked_at', { ascending: false })
    .limit(20);
  
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
    iconType: 'attendance',
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
    iconType: 'import',
  }));

  const combined = [...mappedAtt, ...mappedImp]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  return combined;
}

export async function searchStudents(query) {
  if (!query || query.trim() === '') return [];
  const { data } = await supabase.from('students')
    .select('id, name, usn')
    .ilike('name', `%${query}%`)
    .eq('is_active', true)
    .limit(5);
  return data || [];
}
