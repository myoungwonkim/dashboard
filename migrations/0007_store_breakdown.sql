CREATE TABLE store_dim (
  app_id TEXT NOT NULL,
  source TEXT NOT NULL,
  dim TEXT NOT NULL,
  key TEXT NOT NULL,
  date TEXT NOT NULL,
  installs INTEGER,
  rating_avg REAL,
  visitors INTEGER,
  page_views INTEGER,
  conversions INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app_id, source, dim, key, date)
);
CREATE INDEX store_dim_lookup ON store_dim(app_id, source, dim, date);

CREATE TABLE store_perf_daily (
  app_id TEXT NOT NULL,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  store_listing_visitors INTEGER,
  store_listing_acquisitions INTEGER,
  conversion_rate REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app_id, source, date)
);

CREATE TABLE asc_report_requests (
  id TEXT PRIMARY KEY,
  apple_app_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  access_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_checked_at TEXT,
  status TEXT
);
