-- ======================================================================
-- EYE Gharbia Platform — Database Update & Cloud Synchronization Migration
-- 
-- Includes:
-- 1. Committee Change Requests columns & indexes in `excuses_freezes`
-- 2. Profile columns (`sub_committee`, `pending_profile_update`) in `profiles`
-- 3. Dedicated `profile_update_requests` broadcast table with RLS & Realtime
-- 4. High-performance indexes and Realtime replication
-- ======================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. UPDATE `profiles` TABLE
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_committee text,
  ADD COLUMN IF NOT EXISTS pending_profile_update jsonb,
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

-- Performance indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_committee ON public.profiles (committee);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles (department);
CREATE INDEX IF NOT EXISTS idx_profiles_sub_committee ON public.profiles (sub_committee);

-- Ensure RLS on profiles is enabled and flexible
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_open_access" ON public.profiles;

CREATE POLICY "profiles_open_access" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────────────
-- 2. UPDATE `excuses_freezes` TABLE (Excuses, Freezes & Committee Transfers)
-- ──────────────────────────────────────────────────────────────────────
-- Temporarily drop policies to allow column type adjustments
DROP POLICY IF EXISTS "excuses_select" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_insert" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_update" ON public.excuses_freezes;
DROP POLICY IF EXISTS "excuses_delete" ON public.excuses_freezes;
DROP POLICY IF EXISTS "open access excuses_freezes" ON public.excuses_freezes;
DROP POLICY IF EXISTS "Public Access excuses_freezes" ON public.excuses_freezes;

-- Make ID and user/member references text compatible
ALTER TABLE public.excuses_freezes
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN start_date TYPE text USING start_date::text,
  ALTER COLUMN end_date TYPE text USING end_date::text,
  ALTER COLUMN reviewed_by TYPE text USING reviewed_by::text,
  ALTER COLUMN decision_by TYPE text USING decision_by::text;

-- Add all required transfer & approval fields
ALTER TABLE public.excuses_freezes
  ADD COLUMN IF NOT EXISTS member_id text,
  ADD COLUMN IF NOT EXISTS member_name text,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS target_committee text,
  ADD COLUMN IF NOT EXISTS target_department text,
  ADD COLUMN IF NOT EXISTS sub_committee text,
  ADD COLUMN IF NOT EXISTS request_type text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS target_item_title text,
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS decision_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text,
  ADD COLUMN IF NOT EXISTS decision_by text,
  ADD COLUMN IF NOT EXISTS decision_by_name text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- Performance indexes for excuses & committee transfers
CREATE INDEX IF NOT EXISTS idx_excuses_freezes_member_id ON public.excuses_freezes (member_id);
CREATE INDEX IF NOT EXISTS idx_excuses_freezes_request_type ON public.excuses_freezes (request_type);
CREATE INDEX IF NOT EXISTS idx_excuses_freezes_status ON public.excuses_freezes (status);

-- Enable RLS and create collaborative policy
ALTER TABLE public.excuses_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access excuses_freezes" ON public.excuses_freezes
  FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────────────
-- 3. CREATE `profile_update_requests` TABLE (Broadcast Update Requests)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_update_requests (
  id text PRIMARY KEY,
  target_scope text NOT NULL DEFAULT 'all',
  target_committee text,
  target_user_ids jsonb DEFAULT '[]'::jsonb,
  requested_fields jsonb DEFAULT '[]'::jsonb,
  message text,
  created_by text,
  created_by_name text,
  status text DEFAULT 'Active',
  completed_user_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Performance index for active requests lookup
CREATE INDEX IF NOT EXISTS idx_profile_update_requests_status ON public.profile_update_requests (status);
CREATE INDEX IF NOT EXISTS idx_profile_update_requests_created_at ON public.profile_update_requests (created_at DESC);

-- Enable RLS
ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access profile_update_requests" ON public.profile_update_requests;

CREATE POLICY "Public Access profile_update_requests" ON public.profile_update_requests
  FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────────────
-- 4. REALTIME REPLICATION CONFIGURATION
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.excuses_freezes REPLICA IDENTITY FULL;
ALTER TABLE public.profile_update_requests REPLICA IDENTITY FULL;

-- Safely add tables to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'excuses_freezes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.excuses_freezes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profile_update_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_update_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
