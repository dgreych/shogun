import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { TavernService } from '../TavernService.js';
import {
  ACTIVE_TABLES,
  buildMySqlUpsert,
  collectSqliteRuntimeRows,
  hasMeaningfulData,
  migrateSqliteToMySqlIfNeeded
} from '../persistence/SqliteToMySqlMigration.js';

class FakeMySqlStore {
  constructor() {
    this.dialect = 'mysql';
    this.tables = Object.fromEntries(ACTIVE_TABLES.map(table => [table.name, []]));
    this.imports = new Map();
  }

  async transaction(operation) {
    const store = this;
    return operation({
      async get(sql, params = []) {
        if (sql.includes('FROM tavern_data_imports')) {
          return store.imports.has(params[0]) ? { source_sha256: params[0] } : null;
        }
        const countMatch = sql.match(/FROM `([^`]+)`/);
        if (countMatch && sql.includes('COUNT(*)')) {
          return { total: store.tables[countMatch[1]].length };
        }
        return null;
      },
      async run(sql, params = []) {
        if (sql.startsWith('INSERT INTO tavern_data_imports')) {
          store.imports.set(params[0], { importedAt: params[1], counts: params[2] });
          return { changes: 1 };
        }
        const insertMatch = sql.match(/^INSERT INTO `([^`]+)` \(([^)]+)\)/);
        assert.ok(insertMatch, sql);
        const table = ACTIVE_TABLES.find(item => item.name === insertMatch[1]);
        const row = Object.fromEntries(table.columns.map((column, index) => [column, params[index]]));
        const existingIndex = store.tables[table.name]
          .findIndex(item => item[table.primary] === row[table.primary]);
        if (existingIndex >= 0) store.tables[table.name][existingIndex] = row;
        else store.tables[table.name].push(row);
        return { changes: 1 };
      }
    });
  }
}

test('plano de importação respeita a ordem das chaves estrangeiras', () => {
  assert.deepEqual(ACTIVE_TABLES.map(table => table.name), [
    'tavern_groups',
    'tavern_players',
    'tavern_cards',
    'tavern_group_members',
    'tavern_collections',
    'tavern_matches',
    'tavern_match_events',
    'tavern_match_snapshots',
    'tavern_challenges'
  ]);
  const sql = buildMySqlUpsert(ACTIVE_TABLES[0]);
  assert.match(sql, /^INSERT INTO `tavern_groups`/);
  assert.match(sql, /ON DUPLICATE KEY UPDATE/);
});

test('coleta os dados ativos da Fase B sem alterar o contrato SQLite', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-import-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'tavern.sqlite');
  const tavern = await TavernService.create({ databasePath });
  await tavern.repository.setGroupEnabled('import-test@g.us', true);
  await tavern.close();

  const rows = await collectSqliteRuntimeRows(databasePath);
  assert.equal(rows.tavern_groups.length, 1);
  assert.equal(rows.tavern_groups[0].enabled, 1);
  assert.equal(hasMeaningfulData(rows), true);
});

test('importação cria checkpoint e não reaplica a mesma origem', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-cutover-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'tavern.sqlite');
  const tavern = await TavernService.create({ databasePath });
  await tavern.repository.setGroupEnabled('cutover-test@g.us', true);
  await tavern.close();

  const targetStore = new FakeMySqlStore();
  const first = await migrateSqliteToMySqlIfNeeded({ targetStore, sourceFilename: databasePath });
  const second = await migrateSqliteToMySqlIfNeeded({ targetStore, sourceFilename: databasePath });
  assert.equal(first.status, 'imported');
  assert.equal(second.status, 'already_imported');
  assert.equal(targetStore.tables.tavern_groups.length, 1);
  assert.ok(targetStore.tables.tavern_cards.length > 0);
  assert.equal(targetStore.imports.size, 1);
});

test('importação recusa destino ocupado sem checkpoint', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-occupied-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'tavern.sqlite');
  const tavern = await TavernService.create({ databasePath });
  await tavern.repository.setGroupEnabled('source@g.us', true);
  await tavern.close();

  const targetStore = new FakeMySqlStore();
  targetStore.tables.tavern_groups.push({ group_id: 'existing@g.us' });
  await assert.rejects(
    migrateSqliteToMySqlIfNeeded({ targetStore, sourceFilename: databasePath }),
    /já contém dados sem checkpoint/
  );
});
