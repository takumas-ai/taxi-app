-- ════════════════════════════════════════════════════
-- 管理者用 RLS ポリシー追加
-- Supabase → SQL Editor に貼り付けて「Run」を押してください
-- NOTE: auth.jwt() を使用（auth.users サブクエリ不可）
-- ════════════════════════════════════════════════════

-- ── 1. users テーブル：管理者は全ユーザーを参照可能 ──
drop policy if exists "users: admin全参照" on public.users;
create policy "users: admin全参照"
  on public.users for select
  using (
    auth.jwt() ->> 'email' = 'white-t@hotmail.co.jp'
    OR auth.uid() = id
  );

-- ── 2. daily_reports テーブル：管理者は全ユーザーの日報を参照可能 ──
drop policy if exists "reports: admin全参照" on public.daily_reports;
create policy "reports: admin全参照"
  on public.daily_reports for select
  using (
    auth.jwt() ->> 'email' = 'white-t@hotmail.co.jp'
    OR auth.uid() = user_id
  );

-- ── 3. feedback テーブル：存在しない場合は作成 ──
create table if not exists public.feedback (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.users(id) on delete set null,
  category    text check (category in ('bug','request','praise','other')) default 'other',
  body        text not null,
  anonymous   boolean default false,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback: 自分のみ挿入" on public.feedback;
create policy "feedback: 自分のみ挿入"
  on public.feedback for insert
  with check (auth.uid() = user_id or anonymous = true);

drop policy if exists "feedback: admin全参照" on public.feedback;
create policy "feedback: admin全参照"
  on public.feedback for select
  using (
    auth.jwt() ->> 'email' = 'white-t@hotmail.co.jp'
  );

drop policy if exists "feedback: admin更新" on public.feedback;
create policy "feedback: admin更新"
  on public.feedback for update
  using (
    auth.jwt() ->> 'email' = 'white-t@hotmail.co.jp'
  );

-- ── 4. usersテーブルに不足カラムを追加（存在しない場合のみ） ──
alter table public.users add column if not exists xp                  integer default 0;
alter table public.users add column if not exists badges              text[]  default '{}';
alter table public.users add column if not exists deletion_requested  boolean default false;
alter table public.users add column if not exists closing_day         integer;
alter table public.users add column if not exists last_active_date    text;
alter table public.users add column if not exists streak_days         integer default 0;
alter table public.users add column if not exists referred_by         text;
alter table public.users add column if not exists referral_code       text unique;
alter table public.users add column if not exists memo_dict           jsonb   default '{}';
alter table public.users add column if not exists upload_reset_month  text;
