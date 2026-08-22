import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LINK_CHECK_TOOLS_NATIVE_COMMAND_TOKENS,
  LinkCheckToolsDomainDispatchTarget,
} from '../../dist-vnext/tools/link-check-domain.js';

function baseContext(overrides = {}) {
  const replies = [];
  return {
    prefix: '!',
    query: '',
    sender: '5511999999999@s.whatsapp.net',
    groupId: '120363000000000000@g.us',
    pushName: 'Mauricio',
    isGroup: true,
    groupData: {},
    socket: {},
    reply: async (text) => { replies.push(text); },
    replies,
    ...overrides,
  };
}

test('catálogo de verificação possui uma família e quatro aliases', () => {
  assert.deepEqual(
    [...LINK_CHECK_TOOLS_NATIVE_COMMAND_TOKENS].sort(),
    ['verificar', 'checklink', 'scanlink', 'urlscan'].sort(),
  );
});

test('404 da FishFish preserva análise legada de domínio não listado', async () => {
  const calls = [];
  const domain = new LinkCheckToolsDomainDispatchTarget(async (...args) => {
    calls.push(args);
    return { status: 404, data: {} };
  });
  const context = baseContext({ query: 'https://example.com/caminho' });

  assert.equal(await domain.dispatch('checklink', context), true);
  assert.equal(context.replies[0], '🔍 Verificando segurança do link...');
  assert.match(context.replies[1], /🔗 \*Link:\* https:\/\/example\.com\/caminho/);
  assert.match(context.replies[1], /🌐 \*Domínio:\* example\.com/);
  assert.match(context.replies[1], /Não encontrado na base de ameaças/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.fishfish.gg/v1/domains/example.com');
  assert.equal(calls[0][1].timeout, 120000);
  assert.equal(calls[0][1].validateStatus(404), true);
  assert.equal(calls[0][1].validateStatus(500), false);
});

test('200 phishing preserva categoria, risco crítico e aviso explícito', async () => {
  const domain = new LinkCheckToolsDomainDispatchTarget(async () => ({
    status: 200,
    data: { category: 'phishing', created: '2026-08-01T00:00:00.000Z' },
  }));
  const context = baseContext({ query: 'evil.example/path' });

  assert.equal(await domain.dispatch('urlscan', context), true);
  assert.equal(context.replies.length, 2);
  assert.match(context.replies[1], /🚨 \*Resultado da Verificação\*/);
  assert.match(context.replies[1], /PHISHING DETECTADO/);
  assert.match(context.replies[1], /\*Nível de Risco:\* CRÍTICO/);
  assert.match(context.replies[1], /NÃO ACESSE ESTE LINK!/);
});

test('status inesperado e timeout preservam respostas de erro legadas', async () => {
  const unexpected = new LinkCheckToolsDomainDispatchTarget(async () => ({ status: 418, data: {} }));
  const first = baseContext({ query: 'example.com' });
  assert.equal(await unexpected.dispatch('verificar', first), true);
  assert.deepEqual(first.replies, [
    '🔍 Verificando segurança do link...',
    '❌ Erro ao verificar o link. Tente novamente mais tarde.',
  ]);

  const timeout = new LinkCheckToolsDomainDispatchTarget(async () => {
    const error = new Error('timeout of 120000ms exceeded');
    error.code = 'ECONNABORTED';
    throw error;
  });
  const second = baseContext({ query: 'example.com' });
  assert.equal(await timeout.dispatch('scanlink', second), true);
  assert.deepEqual(second.replies, [
    '🔍 Verificando segurança do link...',
    '⏰ Tempo esgotado! O servidor de verificação está demorando para responder.',
  ]);
});

test('sem consulta usa o alias real na ajuda e não chama rede', async () => {
  let calls = 0;
  const domain = new LinkCheckToolsDomainDispatchTarget(async () => {
    calls += 1;
    return { status: 404 };
  });
  const context = baseContext();

  assert.equal(await domain.dispatch('urlscan', context), true);
  assert.equal(calls, 0);
  assert.match(context.replies[0], /!urlscan <link>/);
  assert.match(context.replies[0], /!urlscan google\.com/);
});

test('comando estranho permanece fora do domínio', async () => {
  const domain = new LinkCheckToolsDomainDispatchTarget(async () => ({ status: 404 }));
  const context = baseContext();
  assert.equal(await domain.dispatch('upload', context), false);
  assert.deepEqual(context.replies, []);
});
