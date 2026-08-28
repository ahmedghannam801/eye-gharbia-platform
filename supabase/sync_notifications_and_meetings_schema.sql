-- ============================================================
-- EYE Workflow Hub — Optimization & Realtime Sync for Notifications & Meetings
-- ============================================================

-- 1. التأكد من وجود وتحديث جدول الإشعارات (notifications)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text,
  type text default 'info' check (type in ('info','success','warning','error')),
  is_read boolean default false,
  created_at timestamptz default now(),
  related_id text
);

-- إضافة أي أعمدة قد تكون ناقصة في جدول الإشعارات
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='related_id') then
    alter table public.notifications add column related_id text;
  end if;
end $$;

-- 2. التأكد من وجود وتحديث جدول الاجتماعات (meetings)
create table if not exists public.meetings (
  id text primary key,
  title text not null,
  description text,
  type text not null default 'General',
  committee text default 'All',
  department text default 'All',
  scheduled_at timestamptz not null,
  location text,
  expected_attendees_count integer,
  created_by uuid,
  created_by_name text,
  created_at timestamptz default now(),
  status text not null default 'Scheduled',
  attendance_code text not null,
  governorate text default 'الغربية'
);

-- إضافة أي أعمدة قد تكون ناقصة في جدول الاجتماعات
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='meetings' and column_name='governorate') then
    alter table public.meetings add column governorate text default 'الغربية';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='meetings' and column_name='expected_attendees_count') then
    alter table public.meetings add column expected_attendees_count integer;
  end if;
end $$;

-- 3. تفعيل الفهارس (Indexes) لسرعة جلب الإشعارات والاجتماعات
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_meetings_committee on public.meetings(committee);

-- 4. ضبط وتحديث سياسات الأمان (RLS Policies)
alter table public.notifications enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;

-- حذف السياسات القديمة لمنع التكرار
drop policy if exists "allow all access to notifications" on public.notifications;
drop policy if exists "open access meetings" on public.meetings;
drop policy if exists "open access attendance" on public.attendance;

-- إنشاء سياسات الوصول الشاملة
create policy "allow all access to notifications" on public.notifications for all using (true) with check (true);
create policy "open access meetings" on public.meetings for all using (true) with check (true);
create policy "open access attendance" on public.attendance for all using (true) with check (true);

-- 5. تفعيل الاستماع اللحظي (Realtime) للإشعارات والاجتماعات
do $$
begin
  alter publication supabase_realtime add table public.notifications, public.meetings, public.attendance;
exception
  when others then null;
end $$;
