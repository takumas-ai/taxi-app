-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- シフト共有申請 & ユーザー表示ID
-- Supabase Dashboard > SQL Editor で実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. users テーブルに display_id を追加（英数字6文字、プレフィックスなし）
alter table public.users add column if not exists display_id text unique;

-- 既存ユーザーに一括生成（UUIDの先頭6文字を大文字英数字で使用）
update public.users
set display_id = upper(substring(replace(id::text, '-', ''), 1, 6))
where display_id is null;

-- 新規ユーザー作成トリガーに display_id を追加
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, name, email, display_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    upper(substring(replace(new.id::text, '-', ''), 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. shift_share_requests テーブル
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists public.shift_share_requests (
  id           uuid        default gen_random_uuid() primary key,
  from_user_id uuid        not null references public.users(id) on delete cascade,
  to_user_id   uuid        not null references public.users(id) on delete cascade,
  status       text        default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz default now(),
  unique (from_user_id, to_user_id)
);

alter table public.shift_share_requests enable row level security;

create policy "shift_share: 関係者のみ参照"
  on public.shift_share_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "shift_share: 自分が送信"
  on public.shift_share_requests for insert
  with check (auth.uid() = from_user_id);

create policy "shift_share: 受け取った側が承認・拒否"
  on public.shift_share_requests for update
  using (auth.uid() = to_user_id);

create policy "shift_share: 関係者が削除"
  on public.shift_share_requests for delete
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. friend_requests テーブル（フレンド申請・承認フロー）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists public.friend_requests (
  id           uuid        default gen_random_uuid() primary key,
  from_user_id uuid        not null references public.users(id) on delete cascade,
  to_user_id   uuid        not null references public.users(id) on delete cascade,
  status       text        default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz default now(),
  unique (from_user_id, to_user_id)
);

alter table public.friend_requests enable row level security;

create policy "friend_req: 関係者のみ参照"
  on public.friend_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "friend_req: 自分が送信"
  on public.friend_requests for insert
  with check (auth.uid() = from_user_id);

create policy "friend_req: 受け取った側が承認・拒否"
  on public.friend_requests for update
  using (auth.uid() = to_user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 確認
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
select id, name, display_id from public.users limit 10;
