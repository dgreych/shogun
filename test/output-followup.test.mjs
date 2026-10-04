import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { formatCommandResponse, installBotPresentation, installCommandPresentation, renderCommandCard } from '../dados/src/utils/commandPresentation.js';
import { renderedOutputBody } from '../dados/src/menus/renderedOutput.js';
import { createShogunMenuTheme } from '../dados/src/menus/theme.js';
import { MembersGeneratedDomainDispatchTarget } from '../dist-vnext/members/generated-domain.js';
import { NexoWhatsAppTransport } from '../dados/src/nexo/transport/NexoWhatsAppTransport.js';

const updateNotice = '⚠️ *ATENÇÃO - ATUALIZAÇÃO DO BOT* ⚠️\n\n┏━━━━━━━━━━━━━━━━━━━━━\n┃ 📢 *AVISOS IMPORTANTES:*\n┣━━━━━━━━━━━━━━━━━━━━━\n┃ ✅ Banco de dados será\n┃    *PRESERVADO*\n┃ 📝 Para confirmar, use:\n┃ !atualizar sim\n┗━━━━━━━━━━━━━━━━━━━━━';
function socketFixture() {
  const sent = [];
  const socket = { async sendMessage(target, content, options) { sent.push({ target, content, options }); return { key: { id: `out-${sent.length}` } }; } };
  installBotPresentation(socket);
  return { socket, sent };
}

test('aviso real de atualização remove a moldura depois do preâmbulo sem apagar as instruções', () => {
  const out = formatCommandResponse(updateNotice, 'atualizar');
  const body = renderedOutputBody(out);
  assert.doesNotMatch(body, /[┏┃┣┗]/u);
  assert.ok(body.includes('⚠️ *ATENÇÃO - ATUALIZAÇÃO DO BOT* ⚠️'));
  assert.ok(body.includes('*PRESERVADO*'));
  assert.ok(body.includes('!atualizar sim'));
  assert.equal(formatCommandResponse(out, 'atualizar'), out);
});

test('desenho de tabela, URLs e texto customizado não são tratados como moldura do produto', () => {
  const originals = [
    'Mensagem do dono\n╭───╮\n│ x │\n╰───╯',
    '╭────────┬────────╮\n│ Item   │ Valor  │\n├────────┼────────┤\n│ A      │ 10     │\n╰────────┴────────╯',
    'https://example.com/a?x=1&y=2\n  Texto *do dono*\n│ trecho literal',
  ];
  for (const text of originals) assert.equal(renderedOutputBody(formatCommandResponse(text, 'perfil')), text);
});

test('código com bordas literais dentro da resposta mantém caracteres, espaços e aspas', () => {
  const text = '⚠️ Veja o resultado\n┏━━━━━━━━━━━━\n┃ *RESULTADO*\n┃ ```js\n┃ const box = "│╭──╮";\n┃   console.log(box, "https://example.com/a?x=1");\n┃ ```\n┗━━━━━━━━━━━━';
  const out = formatCommandResponse(text, 'ajuda');
  assert.match(out, /```js\nconst box = "│╭──╮";\n  console\.log\(box, "https:\/\/example\.com\/a\?x=1"\);\n```/u);
  assert.ok(!renderedOutputBody(out).includes('┃ ```'));
  const unwrapped = '╭── *RESULTADO* ──╮\n│ Nota\n```text\n│ conteúdo literal\n  ┏ desenho do usuário\n```\n╰────────╯';
  assert.match(formatCommandResponse(unwrapped, 'ajuda'), /```text\n│ conteúdo literal\n  ┏ desenho do usuário\n```/u);
});

for (const text of [
  'Este comando só pode ser usado em grupos 💔',
  'Ocorreu um erro ao limpar o chat 💔',
  'Somente administradores podem configurar a conversa.',
  'Apenas o dono do bot pode usar este comando.',
  'Use este comando em um grupo.',
]) test(`negativa ou erro real termina em falha: ${text}`, async () => {
  const { socket, sent } = socketFixture();
  const message = { key: { remoteJid: 'group@g.us', id: 'failure' } };
  installCommandPresentation(socket, message, 'grupo');
  await socket.sendMessage('group@g.us', { text }, { quoted: message });
  assert.deepEqual(sent.filter(event => event.content.react).map(event => event.content.react.text), ['⚠️']);
});

test('moldura preservada em tabela não transforma sucesso em erro nem muda tema personalizado', async () => {
  const { socket, sent } = socketFixture();
  const message = { key: { remoteJid: 'group@g.us', id: 'success' } };
  installCommandPresentation(socket, message, 'perfil');
  await socket.sendMessage('group@g.us', { text: 'Perfil consultado.\nApenas o campo Nome ficou vazio.' }, { quoted: message });
  assert.equal(sent.at(-1).content.react.text, '✅');
  const theme = { ...createShogunMenuTheme(), header: 'MEU #title#', bottomBorder: 'FIM DO DONO' };
  const custom = formatCommandResponse(updateNotice, 'atualizar', theme);
  assert.ok(custom.startsWith('MEU ATUALIZAR'));
  assert.ok(custom.endsWith('FIM DO DONO'));
});

test('level-up real usa cartão compartilhado sem mudar progressão, destinatário ou menção', async () => {
  const source = fs.readFileSync(new URL('../dados/src/utils/database.js', import.meta.url), 'utf8');
  const start = source.indexOf('function checkLevelUp(');
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start);
  const { socket, sent } = socketFixture();
  const saved = [];
  const checkLevelUp = new Function('saveLevelingSafe', 'calculateNextLevelXp', 'getPatent', 'getUserName', 'renderCommandCard', 'loadMenuDesign',
    `${source.slice(start, end)}\nreturn checkLevelUp;`)(
      data => saved.push(data), () => 100, () => 'Aprendiz', () => '123', renderCommandCard, () => ({}));
  const user = { level: 1, xp: 150, patent: 'Iniciante' };
  const data = { users: { '123@lid': user }, patents: [] };
  checkLevelUp('123@lid', user, data, socket, 'group@g.us');
  assert.equal(user.level, 2);
  assert.equal(user.xp, 50);
  assert.equal(saved.length, 1);
  assert.equal(saved[0], data);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].target, 'group@g.us');
  assert.deepEqual(sent[0].content.mentions, ['123@lid']);
  assert.match(sent[0].content.text, /🐈‍⬛/u);
  assert.doesNotMatch(sent[0].content.text, /^[│┃╭╰┣]/mu);
  assert.match(sent[0].content.text, /Nível.*2/u);
  assert.match(sent[0].content.text, /XP.*50\/100/u);
  assert.match(sent[0].content.text, /Aprendiz/u);
  assert.match(sent[0].content.text, /@123/u);
});

function roleScope(socket, message, reply, overrides = {}) {
  return { command: 'roles', ROLE_GOING_BASE: '🙋', ROLE_NOT_GOING_BASE: '🤷', args: [],
    formatRoleSummary: () => 'Praça às 18h', from: 'group@g.us',
    groupData: { roles: { festa: { title: 'Praça' } } }, groupPrefix: '!', isGroup: true,
    isGroupAdmin: true, socket, normalizar: value => value, reply,
    sender: 'member@lid', info: message, ...overrides };
}

test('roles cita a mensagem certa e finaliza seu feedback com comandos intercalados no mesmo chat', async () => {
  const { socket, sent } = socketFixture();
  const a = { key: { remoteJid: 'group@g.us', id: 'roles-A' } }, b = { key: { remoteJid: 'group@g.us', id: 'roles-B' } };
  installCommandPresentation(socket, a, 'roles');
  installCommandPresentation(socket, b, 'ping');
  const target = new MembersGeneratedDomainDispatchTarget();
  const manifest = JSON.parse(fs.readFileSync(new URL('../dados/src/.scripts/vnextMembersDomainScope.json', import.meta.url), 'utf8'));
  const sourceScope = roleScope(socket, a, async () => assert.fail('resposta não deveria ser necessária no grupo'));
  const membersScope = Object.fromEntries(manifest.freeBindings.map(name => [name, sourceScope[name]]));
  membersScope.command = 'roles';
  await target.dispatch('roles', { membersScope });
  const response = sent.find(event => event.content.text);
  assert.equal(response.options?.quoted, a);
  assert.match(response.content.text, /ROLES/u);
  assert.doesNotMatch(response.content.text, /CONEXÃO/u);
  assert.deepEqual(sent.filter(event => event.content.react).map(event => event.content.react.key.id), ['roles-A']);
});

test('roles no privado não leva citação nem contexto do grupo e confirmação fica no grupo', async () => {
  const { socket, sent } = socketFixture();
  const message = { key: { remoteJid: 'group@g.us', id: 'roles-private' } };
  installCommandPresentation(socket, message, 'roles');
  const replies = [];
  await new MembersGeneratedDomainDispatchTarget().dispatch('roles', { membersScope: roleScope(socket, message, async (...args) => replies.push(args), { isGroupAdmin: false }) });
  assert.equal(sent[0].target, 'member@lid');
  assert.equal(sent[0].options?.quoted, undefined);
  assert.equal(sent.filter(event => event.content.react).length, 0);
  assert.equal(replies.length, 1);
  assert.match(replies[0][0], /privado/u);
});

test('Nexo nunca cita mensagem de outro chat ao enviar texto ou imagem', async () => {
  const { socket, sent } = socketFixture();
  const wrongMessage = { key: { remoteJid: 'other@g.us', id: 'same' } };
  const transport = new NexoWhatsAppTransport({ socket, chatId: 'group@g.us', privateChatId: 'member@lid', quoted: wrongMessage });
  await transport.sendText('Painel');
  await transport.sendImage(Buffer.from('img'), { caption: 'Ficha' });
  assert.ok(sent.every(event => event.options?.quoted === undefined));
});

test('chamador real e runtime Nexo correlacionam a resposta à mensagem recebida sem usar último comando do chat', async () => {
  process.env.NEXO_DATABASE_PATH = ':memory:';
  const { handleNexoCommand } = await import('../dados/src/nexo/runtime.js');
  const source = fs.readFileSync(new URL('../dados/src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('await handleNexoCommand({');
  const call = source.slice(start, source.indexOf('\n      });', start) + '\n      });'.length);
  assert.ok(start >= 0 && call.endsWith('});'));
  const run = new (Object.getPrototypeOf(async function() {}).constructor)('handleNexoCommand', 'socket', 'info', 'args', 'nexoIsGroupAdmin', 'sender', 'isGroup', 'from', 'pushname', call);
  const { socket, sent } = socketFixture();
  const a = { key: { remoteJid: 'nexo-group@g.us', id: 'nexo-origin' } };
  const b = { key: { remoteJid: 'nexo-group@g.us', id: 'newer-command' } };
  installCommandPresentation(socket, a, 'nexo');
  installCommandPresentation(socket, b, 'ping');
  await run(handleNexoCommand, socket, a, ['status'], false, '123456789@lid', true, 'nexo-group@g.us', 'Membro');
  const response = sent.find(event => event.content.text);
  assert.equal(response.options?.quoted, a);
  assert.match(response.content.text, /\*NEXO\*/u);
  assert.doesNotMatch(response.content.text, /CONEXÃO/u);
  assert.deepEqual(sent.filter(event => event.content.react).map(event => event.content.react.key.id), ['nexo-origin']);
});

test('Nexo preserva citação de texto e imagem no chat original e nunca a leva ao privado', async () => {
  const { socket, sent } = socketFixture();
  const message = { key: { remoteJid: 'group@g.us', id: 'nexo-image' } };
  installCommandPresentation(socket, message, 'nexo');
  const transport = new NexoWhatsAppTransport({ socket, chatId: 'group@g.us', privateChatId: 'member@lid', quoted: message });
  const media = Buffer.from('img');
  await transport.sendText('Painel', { mentions: ['member@lid'] });
  await transport.sendImage(media, { caption: 'Ficha', preferPrivate: true });
  const text = sent.find(event => event.content.text);
  const image = sent.find(event => event.content.image);
  assert.equal(text.options?.quoted, message);
  assert.deepEqual(text.content.mentions, ['member@lid']);
  assert.equal(image.target, 'member@lid');
  assert.equal(image.options?.quoted, undefined);
  assert.equal(image.content.caption, 'Ficha');
  assert.equal(image.content.image, media);
  assert.deepEqual(sent.filter(event => event.content.react).map(event => event.content.react.key.id), ['nexo-image']);
});

test('linha que parece fechar a moldura dentro de código não interrompe o bloco nem deixa bordas no texto seguinte', () => {
  const text = '╭─ Código\n│ ```text\n╰── literal do usuário\n│ ```\n│ Texto após o bloco\n╰──';
  const out = formatCommandResponse(text, 'ajuda');
  assert.match(out, /```text\n╰── literal do usuário\n```/u);
  assert.ok(renderedOutputBody(out).includes('\nTexto após o bloco\n'));
  assert.ok(!renderedOutputBody(out).includes('│ Texto após o bloco'));
});

test('chamador de jogador Nexo mantém a mensagem original mesmo com outro comando ativo no grupo', async () => {
  process.env.NEXO_DATABASE_PATH = ':memory:';
  const { handleNexoPlayerCommand } = await import('../dados/src/nexo/runtime.js');
  const source = fs.readFileSync(new URL('../dados/src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('await handleNexoPlayerCommand({');
  const call = source.slice(start, source.indexOf('\n      });', start) + '\n      });'.length);
  const run = new (Object.getPrototypeOf(async function() {}).constructor)('handleNexoPlayerCommand', 'socket', 'info', 'args', 'command', 'sender', 'isGroup', 'from', 'pushname', call);
  const { socket, sent } = socketFixture();
  const a = { key: { remoteJid: 'player-group@g.us', id: 'player-origin' } }, b = { key: { remoteJid: 'player-group@g.us', id: 'player-other' } };
  installCommandPresentation(socket, a, 'continuar');
  installCommandPresentation(socket, b, 'ping');
  await run(handleNexoPlayerCommand, socket, a, [], 'continuar', '222333444@lid', true, 'player-group@g.us', 'Membro');
  const response = sent.find(event => event.content.text);
  assert.equal(response.options?.quoted, a);
  assert.doesNotMatch(response.content.text, /CONEXÃO/u);
  assert.deepEqual(sent.filter(event => event.content.react).map(event => event.content.react.key.id), ['player-origin']);
});

test('recusa real de admin Nexo envia falha explícita e reage apenas à mensagem original', async () => {
  process.env.NEXO_DATABASE_PATH = ':memory:';
  const { handleNexoCommand } = await import('../dados/src/nexo/runtime.js');
  const { socket, sent } = socketFixture();
  const message = { key: { remoteJid: 'denied@g.us', id: 'denied-original' } };
  installCommandPresentation(socket, message, 'nexo');
  installCommandPresentation(socket, { key: { remoteJid: 'denied@g.us', id: 'denied-newer' } }, 'ping');
  const view = await handleNexoCommand({ socket, quoted: message, args: ['ativar'], isGroupAdmin: false, raw: { messageId: message.key.id, chatId: message.key.remoteJid, senderLid: '555666777@lid', isGroup: true, groupId: message.key.remoteJid, text: '!nexo ativar', timestamp: Date.now() } });
  assert.equal(view.kind, 'ERROR');
  const response = sent.find(event => event.content.text);
  assert.match(response.content.text, /admin ou moderador/u);
  assert.equal(response.options?.quoted, message);
  assert.deepEqual(sent.filter(event => event.content.react).map(event => [event.content.react.text, event.content.react.key.id]), [['⚠️', message.key.id]]);
});
