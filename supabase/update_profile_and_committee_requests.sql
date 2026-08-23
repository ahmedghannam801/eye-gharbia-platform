-- ======================================================================
-- EYE Hub — Update Profiles & Committee Change Requests System
-- ======================================================================

-- 1. Temporarily drop policies on excuses_freezes to allow column type changes
DROP POLICY IF EXISTS "excuses_select" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_insert" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_update" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_delete" ON public.excuses_freezes;
DROP POLICY IF EXISTS "open access excuses_freezes" ON public.excuses_freezes;

-- 2. Ensure excuses_freezes columns are flexible and support Excuses, Freezes & Committee Changes
ALTER TABLE public.excuses_freezes
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN start_date TYPE text USING start_date::text,
  ALTER COLUMN end_date TYPE text USING end_date::text,
  ALTER COLUMN reviewed_by TYPE text USING reviewed_by::text,
  ALTER COLUMN decision_by TYPE text USING decision_by::text;

ALTER TABLE public.excuses_freezes
  ADD COLUMN IF NOT EXISTS request_type text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS target_item_title text,
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS decision_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 3. Re-create RLS policies on excuses_freezes (allow open access for collaborative leaders & admins)
ALTER TABLE public.excuses_freezes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "excuses_select" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_insert" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_update" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_delete" ON public.excuses_freezes;
DROP POLICY IF EXISTS "open access excuses_freezes" ON public.excuses_freezes;
DROP POLICY IF EXISTS "Public Access excuses_freezes" ON public.excuses_freezes;

CREATE POLICY "Public Access excuses_freezes" ON public.excuses_freezes FOR ALL USING (true) WITH CHECK (true);

-- 4. Ensure profiles columns exist and have proper defaults
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_phone_to_others boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_avatar_to_others boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_avatar_protected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS linked_in_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS bonus_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lft_nazar_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inzar_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 5. Enable RLS and verify policies on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Realtime publication additions & Replica Identity
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.excuses_freezes REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'excuses_freezes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.excuses_freezes;
  END IF;
END $$;
