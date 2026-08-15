const MYSQL_ENGINE = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';

const MYSQL_INITIAL_SCHEMA = Object.freeze([
  `CREATE TABLE IF NOT EXISTS tavern_groups (
    group_id VARCHAR(191) PRIMARY KEY,
    enabled TINYINT UNSIGNED NOT NULL DEFAULT 0,
    tavern_level INT UNSIGNED NOT NULL DEFAULT 1,
    tavern_xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
    season_id VARCHAR(191) NULL,
    settings_json LONGTEXT NOT NULL,
    boss_progress_json LONGTEXT NOT NULL,
    collective_quests_json LONGTEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_players (
    player_id VARCHAR(191) PRIMARY KEY,
    display_name VARCHAR(255) NULL,
    xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
    active_class_id VARCHAR(64) NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_group_members (
    group_id VARCHAR(191) NOT NULL,
    player_id VARCHAR(191) NOT NULL,
    joined_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (group_id, player_id),
    CONSTRAINT fk_tavern_member_group FOREIGN KEY (group_id)
      REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_tavern_member_player FOREIGN KEY (player_id)
      REFERENCES tavern_players(player_id) ON DELETE CASCADE
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_cards (
    card_id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    rarity VARCHAR(64) NOT NULL,
    class_id VARCHAR(64) NULL,
    cost INT UNSIGNED NOT NULL,
    attack INT NULL,
    health INT NULL,
    definition_json LONGTEXT NOT NULL,
    schema_version INT UNSIGNED NOT NULL DEFAULT 1,
    enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_collections (
    player_id VARCHAR(191) NOT NULL,
    card_id VARCHAR(191) NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    locked_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (player_id, card_id),
    KEY idx_tavern_collections_player (player_id),
    CONSTRAINT fk_tavern_collection_player FOREIGN KEY (player_id)
      REFERENCES tavern_players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_tavern_collection_card FOREIGN KEY (card_id)
      REFERENCES tavern_cards(card_id)
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_matches (
    match_id VARCHAR(191) PRIMARY KEY,
    group_id VARCHAR(191) NOT NULL,
    player_one_id VARCHAR(191) NOT NULL,
    player_two_id VARCHAR(191) NOT NULL,
    mode VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    seed VARCHAR(191) NOT NULL,
    active_player_id VARCHAR(191) NULL,
    turn_number INT UNSIGNED NOT NULL DEFAULT 0,
    deadline_at VARCHAR(32) NULL,
    state_json LONGTEXT NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    finished_at VARCHAR(32) NULL,
    KEY idx_tavern_matches_group_status (group_id, status),
    KEY idx_tavern_matches_deadline (status, deadline_at),
    KEY idx_tavern_matches_group_players (group_id, status, player_one_id, player_two_id),
    CONSTRAINT fk_tavern_match_group FOREIGN KEY (group_id)
      REFERENCES tavern_groups(group_id),
    CONSTRAINT fk_tavern_match_player_one FOREIGN KEY (player_one_id)
      REFERENCES tavern_players(player_id),
    CONSTRAINT fk_tavern_match_player_two FOREIGN KEY (player_two_id)
      REFERENCES tavern_players(player_id)
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_match_events (
    event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    match_id VARCHAR(191) NOT NULL,
    sequence INT UNSIGNED NOT NULL,
    message_id VARCHAR(191) NULL,
    actor_id VARCHAR(191) NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_json LONGTEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uq_tavern_event_sequence (match_id, sequence),
    UNIQUE KEY uq_tavern_event_message (match_id, message_id),
    KEY idx_tavern_match_events_match (match_id, sequence),
    CONSTRAINT fk_tavern_event_match FOREIGN KEY (match_id)
      REFERENCES tavern_matches(match_id) ON DELETE CASCADE
  ) ${MYSQL_ENGINE}`,
  `CREATE TABLE IF NOT EXISTS tavern_match_snapshots (
    match_id VARCHAR(191) NOT NULL,
    version INT UNSIGNED NOT NULL,
    state_json LONGTEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (match_id, version),
    CONSTRAINT fk_tavern_snapshot_match FOREIGN KEY (match_id)
      REFERENCES tavern_matches(match_id) ON DELETE CASCADE
  ) ${MYSQL_ENGINE}`
]);

const MYSQL_PHASE_B_SCHEMA = Object.freeze([
  `CREATE TABLE IF NOT EXISTS tavern_challenges (
    challenge_id VARCHAR(191) PRIMARY KEY,
    group_id VARCHAR(191) NOT NULL,
    challenger_id VARCHAR(191) NOT NULL,
    challenged_id VARCHAR(191) NOT NULL,
    mode VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    expires_at VARCHAR(32) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    responded_at VARCHAR(32) NULL,
    response_message_id VARCHAR(191) NULL,
    match_id VARCHAR(191) NULL,
    KEY idx_tavern_challenges_group_status (group_id, status, expires_at),
    KEY idx_tavern_challenges_challenged_status (challenged_id, status, expires_at),
    UNIQUE KEY uq_tavern_challenges_response_message (response_message_id),
    CONSTRAINT fk_tavern_challenge_group FOREIGN KEY (group_id)
      REFERENCES tavern_groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_tavern_challenge_challenger FOREIGN KEY (challenger_id)
      REFERENCES tavern_players(player_id),
    CONSTRAINT fk_tavern_challenge_challenged FOREIGN KEY (challenged_id)
      REFERENCES tavern_players(player_id),
    CONSTRAINT fk_tavern_challenge_match FOREIGN KEY (match_id)
      REFERENCES tavern_matches(match_id)
  ) ${MYSQL_ENGINE}`
]);

const MYSQL_IMPORT_SCHEMA = Object.freeze([
  `CREATE TABLE IF NOT EXISTS tavern_data_imports (
    source_sha256 CHAR(64) PRIMARY KEY,
    imported_at VARCHAR(32) NOT NULL,
    counts_json LONGTEXT NOT NULL
  ) ${MYSQL_ENGINE}`
]);

const MYSQL_MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, name: 'initial_tavern_runtime_schema', statements: MYSQL_INITIAL_SCHEMA }),
  Object.freeze({ version: 2, name: 'whatsapp_duel_challenges', statements: MYSQL_PHASE_B_SCHEMA }),
  Object.freeze({ version: 3, name: 'sqlite_import_checkpoint', statements: MYSQL_IMPORT_SCHEMA })
]);

export { MYSQL_MIGRATIONS };
