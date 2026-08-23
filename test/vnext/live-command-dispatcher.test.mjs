import assert from 'node:assert/strict';
import test from 'node:test';

import { MenuDomainDispatchTarget } from '../../dist-vnext/menu/domain.js';
import { CompositeVNextDispatchTarget } from '../../dist-vnext/runtime/composite-dispatch.js';
import { LiveCommandDispatcher } from '../../dist-vnext/runtime/live-command-dispatcher.js';

function input(overrides = {}) {
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
    body: '!menu',
    rawAliases: [],
    ...overrides,
  };
}

function system() {
  const calls = { present: [], reply: [], error: [], legacy: [] };
  const menu = new MenuDomainDispatchTarget({
    async present(request) { calls.present.push(request); },
    async replyText(ctx, text) { calls.reply.push({ ctx, text }); },
    async reportError(error, request) { calls.error.push({ error, request }); },
  });
  const vnext = new CompositeVNextDispatchTarget([menu]);
  const legacy = {
    async execute(ctx) { calls.legacy.push(ctx); },
  };
  return { calls, dispatcher: new LiveCommandDispatcher(vnext, legacy) };
}

test('menu prefixado pertence ao vNext e nunca chama legado', async () => {
  const { calls, dispatcher } = system();
  const receipt = await dispatcher.dispatch(input({ body: '!menu' }));
  assert.equal(receipt.owner, 'vnext');
  assert.equal(receipt.parsed.command, 'menu');
  assert.equal(calls.present.length, 1);
  assert.equal(calls.legacy.length, 0);
});

test('alias customizado é resolvido antes da decisão de ownership', async () => {
  const { calls, dispatcher } = system();
  const receipt = await dispatcher.dispatch(input({
    body: '!painel agora',
    rawAliases: [{ alias: 'painel', command: 'menu', fixedParams: '' }],
  }));
  assert.equal(receipt.owner, 'vnext');
  assert.equal(receipt.parsed.command, 'menu');
  assert.equal(receipt.parsed.query, 'agora');
  assert.equal(calls.present.length, 1);
  assert.equal(calls.legacy.length, 0);
});

test('prefixo customizado é respeitado antes do ownership', async () => {
  const { calls, dispatcher } = system();
  const receipt = await dispatcher.dispatch(input({ prefix: '#', body: '#menudown' }));
  assert.equal(receipt.owner, 'vnext');
  assert.equal(receipt.parsed.command, 'menudown');
  assert.equal(calls.present[0].descriptor.id, 'downloads');
  assert.equal(calls.legacy.length, 0);
});

test('comando prefixado fora do domínio cai uma única vez no legado', async () => {
  const { calls, dispatcher } = system();
  const receipt = await dispatcher.dispatch(input({ body: '!ping' }));
  assert.equal(receipt.owner, 'legacy');
  assert.equal(calls.present.length, 0);
  assert.equal(calls.legacy.length, 1);
});

test('mensagem sem prefixo permanece integralmente no legado', async () => {
  const { calls, dispatcher } = system();
  const receipt = await dispatcher.dispatch(input({ body: 'oi gyomei' }));
  assert.equal(receipt.owner, 'legacy');
  assert.equal(receipt.parsed.isCommand, false);
  assert.equal(calls.present.length, 0);
  assert.equal(calls.legacy.length, 1);
});

test('owner guardado pelo domínio não provoca fallback legado', async () => {
  const { calls, dispatcher } = system();
  const receipt = await dispatcher.dispatch(input({ body: '!ownermenu', isOwner: false }));
  assert.equal(receipt.owner, 'vnext');
  assert.equal(calls.present.length, 0);
  assert.equal(calls.reply.length, 1);
  assert.equal(calls.legacy.length, 0);
});
