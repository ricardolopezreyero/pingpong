CREATE TABLE IF NOT EXISTS user_data (
  google_sub  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  picture     TEXT DEFAULT '',
  liga_data   TEXT DEFAULT '{"jugadores":{},"sesiones":[]}',
  updated_at  INTEGER DEFAULT 0
);
