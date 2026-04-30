-- supabase/seed.sql

-- 1. Insert Students
INSERT INTO public.students (id, name, usn, branch_code, email, admission_number) VALUES
(1, 'Test Student', '4SH24CS001', 'CS', '4SH24CS001@forge.local', '24CS001'),
(2, 'Divya Kulkarni', '4SH24CS002', 'AI', '4SH24CS002@forge.local', '24CS002'),
(3, 'Ravi Kumar', '4SH24CS003', 'CS', '4SH24CS003@forge.local', '24CS003'),
(4, 'Priya Sharma', '4SH24IS001', 'IS', '4SH24IS001@forge.local', '24IS001');

-- Reset sequence
SELECT setval('students_id_seq', (SELECT MAX(id) FROM public.students));

-- 2. Insert Sessions
INSERT INTO public.sessions (id, date, topic, month_number, duration_hours, session_type) VALUES
(1, '2025-08-10', '8-Layer AI Stack', 4, 2.0, 'offline'),
(2, '2025-08-15', 'ReAct Agent Pattern', 4, 2.0, 'offline'),
(3, '2025-09-05', 'pgvector RAG', 5, 2.0, 'online'),
(4, '2025-09-12', 'Tiered Autonomy Multi-Agent', 5, 2.0, 'offline');

-- Reset sequence
SELECT setval('sessions_id_seq', (SELECT MAX(id) FROM public.sessions));

-- 3. Insert Attendance
INSERT INTO public.attendance (student_id, session_id, present, marked_by) VALUES
(1, 1, true, 'Nischay'),
(1, 2, true, 'Nischay'),
(1, 3, false, 'Nischay'),
(1, 4, true, 'Nischay'),
(2, 1, true, 'Nischay'),
(2, 2, false, 'Nischay'),
(2, 3, true, 'Nischay'),
(2, 4, true, 'Nischay'),
(3, 1, false, 'Nischay'),
(3, 2, true, 'Nischay'),
(3, 3, true, 'Nischay'),
(3, 4, false, 'Nischay'),
(4, 1, true, 'Nischay'),
(4, 2, true, 'Nischay'),
(4, 3, true, 'Nischay'),
(4, 4, true, 'Nischay');

-- 4. Insert Materials
INSERT INTO public.materials (session_id, title, type, url, description) VALUES
(1, '8-Layer Stack Slides', 'slides', 'https://example.com/slides1', 'Overview of the AI application stack'),
(1, 'Session Recording', 'recording', 'https://example.com/rec1', 'Class recording from Aug 10'),
(2, 'ReAct Pattern Guide', 'document', 'https://example.com/doc2', 'Implementation guide for ReAct'),
(3, 'pgvector Documentation', 'link', 'https://example.com/link3', 'Official pgvector docs');

-- 5. Insert Import Log
INSERT INTO public.import_log (filename, uploaded_by, total_rows, imported_rows, skipped_rows, status) VALUES
('month4_attendance.csv', 'Nischay', 100, 95, 5, 'completed'),
('month5_attendance.csv', 'Nischay', 120, 120, 0, 'completed');

-- Note: The users table must be populated by the application using Supabase Auth.
-- To login as Mentor, create an account with email 'nischay@theboringpeople.in'.
-- To login as Student, create an account with email '4SH24CS001@forge.local'.
