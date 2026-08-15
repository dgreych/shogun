import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  MySqlSession,
  parseMysqlConnectionString,
  translateSqliteQuery
} from '../persistence/MySqlStore.js';
import { resolveTavernDatabaseConfig } from '../persistence/databaseConfig.js';
import { MYSQL_MIGRATIONS } from '../persistence/mysqlMigrations.js';

test('parser aceita JDBC MySQL e decodifica credenciais sem expor a URL', () => {
  const parsed = parseMysqlConnectionString(
    'jdbc:mysql://usuario:senha%5Esegura%40local@127.0.0.1:3307/banco_teste'
  );
  assert.deepEqual(parsed, {
    host: '127.0.0.1',
    port: 3307,
    user: 'usuario',
    password: 'senha^segura@local',
    database: 'banco_teste'
  });
});

test('configuração privada seleciona MySQL sem colocar segredo no código', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-mysql-config-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'tavern.mysql.json');
  await fs.writeFile(filename, JSON.stringify({
    driver: 'mysql',
    connectionString: 'mysql://usuario:senha@127.0.0.1:3306/banco_teste',
    connectionLimit: 3
  }), { mode: 0o600 });

  const config = await resolveTavernDatabaseConfig({ databaseConfigPath: filename });
  assert.equal(config.driver, 'mysql');
  assert.equal(config.mysql.connectionLimit, 3);
  assert.equal(config.mysql.connectTimeoutMs, 10_000);
});

test('tradutor converte UPSERT do SQLite para MySQL', () => {
  const doNothing = translateSqliteQuery(
    'INSERT INTO tavern_groups (group_id) VALUES (?) ON CONFLICT(group_id) DO NOTHING'
  );
  assert.match(doNothing, /ON DUPLICATE KEY UPDATE group_id = group_id/i);

  const upsert = translateSqliteQuery(`INSERT INTO tavern_players (player_id, display_name)
    VALUES (?, ?) ON CONFLICT(player_id) DO UPDATE SET
    display_name = COALESCE(excluded.display_name, tavern_players.display_name)`);
  assert.match(upsert, /ON DUPLICATE KEY UPDATE/i);
  assert.match(upsert, /COALESCE\(VALUES\(display_name\), display_name\)/i);
  assert.doesNotMatch(upsert, /excluded\./i);
});

test('sessão MySQL normaliza booleanos e retorna alterações', async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      return [{ affectedRows: 1, insertId: 7 }];
    }
  };
  const session = new MySqlSession(connection);
  const result = await session.run('UPDATE tavern_groups SET enabled = ? WHERE group_id = ?', [true, 'g1']);
  assert.deepEqual(result, { changes: 1, insertId: 7 });
  assert.deepEqual(calls[0].params, [1, 'g1']);
});

test('migrations MySQL são idempotentes e cobrem o runtime da Fase B', () => {
  assert.deepEqual(MYSQL_MIGRATIONS.map(item => item.version), [1, 2, 3]);
  const sql = MYSQL_MIGRATIONS.flatMap(item => item.statements).join('\n');
  for (const table of [
    'tavern_groups',
    'tavern_players',
    'tavern_cards',
    'tavern_matches',
    'tavern_match_events',
    'tavern_match_snapshots',
    'tavern_challenges',
    'tavern_data_imports'
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(sql, /COLLATE=utf8mb4_bin/);
});

test('sessão MySQL adiciona bloqueio de linha dentro de transações', async () => {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      return [[{ match_id: 'm1' }]];
    }
  };
  const session = new MySqlSession(connection);
  const row = await session.getForUpdate('SELECT * FROM tavern_matches WHERE match_id = ?', ['m1']);
  assert.equal(row.match_id, 'm1');
  assert.match(calls[0].sql, /FOR UPDATE$/);
});
