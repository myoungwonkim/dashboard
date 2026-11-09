CREATE TABLE dashboard_sessions (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, credential_version TEXT NOT NULL);
CREATE INDEX dashboard_sessions_expiry ON dashboard_sessions(expires_at);
CREATE TABLE dashboard_attempts (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX dashboard_attempts_expiry ON dashboard_attempts(expires_at);
