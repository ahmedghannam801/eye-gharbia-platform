-- ============================================================
-- EYE Workflow Hub — SECURITY LOCKDOWN
-- Version: 5.0 — Complete RLS hardening for ALL tables
-- ============================================================
-- 🔴 RUN THIS IN SUPABASE DASHBOARD > SQL EDITOR > NEW QUERY
-- This replaces ALL open (using(true)) policies with secure ones.
-- ============================================================

-- ======================================================================
-- HELPER: Admin role check function (reusable across policies)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('Super Admin', 'Leader', 'Vice', 'Coordinator', 'Deputy Coordinator', 'Head', 'Central')
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
    WHERE id = auth.uid()
    AND role = 'Super Admin'
  );
$$;

-- ======================================================================
-- ROLE PROTECTION TRIGGER — prevent privilege escalation
-- ======================================================================

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.profile_role_change_allowed();

CREATE OR REPLACE FUNCTION public.profile_role_change_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  caller_is_admin BOOLEAN := FALSE;
BEGIN
  -- Check if caller is an existing administrator
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  caller_is_admin := (current_user_role IN ('Super Admin', 'Leader', 'Vice', 'Coordinator', 'Deputy Coordinator', 'Head', 'Central'));

  -- INSERT: If not an admin, force role to Member to prevent privilege escalation on self-registration
  IF TG_OP = 'INSERT' THEN
    IF NOT caller_is_admin THEN
      NEW.role := 'Member';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE:
  IF current_user_role IS NULL THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Unauthorized role change';
    END IF;
    IF OLD.id IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'ID changes are not permitted';
    END IF;
    RETURN NEW;
  END IF;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Unauthorized role change';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'ID changes are not permitted';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profile_role_change_allowed();



-- ======================================================================
-- DROP ALL EXISTING POLICIES (clean slate)
-- ======================================================================

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
END;
$$;


-- ======================================================================
-- ENABLE RLS ON ALL TABLES
-- ======================================================================

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.excuses_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.issued_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.volunteer_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leader_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.disciplinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.live_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reward_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memory_wall ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.issued_posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_performance ENABLE ROW LEVEL SECURITY;


-- ======================================================================
-- PROFILES
-- ======================================================================

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_super_admin" ON public.profiles
  FOR DELETE USING (public.is_super_admin());


-- ======================================================================
-- TASKS
-- ======================================================================

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_insert_admin" ON public.tasks
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (created_by = auth.uid() OR public.is_admin());


-- ======================================================================
-- SUBMISSIONS
-- ======================================================================

CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT USING (member_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "submissions_insert" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "submissions_update" ON public.submissions
  FOR UPDATE USING (member_id::text = auth.uid()::text OR public.is_admin())
  WITH CHECK (member_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "submissions_delete" ON public.submissions
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- ANNOUNCEMENTS
-- ======================================================================

CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "announcements_insert" ON public.announcements
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "announcements_update" ON public.announcements
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "announcements_delete" ON public.announcements
  FOR DELETE USING (created_by = auth.uid() OR public.is_admin());


-- ======================================================================
-- NOTIFICATIONS
-- ======================================================================

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (user_id = auth.uid() OR public.is_admin());


-- ======================================================================
-- ACTIVITY LOGS
-- ======================================================================

CREATE POLICY "logs_select_admin" ON public.activity_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "logs_delete" ON public.activity_logs
  FOR DELETE USING (public.is_super_admin());


-- ======================================================================
-- MEETINGS
-- ======================================================================

CREATE POLICY "meetings_select" ON public.meetings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "meetings_insert" ON public.meetings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "meetings_update" ON public.meetings
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "meetings_delete" ON public.meetings
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- ATTENDANCE
-- ======================================================================

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (member_id = auth.uid() OR public.is_admin());

CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (member_id = auth.uid() OR public.is_admin())
  WITH CHECK (member_id = auth.uid() OR public.is_admin());

CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- EXCUSES & FREEZES
-- ======================================================================

CREATE POLICY "excuses_select" ON public.excuses_freezes
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "excuses_insert" ON public.excuses_freezes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "excuses_update" ON public.excuses_freezes
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "excuses_delete" ON public.excuses_freezes
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- ISSUED CERTIFICATES
-- ======================================================================

CREATE POLICY "certs_select" ON public.issued_certificates
  FOR SELECT USING (recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY "certs_insert" ON public.issued_certificates
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "certs_update" ON public.issued_certificates
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "certs_delete" ON public.issued_certificates
  FOR DELETE USING (public.is_super_admin());


-- ======================================================================
-- WORK PLANS
-- ======================================================================

CREATE POLICY "workplans_select" ON public.work_plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "workplans_insert" ON public.work_plans
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "workplans_update" ON public.work_plans
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "workplans_delete" ON public.work_plans
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- VOLUNTEER IDEAS
-- ======================================================================

CREATE POLICY "ideas_select" ON public.volunteer_ideas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ideas_insert" ON public.volunteer_ideas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ideas_update" ON public.volunteer_ideas
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "ideas_delete" ON public.volunteer_ideas
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());


-- ======================================================================
-- MEMBER EVALUATIONS
-- ======================================================================

CREATE POLICY "evals_select" ON public.member_evaluations
  FOR SELECT USING (target_user_id = auth.uid() OR evaluator_id = auth.uid() OR public.is_admin());

CREATE POLICY "evals_insert" ON public.member_evaluations
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "evals_update" ON public.member_evaluations
  FOR UPDATE USING (evaluator_id = auth.uid() OR public.is_admin())
  WITH CHECK (evaluator_id = auth.uid() OR public.is_admin());

CREATE POLICY "evals_delete" ON public.member_evaluations
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- LEADER FEEDBACKS
-- ======================================================================

CREATE POLICY "feedback_select" ON public.leader_feedbacks
  FOR SELECT USING (leader_id = auth.uid() OR reviewer_id = auth.uid() OR public.is_admin());

CREATE POLICY "feedback_insert" ON public.leader_feedbacks
  FOR INSERT WITH CHECK (public.is_admin() OR auth.uid() IS NOT NULL);

CREATE POLICY "feedback_update" ON public.leader_feedbacks
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "feedback_delete" ON public.leader_feedbacks
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- DISCIPLINARY RECORDS
-- ======================================================================

CREATE POLICY "disciplinary_select" ON public.disciplinary_records
  FOR SELECT USING (member_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "disciplinary_insert" ON public.disciplinary_records
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "disciplinary_update" ON public.disciplinary_records
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "disciplinary_delete" ON public.disciplinary_records
  FOR DELETE USING (public.is_super_admin());


-- ======================================================================
-- LIVE WORKSHOPS
-- ======================================================================

CREATE POLICY "workshops_select" ON public.live_workshops
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "workshops_insert" ON public.live_workshops
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "workshops_update" ON public.live_workshops
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "workshops_delete" ON public.live_workshops
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- ACADEMY COURSES
-- ======================================================================

CREATE POLICY "courses_select" ON public.academy_courses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "courses_insert" ON public.academy_courses
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "courses_update" ON public.academy_courses
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "courses_delete" ON public.academy_courses
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- REWARD ITEMS
-- ======================================================================

CREATE POLICY "rewards_select" ON public.reward_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "rewards_insert" ON public.reward_items
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "rewards_update" ON public.reward_items
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "rewards_delete" ON public.reward_items
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- REWARD PURCHASES
-- ======================================================================

CREATE POLICY "purchases_select" ON public.reward_purchases
  FOR SELECT USING (member_id::text = auth.uid()::text OR public.is_admin());

CREATE POLICY "purchases_insert" ON public.reward_purchases
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "purchases_update" ON public.reward_purchases
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "purchases_delete" ON public.reward_purchases
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- WEEKLY QUIZZES
-- ======================================================================

CREATE POLICY "quizzes_select" ON public.weekly_quizzes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "quizzes_insert" ON public.weekly_quizzes
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "quizzes_update" ON public.weekly_quizzes
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "quizzes_delete" ON public.weekly_quizzes
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- WEEKLY CHALLENGES
-- ======================================================================

CREATE POLICY "challenges_select" ON public.weekly_challenges
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "challenges_insert" ON public.weekly_challenges
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "challenges_update" ON public.weekly_challenges
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "challenges_delete" ON public.weekly_challenges
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- MEMORY WALL
-- ======================================================================

CREATE POLICY "memory_select" ON public.memory_wall
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "memory_insert" ON public.memory_wall
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "memory_update" ON public.memory_wall
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "memory_delete" ON public.memory_wall
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());


-- ======================================================================
-- OCCASIONS
-- ======================================================================

CREATE POLICY "occasions_select" ON public.occasions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "occasions_insert" ON public.occasions
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "occasions_update" ON public.occasions
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "occasions_delete" ON public.occasions
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- ISSUED POSTERS
-- ======================================================================

CREATE POLICY "posters_select" ON public.issued_posters
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "posters_insert" ON public.issued_posters
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "posters_update" ON public.issued_posters
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "posters_delete" ON public.issued_posters
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- PUSH SUBSCRIPTIONS
-- ======================================================================

CREATE POLICY "push_select" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "push_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "push_update" ON public.push_subscriptions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_delete" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid() OR public.is_admin());


-- ======================================================================
-- ORG SETTINGS
-- ======================================================================

CREATE POLICY "settings_select" ON public.org_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "settings_insert" ON public.org_settings
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "settings_update" ON public.org_settings
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "settings_delete" ON public.org_settings
  FOR DELETE USING (public.is_super_admin());


-- ======================================================================
-- MONTHLY PERFORMANCE
-- ======================================================================

CREATE POLICY "perf_select" ON public.monthly_performance
  FOR SELECT USING (member_id = auth.uid() OR public.is_admin());

CREATE POLICY "perf_insert" ON public.monthly_performance
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "perf_update" ON public.monthly_performance
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "perf_delete" ON public.monthly_performance
  FOR DELETE USING (public.is_admin());


-- ======================================================================
-- STORAGE OBJECTS POLICIES (Hardened)
-- ======================================================================

-- Ensure buckets exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('eye-bucket', 'eye-bucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-submissions', 'task-submissions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop insecure storage policies
DROP POLICY IF EXISTS "Public Access eye-bucket SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Public Access eye-bucket INSERT" ON storage.objects;
DROP POLICY IF EXISTS "Public Access eye-bucket UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "Public Access eye-bucket DELETE" ON storage.objects;
DROP POLICY IF EXISTS "task_submissions_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_submissions_select" ON storage.objects;
DROP POLICY IF EXISTS "task_submissions_update" ON storage.objects;
DROP POLICY IF EXISTS "task_submissions_delete" ON storage.objects;

-- SELECT: Public can view assets in public buckets
CREATE POLICY "storage_select_public" ON storage.objects
  FOR SELECT USING (bucket_id IN ('eye-bucket', 'task-submissions'));

-- INSERT: Authenticated users can upload
CREATE POLICY "storage_insert_authenticated" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND bucket_id IN ('eye-bucket', 'task-submissions')
  );

-- UPDATE: Owner or Admin
CREATE POLICY "storage_update_owner_or_admin" ON storage.objects
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR public.is_admin()
  ) WITH CHECK (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR public.is_admin()
  );

-- DELETE: Owner or Super Admin
CREATE POLICY "storage_delete_owner_or_admin" ON storage.objects
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR public.is_super_admin()
  );


-- ======================================================================
-- END OF SECURITY LOCKDOWN
-- ======================================================================

