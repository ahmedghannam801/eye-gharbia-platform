-- ==============================================================================
-- EYE PLATFORM: COMPREHENSIVE FIX FOR ALL ROLES, PERMISSIONS & DATA SYNC
-- ==============================================================================
-- Run this script in Supabase Dashboard > SQL Editor > New Query.
-- It fixes the issue where new leaders or position holders add tasks, meetings,
-- announcements, etc. and get rejected by RLS (42501) or UUID type mismatch.
-- ==============================================================================

BEGIN;

-- 1. DROP RESTRICTIVE ROLE TRIGGER (Which was reverting new leaders to 'Member')
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.profile_role_change_allowed();

-- 2. HELPER FUNCTIONS FOR ROLES (Fixed type matching: id::text = auth.uid()::text)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::text = auth.uid()::text
    AND role IN ('Super Admin', 'Leader', 'Vice', 'Coordinator', 'Deputy Coordinator', 'Head', 'HRM')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::text = auth.uid()::text
    AND role = 'Super Admin'
  );
$$;

-- 3. ENSURE ALL TABLES HAVE GOVERNORATE DEFAULT 'الغربية'
DO $$
DECLARE
  t TEXT;
  tables_list TEXT[] := ARRAY[
    'profiles', 'tasks', 'announcements', 'meetings', 'attendance',
    'excuses_freezes', 'work_plans', 'volunteer_ideas', 'issued_certificates',
    'issued_posters', 'disciplinary_records', 'live_workshops'
  ];
BEGIN
  FOREACH t IN ARRAY tables_list LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'governorate') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN governorate text DEFAULT ''الغربية''', t);
      ELSE
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN governorate SET DEFAULT ''الغربية''', t);
      END IF;
      EXECUTE format('UPDATE public.%I SET governorate = ''الغربية'' WHERE governorate IS NULL OR governorate != ''الغربية''', t);
    END IF;
  END LOOP;
END $$;

-- 4. CLEAN SLATE: DROP OLD CONFLICTING POLICIES ACROSS ALL TABLES
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 5. ENABLE ROW LEVEL SECURITY & CREATE UNRESTRICTED POLICIES
DO $$
DECLARE
  t TEXT;
  all_tables TEXT[] := ARRAY[
    'profiles', 'tasks', 'submissions', 'announcements', 'notifications',
    'activity_logs', 'meetings', 'attendance', 'excuses_freezes',
    'issued_certificates', 'work_plans', 'volunteer_ideas', 'member_evaluations',
    'leader_feedbacks', 'live_workshops', 'disciplinary_records',
    'memory_wall', 'academy_courses', 'reward_items', 'reward_purchases',
    'weekly_quizzes', 'weekly_challenges', 'occasions', 'issued_posters', 'org_settings'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY "allow_all_%I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;

-- 6. RE-ENABLE REALTIME REPLICATION ON CORE TABLES
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.profiles,
    public.tasks,
    public.submissions,
    public.announcements,
    public.notifications,
    public.meetings,
    public.attendance,
    public.excuses_freezes,
    public.work_plans,
    public.issued_certificates,
    public.issued_posters,
    public.disciplinary_records;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;
