import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UTILITY_TOOLS_NATIVE_COMMAND_TOKENS,
  UtilityToolsDomainDispatchTarget,
} from '../../dist-vnext/tools/utility-domain.js';

function baseContext(overrides = {}) {
  const replies = [];
  const sent = [];
  return {
    prefix: '!',
    query: '',
    sender: '5511999999999@s.whatsapp.net',
    groupId: '120363000000000000@g.us',
    pushName: 'Mauricio',
    isGroup: true,
    groupData: {},
    message: { key: { id: 'quoted-message' } },
    socket: {
      sendMessage: async (...args) => { sent.push(args); },
    },
    reply: async (text) => { replies.push(text); },
    replies,
    sent,
    ...overrides,
  };
}

test('catálogo utilitário possui duas famílias e três tokens sem duplicata', () => {
  assert.deepEqual([...UTILITY_TOOLS_NATIVE_COMMAND_TOKENS].sort(), ['printsite', 'signos', 'ssweb'].sort());
  assert.equal(new Set(UTILITY_TOOLS_NATIVE_COMMAND_TOKENS).size, 3);
});

test('printsite e ssweb preservam URL do screenshot e mensagem citada', async () => {
  const domain = new UtilityToolsDomainDispatchTarget();
  const context = baseContext({ query: 'https://example.com/pagina' });

  assert.equal(await domain.dispatch('ssweb', context), true);
  assert.deepEqual(context.replies, []);
  assert.equal(context.sent.length, 1);
  assert.deepEqual(context.sent[0], [
    context.groupId,
    { image: { url: 'https://image.thum.io/get/fullpage/https://example.com/pagina' } },
    { quoted: context.message },
  ]);

  const missing = baseContext();
  assert.equal(await domain.dispatch('printsite', missing), true);
  assert.deepEqual(missing.replies, ['Cade o link?']);
  assert.deepEqual(missing.sent, []);
});

test('signos preserva a tabela legada e orientação para horóscopo', async () => {
  const domain = new UtilityToolsDomainDispatchTarget();
  const context = baseContext();

  assert.equal(await domain.dispatch('signos', context), true);
  assert.equal(context.replies.length, 1);
  assert.match(context.replies[0], /♈ \*Áries\* \(21\/03 - 19\/04\)/);
  assert.match(context.replies[0], /♑ \*Capricórnio\* \(22\/12 - 19\/01\)/);
  assert.match(context.replies[0], /Use !horoscopo <signo> para ver a previsão!/);
});

test('utilitário recusa comando fora do domínio sem efeitos colaterais', async () => {
  const domain = new UtilityToolsDomainDispatchTarget();
  const context = baseContext();

  assert.equal(await domain.dispatch('qrcode', context), false);
  assert.deepEqual(context.replies, []);
  assert.deepEqual(context.sent, []);
});
