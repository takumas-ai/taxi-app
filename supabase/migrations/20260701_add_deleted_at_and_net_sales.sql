-- ゴミ箱機能用 deleted_at カラム追加（ソフトデリート・30日保持）
alter table public.daily_reports
  add column if not exists deleted_at timestamptz default null;

-- OCR net_sales（税抜売上）カラム追加
alter table public.daily_reports
  add column if not exists net_sales integer default null;

-- adjustment（調整額）カラム追加
alter table public.daily_reports
  add column if not exists adjustment integer default null;

-- deleted_at のインデックス（ゴミ箱一覧取得を高速化）
create index if not exists idx_daily_reports_deleted_at
  on public.daily_reports (user_id, deleted_at)
  where deleted_at is not null;
