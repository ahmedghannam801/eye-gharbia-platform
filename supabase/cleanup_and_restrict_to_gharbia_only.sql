-- ==============================================================================
-- EYE PLATFORM: CLEANUP & RESTRICT TO GHARBIA GOVERNORATE ONLY (محافظة الغربية)
-- ==============================================================================
-- This script cleans all non-Gharbia records, normalizes central roles,
-- ensures all tables default to 'الغربية', and locks down the platform
-- to exclusively operate for Gharbia Governorate branch.
-- ==============================================================================

BEGIN;

-- 1. Remove central dummy accounts if any
DELETE FROM public.profiles 
WHERE email LIKE '%@eye.org' AND membership_code LIKE 'EYE-CTRL-%';

-- 2. Clean 'Central' roles and update to 'Member' or appropriate role
UPDATE public.profiles 
SET role = 'Member' 
WHERE role = 'Central';

-- 3. Normalize all profiles to Gharbia
UPDATE public.profiles
SET governorate = 'الغربية'
WHERE governorate IS NULL OR governorate != 'الغربية';

-- 4. Set default value for profiles governorate column
ALTER TABLE IF EXISTS public.profiles 
  ALTER COLUMN governorate SET DEFAULT 'الغربية';

-- 5. Normalize Tasks to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'governorate') THEN
    UPDATE public.tasks SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.tasks ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 6. Normalize Announcements to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'governorate') THEN
    UPDATE public.announcements SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.announcements ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 7. Normalize Meetings to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'governorate') THEN
    UPDATE public.meetings SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.meetings ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 8. Normalize Attendance Records to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'governorate') THEN
    UPDATE public.attendance SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.attendance ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 9. Normalize Excuses & Freezes to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'excuses_freezes' AND column_name = 'governorate') THEN
    UPDATE public.excuses_freezes SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.excuses_freezes ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 10. Normalize Work Plans (OKRs) to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_plans' AND column_name = 'governorate') THEN
    UPDATE public.work_plans SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.work_plans ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 11. Normalize Volunteer Ideas to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'volunteer_ideas' AND column_name = 'governorate') THEN
    UPDATE public.volunteer_ideas SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.volunteer_ideas ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 12. Normalize Issued Certificates to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issued_certificates' AND column_name = 'governorate') THEN
    UPDATE public.issued_certificates SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.issued_certificates ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 13. Normalize Issued Posters to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issued_posters' AND column_name = 'governorate') THEN
    UPDATE public.issued_posters SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.issued_posters ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 14. Normalize Disciplinary Records to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disciplinary_records' AND column_name = 'governorate') THEN
    UPDATE public.disciplinary_records SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.disciplinary_records ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

-- 15. Normalize Live Workshops to Gharbia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_workshops' AND column_name = 'governorate') THEN
    UPDATE public.live_workshops SET governorate = 'الغربية' WHERE governorate IS NULL OR governorate != 'الغربية';
    ALTER TABLE public.live_workshops ALTER COLUMN governorate SET DEFAULT 'الغربية';
  END IF;
END $$;

COMMIT;
