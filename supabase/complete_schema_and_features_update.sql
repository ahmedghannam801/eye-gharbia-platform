-- ==============================================================================
-- 🚀 EYE PLATFORM — COMPLETE DATABASE SCHEMA & FEATURES UPDATE
-- منصة كيان المصريون الشباب (EYE Gharbia) - التحديث الشامل لقاعدة البيانات
-- ==============================================================================

-- 1. تحديث وتوسيع جدول الملفات الشخصية (profiles)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_committee text DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS bonus_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_phone_to_others boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_avatar_to_others boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_avatar_protected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_birth text,
  ADD COLUMN IF NOT EXISTS linked_in_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS skills jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS endorsements jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lft_nazar_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inzar_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date text,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- تحديث فحص الأدوار (Role Check Constraint) ليشمل جميع الأدوار القيادية
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('Member', 'Leader', 'Super Admin', 'HRM', 'Vice', 'Head', 'Coordinator', 'Deputy Coordinator'));

-- 2. تحديث جدول الأعذار والفريز وتغيير اللجان (excuses_freezes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.excuses_freezes (
  id text PRIMARY KEY,
  member_id text,
  member_name text,
  committee text,
  department text,
  type text,
  request_type text,
  reason text,
  date text,
  start_date text,
  end_date text,
  status text DEFAULT 'Pending',
  target_committee text,
  target_department text,
  sub_committee text,
  admin_response text,
  decision_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  governorate text DEFAULT 'الغربية'
);

ALTER TABLE public.excuses_freezes
  ADD COLUMN IF NOT EXISTS request_type text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS target_committee text,
  ADD COLUMN IF NOT EXISTS target_department text,
  ADD COLUMN IF NOT EXISTS sub_committee text,
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS decision_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 3. تحديث جدول تقييمات الأعضاء (member_evaluations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_evaluations (
  id text PRIMARY KEY,
  target_user_id text NOT NULL,
  target_user_name text,
  target_user_role text,
  committee text,
  department text,
  evaluator_id text,
  evaluator_name text,
  evaluator_role text,
  overall_rating numeric DEFAULT 5,
  commitment_rating numeric DEFAULT 5,
  quality_rating numeric DEFAULT 5,
  teamwork_rating numeric DEFAULT 5,
  activity_rating numeric DEFAULT 5,
  bonus_points numeric DEFAULT 0,
  feedback_comment text,
  created_at timestamptz DEFAULT now(),
  governorate text DEFAULT 'الغربية'
);

ALTER TABLE public.member_evaluations
  ADD COLUMN IF NOT EXISTS bonus_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commitment_rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS quality_rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS teamwork_rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS activity_rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS overall_rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS feedback_comment text;

-- 4. تحديث جدول التكليفات والمهام (tasks) لدعم تكليفات الفيديو
-- ------------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_video_task boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS assigned_member_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_audience text DEFAULT 'all_committee',
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 5. تحديث جدول تسليمات المهام (submissions)
-- ------------------------------------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS video_watch_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewer_id text,
  ADD COLUMN IF NOT EXISTS reviewer_name text,
  ADD COLUMN IF NOT EXISTS reviewer_role text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 6. سياسات الأمان والحماية (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuses_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public Access excuses_freezes" ON public.excuses_freezes;
DROP POLICY IF EXISTS "Public Access member_evaluations" ON public.member_evaluations;
DROP POLICY IF EXISTS "Public Access tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public Access submissions" ON public.submissions;

CREATE POLICY "Public Access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access excuses_freezes" ON public.excuses_freezes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access member_evaluations" ON public.member_evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);

-- 7. تفعيل البث الفوري Realtime لجميع الجداول
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.excuses_freezes REPLICA IDENTITY FULL;
ALTER TABLE public.member_evaluations REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.submissions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'excuses_freezes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.excuses_freezes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'member_evaluations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.member_evaluations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END $$;
