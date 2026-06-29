-- OCRコスト記録テーブル
-- Supabase Dashboard > SQL Editor で実行してください

create table if not exists ocr_usage_logs (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  created_at    timestamptz default now(),
  model         text        default 'claude-sonnet-4-6',
  input_tokens  int         not null,
  output_tokens int         not null,
  input_cost_usd  numeric(10, 8) not null,
  output_cost_usd numeric(10, 8) not null,
  total_cost_usd  numeric(10, 8) not null
);

-- インデックス（ユーザー×日付で集計しやすくする）
create index ocr_usage_logs_user_created on ocr_usage_logs (user_id, created_at desc);

-- RLS: ユーザー自身のレコードのみ参照可
alter table ocr_usage_logs enable row level security;

create policy "users can view own ocr logs"
  on ocr_usage_logs for select
  using (auth.uid() = user_id);

-- Edge Function（service_role）は RLS をバイパスして insert できる
-- （service_role_key を使っているので追加設定不要）
