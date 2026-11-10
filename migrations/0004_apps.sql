CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  firebase_project_id TEXT,
  ga4_property_id TEXT,
  android_pkg TEXT,
  ios_bundle_id TEXT,
  apple_app_id TEXT,
  admob_android_app_id TEXT,
  admob_ios_app_id TEXT,
  af_android_id TEXT,
  af_ios_id TEXT,
  checks TEXT,
  checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX apps_status ON apps(status);

INSERT INTO apps (
  id, name, symbol, status,
  firebase_project_id, ga4_property_id, android_pkg,
  admob_android_app_id, admob_ios_app_id,
  created_at, updated_at
) VALUES
 (
  'bazi', '읽어주는 만세력', '命', 'active',
  'bazi-ea78b', '550050295', 'com.nolsoopgames.bazi',
  'ca-app-pub-4999376453226791~5692726639', 'ca-app-pub-4999376453226791~2304842432',
  '2026-11-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z'
 ),
 (
  'sudoku', '스도쿠 마스터', '9', 'active',
  'sudoku-master-8998c', '558243778', 'com.nolsoopgames.sudoku',
  'ca-app-pub-4999376453226791~7315994561', 'ca-app-pub-4999376453226791~2158003782',
  '2026-11-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z'
 );
