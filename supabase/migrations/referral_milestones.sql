-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Amazonギフトマイルストーン管理テーブル
-- 3人/5人/10人招待達成時に記録
-- Supabase Dashboard > SQL Editor で実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.referral_milestones (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        not null references public.users(id) on delete cascade,
  user_name    text,
  user_email   text,
  milestone    int         not null,   -- 3, 5, 10 (人数)
  gift_amount  int         not null,   -- 500, 1000, 1500 (円)
  achieved_at  timestamptz default now(),
  sent_at      timestamptz,            -- null = 未送付
  sent_note    text,                   -- 管理者メモ（送付方法など）
  unique (user_id, milestone)
);

alter table public.referral_milestones enable row level security;

-- 本人は自分の達成状況を見られる
create policy "milestones: 本人参照"
  on public.referral_milestones for select
  using (auth.uid() = user_id);

-- 管理者（service_role）のみ insert/update
