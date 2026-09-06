-- ============================================================
-- تحديث جدول المسابقات الأسبوعية والمشاركات لدعم الأسئلة المتعددة
-- Weekly Quizzes & Submissions Schema Update
-- ============================================================

-- 1. إضافة الأعمدة الجديدة لجدول المسابقات الأسبوعية
ALTER TABLE IF EXISTS public.weekly_quizzes
  ADD COLUMN IF NOT EXISTS title text DEFAULT 'المسابقة الأسبوعية',
  ADD COLUMN IF NOT EXISTS questions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS committee text DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS governorate text DEFAULT 'الغربية',
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT 'إدارة المنصة',
  ADD COLUMN IF NOT EXISTS created_by_role text DEFAULT 'Leader',
  ADD COLUMN IF NOT EXISTS created_by_avatar text DEFAULT '';

ALTER TABLE IF EXISTS public.weekly_challenges
  ADD COLUMN IF NOT EXISTS created_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS creator_role text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS creator_avatar text DEFAULT NULL;

-- تحديث المسابقات القديمة باسم افتراضي في حال خلوها من اسم المنشئ
UPDATE public.weekly_quizzes
SET created_by_name = 'إدارة المنصة'
WHERE created_by_name IS NULL OR created_by_name = '';

-- 2. إنشاء جدول تسجيل إجابات ومشاركات الأعضاء في المسابقات (Quiz Submissions)
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id text PRIMARY KEY,
  quiz_id text REFERENCES public.weekly_quizzes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_avatar text DEFAULT '',
  answers jsonb DEFAULT '[]'::jsonb,
  answer_index integer DEFAULT 0,
  score integer DEFAULT 0,
  total_questions integer DEFAULT 1,
  points_earned integer DEFAULT 0,
  is_correct boolean DEFAULT false,
  submitted_at timestamptz DEFAULT now(),
  governorate text DEFAULT 'الغربية'
);

-- 3. تفعيل الأمان (RLS) وسياسات الوصول المفتوحة
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open access quiz_submissions" ON public.quiz_submissions;
CREATE POLICY "open access quiz_submissions" ON public.quiz_submissions
  FOR ALL USING (true) WITH CHECK (true);

-- 4. تمكين التحديثات اللحظية (Realtime)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_quizzes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_submissions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
