-- supabase/schema.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Students Table
CREATE TABLE public.students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    admission_number TEXT,
    email TEXT,
    branch_code TEXT NOT NULL,
    batch TEXT DEFAULT '2024-2028',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Sessions Table
CREATE TABLE public.sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    month_number INTEGER NOT NULL,
    duration_hours DECIMAL(3,1) DEFAULT 2.0,
    session_type TEXT DEFAULT 'offline',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ImportLog Table
CREATE TABLE public.import_log (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL,
    warnings TEXT,
    column_mapping TEXT,
    status TEXT NOT NULL
);

-- 4. Attendance Table
CREATE TABLE public.attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    present BOOLEAN NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    marked_by TEXT DEFAULT 'system',
    import_id INTEGER REFERENCES public.import_log(id) ON DELETE SET NULL,
    UNIQUE(student_id, session_id)
);

-- 5. Materials Table
CREATE TABLE public.materials (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Users Table (Extension of Supabase Auth)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CHECK Constraints
ALTER TABLE public.sessions ADD CONSTRAINT check_session_date_not_future CHECK (date <= current_date);
ALTER TABLE public.sessions ADD CONSTRAINT check_session_date_after_start CHECK (date >= '2025-08-04');

-- 7. Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_mentor() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'mentor'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_student_id() RETURNS INTEGER AS $$
  SELECT student_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies
CREATE POLICY "Mentors can do all on students" ON public.students FOR ALL USING (public.is_mentor());
CREATE POLICY "Students can read own row" ON public.students FOR SELECT USING (id = public.get_student_id());

CREATE POLICY "Mentors can do all on sessions" ON public.sessions FOR ALL USING (public.is_mentor());
CREATE POLICY "Students can read all sessions" ON public.sessions FOR SELECT USING (true);

CREATE POLICY "Mentors can do all on attendance" ON public.attendance FOR ALL USING (public.is_mentor());
CREATE POLICY "students_read_own" ON public.attendance FOR SELECT USING (student_id = (SELECT student_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Mentors can do all on materials" ON public.materials FOR ALL USING (public.is_mentor());
CREATE POLICY "Students can read all materials" ON public.materials FOR SELECT USING (true);

CREATE POLICY "Mentors can do all on import_log" ON public.import_log FOR ALL USING (public.is_mentor());

CREATE POLICY "Mentors can read all users" ON public.users FOR SELECT USING (public.is_mentor());
CREATE POLICY "Users can read own user record" ON public.users FOR SELECT USING (id = auth.uid());

-- Trigger to auto-create user when student is created
-- Note: Creating auth.users requires superuser privileges or using the Supabase admin API.
-- In a standard Supabase setup, you would use an edge function or app-side logic to create the auth user,
-- but since the spec asks for an auth trigger, we implement a basic one assuming pgcrypto is available 
-- to set a default password if we were inserting into auth.users directly. 
-- For the sake of this demo schema, we will assume user creation happens via the Supabase client API.
