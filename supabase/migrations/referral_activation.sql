-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- referral_events に activated_at 追加
-- 招待が「有効」になる条件：招待された人がOCR3枚達成
-- Supabase Dashboard > SQL Editor で実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.referral_events
  add column if not exists activated_at timestamptz;

-- 既存レコード：登録済みなので全件 activated とみなす（移行）
update public.referral_events
  set activated_at = created_at
  where activated_at is null;
