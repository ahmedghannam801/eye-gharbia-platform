-- ==============================================================================
-- EYE GHARBIA PLATFORM - Comprehensive Database Update
-- ==============================================================================
-- 1. Adds video & submission columns to tasks & submissions tables
-- 2. Ensures 'task-submissions' storage bucket exists and allows photo/file uploads
-- 3. Cleans up legacy 'Events' committee and assigns membership codes
-- ==============================================================================

-- ── 1. TASKS TABLE UPDATES ──────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS is_video_task BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_file_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_upload_size_mb INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS allow_resubmission BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_member_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_committee TEXT DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS target_department TEXT DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;

-- ── 2. SUBMISSIONS TABLE UPDATES ─────────────────────────────────────────────
ALTER TABLE IF EXISTS public.submissions
  ADD COLUMN IF NOT EXISTS submission_id_code TEXT,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_file_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_file_size TEXT,
  ADD COLUMN IF NOT EXISTS grade NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS completed_subtasks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;

-- ── 3. CLEAN UP LEGACY 'Events' COMMITTEE ────────────────────────────────────
-- Remove / reset any profile that was set to Events
UPDATE public.profiles
SET 
  committee = 'None',
  department = 'None'
WHERE 
  committee IN ('Events', 'Event Management', 'events', 'Event');

-- ── 4. AUTO-GENERATE MEMBERSHIP CODES (Safe: Uses joined_date ASC, id ASC) ──
DO $$
DECLARE
  r RECORD;
  seq INT := 1001;
BEGIN
  FOR r IN (
    SELECT id, membership_code 
    FROM public.profiles 
    WHERE membership_code IS NULL 
       OR membership_code = '' 
       OR membership_code = 'EYE-GH-0000'
    ORDER BY joined_date ASC NULLS LAST, id ASC
  ) LOOP
    -- Find a unique code starting from seq
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE membership_code = 'EYE-GH-' || LPAD(seq::text, 4, '0')) LOOP
      seq := seq + 1;
    END LOOP;
    
    UPDATE public.profiles
    SET membership_code = 'EYE-GH-' || LPAD(seq::text, 4, '0')
    WHERE id = r.id;
    
    seq := seq + 1;
  END LOOP;
END $$;

-- ── 5. STORAGE BUCKET CONFIGURATION (task-submissions) ──────────────────────
-- Insert bucket if not exists and ensure it is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-submissions', 'task-submissions', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Ensure storage policies allow public read and uploads
DROP POLICY IF EXISTS "Public task-submissions read" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to task-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to task-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes to task-submissions" ON storage.objects;

CREATE POLICY "Public task-submissions read"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-submissions');

CREATE POLICY "Allow uploads to task-submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-submissions');

CREATE POLICY "Allow updates to task-submissions"
ON storage.objects FOR UPDATE
USING (bucket_id = 'task-submissions');

CREATE POLICY "Allow deletes to task-submissions"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-submissions');

-- ==============================================================================
-- DONE! All tables, storage buckets, and codes are updated successfully.
-- ==============================================================================
