import assert from 'node:assert/strict';
import test from 'node:test';

import { CompatibilityDispatch } from '../../dist-vnext/runtime/compatibility-dispatch.js';

const envelope = Object.freeze({
  chatId: 'grupo@g.us',
  senderId: 'usuario@s.whatsapp.net',
  kind: 'group',
  text: '!menu',
  command: 'menu',
});

test('mensagem tratada pelo vNext nunca executa fallback legado', async () => {
  let legacyCalls = 0;
  const dispatcher = new CompatibilityDispatch(
    { dispatch: async () => true },
    { execute: async () => { legacyCalls += 1; } },
  );

  const owner = await dispatcher.dispatch(envelope, { raw: true });
  assert.equal(owner, 'vnext');
  assert.equal(legacyCalls, 0);
});

test('mensagem não tratada pelo vNext cai uma única vez no legado', async () => {
  let legacyCalls = 0;
  let legacyPayload;
  const dispatcher = new CompatibilityDispatch(
    { dispatch: async () => false },
    { execute: async (input) => { legacyCalls += 1; legacyPayload = input; } },
  );

  const payload = { raw: 'mensagem' };
  const owner = await dispatcher.dispatch(envelope, payload);
  assert.equal(owner, 'legacy');
  assert.equal(legacyCalls, 1);
  assert.equal(legacyPayload, payload);
});

test('erro do vNext não dispara legado e preserva falha para observabilidade', async () => {
  let legacyCalls = 0;
  const dispatcher = new CompatibilityDispatch(
    { dispatch: async () => { throw new Error('falha-vnext'); } },
    { execute: async () => { legacyCalls += 1; } },
  );

  await assert.rejects(() => dispatcher.dispatch(envelope, {}), /falha-vnext/);
  assert.equal(legacyCalls, 0);
});

test('erro do legado propaga sem mascaramento', async () => {
  const dispatcher = new CompatibilityDispatch(
    { dispatch: async () => false },
    { execute: async () => { throw new Error('falha-legado'); } },
  );

  await assert.rejects(() => dispatcher.dispatch(envelope, {}), /falha-legado/);
});
