-- ==============================================================================
-- FIX USER ROLE & PROFILE: Youssef Ghoneim (يوسف غنيم)
-- ==============================================================================
-- Converts user to 'Member' (عضو) with standard Member membership code.
-- Run in Supabase SQL Editor if you want to apply directly to remote database.
-- ==============================================================================

UPDATE public.profiles
SET 
  role = 'Member',
  membership_code = 'EYE-HR-0001',
  committee = 'HR',
  department = 'HRM',
  bio = 'Enthusiastic member of the HRM department.'
WHERE 
  email = 'ysft7136@gmail.com' 
  OR full_name ILIKE '%يوسف غنيم%';
