import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function gatewayProbe({ failPrompt = false } = {}) {
  const source = fs.readFileSync('dados/src/funcs/private/assistant.js', 'utf8');
  const start = source.indexOf('async function processUserMessages(');
  const end = source.indexOf('function processLearning(', start);
  assert.ok(start >= 0 && end > start);
  const worker = source.slice(start, end).replaceAll('import.meta.url', '"file:///gateway/entry.js"');
  const requests = [];
  const scopes = [];
  const bindings = {
    fs: { appendFileSync() {} }, path, fileURLToPath: () => '/gateway/entry.js',
    validateMessage: message => message, historico: {},
    userContextDB: {
      registerInteraction: key => scopes.push(key), updateUserInfo() {}, getUserContextSummary: () => '',
    },
    updateHistorico() {}, processLearning() {},
    automacoesV9: { buildAssistantSystemPrompt(profile) {
      if (failPrompt) throw Error('perfil indisponível');
      return `PERFIL=${profile}`;
    } },
    getBunnyFyConversationModelOverride: () => undefined,
    makeNvidiaRequest: async (model, text, systemPrompt) => {
      requests.push({ model, text: JSON.parse(text), systemPrompt });
      return { data: { choices: [{ message: { content: JSON.stringify({
        resp: [{ id: 'r1', resp: 'Resposta de teste.', react: '' }], aprender: [],
      }) } }] } };
    },
    extractJSON: JSON.parse, cleanWhatsAppFormatting: value => value,
    getShogunReaction: () => '', console: { info() {}, warn() {}, error() {} },
  };
  const run = new Function(...Object.keys(bindings), `${worker}\nreturn processUserMessages;`)(...Object.values(bindings));
  return { run, requests, scopes };
}

const input = group => ({ mensagens: [{ texto: 'oi', nome_enviou: 'Pessoa', id_enviou: '123@lid', id_grupo: group }] });

test('o caminho real de conversa normaliza perfil e mantém contexto separado por grupo', async () => {
  const probe = gatewayProbe();
  for (const profile of ['shogun', 'perfil_antigo', 'pro']) {
    const result = await probe.run(input('grupo-a@g.us'), null, null, profile);
    assert.deepEqual(result.resp, [{ id: 'r1', resp: 'Resposta de teste.', react: '' }]);
  }
  await probe.run(input('grupo-b@g.us'), null, null, 'perfil_antigo');
  assert.ok(probe.requests.every(request => request.systemPrompt === 'PERFIL=shogun'));
  assert.ok(probe.scopes.every(scope => scope.endsWith('_shogun')));
  assert.notEqual(probe.scopes[0], probe.scopes.at(-1));
});

test('falha no preparo da voz não envia um texto antigo ao gateway', async () => {
  const probe = gatewayProbe({ failPrompt: true });
  const result = await probe.run(input('grupo-a@g.us'), null, null, 'perfil_antigo');
  assert.deepEqual(result.resp, []);
  assert.equal(probe.requests.length, 0);
});
