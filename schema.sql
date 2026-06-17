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
  avatar_preset         text,       -- プリセットアバターID (例: "owl", "lion" など)
  avatar_url            text,       -- カスタム写真URL (Supabase Storage)
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- 既存テーブルへのカラム追加（初回実行後に追加する場合）
alter table public.users add column if not exists avatar_preset text;
alter table public.users add column if not exists avatar_url    text;

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
  dispatch_type     text,                      -- 配車アプリ・無線の種類（例: GO, S.RIDE, 東京無線）
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

-- アバター画像バケット（公開：imgタグで直接表示するため）
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
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

-- avatarsバケットRLS（公開バケットだが書き込みは本人のみ）
create policy "avatars: 自分のファイルのみ挿入"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: 自分のファイルのみ更新"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: 全員が参照可（公開）"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

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
-- 9. feedback テーブル（意見箱）
-- ─────────────────────────────────────────
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

-- 一般ユーザー: 自分の意見のみ挿入可
create policy "feedback: 自分のみ挿入"
  on public.feedback for insert
  with check (auth.uid() = user_id or anonymous = true);

-- 管理者: 全件参照・更新（管理者のメールアドレスで判定）
create policy "feedback: 管理者は全件参照"
  on public.feedback for select
  using (
    auth.uid() = user_id
    or auth.email() = 'white-t@hotmail.co.jp'
  );

create policy "feedback: 管理者は更新可"
  on public.feedback for update
  using (auth.email() = 'white-t@hotmail.co.jp');

-- ─────────────────────────────────────────
-- 10. notifications テーブル（お知らせ）
-- ─────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text not null,
  area        text,
  severity    text check (severity in ('info','warning','alert')) default 'info',
  created_at  timestamptz default now()
);

alter table public.notifications enable row level security;

-- 全認証ユーザーが参照可
create policy "notifications: 認証ユーザーは参照可"
  on public.notifications for select
  using (auth.role() = 'authenticated');

-- 管理者のみ挿入・更新可
create policy "notifications: 管理者は挿入可"
  on public.notifications for insert
  with check (auth.email() = 'white-t@hotmail.co.jp');

-- ─────────────────────────────────────────
-- 11. users テーブル: 管理者用 RLS 追加
-- ─────────────────────────────────────────
-- 管理者は全ユーザーを参照可能（auth.email() でJWTから直接取得 → 再帰RLSなし）
-- ※ 既存の "users: 自分のみ参照" と OR で評価される（どちらか満たせばOK）
drop policy if exists "users: 管理者は全件参照" on public.users;
create policy "users: 管理者は全件参照"
  on public.users for select
  using (
    auth.uid() = id
    or auth.email() = 'white-t@hotmail.co.jp'
  );

-- 管理者は任意のユーザーを更新可
drop policy if exists "users: 管理者は全件更新" on public.users;
create policy "users: 管理者は全件更新"
  on public.users for update
  using (
    auth.uid() = id
    or auth.email() = 'white-t@hotmail.co.jp'
  );

-- ─────────────────────────────────────────
-- 12. 追加カラム（マイグレーション）
-- ─────────────────────────────────────────
alter table public.users add column if not exists referred_by         text;             -- 登録時に使った招待コード（誰に招待されたか）
alter table public.users add column if not exists referral_code       text unique;      -- 自分の招待コード（TK-XXXXXX）
alter table public.users add column if not exists free_period_ends_at timestamptz;      -- 無料期間終了日
alter table public.users add column if not exists xp                  integer default 0;
alter table public.users add column if not exists badges              text[]  default '{}';
alter table public.users add column if not exists deletion_requested  boolean default false;
alter table public.users add column if not exists closing_day         integer;          -- 締日（0=月末、5/10/15/20/25）
alter table public.users add column if not exists last_active_date    text;
alter table public.users add column if not exists streak_days         integer default 0;

-- ─────────────────────────────────────────
-- 12b. referral_events テーブル（紹介イベント不変ログ）
-- ─────────────────────────────────────────
create table if not exists public.referral_events (
  id             uuid primary key default uuid_generate_v4(),
  referrer_id    uuid references public.users(id) on delete set null, -- 招待した人（削除されても記録は残す）
  referred_id    uuid unique references public.users(id) on delete set null, -- 招待された人（1人1回のみ）
  referral_code  text not null,    -- 使われたコード（非正規化、削除後も参照可）
  referrer_name  text,             -- 招待した人の名前（非正規化）
  referred_name  text,             -- 招待された人の名前（非正規化）
  created_at     timestamptz default now()
);

-- RLS
alter table public.referral_events enable row level security;
create policy "referral_events: 本人は参照可"
  on public.referral_events for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);
create policy "referral_events: サービス挿入のみ"
  on public.referral_events for insert
  with check (auth.uid() = referred_id); -- 登録者本人が挿入

-- ─────────────────────────────────────────
-- 12c. coupons テーブル（クーポン台帳）
-- ─────────────────────────────────────────
create table if not exists public.coupons (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  code           text unique not null,  -- EXT-XXXXXX形式
  type           text not null check (type in ('invited', 'milestone')),
  benefit_days   integer not null,      -- 延長日数（14 or 30）
  milestone_at   integer,               -- 何人目で発行か（1, 3, 6, 9...）NULL=invited
  issued_reason  text,                  -- 説明文（ログ・通知用）
  issued_at      timestamptz default now(),
  used_at        timestamptz,           -- NULL = 未使用
  expires_at     timestamptz            -- NULL = 無期限
);

-- RLS
alter table public.coupons enable row level security;
create policy "coupons: 本人のみ参照"
  on public.coupons for select using (auth.uid() = user_id);
create policy "coupons: サービス挿入"
  on public.coupons for insert with check (auth.uid() = user_id);
create policy "coupons: 本人のみ更新（使用時）"
  on public.coupons for update using (auth.uid() = user_id);

-- 紹介数カウント用RPC（RLSをバイパスしてcountのみ返す）
create or replace function count_referrals(ref_code text)
returns integer language sql security definer as $$
  select count(*)::integer from public.referral_events where referral_code = ref_code;
$$;

-- 招待コード生成用RPC（重複チェック付き）
create or replace function generate_referral_code(user_id uuid)
returns text language plpgsql security definer as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 紛らわしい文字除外
  code text;
  exists bool;
begin
  loop
    code := 'TK-';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.users where referral_code = code) into exists;
    exit when not exists;
  end loop;
  update public.users set referral_code = code where id = user_id;
  return code;
end;
$$;

-- マイルストーン確認・クーポン自動発行RPC
create or replace function check_referral_milestone(referrer_id_input uuid)
returns json language plpgsql security definer as $$
declare
  total_count integer;
  already_issued integer;
  new_milestone integer;
  benefit integer;
  coupon_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result json;
begin
  -- 累計紹介数
  select count(*)::integer into total_count
    from public.referral_events where referrer_id = referrer_id_input;

  -- 発行済みマイルストーンの最大値
  select coalesce(max(milestone_at), 0) into already_issued
    from public.coupons where user_id = referrer_id_input and type = 'milestone';

  -- 次のマイルストーン判定（1, 3, 6, 9, 12...）
  if total_count >= 1 and already_issued < 1 then
    new_milestone := 1; benefit := 14;
  elsif total_count >= 3 and already_issued < 3 then
    new_milestone := 3; benefit := 30;
  elsif total_count >= 6 and already_issued < 6 then
    new_milestone := 6; benefit := 30;
  elsif total_count >= 9 and already_issued < 9 then
    new_milestone := 9; benefit := 30;
  elsif total_count >= 12 and already_issued < 12 then
    new_milestone := 12; benefit := 30;
  else
    return json_build_object('issued', false, 'total', total_count);
  end if;

  -- クーポンコード生成（EXT-XXXXXX）
  coupon_code := 'EXT-';
  for i in 1..6 loop
    coupon_code := coupon_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;

  -- クーポン発行
  insert into public.coupons (user_id, code, type, benefit_days, milestone_at, issued_reason)
    values (referrer_id_input, coupon_code, 'milestone', benefit, new_milestone,
      new_milestone || '人招待達成！' || benefit || '日延長クーポン');

  return json_build_object('issued', true, 'milestone', new_milestone, 'benefit_days', benefit, 'coupon_code', coupon_code, 'total', total_count);
end;
$$;

-- ─────────────────────────────────────────
-- 13. ride_records テーブル（乗車記録）
-- ─────────────────────────────────────────
create table if not exists public.ride_records (
  id               text      primary key,          -- クライアント生成ID（Date.now()+random）
  user_id          uuid      not null references public.users(id) on delete cascade,
  work_date        date,
  boarding_time    timestamptz,
  pickup_location  text,
  dropoff_time     timestamptz,
  dropoff_location text,
  passengers       integer,
  fare             integer   not null default 0,
  highway_fee      integer,
  payment_method   text,
  boarding_method  text,
  memo             text,
  lat              numeric(10,7),
  lng              numeric(10,7),
  created_at       timestamptz default now()
);

alter table public.ride_records enable row level security;

create policy "ride_records: 自分のみ参照"
  on public.ride_records for select
  using (auth.uid() = user_id);

create policy "ride_records: 自分のみ挿入"
  on public.ride_records for insert
  with check (auth.uid() = user_id);

create policy "ride_records: 自分のみ更新"
  on public.ride_records for update
  using (auth.uid() = user_id);

create policy "ride_records: 自分のみ削除"
  on public.ride_records for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 8. guide_spots（ガイド：コミュニティ投稿型スポット）
-- ─────────────────────────────────────────
create table if not exists public.guide_spots (
  id               uuid         default gen_random_uuid() primary key,
  category         text         not null check (category in ('stand','airport','rest','food')),
  subcategory      text,        -- stand: station/hotel/hospital/commercial
  name             text         not null,
  area             text         not null,
  emoji            text         default '📍',
  tags             text[]       default '{}',
  peak             text,
  lineup           text,        -- 並び方ルール（stand/airport）
  tips             text[]       default '{}',
  caution          text,
  access_note      text,        -- 進入路（airport）
  flow             text[]       default '{}', -- 入港ステップ（airport）
  description      text,        -- rest/food 用メインテキスト
  address          text,
  has_parking      boolean      default false,
  open_hours       text,
  demand_score     numeric(3,1) default 3.0,
  rating           numeric(3,1) default 0,
  review_count     int          default 0,
  favorite_count   int          default 0,
  flag_count       int          default 0,
  status           text         default 'active' check (status in ('active','flagged')),
  contributor_id   uuid         references public.users(id) on delete set null,
  contributor_name text,
  created_at       timestamptz  default now(),
  updated_at       timestamptz  default now()
);

-- 編集履歴（Wikipedia 方式）
create table if not exists public.guide_edits (
  id          uuid        default gen_random_uuid() primary key,
  spot_id     uuid        not null references public.guide_spots(id) on delete cascade,
  editor_id   uuid        references public.users(id) on delete set null,
  editor_name text,
  changes     jsonb       not null,  -- { field: { old: "...", new: "..." } }
  created_at  timestamptz default now()
);

-- レビュー（1ユーザー1スポット1件）
create table if not exists public.guide_reviews (
  id         uuid        default gen_random_uuid() primary key,
  spot_id    uuid        not null references public.guide_spots(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  user_name  text,
  rating     int         not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz default now(),
  unique (spot_id, user_id)
);

-- フラグ（不正確な情報の報告）
create table if not exists public.guide_flags (
  id         uuid        default gen_random_uuid() primary key,
  spot_id    uuid        not null references public.guide_spots(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  reason     text,
  created_at timestamptz default now(),
  unique (spot_id, user_id)
);

alter table public.guide_spots   enable row level security;
alter table public.guide_edits   enable row level security;
alter table public.guide_reviews enable row level security;
alter table public.guide_flags   enable row level security;

-- guide_spots RLS
create policy "guide_spots: active は全員参照"
  on public.guide_spots for select using (status = 'active');
create policy "guide_spots: ログイン済みが投稿"
  on public.guide_spots for insert with check (auth.uid() is not null);
create policy "guide_spots: ログイン済みが更新"
  on public.guide_spots for update using (auth.uid() is not null);

-- guide_edits RLS
create policy "guide_edits: 全員参照"
  on public.guide_edits for select using (true);
create policy "guide_edits: ログイン済みが挿入"
  on public.guide_edits for insert with check (auth.uid() is not null);

-- guide_reviews RLS
create policy "guide_reviews: 全員参照"
  on public.guide_reviews for select using (true);
create policy "guide_reviews: 自分のみ挿入"
  on public.guide_reviews for insert with check (auth.uid() = user_id);
create policy "guide_reviews: 自分のみ削除"
  on public.guide_reviews for delete using (auth.uid() = user_id);

-- guide_flags RLS
create policy "guide_flags: ログイン済みが参照"
  on public.guide_flags for select using (auth.uid() is not null);
create policy "guide_flags: 自分のみ挿入"
  on public.guide_flags for insert with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 完了
-- ─────────────────────────────────────────
-- 実行後の確認:
--   select * from public.users;
--   select * from public.daily_reports limit 5;
--   select * from public.ride_records limit 5;
--   select * from public.guide_spots limit 5;
