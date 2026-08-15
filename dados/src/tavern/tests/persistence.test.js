import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createDefaultRegistries } from '../domain/registries.js';
import { SqliteStore } from '../persistence/SqliteStore.js';
import { TavernRepository } from '../persistence/TavernRepository.js';

test('SQLite cria schema idempotente, arquivo válido e persiste dados', async t => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-sqlite-'));
  const databasePath = path.join(tempDirectory, 'tavern.sqlite');
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));

  const { cardRegistry } = await createDefaultRegistries();
  let store = await SqliteStore.open({ filename: databasePath });
  let repository = new TavernRepository(store);
  await repository.seedCards(cardRegistry.list());
  await repository.setGroupEnabled('group@g.us', true);
  await repository.grantCard('player@s.whatsapp.net', 'GY-001', 2);
  await store.close();

  const header = await fs.readFile(databasePath);
  assert.equal(header.subarray(0, 16).toString('binary'), 'SQLite format 3\u0000');

  store = await SqliteStore.open({ filename: databasePath });
  repository = new TavernRepository(store);
  assert.equal((await repository.getGroup('group@g.us')).enabled, true);
  assert.equal((await repository.getCard('GY-001')).name, 'Sentinela de Pedra');
  const migrationCount = await store.read(session => session.get(
    'SELECT COUNT(*) AS total FROM tavern_schema_migrations'
  ));
  assert.equal(Number(migrationCount.total), 2);
  await store.close();
});

test('transação com erro faz rollback completo', async t => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gyomei-tavern-rollback-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await SqliteStore.open({ filename: path.join(tempDirectory, 'tavern.sqlite') });

  await assert.rejects(store.transaction(session => {
    session.run(
      `INSERT INTO tavern_players (player_id, created_at, updated_at)
       VALUES ('rollback@s.whatsapp.net', '2026-08-08T00:00:00.000Z', '2026-08-08T00:00:00.000Z')`
    );
    throw new Error('falha simulada');
  }));

  const row = await store.read(session => session.get(
    `SELECT player_id FROM tavern_players WHERE player_id = 'rollback@s.whatsapp.net'`
  ));
  assert.equal(row, null);
  await store.close();
});
