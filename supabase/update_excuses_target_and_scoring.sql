-- ==============================================================================
-- 🚀 تحديث جدول الأعذار والفريز لدعم تحديد الاجتماع أو المهمة بدقة (target_id)
-- وتحديث صلاحيات المزامنة الفورية في Supabase
-- ==============================================================================

-- 1. التأكد من وجود أعمدة target_id و target_item_title و related_id في جدول excuses_freezes
ALTER TABLE IF EXISTS public.excuses_freezes
  ADD COLUMN IF NOT EXISTS target_id text,
  ADD COLUMN IF NOT EXISTS related_id text,
  ADD COLUMN IF NOT EXISTS target_item_title text,
  ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'Excuse',
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 2. فهرسة لتسريع الاستعلام والفلترة
CREATE INDEX IF NOT EXISTS idx_excuses_freezes_member_id ON public.excuses_freezes (member_id);
CREATE INDEX IF NOT EXISTS idx_excuses_freezes_target_id ON public.excuses_freezes (target_id);
CREATE INDEX IF NOT EXISTS idx_excuses_freezes_status ON public.excuses_freezes (status);

-- 3. تفعيل المزامنة اللحظية (Realtime) لجدول الأعذار والفريز
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
