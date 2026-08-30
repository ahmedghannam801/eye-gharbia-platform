-- ============================================================
-- EYE Platform — Meetings & Attendance Schema Update
-- قم بنسخ هذا الكود وتشغيله في Supabase SQL Editor لضمان التوافق التام
-- ============================================================

-- 1. التأكد من وجود أعمدة التقييم والملاحظات في جدول الحضور attendance
ALTER TABLE IF EXISTS public.attendance 
ADD COLUMN IF NOT EXISTS feedback text,
ADD COLUMN IF NOT EXISTS rating integer;

-- 2. التأكد من وجود عمود عدد الحضور المتوقع في جدول الاجتماعات meetings
ALTER TABLE IF EXISTS public.meetings
ADD COLUMN IF NOT EXISTS expected_attendees_count integer;

-- 3. التأكد من وجود عمود اللجنة الفرعية في جدول الملفات الشخصية profiles
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS sub_committee text;

-- 4. تحديث الصلاحيات
GRANT ALL ON TABLE public.attendance TO authenticated;
GRANT ALL ON TABLE public.attendance TO service_role;
GRANT ALL ON TABLE public.meetings TO authenticated;
GRANT ALL ON TABLE public.meetings TO service_role;
