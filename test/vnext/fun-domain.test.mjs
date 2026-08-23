import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FUN_COMMAND_DESCRIPTORS,
  FUN_COMMAND_TOKENS,
  findFunCommandDescriptor,
} from '../../dist-vnext/fun/catalog.js';
import { FunDomainDispatchTarget } from '../../dist-vnext/fun/domain.js';

function context(overrides = {}) {
  const sent = [];
  const replies = [];
  const liteRejections = [];
  const value = {
    socket: {
      async sendMessage(jid, content) {
        sent.push({ jid, content });
      },
    },
    message: {},
    mediaPath: null,
    messagesCache: {},
    rentalExpirationManager: {},
    prefix: '!',
    botName: '𝖘𝖍𝖔𝖌𝖚𝖓',
    pushName: 'Teste',
    isOwner: false,
    isLiteMode: false,
    async reply(text, options) {
      replies.push({ text, options });
    },
    async rejectInLiteMode() {
      liteRejections.push(true);
      replies.push({ text: '⚠️ Este comando fica indisponível enquanto o modo lite está ativo neste grupo.' });
    },
    isGroup: true,
    isModoBn: true,
    sender: '5511000000000@s.whatsapp.net',
    mentionedUser: null,
    groupId: '120363000000000000@g.us',
    groupMembers: [
      '5511000000000@s.whatsapp.net',
      '5511000000001@s.whatsapp.net',
      '5511000000002@s.whatsapp.net',
      '5511000000003@s.whatsapp.net',
      '5511000000004@s.whatsapp.net',
    ],
    getUserName: (id) => String(id).split('@')[0],
    buildGroupFilePath: () => '/arquivo/que/nao/existe.json',
    ...overrides,
  };
  return { value, sent, replies, liteRejections };
}

test('catálogo amplo possui cinco famílias completas e 333 tokens únicos', () => {
  assert.equal(FUN_COMMAND_DESCRIPTORS.length, 5);
  assert.equal(FUN_COMMAND_TOKENS.length, 333);
  assert.equal(new Set(FUN_COMMAND_TOKENS).size, 333);
  for (const token of FUN_COMMAND_TOKENS) assert.ok(findFunCommandDescriptor(token));
});

test('perfil percentual é owned e envia exatamente uma resposta', async () => {
  const target = new FunDomainDispatchTarget();
  const ctx = context();
  assert.equal(await target.dispatch('burro', ctx.value), true);
  assert.equal(ctx.replies.length, 0);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].jid, ctx.value.groupId);
});

test('modo lite delega ao rejeitador legado e não cai no fallback', async () => {
  const target = new FunDomainDispatchTarget();
  const ctx = context({ isLiteMode: true });
  assert.equal(await target.dispatch('gostoso', ctx.value), true);
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.liteRejections.length, 1);
  assert.equal(ctx.replies.length, 1);
  assert.match(ctx.replies[0].text, /modo lite/i);
});

test('interação exige menção e permanece owned', async () => {
  const target = new FunDomainDispatchTarget();
  const ctx = context();
  assert.equal(await target.dispatch('tapa', ctx.value), true);
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.replies.length, 1);
  assert.equal(ctx.replies[0].text, 'Marque um usuário.');
});

test('ranking preserva mínimo de cinco membros elegíveis', async () => {
  const target = new FunDomainDispatchTarget();
  const ctx = context({ groupMembers: ['1@s.whatsapp.net', '2@s.whatsapp.net', '3@s.whatsapp.net', '4@s.whatsapp.net'] });
  assert.equal(await target.dispatch('rankburro', ctx.value), true);
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.replies.length, 1);
  assert.match(ctx.replies[0].text, /Membros insuficientes/);
});

test('comando fora da tranche é recusado para o fallback legado', async () => {
  const target = new FunDomainDispatchTarget();
  const ctx = context();
  assert.equal(await target.dispatch('play', ctx.value), false);
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.replies.length, 0);
});
