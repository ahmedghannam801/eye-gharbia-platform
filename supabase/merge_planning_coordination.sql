-- ============================================================
-- SQL Migration: Merge Planning & Coordination Departments
-- نفّذ هذا الكود في Supabase SQL Editor لدمج بيانات اللجنتين معاً
-- ============================================================

-- 1. تحديث بيانات الأعضاء في جدول profiles
UPDATE public.profiles
SET department = 'Planning & Coordination'
WHERE committee = 'OR' 
  AND (
    department = 'Planning' 
    OR department = 'Coordination' 
    OR department ILIKE '%تخطيط%' 
    OR department ILIKE '%تنسيق%'
  );

-- 2. تحديث المهام في جدول tasks
UPDATE public.tasks
SET department = 'Planning & Coordination'
WHERE committee = 'OR' 
  AND (
    department = 'Planning' 
    OR department = 'Coordination' 
    OR department ILIKE '%تخطيط%' 
    OR department ILIKE '%تنسيق%'
  );

-- 3. تحديث تسليمات المهام في جدول submissions
UPDATE public.submissions
SET department = 'Planning & Coordination'
WHERE committee = 'OR' 
  AND (
    department = 'Planning' 
    OR department = 'Coordination' 
    OR department ILIKE '%تخطيط%' 
    OR department ILIKE '%تنسيق%'
  );

-- 4. تحديث سجلات الحضور في جدول meeting_attendances إن وُجد عمود department
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'meeting_attendances' 
      AND column_name = 'department'
  ) THEN
    UPDATE public.meeting_attendances
    SET department = 'Planning & Coordination'
    WHERE department = 'Planning' OR department = 'Coordination';
  END IF;
END $$;
