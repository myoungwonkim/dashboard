CREATE TABLE marketing_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  label TEXT NOT NULL,
  app_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  envelope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  last_sync_at TEXT,
  last_error TEXT
);
CREATE INDEX marketing_accounts_app ON marketing_accounts(app_id);
CREATE INDEX marketing_accounts_platform ON marketing_accounts(platform);

CREATE TABLE marketing_daily (
  app_id TEXT NOT NULL,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  spend REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app_id, source, date)
);
CREATE INDEX marketing_daily_app_date ON marketing_daily(app_id, date);
CREATE INDEX marketing_daily_source_date ON marketing_daily(source, date);
