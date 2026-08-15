import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { TavernConflictError, TavernValidationError } from '../errors.js';
import { DEFAULT_TAVERN_DATABASE_PATH, SqliteStore } from './SqliteStore.js';

const ACTIVE_TABLES = Object.freeze([
  Object.freeze({
    name: 'tavern_groups',
    columns: ['group_id', 'enabled', 'tavern_level', 'tavern_xp', 'season_id', 'settings_json', 'boss_progress_json', 'collective_quests_json', 'created_at', 'updated_at'],
    primary: 'group_id'
  }),
  Object.freeze({
    name: 'tavern_players',
    columns: ['player_id', 'display_name', 'xp', 'active_class_id', 'created_at', 'updated_at'],
    primary: 'player_id'
  }),
  Object.freeze({
    name: 'tavern_cards',
    columns: ['card_id', 'name', 'type', 'rarity', 'class_id', 'cost', 'attack', 'health', 'definition_json', 'schema_version', 'enabled', 'created_at', 'updated_at'],
    primary: 'card_id'
  }),
  Object.freeze({
    name: 'tavern_group_members',
    columns: ['group_id', 'player_id', 'joined_at'],
    primary: 'group_id'
  }),
  Object.freeze({
    name: 'tavern_collections',
    columns: ['player_id', 'card_id', 'quantity', 'locked_quantity', 'updated_at'],
    primary: 'player_id'
  }),
  Object.freeze({
    name: 'tavern_matches',
    columns: ['match_id', 'group_id', 'player_one_id', 'player_two_id', 'mode', 'status', 'seed', 'active_player_id', 'turn_number', 'deadline_at', 'state_json', 'version', 'created_at', 'updated_at', 'finished_at'],
    primary: 'match_id'
  }),
  Object.freeze({
    name: 'tavern_match_events',
    columns: ['event_id', 'match_id', 'sequence', 'message_id', 'actor_id', 'event_type', 'payload_json', 'created_at'],
    primary: 'event_id'
  }),
  Object.freeze({
    name: 'tavern_match_snapshots',
    columns: ['match_id', 'version', 'state_json', 'created_at'],
    primary: 'match_id'
  }),
  Object.freeze({
    name: 'tavern_challenges',
    columns: ['challenge_id', 'group_id', 'challenger_id', 'challenged_id', 'mode', 'status', 'expires_at', 'created_at', 'updated_at', 'responded_at', 'response_message_id', 'match_id'],
    primary: 'challenge_id'
  })
]);

const MEANINGFUL_TABLES = ACTIVE_TABLES.filter(table => table.name !== 'tavern_cards');

function buildMySqlUpsert(table) {
  const columns = table.columns.map(column => `\`${column}\``).join(', ');
  const placeholders = table.columns.map(() => '?').join(', ');
  const mutableColumns = table.columns.filter(column => column !== table.primary);
  const update = mutableColumns.length
    ? mutableColumns.map(column => `\`${column}\` = VALUES(\`${column}\`)`).join(', ')
    : `\`${table.primary}\` = \`${table.primary}\``;
  return `INSERT INTO \`${table.name}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${update}`;
}

function countRows(rowsByTable, tables = ACTIVE_TABLES) {
  return Object.fromEntries(tables.map(table => [table.name, rowsByTable[table.name]?.length || 0]));
}

function hasMeaningfulData(rowsByTable) {
  return MEANINGFUL_TABLES.some(table => (rowsByTable[table.name]?.length || 0) > 0);
}

async function collectSqliteRuntimeRows(filename = DEFAULT_TAVERN_DATABASE_PATH) {
  try {
    await fs.access(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  const source = await SqliteStore.open({ filename });
  try {
    const rowsByTable = {};
    for (const table of ACTIVE_TABLES) {
      const columns = table.columns.map(column => `\`${column}\``).join(', ');
      rowsByTable[table.name] = await source.read(session => session.all(
        `SELECT ${columns} FROM \`${table.name}\``
      ));
    }
    return rowsByTable;
  } finally {
    await source.close();
  }
}

async function sha256File(filename) {
  const content = await fs.readFile(filename);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function migrateSqliteToMySqlIfNeeded({
  targetStore,
  sourceFilename = process.env.TAVERN_DATABASE_PATH || DEFAULT_TAVERN_DATABASE_PATH,
  now = () => new Date().toISOString()
} = {}) {
  if (!targetStore || targetStore.dialect !== 'mysql') {
    throw new TavernValidationError('A importação da Tavern exige um destino MySQL');
  }

  const rowsByTable = await collectSqliteRuntimeRows(sourceFilename);
  if (!rowsByTable) return { status: 'source_missing', counts: {} };
  const sourceHash = await sha256File(sourceFilename);
  const sourceCounts = countRows(rowsByTable);
  if (!hasMeaningfulData(rowsByTable)) {
    return { status: 'source_without_runtime_data', counts: sourceCounts };
  }

  return targetStore.transaction(async session => {
    const imported = await session.get(
      'SELECT source_sha256 FROM tavern_data_imports WHERE source_sha256 = ?',
      [sourceHash]
    );
    if (imported) return { status: 'already_imported', counts: sourceCounts };

    const occupied = {};
    for (const table of MEANINGFUL_TABLES) {
      const row = await session.get(`SELECT COUNT(*) AS total FROM \`${table.name}\``);
      occupied[table.name] = Number(row?.total || 0);
    }
    if (Object.values(occupied).some(total => total > 0)) {
      throw new TavernConflictError(
        'MySQL da Tavern já contém dados sem checkpoint desta origem; importação automática cancelada',
        { occupied }
      );
    }

    for (const table of ACTIVE_TABLES) {
      const sql = buildMySqlUpsert(table);
      for (const row of rowsByTable[table.name]) {
        await session.run(sql, table.columns.map(column => row[column]));
      }
    }

    for (const table of MEANINGFUL_TABLES) {
      const row = await session.get(`SELECT COUNT(*) AS total FROM \`${table.name}\``);
      const actual = Number(row?.total || 0);
      if (actual !== sourceCounts[table.name]) {
        throw new TavernConflictError('Contagem divergente durante a importação da Tavern', {
          table: table.name,
          expected: sourceCounts[table.name],
          actual
        });
      }
    }

    await session.run(
      'INSERT INTO tavern_data_imports (source_sha256, imported_at, counts_json) VALUES (?, ?, ?)',
      [sourceHash, now(), JSON.stringify(sourceCounts)]
    );
    return { status: 'imported', counts: sourceCounts };
  });
}

export {
  ACTIVE_TABLES,
  buildMySqlUpsert,
  collectSqliteRuntimeRows,
  countRows,
  hasMeaningfulData,
  migrateSqliteToMySqlIfNeeded
};
