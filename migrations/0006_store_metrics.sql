CREATE TABLE store_daily (
  app_id TEXT NOT NULL,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  installs INTEGER,
  uninstalls INTEGER,
  upgrades INTEGER,
  rating_avg REAL,
  rating_count INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app_id, source, date)
);
CREATE INDEX store_daily_app_source_date ON store_daily(app_id, source, date);

CREATE TABLE store_batch_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  detail TEXT
);
