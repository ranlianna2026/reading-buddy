CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  label TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX credentials_user ON credentials(user_id);

CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE kids (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  hearts INTEGER NOT NULL DEFAULT 5,
  hearts_at INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  streak_day TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX kids_user ON kids(user_id);

CREATE TABLE readings (
  id TEXT PRIMARY KEY,
  kid_id TEXT NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  words INTEGER NOT NULL DEFAULT 0,
  wcpm INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  comprehension INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX readings_kid ON readings(kid_id, created_at);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  kid_id TEXT NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  note TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL
);
CREATE INDEX memories_kid ON memories(kid_id, kind, weight);
CREATE UNIQUE INDEX memories_subject ON memories(kid_id, kind, subject);
