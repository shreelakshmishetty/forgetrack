-- Realistic Data Seed Script

-- 1. Insert more students
INSERT INTO public.students (name, usn, branch_code, email, admission_number) VALUES
('Aarav Patel', '4SH24CS005', 'CS', '4SH24CS005@forge.local', '24CS005'),
('Aditi Rao', '4SH24CS006', 'CS', '4SH24CS006@forge.local', '24CS006'),
('Arjun Desai', '4SH24CS007', 'CS', '4SH24CS007@forge.local', '24CS007'),
('Diya Reddy', '4SH24AI001', 'AI', '4SH24AI001@forge.local', '24AI001'),
('Ishaan Singh', '4SH24AI002', 'AI', '4SH24AI002@forge.local', '24AI002'),
('Kavya Menon', '4SH24AI003', 'AI', '4SH24AI003@forge.local', '24AI003'),
('Mohammed Ali', '4SH24IS002', 'IS', '4SH24IS002@forge.local', '24IS002'),
('Neha Gupta', '4SH24IS003', 'IS', '4SH24IS003@forge.local', '24IS003'),
('Pranav Kumar', '4SH24IS004', 'IS', '4SH24IS004@forge.local', '24IS004'),
('Riya Sharma', '4SH24CS008', 'CS', '4SH24CS008@forge.local', '24CS008'),
('Sai Krishna', '4SH24CS009', 'CS', '4SH24CS009@forge.local', '24CS009'),
('Sneha Joshi', '4SH24CS010', 'CS', '4SH24CS010@forge.local', '24CS010'),
('Varun Nair', '4SH24CS011', 'CS', '4SH24CS011@forge.local', '24CS011'),
('Yash Verma', '4SH24CS012', 'CS', '4SH24CS012@forge.local', '24CS012'),
('Zoya Khan', '4SH24CS013', 'CS', '4SH24CS013@forge.local', '24CS013')
ON CONFLICT (usn) DO NOTHING;

-- 2. Insert more sessions
INSERT INTO public.sessions (date, topic, month_number, duration_hours, session_type) VALUES
('2025-09-19', 'RAG Advanced Strategies', 5, 2.0, 'online'),
('2025-09-26', 'Agentic Workflows', 5, 2.0, 'offline'),
('2025-10-03', 'Supabase Realtime & Auth', 6, 2.0, 'offline'),
('2025-10-10', 'Tailwind CSS Mastery', 6, 2.0, 'online'),
('2025-10-17', 'Building Resilient Microservices', 6, 2.0, 'offline')
ON CONFLICT (date) DO NOTHING;

-- 3. Insert more materials
INSERT INTO public.materials (session_id, title, type, url, description)
SELECT id, 'RAG Strategies Deck', 'slides', 'https://example.com/rag-deck', 'Advanced RAG patterns' FROM public.sessions WHERE date = '2025-09-19';

INSERT INTO public.materials (session_id, title, type, url, description)
SELECT id, 'Agentic Workflows Video', 'recording', 'https://example.com/agents-video', 'Session recording for Agentic Workflows' FROM public.sessions WHERE date = '2025-09-26';

INSERT INTO public.materials (session_id, title, type, url, description)
SELECT id, 'Supabase Auth Guide', 'document', 'https://example.com/supabase-auth', 'How to configure Supabase Auth securely' FROM public.sessions WHERE date = '2025-10-03';

INSERT INTO public.materials (session_id, title, type, url, description)
SELECT id, 'Realtime DB Setup', 'link', 'https://example.com/supabase-realtime', 'Docs for Realtime database' FROM public.sessions WHERE date = '2025-10-03';

INSERT INTO public.materials (session_id, title, type, url, description)
SELECT id, 'Tailwind Cheatsheet', 'document', 'https://example.com/tailwind-cheat', 'Quick reference for Tailwind utilities' FROM public.sessions WHERE date = '2025-10-10';

INSERT INTO public.materials (session_id, title, type, url, description)
SELECT id, 'Microservices Architecture', 'slides', 'https://example.com/microservices', 'Slides for resilient microservices' FROM public.sessions WHERE date = '2025-10-17';

-- 4. Generate Random Attendance for all students for these new sessions
INSERT INTO public.attendance (student_id, session_id, present, marked_by)
SELECT st.id, se.id, (random() > 0.2), 'Nischay'
FROM public.students st
CROSS JOIN public.sessions se
WHERE se.date IN ('2025-09-19', '2025-09-26', '2025-10-03', '2025-10-10', '2025-10-17')
ON CONFLICT (student_id, session_id) DO NOTHING;
