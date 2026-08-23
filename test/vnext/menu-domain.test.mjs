import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MENU_COMMAND_DESCRIPTORS,
  MENU_COMMAND_TOKENS,
  findMenuCommandDescriptor,
} from '../../dist-vnext/menu/catalog.js';
import { MenuDomainDispatchTarget } from '../../dist-vnext/menu/domain.js';

function context(overrides = {}) {
  return {
    socket: {},
    message: {},
    messagesCache: new Map(),
    rentalExpirationManager: null,
    prefix: '!',
    botName: '𝖘𝖍𝖔𝖌𝖚𝖓',
    pushName: 'Mauricio',
    isOwner: false,
    isLiteMode: false,
    ...overrides,
  };
}

function presenter() {
  const calls = { present: [], reply: [], error: [] };
  return {
    calls,
    port: {
      async present(request) { calls.present.push(request); },
      async replyText(ctx, text) { calls.reply.push({ ctx, text }); },
      async reportError(error, request) { calls.error.push({ error, request }); },
    },
  };
}

test('catálogo possui 13 famílias e 45 tokens únicos de apresentação', () => {
  assert.equal(MENU_COMMAND_DESCRIPTORS.length, 13);
  assert.equal(MENU_COMMAND_TOKENS.length, 45);
  assert.equal(new Set(MENU_COMMAND_TOKENS).size, 45);
});

test('todos os aliases do domínio resolvem para exatamente uma família', () => {
  for (const token of MENU_COMMAND_TOKENS) {
    const item = findMenuCommandDescriptor(token);
    assert.ok(item, `token sem descriptor: ${token}`);
    assert.ok(item.tokens.includes(token), `descriptor incorreto para ${token}`);
  }
});

test('menu reconhecido é tratado pelo vNext sem depender do nome primário', async () => {
  const spy = presenter();
  const target = new MenuDomainDispatchTarget(spy.port);
  assert.equal(await target.dispatch('downloadmenu', context()), true);
  assert.equal(spy.calls.present.length, 1);
  assert.equal(spy.calls.present[0].descriptor.id, 'downloads');
  assert.equal(spy.calls.reply.length, 0);
});

test('comando fora do domínio é recusado para permitir fallback legado', async () => {
  const spy = presenter();
  const target = new MenuDomainDispatchTarget(spy.port);
  assert.equal(await target.dispatch('ping', context()), false);
  assert.equal(spy.calls.present.length, 0);
});

test('menudono preserva guarda de proprietário e continua owned pelo vNext', async () => {
  const spy = presenter();
  const target = new MenuDomainDispatchTarget(spy.port);
  assert.equal(await target.dispatch('ownermenu', context({ isOwner: false })), true);
  assert.equal(spy.calls.present.length, 0);
  assert.deepEqual(spy.calls.reply.map((item) => item.text), [
    '⚠️ Este menu é exclusivo para o dono do bot.',
  ]);

  assert.equal(await target.dispatch('menudono', context({ isOwner: true })), true);
  assert.equal(spy.calls.present.length, 1);
  assert.equal(spy.calls.present[0].descriptor.id, 'dono');
});

test('falha de apresentação não cai no legado e gera erro observável + resposta', async () => {
  const calls = { reply: [], error: [] };
  const target = new MenuDomainDispatchTarget({
    async present() { throw new Error('media quebrada'); },
    async replyText(_ctx, text) { calls.reply.push(text); },
    async reportError(error, request) { calls.error.push({ error, request }); },
  });

  assert.equal(await target.dispatch('menuia', context()), true);
  assert.equal(calls.error.length, 1);
  assert.match(String(calls.error[0].error), /media quebrada/);
  assert.deepEqual(calls.reply, ['❌ Ocorreu um erro ao carregar o menu de IA.']);
});
