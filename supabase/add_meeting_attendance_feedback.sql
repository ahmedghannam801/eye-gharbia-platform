-- Migration: Add feedback and rating to attendance table
-- Run this in Supabase SQL Editor:

ALTER TABLE IF EXISTS public.attendance 
ADD COLUMN IF NOT EXISTS feedback text,
ADD COLUMN IF NOT EXISTS rating integer;

-- Update permissions
GRANT ALL ON TABLE public.attendance TO authenticated;
GRANT ALL ON TABLE public.attendance TO service_role;
