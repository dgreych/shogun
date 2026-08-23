import assert from 'node:assert/strict';
import test from 'node:test';

import { createVNextCommandRuntime } from '../../dist-vnext/runtime/vnext-command-runtime.js';

function dispatchInput(body) {
  return {
    socket: {},
    message: {},
    mediaPath: null,
    messagesCache: new Map(),
    rentalExpirationManager: null,
    prefix: '!',
    botName: '𝖘𝖍𝖔𝖌𝖚𝖓',
    pushName: 'Mauricio',
    isOwner: true,
    isLiteMode: false,
    chatId: '5511999999999@s.whatsapp.net',
    sender: '5511999999999@s.whatsapp.net',
    isGroup: false,
    body,
    rawAliases: [],
  };
}

test('composition root entrega menus ao domínio vNext', async () => {
  const calls = { present: [], legacy: [] };
  const runtime = createVNextCommandRuntime({
    menuPresentation: {
      async present(request) { calls.present.push(request); },
      async replyText() {},
      async reportError() {},
    },
    legacy: {
      async execute(context) { calls.legacy.push(context); },
    },
  });

  const receipt = await runtime.dispatch(dispatchInput('!menuadm'));
  assert.equal(receipt.owner, 'vnext');
  assert.equal(calls.present.length, 1);
  assert.equal(calls.present[0].descriptor.id, 'admin');
  assert.equal(calls.legacy.length, 0);
});

test('composition root preserva fallback legado para domínio ainda não migrado', async () => {
  const calls = { legacy: [] };
  const runtime = createVNextCommandRuntime({
    menuPresentation: {
      async present() {},
      async replyText() {},
      async reportError() {},
    },
    legacy: {
      async execute(context) { calls.legacy.push(context); },
    },
  });

  const receipt = await runtime.dispatch(dispatchInput('!ping'));
  assert.equal(receipt.owner, 'legacy');
  assert.equal(calls.legacy.length, 1);
});
