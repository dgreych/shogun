import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { IdentityService, classifyAddress } from '../identity/IdentityService.js';
import { NexoConflictError } from '../errors.js';

async function openIdentityFixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-identity-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);
  return { store, repository, identity: new IdentityService(repository) };
}

test('classifica LID, PN e username sem tratar nenhum como telefone-primário', () => {
  assert.equal(classifyAddress('123456789012345@lid'), 'LID');
  assert.equal(classifyAddress('5511999999999@s.whatsapp.net'), 'PN');
  assert.equal(classifyAddress('5511999999999@c.us'), 'PN');
  assert.equal(classifyAddress('alguem.qualquer'), 'USERNAME');
});

test('resolve usuário novo e nunca usa o JID/telefone como id interno', async t => {
  const { identity } = await openIdentityFixture(t);

  const user = await identity.resolveCanonicalUser({
    addresses: ['5511999999999@s.whatsapp.net'],
    displayName: 'Lume'
  });

  assert.ok(user.id);
  assert.notEqual(user.id, '5511999999999@s.whatsapp.net');
  assert.notEqual(user.id, '5511999999999');
  assert.equal(user.displayName, 'Lume');
});

test('resolve o mesmo usuário quando LID e PN já são aliases conhecidos', async t => {
  const { identity } = await openIdentityFixture(t);

  const first = await identity.resolveCanonicalUser({
    addresses: ['123456789012345@lid'],
    displayName: 'Lume'
  });

  const second = await identity.resolveCanonicalUser({
    addresses: ['123456789012345@lid', '5511999999999@s.whatsapp.net'],
    displayName: 'Lume'
  });

  assert.equal(second.id, first.id);

  // agora resolver só pelo PN (aprendido na chamada anterior) precisa
  // continuar batendo no mesmo usuário
  const third = await identity.resolveCanonicalUser({
    addresses: ['5511999999999@s.whatsapp.net']
  });
  assert.equal(third.id, first.id);
});

test('resolver o mesmo alias duas vezes não duplica linha em nexo_user_address_aliases', async t => {
  const { store, identity } = await openIdentityFixture(t);

  await identity.resolveCanonicalUser({ addresses: ['123456789012345@lid'] });
  await identity.resolveCanonicalUser({ addresses: ['123456789012345@lid'] });

  const rows = await store.read(session => session.all(
    "SELECT * FROM nexo_user_address_aliases WHERE type = 'LID' AND value = '123456789012345@lid'"
  ));
  assert.equal(rows.length, 1);
});

test('alias já pertencente a outro usuário gera conflito, não roubo silencioso de identidade', async t => {
  const { repository } = await openIdentityFixture(t);

  const userA = await repository.createUser({ displayName: 'A' });
  const userB = await repository.createUser({ displayName: 'B' });
  await repository.addAddressAlias(userA.id, 'LID', '111@lid');

  await assert.rejects(
    repository.addAddressAlias(userB.id, 'LID', '111@lid'),
    NexoConflictError
  );
});
