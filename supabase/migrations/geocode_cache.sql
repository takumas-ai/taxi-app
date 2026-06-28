-- ジオコーディング結果キャッシュ（全ユーザー共有）
CREATE TABLE IF NOT EXISTS geocode_cache (
  address TEXT PRIMARY KEY,
  lat     DOUBLE PRECISION NOT NULL,
  lng     DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 全員が読める、書き込みはService Role（Edge Function）のみ
ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read geocode cache"
  ON geocode_cache FOR SELECT USING (true);
