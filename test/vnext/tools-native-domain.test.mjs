import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TOOLS_NATIVE_COMMAND_TOKENS,
  ToolsDomainDispatchTarget,
} from '../../dist-vnext/tools/domain.js';

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
    buildGroupFilePath: () => '/tmp/grupo.json',
    reply: async (text) => { replies.push(text); },
    replies,
    ...overrides,
  };
}

test('catálogo nativo de tools possui nove famílias e 23 tokens sem duplicata', () => {
  assert.equal(TOOLS_NATIVE_COMMAND_TOKENS.length, 23);
  assert.equal(new Set(TOOLS_NATIVE_COMMAND_TOKENS).size, 23);
  for (const token of [
    'hora', 'groupstats', 'nota', 'note', 'notas', 'notes',
    'calc', 'calcular', 'calculadora', 'lembrete', 'lembrar',
    'meuslembretes', 'listalembretes', 'apagalembrete', 'removerlembrete',
    'aniversario', 'niver', 'birthday',
  ]) {
    assert.ok(TOOLS_NATIVE_COMMAND_TOKENS.includes(token), `token nativo ausente: ${token}`);
  }
});

test('nota e notas delegam à API legada preservando argumentos e paginação', async () => {
  const calls = [];
  const notes = {
    addNote: (...args) => { calls.push(['addNote', ...args]); return { message: 'adicionada' }; },
    getNote: (...args) => { calls.push(['getNote', ...args]); return { message: 'visualizada' }; },
    deleteNote: (...args) => { calls.push(['deleteNote', ...args]); return { message: 'apagada' }; },
    togglePin: (...args) => { calls.push(['togglePin', ...args]); return { message: 'fixada' }; },
    searchNotes: (...args) => { calls.push(['searchNotes', ...args]); return { message: 'busca' }; },
    listNotes: (...args) => { calls.push(['listNotes', ...args]); return { message: 'lista' }; },
  };
  const domain = new ToolsDomainDispatchTarget();

  const add = baseContext({ query: 'add estudar typescript', notes });
  assert.equal(await domain.dispatch('note', add), true);
  assert.deepEqual(calls.shift(), ['addNote', add.sender, 'estudar typescript', null, '!']);
  assert.deepEqual(add.replies, ['adicionada']);

  const pin = baseContext({ query: 'fixar 7', notes });
  assert.equal(await domain.dispatch('nota', pin), true);
  assert.deepEqual(calls.shift(), ['togglePin', pin.sender, 7]);
  assert.deepEqual(pin.replies, ['fixada']);

  const list = baseContext({ query: '3', notes });
  assert.equal(await domain.dispatch('notes', list), true);
  assert.deepEqual(calls.shift(), ['listNotes', list.sender, 3, 10, '!']);
  assert.deepEqual(list.replies, ['lista']);
});

test('calc preserva caminho de expressão e conversão do helper legado', async () => {
  const calls = [];
  const calculator = {
    calculate: (...args) => { calls.push(['calculate', ...args]); return { message: 'resultado expressão' }; },
    convert: (...args) => { calls.push(['convert', ...args]); return { message: 'resultado conversão' }; },
  };
  const domain = new ToolsDomainDispatchTarget();

  const expression = baseContext({ query: 'sqrt(144)', calculator });
  assert.equal(await domain.dispatch('calculadora', expression), true);
  assert.deepEqual(calls.shift(), ['calculate', 'sqrt(144)', '!']);
  assert.deepEqual(expression.replies, ['resultado expressão']);

  const conversion = baseContext({ query: 'converter 100 km mi', calculator });
  assert.equal(await domain.dispatch('calc', conversion), true);
  assert.deepEqual(calls.shift(), ['convert', 100, 'km', 'mi']);
  assert.deepEqual(conversion.replies, ['resultado conversão']);
});

test('lembrete persiste o mesmo payload e invalida o cache duas vezes', async () => {
  const domain = new ToolsDomainDispatchTarget();
  const saved = [];
  const clears = [];
  const existing = [];
  const at = Date.now() + 60_000;
  const optimizer = {
    memoize: async (key, loader, ttl) => {
      assert.equal(key, 'reminders:all');
      assert.equal(ttl, 5000);
      return loader();
    },
    clearStatic: (key) => clears.push(key),
  };
  const context = baseContext({
    query: 'em 1m testar lembrete',
    optimizer,
    loadReminders: () => existing,
    saveReminders: (items) => saved.push(items.map((item) => ({ ...item }))),
    parseReminderInput: (query) => {
      assert.equal(query, 'em 1m testar lembrete');
      return { at, message: 'testar lembrete' };
    },
    tzFormat: (timestamp) => `quando:${timestamp}`,
  });

  assert.equal(await domain.dispatch('lembrar', context), true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].length, 1);
  assert.equal(saved[0][0].userId, context.sender);
  assert.equal(saved[0][0].chatId, context.groupId);
  assert.equal(saved[0][0].createdByName, context.pushName);
  assert.equal(saved[0][0].at, at);
  assert.equal(saved[0][0].message, 'testar lembrete');
  assert.equal(saved[0][0].status, 'pending');
  assert.match(saved[0][0].id, /^[0-9a-f]+$/);
  assert.deepEqual(clears, ['reminders:all', 'reminders:all']);
  assert.deepEqual(context.replies, [`✅ Lembrete agendado para quando:${at}.\n📝 Mensagem: testar lembrete`]);
});

test('listar e apagar lembretes preserva filtro por usuário, status e prefixo de id', async () => {
  const domain = new ToolsDomainDispatchTarget();
  const sender = '5511999999999@s.whatsapp.net';
  const initial = [
    { id: 'abcdef123456', userId: sender, at: 20, message: 'segundo', status: 'pending' },
    { id: '123456abcdef', userId: sender, at: 10, message: 'primeiro', status: 'pending' },
    { id: 'sent00000000', userId: sender, at: 5, message: 'enviado', status: 'sent' },
    { id: 'other0000000', userId: 'outro', at: 1, message: 'outro', status: 'pending' },
  ];
  let current = initial.map((item) => ({ ...item }));
  const optimizer = {
    memoize: async (_key, loader) => loader(),
    clearStatic: () => {},
  };
  const common = {
    sender,
    optimizer,
    loadReminders: () => current,
    saveReminders: (items) => { current = items.map((item) => ({ ...item })); },
    tzFormat: (at) => `T${at}`,
  };

  const list = baseContext({ ...common });
  assert.equal(await domain.dispatch('listalembretes', list), true);
  assert.deepEqual(list.replies, ['🗓️ Seus lembretes pendentes:\n\n1. [123456] T10 — primeiro\n2. [abcdef] T20 — segundo']);

  const remove = baseContext({ ...common, query: '123456' });
  assert.equal(await domain.dispatch('removerlembrete', remove), true);
  assert.deepEqual(remove.replies, ['🗑️ Lembrete removido: primeiro']);
  assert.deepEqual(current.map((item) => item.id), ['abcdef123456', 'sent00000000', 'other0000000']);
});

test('aniversario usa arquivo irmão do estado do grupo e preserva formato legado', async () => {
  const domain = new ToolsDomainDispatchTarget();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-birthday-'));
  const groupId = '120363000000000000@g.us';
  const groupFile = path.join(tempDir, `${groupId}.json`);
  const birthdayFile = path.join(tempDir, `${groupId}_aniversarios.json`);
  try {
    const context = baseContext({
      groupId,
      query: 'definir 25/12',
      buildGroupFilePath: () => groupFile,
    });
    assert.equal(await domain.dispatch('birthday', context), true);
    const stored = JSON.parse(fs.readFileSync(birthdayFile, 'utf8'));
    assert.deepEqual(stored[context.sender], { dia: 25, mes: 12, nome: 'Mauricio' });
    assert.deepEqual(context.replies, ['🎂 Aniversário definido!\n\n📅 *Data:* 25/12\n👤 *Nome:* Mauricio']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('tools continua recusando comando fora do domínio para a próxima camada', async () => {
  const domain = new ToolsDomainDispatchTarget();
  const context = baseContext();
  assert.equal(await domain.dispatch('qrcode', context), false);
  assert.deepEqual(context.replies, []);
});
