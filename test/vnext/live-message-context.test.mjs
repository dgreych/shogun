import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractLegacyMessageText,
  resolveLiveCommandDispatchInput,
} from '../../dist-vnext/adapters/live-message-context.js';

const textCases = [
  ['conversation', { conversation: '!menu' }, '!menu'],
  ['extended', { extendedTextMessage: { text: '!help' } }, '!help'],
  ['image caption', { imageMessage: { caption: '!sticker' } }, '!sticker'],
  ['video caption', { videoMessage: { caption: '!play x' } }, '!play x'],
  ['document caption', { documentMessage: { caption: '!doc' } }, '!doc'],
  ['button', { buttonsResponseMessage: { selectedButtonId: '!menuadm' } }, '!menuadm'],
  ['list', { listResponseMessage: { singleSelectReply: { selectedRowId: '!menudown' } } }, '!menudown'],
  ['template', { templateButtonReplyMessage: { selectedId: '!menuia' } }, '!menuia'],
  ['interactive native flow', {
    interactiveResponseMessage: {
      nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: '!menuvip' }) },
    },
  }, '!menuvip'],
];

for (const [name, message, expected] of textCases) {
  test(`extração textual preserva legado: ${name}`, () => {
    assert.equal(extractLegacyMessageText({ message }), expected);
  });
}

test('nativeFlow inválido retorna vazio e reporta erro sem lançar', () => {
  const errors = [];
  const text = extractLegacyMessageText({
    message: {
      interactiveResponseMessage: {
        nativeFlowResponseMessage: { paramsJson: '{invalido' },
      },
    },
  }, (error) => errors.push(error));

  assert.equal(text, '');
  assert.equal(errors.length, 1);
});

test('resolver entrega envelope completo de grupo sem acessar estado diretamente', async () => {
  const calls = [];
  const port = {
    getPrefix(chatId, isGroup) {
      calls.push(['prefix', chatId, isGroup]);
      return '#';
    },
    getAliases(chatId) {
      calls.push(['aliases', chatId]);
      return [{ alias: 'painel', command: 'menu' }];
    },
    isOwner(sender) {
      calls.push(['owner', sender]);
      return true;
    },
    isLiteMode(chatId, isGroup) {
      calls.push(['lite', chatId, isGroup]);
      return false;
    },
    getBotName() {
      calls.push(['bot']);
      return '𝖘𝖍𝖔𝖌𝖚𝖓';
    },
  };

  const message = {
    key: {
      remoteJid: '120363000000000000@g.us',
      participant: '5511999999999@s.whatsapp.net',
    },
    pushName: 'Mauricio',
    message: { conversation: '#painel' },
  };

  const result = await resolveLiveCommandDispatchInput({
    socket: { id: 'socket' },
    message,
    mediaPath: '/tmp/media',
    messagesCache: new Map(),
    rentalExpirationManager: { id: 'rental' },
  }, port);

  assert.equal(result.body, '#painel');
  assert.equal(result.prefix, '#');
  assert.equal(result.chatId, '120363000000000000@g.us');
  assert.equal(result.sender, '5511999999999@s.whatsapp.net');
  assert.equal(result.isGroup, true);
  assert.equal(result.pushName, 'Mauricio');
  assert.equal(result.botName, '𝖘𝖍𝖔𝖌𝖚𝖓');
  assert.equal(result.isOwner, true);
  assert.equal(result.isLiteMode, false);
  assert.deepEqual(result.rawAliases, [{ alias: 'painel', command: 'menu' }]);
  assert.equal(calls.length, 5);
});

test('conversa privada usa remoteJid como sender', async () => {
  const port = {
    getPrefix: () => '!',
    getAliases: () => [],
    isOwner: (sender) => sender.startsWith('5511'),
    isLiteMode: () => false,
    getBotName: () => '𝖘𝖍𝖔𝖌𝖚𝖓',
  };
  const result = await resolveLiveCommandDispatchInput({
    socket: {},
    message: {
      key: { remoteJid: '5511888888888@s.whatsapp.net' },
      message: { conversation: '!menu' },
    },
    messagesCache: new Map(),
    rentalExpirationManager: null,
  }, port);

  assert.equal(result.sender, '5511888888888@s.whatsapp.net');
  assert.equal(result.chatId, result.sender);
  assert.equal(result.isGroup, false);
  assert.equal(result.isOwner, true);
});
