CREATE TABLE play_connection (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  envelope TEXT NOT NULL,
  gcs_bucket TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  checks TEXT
);

CREATE TABLE asc_connection (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  envelope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  checks TEXT
);
