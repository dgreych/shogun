import assert from 'node:assert/strict';
import test from 'node:test';

import { LegacySwitchHook } from '../../dist-vnext/runtime/legacy-switch-hook.js';

const context = Object.freeze({
  socket: {},
  message: {},
  mediaPath: null,
  messagesCache: {},
  rentalExpirationManager: {},
  prefix: '!',
  botName: 'GYOMEI',
  pushName: 'Mauricio',
  isOwner: true,
  isLiteMode: false,
});

test('hook retorna true quando domínio vNext assume o comando', async () => {
  const calls = [];
  const hook = new LegacySwitchHook({
    async dispatch(command, receivedContext) {
      calls.push({ command, context: receivedContext });
      return true;
    },
  });

  assert.equal(await hook.dispatch('menu', context), true);
  assert.deepEqual(calls, [{ command: 'menu', context }]);
});

test('hook retorna false para permitir exatamente um caminho legado posterior', async () => {
  let calls = 0;
  const hook = new LegacySwitchHook({
    async dispatch() {
      calls += 1;
      return false;
    },
  });

  assert.equal(await hook.dispatch('ping', context), false);
  assert.equal(calls, 1);
});

test('erro do domínio propaga e não é convertido em falso ownership', async () => {
  const hook = new LegacySwitchHook({
    async dispatch() {
      throw new Error('falha-vnext');
    },
  });

  await assert.rejects(() => hook.dispatch('menu', context), /falha-vnext/);
});
