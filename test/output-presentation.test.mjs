import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCommandResponse, installBotPresentation, installCommandPresentation, renderCommandCard } from '../dados/src/utils/commandPresentation.js';
import { createShogunMenuTheme, withShogunMenuTheme } from '../dados/src/menus/theme.js';

const signature = '⟡━━〔 🐈‍⬛ *SHOGUN* 〕━━⟡';
test('respostas mantêm conteúdo, listas, código e primeira linha de moldura antiga', () => {
  const text = '╭── *PERFIL* ──╮\n│ Nome: @123\n│\n│ ```js\n│ const a = 1;\n│ ```\n╰─────────╯';
  const out = formatCommandResponse(text, 'perfil');
  assert.ok(out.startsWith(signature));
  assert.match(out, /\*PERFIL\*/);
  assert.match(out, /Nome: @123/);
  assert.match(out, /```js\nconst a = 1;\n```/);
  assert.equal(formatCommandResponse(out, 'perfil'), out);
  assert.match(formatCommandResponse('• Primeiro\n\n• Segundo', 'ajuda'), /Primeiro[\s\S]*Segundo/);
});
test('tema migra defaults v2 preservando campos personalizados', () => {
  const result = withShogunMenuTheme({ styleVersion: 2, header: 'Meu #title#', menuItemIcon: '  ↳ ', bottomBorder: 'FIM' });
  assert.equal(result.styleVersion, 4);
  assert.equal(result.header, 'Meu #title#');
  assert.equal(result.menuItemIcon, createShogunMenuTheme().menuItemIcon);
  assert.equal(result.bottomBorder, 'FIM');
});
test('camada global cobre avisos, legendas, menus atuais e menções sem mutar mídia', async () => {
  const sent = [];
  const socket = { sendMessage: async (...args) => { sent.push(args); return { key: { id: 'out' } }; } };
  installBotPresentation(socket);
  installBotPresentation(socket);
  const bytes = Buffer.from('media');
  await socket.sendMessage('group', { text: 'Bem-vindo, @123!', mentions: ['123'] });
  await socket.sendMessage('group', { image: bytes, caption: 'Legenda *formatada*' });
  await socket.sendMessage('group', { text: `${signature}\nmenu` });
  await socket.sendMessage('group', { forward: { key: {}, message: { conversation: 'Original' } } });
  assert.ok(sent[0][1].text.startsWith(signature));
  assert.deepEqual(sent[0][1].mentions, ['123']);
  assert.equal(sent[1][1].image, bytes);
  assert.match(sent[1][1].caption, /Legenda \*formatada\*/);
  assert.equal(sent[2][1].text, `${signature}\nmenu`);
  assert.equal(sent[3][1].forward.message.conversation, 'Original');
});
test('contextos com mesmo id em grupos diferentes preservam título e design vivo', async () => {
  const sent = []; let bottomBorder = 'FINAL A';
  const socket = { sendMessage: async (...args) => sent.push(args) };
  installBotPresentation(socket, { getTheme: () => ({ ...createShogunMenuTheme(), bottomBorder }) });
  const a = { key: { id: 'same', remoteJid: 'A' } }, b = { key: { id: 'same', remoteJid: 'B' } };
  installCommandPresentation(socket, a, 'ping');
  installCommandPresentation(socket, b, 'instagram');
  await socket.sendMessage('A', { text: '42 ms' }, { quoted: a });
  bottomBorder = 'FINAL B';
  await socket.sendMessage('B', { video: Buffer.from('mp4'), caption: 'Vídeo pronto' }, { quoted: b });
  assert.match(sent[0][1].text, /CONEXÃO/);
  assert.ok(sent[0][1].text.endsWith('FINAL A'));
  const video = sent.find(event => event[1].video);
  assert.match(video[1].caption, /INSTAGRAM/);
  assert.ok(video[1].caption.endsWith('FINAL B'));
});
test('reação de resultado e apagamento são preservados e envio falho continua falhando', async () => {
  const sent = []; const key = { id: 'reaction', remoteJid: 'A' };
  const socket = { sendMessage: async (...args) => { if (args[1].text) throw new Error('transport'); sent.push(args); } };
  installBotPresentation(socket);
  for (const emoji of ['✅', '⚠️', '', '🎲']) await socket.sendMessage('A', { react: { key, text: emoji } });
  assert.deepEqual(sent.map(x => x[1].react.text), ['✅', '⚠️', '', '🎲']);
  await assert.rejects(socket.sendMessage('A', { text: 'Falhou' }), /transport/);
});
test('campos do card são dados, corpo conserva quebras e tema nunca perde conteúdo', () => {
  const out = renderCommandCard({ title: 'Resultado', fields: [{ label: 'Nome', value: '*Fulano*\nFake\u202e' }], lines: ['Texto *rico*\nSegunda linha', '```\nkey=value\n```'] });
  assert.ok(out.startsWith(signature));
  assert.match(out, /Nome.*Fulano Fake/);
  assert.match(out, /Texto \*rico\*\n│  Segunda linha/);
  assert.match(out, /```\nkey=value\n```/);
  assert.equal(out.includes('\u202e'), false);
});
test('menu com cabeçalho personalizado e ler mais não ganha segunda moldura', async () => {
  const { renderShogunMenu } = await import('../dados/src/menus/presentation.js');
  const custom = renderShogunMenu({ title: 'MENU', prefix: '!', userName: 'Fulano', sections: [], options: { ...createShogunMenuTheme(), header: 'CUSTOM #title#', bottomBorder: 'FIM' } });
  assert.equal(formatCommandResponse(custom, 'menu'), custom);
  assert.equal(formatCommandResponse('\u200e'.repeat(100) + custom, 'menu'), '\u200e'.repeat(100) + custom);
});
test('código de moldura antiga preserva indentação', () => {
  const out = formatCommandResponse('╭─ Código\n│ ```js\n│ if (a) {\n│   foo();\n│ }\n│ ```\n╰──', 'code');
  assert.match(out, /```js\nif \(a\) \{\n  foo\(\);\n\}\n```/);
});
test('feedback global só confirma envio concluído e conserva escolha explícita da reação', async () => {
  const sent = [];
  const socket = { sendMessage: async (...args) => { if (args[1].text?.includes('falha de rede')) throw new Error('transport'); sent.push(args); return {}; } };
  const message = { key: { id: 'feedback', remoteJid: 'A' } };
  installBotPresentation(socket); installCommandPresentation(socket, message, 'play');
  await socket.sendMessage('A', { text: 'Buscando a música. Aguarde um instante.' }, { quoted: message });
  assert.equal(sent.some(x => x[1].react?.text === '✅'), false);
  await socket.sendMessage('A', { audio: Buffer.from('mp3') }, { quoted: message });
  assert.equal(sent.at(-1)[1].react.text, '✅');
  await socket.sendMessage('A', { text: 'Não consegui concluir esse comando.' }, { quoted: message });
  assert.equal(sent.at(-1)[1].react.text, '⚠️');
  await socket.sendMessage('A', { react: { text: '🐈‍⬛', key: message.key } });
  await socket.sendMessage('A', { text: 'Outra resposta' }, { quoted: message });
  assert.equal(sent.filter(x => x[1].react?.text === '🐈‍⬛').length, 1);
  await assert.rejects(socket.sendMessage('A', { text: 'falha de rede' }, { quoted: message }));
});
test('reação usa conteúdo original com tema personalizado e espera com emoji', async () => {
  const sent = [];
  const socket = { sendMessage: async (...args) => { sent.push(args); return {}; } };
  const message = { key: { id: 'custom-feedback', remoteJid: 'A' } };
  const theme = { ...createShogunMenuTheme(), middleBorder: '│' };
  installBotPresentation(socket, { getTheme: () => theme });
  installCommandPresentation(socket, message, 'play');
  await socket.sendMessage('A', { text: formatCommandResponse('📡 Buscando a música. Aguarde.', 'play', theme) }, { quoted: message });
  assert.equal(sent.some(event => event[1].react?.text === '✅'), false);
  await socket.sendMessage('A', { text: formatCommandResponse('Não consegui concluir esse comando.', 'play', theme) }, { quoted: message });
  assert.equal(sent.at(-1)[1].react.text, '⚠️');
});

test('cabeçalho personalizado de linha única conserva título e identidade', () => {
  const text = renderCommandCard({ title: 'PROMOÇÃO SALVA', lines: ['Confirmado'], theme: { ...createShogunMenuTheme(), header: 'SHOGUN #title# · #nome# · #prefix#' } });
  assert.match(text, /^SHOGUN PROMOÇÃO SALVA/);
  assert.equal(text.includes('#nome#'), false);
});
test('avisos Procurando e Criando aguardam conclusão', async () => {
  const sent = []; const message = { key: { id: 'pending-gerunds', remoteJid: 'A' } };
  const socket = { sendMessage: async (...args) => sent.push(args) };
  installBotPresentation(socket); installCommandPresentation(socket, message, 'tradutor');
  for (const text of ['🔍 Procurando "example".', '🎨 Criando imagem.']) await socket.sendMessage('A', { text }, { quoted: message });
  assert.equal(sent.some(event => event[1].react?.text === '✅'), false);
});
