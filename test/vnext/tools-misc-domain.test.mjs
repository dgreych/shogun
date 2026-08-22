import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MISC_TOOLS_NATIVE_COMMAND_TOKENS,
  MiscToolsDomainDispatchTarget,
} from '../../dist-vnext/tools/misc-domain.js';

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
    message: { key: { id: 'quoted-message' }, message: {} },
    socket: { sendMessage: async (...args) => { sent.push(args); } },
    reply: async (text) => { replies.push(text); },
    replies,
    sent,
    pickLoadingMessage: () => '⏳ carregando',
    ...overrides,
  };
}

test('catálogo diverso cobre sete famílias e dezessete tokens sem duplicata', () => {
  assert.equal(MISC_TOOLS_NATIVE_COMMAND_TOKENS.length, 17);
  assert.equal(new Set(MISC_TOOLS_NATIVE_COMMAND_TOKENS).size, 17);
  for (const token of [
    'nick', 'gerarnick', 'nickgenerator', 'qrcode', 'lerqr', 'readqr', 'scanqr',
    'encurtalink', 'tinyurl', 'dicionario', 'dictionary', 'tradutor', 'translator',
    'upload', 'imgpralink', 'videopralink', 'gerarlink',
  ]) assert.ok(MISC_TOOLS_NATIVE_COMMAND_TOKENS.includes(token), `token ausente: ${token}`);
});

test('nick preserva ajuda, aliases e styleText legado', async () => {
  const domain = new MiscToolsDomainDispatchTarget();
  const missing = baseContext();
  assert.equal(await domain.dispatch('nick', missing), true);
  assert.match(missing.replies[0], /GERADOR DE NICK/);

  const context = baseContext({ query: 'nazuna', styleText: async (text) => [`A:${text}`, `B:${text}`] });
  assert.equal(await domain.dispatch('gerarnick', context), true);
  assert.deepEqual(context.replies, ['A:nazuna\nB:nazuna']);
});

test('qrcode preserva loading, endpoint, legenda e mensagem citada', async () => {
  const domain = new MiscToolsDomainDispatchTarget();
  const context = baseContext({ query: 'https://exemplo.com/a b' });
  assert.equal(await domain.dispatch('qrcode', context), true);
  assert.deepEqual(context.replies, ['⏳ carregando']);
  assert.equal(context.sent.length, 1);
  assert.equal(context.sent[0][0], context.groupId);
  assert.deepEqual(context.sent[0][1].image, {
    url: 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https%3A%2F%2Fexemplo.com%2Fa%20b',
  });
  assert.match(context.sent[0][1].caption, /Seu QR Code super fofo está pronto/);
  assert.deepEqual(context.sent[0][2], { quoted: context.message });
});

test('lerqr mantém aliases, baixa imagem citada e devolve resultado do leitor', async () => {
  const domain = new MiscToolsDomainDispatchTarget();
  async function* stream() { yield Buffer.from('abc'); yield Buffer.from('123'); }
  let received;
  const quotedImage = { mimetype: 'image/png' };
  const context = baseContext({
    message: {
      message: { extendedTextMessage: { contextInfo: { quotedMessage: { imageMessage: quotedImage } } } },
    },
    qrReader: { readQRCode: async (buffer) => { received = buffer; return { message: 'QR:ok' }; } },
    downloadContentFromMessage: async (message, type) => {
      assert.equal(message, quotedImage);
      assert.equal(type, 'image');
      return stream();
    },
  });
  assert.equal(await domain.dispatch('scanqr', context), true);
  assert.equal(received.toString(), 'abc123');
  assert.deepEqual(context.replies, ['QR:ok']);
});

test('encurtalink preserva contrato HTTP e campos da resposta', async () => {
  const calls = [];
  const domain = new MiscToolsDomainDispatchTarget(async (...args) => {
    calls.push(args);
    return { data: { short_url: 'https://spoo.me/x', long_url: 'https://example.com/longo' } };
  });
  const context = baseContext({ query: 'https://example.com/longo' });
  assert.equal(await domain.dispatch('tinyurl', context), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://spoo.me/api/v1/shorten');
  assert.equal(calls[0][1].long_url, 'https://example.com/longo');
  assert.match(calls[0][1].alias, /^nazuna_\d{5}$/);
  assert.deepEqual(context.replies, [
    '⏳ carregando',
    '✅ *Link encurtado com sucesso!*\n\n🔗 *Link curto:* https://spoo.me/x\n📎 *Link original:* https://example.com/longo',
  ]);
});

test('tradutor mantém formato idioma | texto e chamada ao modelo legado', async () => {
  const calls = [];
  const domain = new MiscToolsDomainDispatchTarget();
  const context = baseContext({
    query: 'inglês | Bom dia!',
    defaultAiModel: 'modelo-teste',
    formatAIResponse: (text) => text.trim(),
    ai: {
      makeCognimaRequest: async (...args) => {
        calls.push(args);
        return { data: { choices: [{ message: { content: 'Good morning!' } }] } };
      },
    },
  });
  assert.equal(await domain.dispatch('translator', context), true);
  assert.deepEqual(calls, [[
    'modelo-teste',
    'Traduza o seguinte texto para inglês:\n\nBom dia!\n\nForneça apenas a tradução, sem explicações adicionais.',
    null,
  ]]);
  assert.equal(context.replies[0], '⏳ carregando');
  assert.match(context.replies[1], /GOOD MORNING|Good morning!/i);
});

test('dicionario preserva resultado primário e fallback de IA', async () => {
  const domain = new MiscToolsDomainDispatchTarget();
  const primary = baseContext({
    query: 'casa',
    dictionary: async () => ({
      palavra: 'casa', classe: 'substantivo', separacao: 'ca-sa',
      significados: ['moradia', 'lar'], exemplos: [{ texto: 'Voltei para casa.', fonte: 'exemplo' }],
      etimologia: 'origem histórica', frases: [{ texto: 'Minha casa.', autor: 'Autor' }],
    }),
  });
  assert.equal(await domain.dispatch('dictionary', primary), true);
  assert.match(primary.replies[1], /Significado de "casa"/);
  assert.match(primary.replies[1], /1\. moradia/);

  const fallback = baseContext({
    query: 'xyz',
    dictionary: async () => { throw new Error('offline'); },
    defaultAiModel: 'modelo-teste',
    formatAIResponse: (text) => `FMT:${text}`,
    ai: { makeCognimaRequest: async () => ({ data: { choices: [{ message: { content: 'definição' } }] } }) },
  });
  assert.equal(await domain.dispatch('dicionario', fallback), true);
  assert.equal(fallback.replies[1], 'FMT:definição');
});

test('upload mantém quatro aliases e escolhe mídia citada pelo tipo', async () => {
  const domain = new MiscToolsDomainDispatchTarget();
  const imageMessage = { mimetype: 'image/jpeg' };
  const context = baseContext({
    message: {
      message: { extendedTextMessage: { contextInfo: { quotedMessage: { imageMessage } } } },
    },
    isQuotedImage: true,
    getFileBuffer: async (message, type) => {
      assert.equal(message, imageMessage);
      assert.equal(type, 'image');
      return Buffer.from('imagem');
    },
    uploadMedia: async (media) => {
      assert.equal(media.toString(), 'imagem');
      return 'https://upload.example/media';
    },
  });
  assert.equal(await domain.dispatch('gerarlink', context), true);
  assert.deepEqual(context.replies, ['https://upload.example/media']);
});

test('comando alheio continua recusado pelo domínio', async () => {
  const domain = new MiscToolsDomainDispatchTarget();
  assert.equal(await domain.dispatch('nao-existe', baseContext()), false);
});
