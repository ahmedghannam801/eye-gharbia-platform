-- ============================================================
-- SQL Script for Academy & Knowledge Reference Hub
-- نفّذ هذا الكود في Supabase SQL Editor
-- ============================================================

-- 1. إنشاء الجدول في حال لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.academy_courses (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text DEFAULT 'General',
  committee text DEFAULT 'All',
  reads_count integer DEFAULT 0,
  completed_by jsonb DEFAULT '[]',
  governorate text DEFAULT 'الغربية',
  type text DEFAULT 'reference',
  video_url text,
  link_url text,
  pdf_url text,
  duration text,
  author text,
  tags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  created_by text,
  created_by_name text
);

-- 2. إضافة الأعمدة في حال كان الجدول موجوداً بالفعل
ALTER TABLE IF EXISTS public.academy_courses
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'reference',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- 3. تفعيل الحماية والوصول المفتوح للقراءة والتعديل (RLS)
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'academy_courses' AND policyname = 'open access academy_courses'
  ) THEN
    CREATE POLICY "open access academy_courses" ON public.academy_courses FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. تفعيل المزامنة اللحظية (Realtime) للجدول
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'academy_courses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_courses;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
