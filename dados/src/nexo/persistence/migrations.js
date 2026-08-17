const ALPHA_FOUNDATION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS nexo_users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_user_address_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES nexo_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('LID', 'PN', 'USERNAME')),
  value TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  UNIQUE (type, value)
);

CREATE TABLE IF NOT EXISTS nexo_groups (
  id TEXT PRIMARY KEY,
  transport_chat_id TEXT NOT NULL UNIQUE,
  name TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK (status IN ('INACTIVE', 'ACTIVE', 'PAUSED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_group_settings (
  group_id TEXT NOT NULL REFERENCES nexo_groups(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, key)
);

CREATE TABLE IF NOT EXISTS nexo_seasons (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES nexo_groups(id) ON DELETE CASCADE,
  template_id TEXT,
  seed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FINALE', 'ENDED', 'ARCHIVED')),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_cycles (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES nexo_seasons(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL CHECK (idx >= 0),
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'ACTIVE', 'CLOSING', 'CLOSED')),
  starts_at TEXT,
  ends_at TEXT,
  UNIQUE (season_id, idx)
);

CREATE TABLE IF NOT EXISTS nexo_world_state (
  season_id TEXT PRIMARY KEY REFERENCES nexo_seasons(id) ON DELETE CASCADE,
  pulse INTEGER NOT NULL DEFAULT 0 CHECK (pulse BETWEEN 0 AND 100),
  cohesion INTEGER NOT NULL DEFAULT 0 CHECK (cohesion BETWEEN 0 AND 100),
  lucidity INTEGER NOT NULL DEFAULT 0 CHECK (lucidity BETWEEN 0 AND 100),
  entropy INTEGER NOT NULL DEFAULT 0 CHECK (entropy BETWEEN 0 AND 100),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_players (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nexo_users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES nexo_groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'LEFT')),
  renown INTEGER NOT NULL DEFAULT 0 CHECK (renown >= 0),
  private_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (private_opt_in IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS nexo_characters (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES nexo_players(id) ON DELETE CASCADE,
  name TEXT,
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 20),
  memory INTEGER NOT NULL DEFAULT 0 CHECK (memory >= 0),
  impulse TEXT,
  scar TEXT,
  oath TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (player_id)
);

CREATE TABLE IF NOT EXISTS nexo_pending_interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  type TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  quoted_message_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_processed_messages (
  message_id TEXT PRIMARY KEY,
  result_ref TEXT,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_game_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS nexo_scheduled_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  aggregate_id TEXT,
  logical_key TEXT NOT NULL UNIQUE,
  run_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nexo_players_group
  ON nexo_players(group_id, status);
CREATE INDEX IF NOT EXISTS idx_nexo_pending_interactions_lookup
  ON nexo_pending_interactions(user_id, chat_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_nexo_game_events_aggregate
  ON nexo_game_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_nexo_outbox_status
  ON nexo_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_nexo_scheduled_jobs_run_at
  ON nexo_scheduled_jobs(state, run_at);
`;

const ENCOUNTER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS nexo_encounters (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES nexo_seasons(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES nexo_groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quest_id TEXT,
  state TEXT NOT NULL DEFAULT 'CREATED' CHECK (state IN (
    'CREATED', 'OPEN_ROUND', 'LOCKING', 'RESOLVING', 'PAUSED',
    'VICTORY', 'DEFEAT', 'ESCAPED', 'CANCELLED'
  )),
  round INTEGER NOT NULL DEFAULT 0 CHECK (round >= 0),
  seed TEXT NOT NULL,
  deadline_at TEXT,
  state_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nexo_action_submissions (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL REFERENCES nexo_encounters(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (encounter_id, round, player_id)
);

CREATE INDEX IF NOT EXISTS idx_nexo_encounters_group_state
  ON nexo_encounters(group_id, state);
CREATE INDEX IF NOT EXISTS idx_nexo_action_submissions_encounter_round
  ON nexo_action_submissions(encounter_id, round);
`;

const CHARACTER_ORIGIN_SQL = `
ALTER TABLE nexo_characters ADD COLUMN origin TEXT;
`;

const MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'nexo_alpha_foundation_schema',
    sql: ALPHA_FOUNDATION_SCHEMA_SQL
  }),
  Object.freeze({
    version: 2,
    name: 'nexo_encounter_schema',
    sql: ENCOUNTER_SCHEMA_SQL
  }),
  Object.freeze({
    version: 3,
    name: 'nexo_character_origin',
    sql: CHARACTER_ORIGIN_SQL
  })
]);

export { MIGRATIONS };
