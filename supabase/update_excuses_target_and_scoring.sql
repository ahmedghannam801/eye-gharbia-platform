-- ==============================================================================
-- 🚀 تحديث جدول الأعذار والفريز لدعم تحديد الاجتماع أو المهمة بدقة (target_id)
-- متوافق تماماً مع أي بنية سابقة (user_id / member_id)
-- ==============================================================================

-- 1. التأكد من وجود كافة الأعمدة المطلوبة بما فيها user_id, member_id, target_id
ALTER TABLE IF EXISTS public.excuses_freezes
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS member_id text,
  ADD COLUMN IF NOT EXISTS member_name text,
  ADD COLUMN IF NOT EXISTS target_id text,
  ADD COLUMN IF NOT EXISTS related_id text,
  ADD COLUMN IF NOT EXISTS target_item_title text,
  ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'Excuse',
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS date text,
  ADD COLUMN IF NOT EXISTS start_date text,
  ADD COLUMN IF NOT EXISTS end_date text,
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية';

-- 2. إنشاء الفهارس بشكل آمن وديناميكي بدون أي خطأ
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'excuses_freezes' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_excuses_freezes_user_id ON public.excuses_freezes (user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'excuses_freezes' AND column_name = 'member_id') THEN
    CREATE INDEX IF NOT EXISTS idx_excuses_freezes_member_id ON public.excuses_freezes (member_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'excuses_freezes' AND column_name = 'target_id') THEN
    CREATE INDEX IF NOT EXISTS idx_excuses_freezes_target_id ON public.excuses_freezes (target_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'excuses_freezes' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_excuses_freezes_status ON public.excuses_freezes (status);
  END IF;
END $$;

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
