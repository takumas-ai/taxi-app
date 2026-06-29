-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 東京イベントテーブル
-- Supabase Dashboard > SQL Editor で実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.events (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date          DATE NOT NULL,
  title               TEXT NOT NULL,
  venue               TEXT NOT NULL,
  start_time          TEXT,
  event_type          TEXT NOT NULL DEFAULT 'other'
                        CHECK (event_type IN ('baseball', 'concert', 'sports', 'other')),
  estimated_capacity  INTEGER DEFAULT 1000,
  priority            INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  access_info         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- インデックス（日付検索の高速化）
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date);

-- RLS（全ユーザーが読み取り可能、書き込みはService Role Keyのみ）
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_all" ON public.events
  FOR SELECT USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Web Push 購読テーブル
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 自分の購読のみ操作可能
CREATE POLICY "push_sub_select" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_sub_insert" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_sub_delete" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Supabase Cron設定（毎朝5:00 JST = 20:00 UTC）
-- Dashboard > Database > Extensions で pg_cron を有効化後に実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- pg_cron拡張の確認
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- cron登録（既存があれば削除してから追加）
SELECT cron.unschedule('fetch-tokyo-events') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fetch-tokyo-events'
);

-- ① イベント取得（JST 5:00）
SELECT cron.schedule(
  'fetch-tokyo-events',
  '0 20 * * *',  -- 毎日 UTC 20:00 = JST 05:00
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/fetch-events',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ② Push通知送信（JST 5:05）
SELECT cron.unschedule('send-event-push') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-event-push'
);

SELECT cron.schedule(
  'send-event-push',
  '5 20 * * *',  -- 毎日 UTC 20:05 = JST 05:05
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-event-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
