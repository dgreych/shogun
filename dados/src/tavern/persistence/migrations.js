const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tavern_groups (
  group_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  tavern_level INTEGER NOT NULL DEFAULT 1 CHECK (tavern_level >= 1),
  tavern_xp INTEGER NOT NULL DEFAULT 0 CHECK (tavern_xp >= 0),
  season_id TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  boss_progress_json TEXT NOT NULL DEFAULT '{}',
  collective_quests_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_players (
  player_id TEXT PRIMARY KEY,
  display_name TEXT,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  active_class_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_group_members (
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, player_id)
);

CREATE TABLE IF NOT EXISTS tavern_cards (
  card_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  class_id TEXT,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  attack INTEGER,
  health INTEGER,
  definition_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_collections (
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES tavern_cards(card_id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  locked_quantity INTEGER NOT NULL DEFAULT 0 CHECK (locked_quantity >= 0 AND locked_quantity <= quantity),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, card_id)
);

CREATE TABLE IF NOT EXISTS tavern_decks (
  deck_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  group_id TEXT REFERENCES tavern_groups(group_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (player_id, name)
);

CREATE TABLE IF NOT EXISTS tavern_deck_cards (
  deck_id TEXT NOT NULL REFERENCES tavern_decks(deck_id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES tavern_cards(card_id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (deck_id, card_id)
);

CREATE TABLE IF NOT EXISTS tavern_matches (
  match_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id),
  player_one_id TEXT NOT NULL REFERENCES tavern_players(player_id),
  player_two_id TEXT NOT NULL REFERENCES tavern_players(player_id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  seed TEXT NOT NULL,
  active_player_id TEXT,
  turn_number INTEGER NOT NULL DEFAULT 0,
  deadline_at TEXT,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS tavern_match_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL REFERENCES tavern_matches(match_id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  message_id TEXT,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (match_id, sequence),
  UNIQUE (match_id, message_id)
);

CREATE TABLE IF NOT EXISTS tavern_match_snapshots (
  match_id TEXT NOT NULL REFERENCES tavern_matches(match_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (match_id, version)
);

CREATE TABLE IF NOT EXISTS tavern_seasons (
  season_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tavern_rankings (
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES tavern_seasons(season_id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  rating REAL NOT NULL DEFAULT 1500,
  deviation REAL NOT NULL DEFAULT 350,
  volatility REAL NOT NULL DEFAULT 0.06,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  best_rank TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, season_id, player_id)
);

CREATE TABLE IF NOT EXISTS tavern_packs (
  pack_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  opened_at TEXT
);

CREATE TABLE IF NOT EXISTS tavern_currencies (
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, currency)
);

CREATE TABLE IF NOT EXISTS tavern_trades (
  trade_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  proposer_id TEXT NOT NULL REFERENCES tavern_players(player_id),
  receiver_id TEXT NOT NULL REFERENCES tavern_players(player_id),
  status TEXT NOT NULL,
  proposer_offer_json TEXT NOT NULL DEFAULT '[]',
  receiver_offer_json TEXT NOT NULL DEFAULT '[]',
  proposer_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (proposer_confirmed IN (0, 1)),
  receiver_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (receiver_confirmed IN (0, 1)),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_quests (
  quest_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tavern_player_quests (
  player_id TEXT NOT NULL REFERENCES tavern_players(player_id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL REFERENCES tavern_quests(quest_id),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  target INTEGER NOT NULL CHECK (target > 0),
  status TEXT NOT NULL,
  expires_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, quest_id)
);

CREATE TABLE IF NOT EXISTS tavern_group_quests (
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL REFERENCES tavern_quests(quest_id),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  target INTEGER NOT NULL CHECK (target > 0),
  status TEXT NOT NULL,
  expires_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, quest_id)
);

CREATE TABLE IF NOT EXISTS tavern_bosses (
  boss_id TEXT PRIMARY KEY,
  definition_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tavern_boss_progress (
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  boss_id TEXT NOT NULL REFERENCES tavern_bosses(boss_id),
  hp_remaining INTEGER NOT NULL CHECK (hp_remaining >= 0),
  participants_json TEXT NOT NULL DEFAULT '{}',
  attempts_json TEXT NOT NULL DEFAULT '{}',
  reward_resolved INTEGER NOT NULL DEFAULT 0 CHECK (reward_resolved IN (0, 1)),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, boss_id, starts_at)
);

CREATE TABLE IF NOT EXISTS tavern_rewards (
  reward_id TEXT PRIMARY KEY,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  UNIQUE (recipient_type, recipient_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS tavern_settings (
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope_type, scope_id, key)
);

CREATE INDEX IF NOT EXISTS idx_tavern_matches_group_status
  ON tavern_matches(group_id, status);
CREATE INDEX IF NOT EXISTS idx_tavern_matches_deadline
  ON tavern_matches(status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_tavern_match_events_match
  ON tavern_match_events(match_id, sequence);
CREATE INDEX IF NOT EXISTS idx_tavern_collections_player
  ON tavern_collections(player_id);
CREATE INDEX IF NOT EXISTS idx_tavern_rankings_group_rating
  ON tavern_rankings(group_id, season_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_tavern_trades_status_expiry
  ON tavern_trades(status, expires_at);
`;

const PHASE_B_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tavern_challenges (
  challenge_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
  challenger_id TEXT NOT NULL REFERENCES tavern_players(player_id),
  challenged_id TEXT NOT NULL REFERENCES tavern_players(player_id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  responded_at TEXT,
  response_message_id TEXT,
  match_id TEXT REFERENCES tavern_matches(match_id),
  CHECK (challenger_id <> challenged_id)
);

CREATE INDEX IF NOT EXISTS idx_tavern_challenges_group_status
  ON tavern_challenges(group_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_tavern_challenges_challenged_status
  ON tavern_challenges(challenged_id, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tavern_challenges_response_message
  ON tavern_challenges(response_message_id)
  WHERE response_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tavern_matches_group_players
  ON tavern_matches(group_id, status, player_one_id, player_two_id);
`;

const MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'initial_tavern_schema',
    sql: INITIAL_SCHEMA_SQL
  }),
  Object.freeze({
    version: 2,
    name: 'whatsapp_duel_challenges',
    sql: PHASE_B_SCHEMA_SQL
  })
]);

export { MIGRATIONS };
