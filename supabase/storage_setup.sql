-- ============================================================
-- STORAGE BUCKETS & POLICIES SETUP
-- ============================================================

-- 1. Ensure storage schema and eye-bucket exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('eye-bucket', 'eye-bucket', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800;

-- 2. Open RLS policies for eye-bucket public read, write, update, delete
DROP POLICY IF EXISTS "Public Access eye-bucket SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Public Access eye-bucket INSERT" ON storage.objects;
DROP POLICY IF EXISTS "Public Access eye-bucket UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "Public Access eye-bucket DELETE" ON storage.objects;

CREATE POLICY "Public Access eye-bucket SELECT"
ON storage.objects FOR SELECT
USING (bucket_id = 'eye-bucket');

CREATE POLICY "Public Access eye-bucket INSERT"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'eye-bucket');

CREATE POLICY "Public Access eye-bucket UPDATE"
ON storage.objects FOR UPDATE
USING (bucket_id = 'eye-bucket')
WITH CHECK (bucket_id = 'eye-bucket');

CREATE POLICY "Public Access eye-bucket DELETE"
ON storage.objects FOR DELETE
USING (bucket_id = 'eye-bucket');
