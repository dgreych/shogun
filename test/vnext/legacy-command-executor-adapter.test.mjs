import assert from 'node:assert/strict';
import test from 'node:test';

import { LegacyCommandExecutorAdapter } from '../../dist-vnext/adapters/legacy-command-executor.js';

test('adapter preserva assinatura do executor legado e reutiliza módulo carregado', async () => {
  let loads = 0;
  const calls = [];
  const executor = async (...args) => { calls.push(args); };
  const adapter = new LegacyCommandExecutorAdapter(async () => {
    loads += 1;
    return { default: executor };
  });

  const first = {
    socket: { id: 'sock' },
    message: { id: 'm1' },
    mediaPath: null,
    messagesCache: new Map(),
    rentalExpirationManager: { id: 'rent' },
  };
  const second = { ...first, message: { id: 'm2' } };

  await adapter.execute(first);
  await adapter.execute(second);

  assert.equal(loads, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [first.socket, first.message, null, first.messagesCache, first.rentalExpirationManager]);
  assert.deepEqual(calls[1], [second.socket, second.message, null, second.messagesCache, second.rentalExpirationManager]);
});

test('adapter recusa módulo legado sem função exportada', async () => {
  const adapter = new LegacyCommandExecutorAdapter(async () => ({ default: 'invalido' }));
  await assert.rejects(() => adapter.execute({
    socket: {},
    message: {},
    messagesCache: new Map(),
    rentalExpirationManager: {},
  }), /não exporta executor de comandos compatível/);
});
