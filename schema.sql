-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- タクシー日報AI — Supabase スキーマ v3.0
-- Supabase Dashboard > SQL Editor に貼り付けて実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────
-- 拡張機能
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- 1. users テーブル
-- ─────────────────────────────────────────
create table if not exists public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  name                  text not null,
  email                 text,
  company_name          text,
  work_type             text check (work_type in ('日勤','夜勤','隔日勤務','個人タクシー')),
  areas                 text[]    default '{}',
  monthly_target        integer   default 380000,
  plan                  text      default 'free' check (plan in ('free','paid')),
  plan_expires_at       timestamptz,
  monthly_upload_count  integer   default 0,
  rank_show_my_rank     boolean   default false,
  rank_show_top_sales   boolean   default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- 月初にupload_countをリセットするトリガー用関数
create or replace function reset_monthly_upload_count()
returns trigger language plpgsql as $$
begin
  -- Edge Function (pg_cron) から毎月1日0時に呼ぶ想定。ここは空実装。
  return new;
end;
$$;

-- ─────────────────────────────────────────
-- 2. daily_reports テーブル
-- ─────────────────────────────────────────
create table if not exists public.daily_reports (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  report_date       date not null,
  gross_sales       integer not null,
  cash_sales        integer,
  card_sales        integer,
  app_sales         integer,
  highway_fee       integer,
  ride_count        integer,
  total_distance    integer,
  occupied_distance integer,               -- 両社とも現状null
  work_hours        numeric(4,1),
  break_hours       numeric(4,1),
  format_type       text check (format_type in (
                      'mismatsu_simple','mismatsu_full','greencab','manual','unknown'
                    )),
  confidence_score  integer check (confidence_score between 0 and 100),
  raw_ocr_fields    jsonb,
  image_url         text,
  ai_comment        text,
  trouble_note      text,
  work_area         text,                      -- 営業メインエリア（例: 港区, 中区（横浜））
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (user_id, report_date)             -- 同日の重複登録を防止
);

-- ─────────────────────────────────────────
-- 3. daily_summaries テーブル（翌日発表）
-- ─────────────────────────────────────────
create table if not exists public.daily_summaries (
  id             uuid primary key default uuid_generate_v4(),
  summary_date   date not null unique,
  announce_date  date not null,            -- 発表日（summary_date + 1）
  total_drivers  integer,
  area_stats     jsonb,                    -- [{area, avg, count, trend}]
  top_sales      jsonb,                    -- [{rank, driver_code, area, sales}]
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- 4. shifts テーブル（シフト管理）
-- ─────────────────────────────────────────
create table if not exists public.shifts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  shift_date  date not null,
  clock_in    text,                        -- "HH:MM"
  clock_out   text,                        -- "HH:MM" or "翌HH:MM"
  is_night    boolean default false,
  note        text,
  created_at  timestamptz default now(),
  unique (user_id, shift_date)
);

-- ─────────────────────────────────────────
-- 5. updated_at 自動更新トリガー
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at         on public.users;
drop trigger if exists trg_daily_reports_updated_at on public.daily_reports;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

create trigger trg_daily_reports_updated_at
  before update on public.daily_reports
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- 6. RLS（Row Level Security）
-- ─────────────────────────────────────────

-- users
alter table public.users enable row level security;

create policy "users: 自分のみ参照"
  on public.users for select
  using (auth.uid() = id);

create policy "users: 自分のみ更新"
  on public.users for update
  using (auth.uid() = id);

create policy "users: 自分のみ挿入"
  on public.users for insert
  with check (auth.uid() = id);

-- daily_reports
alter table public.daily_reports enable row level security;

create policy "reports: 自分のみ参照"
  on public.daily_reports for select
  using (auth.uid() = user_id);

create policy "reports: 自分のみ挿入"
  on public.daily_reports for insert
  with check (auth.uid() = user_id);

create policy "reports: 自分のみ更新"
  on public.daily_reports for update
  using (auth.uid() = user_id);

create policy "reports: 自分のみ削除"
  on public.daily_reports for delete
  using (auth.uid() = user_id);

-- daily_summaries（全員が読めるが書けない）
alter table public.daily_summaries enable row level security;

create policy "summaries: 認証ユーザーは参照可"
  on public.daily_summaries for select
  using (auth.role() = 'authenticated');

-- shifts
alter table public.shifts enable row level security;

create policy "shifts: 自分のみ参照"
  on public.shifts for select
  using (auth.uid() = user_id);

create policy "shifts: 自分のみ挿入"
  on public.shifts for insert
  with check (auth.uid() = user_id);

create policy "shifts: 自分のみ更新"
  on public.shifts for update
  using (auth.uid() = user_id);

create policy "shifts: 自分のみ削除"
  on public.shifts for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 7. Storage バケット
-- ─────────────────────────────────────────
-- Supabase Dashboard > Storage > New Bucket で作成するか、
-- 下記SQL（Supabase管理API経由）で作成
insert into storage.buckets (id, name, public)
  values ('report-images', 'report-images', false)
  on conflict (id) do nothing;

-- Storage RLS: 自分のフォルダのみ読み書き可
create policy "report-images: 自分のフォルダのみ挿入"
  on storage.objects for insert
  with check (
    bucket_id = 'report-images'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "report-images: 自分のフォルダのみ参照"
  on storage.objects for select
  using (
    bucket_id = 'report-images'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

-- ─────────────────────────────────────────
-- 8. 新規ユーザー登録時に users レコードを自動作成
-- ─────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────
-- 9. 追加カラム（マイグレーション）
-- ─────────────────────────────────────────
alter table public.users add column if not exists referred_by      text;          -- 紹介コード（招待した人のコード）
alter table public.users add column if not exists xp               integer default 0;
alter table public.users add column if not exists badges           text[]  default '{}';
alter table public.users add column if not exists deletion_requested boolean default false;

-- 紹介数カウント用RPC（RLSをバイパスしてcountのみ返す）
create or replace function count_referrals(ref_code text)
returns integer language sql security definer as $$
  select count(*)::integer from public.users where referred_by = ref_code;
$$;

-- ─────────────────────────────────────────
-- 完了
-- ─────────────────────────────────────────
-- 実行後の確認:
--   select * from public.users;
--   select * from public.daily_reports limit 5;
