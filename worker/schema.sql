CREATE TABLE IF NOT EXISTS user_data (
  google_sub  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  picture     TEXT DEFAULT '',
  liga_data   TEXT DEFAULT '{"jugadores":{},"sesiones":[]}',
  -- Ligas completas (torneos con partidos) para sincronizar entre computadoras
  ligas_data  TEXT DEFAULT '',
  updated_at  INTEGER DEFAULT 0
);
