-- ============================================================
-- EYE Platform — Submissions & Meetings Database Migration
-- قم بنسخ هذا الكود وتشغيله في Supabase SQL Editor لضمان التوافق التام
-- ============================================================

-- 1. إضافة أعمدة المُقيِّم والتقييم المفصل في جدول التسليمات submissions
ALTER TABLE IF EXISTS public.submissions 
ADD COLUMN IF NOT EXISTS reviewed_by text,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS grading_criteria jsonb,
ADD COLUMN IF NOT EXISTS grade numeric,
ADD COLUMN IF NOT EXISTS submission_id_code text,
ADD COLUMN IF NOT EXISTS comment text,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS completed_subtasks jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;

-- 2. التأكد من وجود أعمدة الفيدباك والتقييم في جدول الحضور attendance
ALTER TABLE IF EXISTS public.attendance 
ADD COLUMN IF NOT EXISTS feedback text,
ADD COLUMN IF NOT EXISTS rating integer;

-- 3. التأكد من وجود عمود عدد الحضور المتوقع في جدول الاجتماعات meetings
ALTER TABLE IF EXISTS public.meetings
ADD COLUMN IF NOT EXISTS expected_attendees_count integer;

-- 4. التأكد من وجود عمود اللجنة الفرعية في جدول الملفات الشخصية profiles
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS sub_committee text;

-- 5. تحديث الصلاحيات
GRANT ALL ON TABLE public.submissions TO authenticated, service_role, anon;
GRANT ALL ON TABLE public.attendance TO authenticated, service_role, anon;
GRANT ALL ON TABLE public.meetings TO authenticated, service_role, anon;
GRANT ALL ON TABLE public.profiles TO authenticated, service_role, anon;
