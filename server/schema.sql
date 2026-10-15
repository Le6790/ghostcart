CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY,
  login      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entries (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category     TEXT NOT NULL,
  note         TEXT,
  skipped_at   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'skipped' CHECK (status IN ('tempted', 'skipped', 'bought')),
  decide_by    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS entries_user_skipped ON entries(user_id, skipped_at);

-- A user has at most one 'active' goal (enforced by goals_one_active, created in db.ts after migration).
-- completed/removed goals are history and can be restored while no goal is active.
CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  started_at   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'removed')),
  ended_at     TEXT,
  saved_cents  INTEGER,                 -- snapshot taken when completed/removed; live for active goals
  offset_cents INTEGER NOT NULL DEFAULT 0 -- savings already credited to the goal completed the same day
);
