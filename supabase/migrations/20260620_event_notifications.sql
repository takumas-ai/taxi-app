-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 終演1時間前プッシュ通知スケジュールテーブル
-- Supabase Dashboard > SQL Editor で実行
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.event_notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  notify_at   TIMESTAMPTZ NOT NULL,
  sent        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_event_notifications_pending
  ON public.event_notifications (notify_at, sent)
  WHERE sent = false;

-- RLS（匿名キーでinsert/delete可、Edge FunctionはService Role Keyで全権限）
ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_notifications_insert" ON public.event_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "event_notifications_delete" ON public.event_notifications
  FOR DELETE USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- cron: 15分ごとに通知チェック
-- （pg_cronとpg_netが有効になっていること）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT cron.unschedule('check-event-notifications')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-event-notifications');

SELECT cron.schedule(
  'check-event-notifications',
  '*/15 * * * *',  -- 15分ごと
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/check-event-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
