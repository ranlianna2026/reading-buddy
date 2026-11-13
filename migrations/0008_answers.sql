CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  kid_id TEXT NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  reading_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  verdict TEXT NOT NULL,
  word TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX answers_kid ON answers(kid_id, kind);
