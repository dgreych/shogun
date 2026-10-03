import assert from 'node:assert/strict';
import test from 'node:test';
import menus from '../dados/src/menus/index.js';
import { createShogunMenuTheme, withShogunMenuTheme } from '../dados/src/menus/theme.js';
import { formatCommandResponse, renderCommandCard } from '../dados/src/utils/commandPresentation.js';
import { highlightMenuCommands } from '../dados/src/utils/shogunCore.js';

test('todos os 14 menus têm abertura própria, categorias com ícone e orientação editorial', async () => {
  const introductions = new Set();
  for (const [name, render] of Object.entries(menus)) {
    const args = name === 'menubn' ? ['!', 'SHOGUN', 'Lua', true] : name === 'menuTopCmd' ? ['!', 'SHOGUN', 'Lua', []] : ['!', 'SHOGUN', 'Lua'];
    const text = await render(...args);
    assert.match(text, /^⋆ · ⟡ 🐈‍⬛ ⟡ · ⋆\n   \*SHOGUN\*\n  ☾ ── ✧ ── ☽/u, name);
    assert.match(text, /\*Lua\*, aqui estão os comandos\./u, name);
    const lines = text.split('\n');
    const greetingIndex = lines.indexOf('*Lua*, aqui estão os comandos.');
    const introduction = lines[greetingIndex + 1];
    assert.ok(introduction, name);
    introductions.add(introduction);
    assert.match(text, /^☾ \*\p{Extended_Pictographic}/mu, name);
    assert.doesNotMatch(text, /^[│┃╭╰┣]/mu, name);
    assert.doesNotMatch(text, /nosso canto|sob a mesma lua|entre luas e ideias|o resto é comigo|escolha sua rota|seu próximo passo/iu, name);
    assert.match(text, /🐾 /u, name);
    assert.equal(text.includes('#intro#'), false, name);
    assert.equal(text.includes('#footer#'), false, name);
  }
  assert.equal(introductions.size, 14);
});

test('principal descreve seus comandos e downloads orientam pesquisa e uso de links', async () => {
  const main = await menus.menu('!', 'SHOGUN', 'Lua');
  const commands = [...main.matchAll(/^  ✧ › \*!([^*]+)\*\n {5}(\S[^\n]+)/gmu)];
  assert.equal(commands.length, 12);
  assert.equal(new Set(commands.map(match => match[1])).size, 12);
  assert.ok(commands.every(match => match[2].length > 20));
  const media = await menus.menudown('/', 'SHOGUN', 'Lua');
  assert.match(media, /nome para pesquisar ou um link para baixar/u);
  assert.ok(media.includes('*/play* <nome ou link>'));
  assert.ok(media.includes('*/instagram* <link>'));
});

test('migração v3 troca apenas defaults e conserva todos os campos personalizados', () => {
  const old = { styleVersion: 3, header: '╭━━━〔 🐈‍⬛ *SHOGUN* 〕━━━\n┃  *#title#*\n┃  #nome# #separator# prefixo #prefix#\n┣━━━━━━━━━━━━━━━━━━━━', menuItemIcon: '  › ', middleBorder: '┃', menuTopBorder: '┣━', bottomBorder: 'FIM ESCOLHIDO', menuTitleIcon: '⚡ ', separatorIcon: '◆', separator: '·' };
  const next = withShogunMenuTheme(old);
  assert.equal(next.styleVersion, 5);
  assert.equal(next.header, createShogunMenuTheme().header);
  assert.equal(next.menuItemIcon, createShogunMenuTheme().menuItemIcon);
  assert.equal(next.bottomBorder, 'FIM ESCOLHIDO');
  assert.equal(next.menuTitleIcon, '⚡ ');
});

test('resultados, espera e erros têm hierarquia própria sem reescrever dados arbitrários', () => {
  assert.match(formatCommandResponse('42 ms', 'ping'), /📡/u);
  assert.match(formatCommandResponse('Buscando a música. Aguarde.', 'play'), /⏳/u);
  assert.match(formatCommandResponse('❌ Falha ao obter arquivo.', 'mediafire'), /⚠️/u);
  const body = 'Nome: @123\nTítulo original: *texto*\nhttps://example.com/a?x=1\n```js\n  run();\n```';
  const result = formatCommandResponse(body, 'perfil');
  assert.match(result, /Nome: @123/);
  assert.match(result, /Título original: \*texto\*/);
  assert.match(result, /```js\n  run\(\);\n```/);
  assert.equal(formatCommandResponse(result, 'perfil'), result);
  assert.ok(renderCommandCard({ title: 'PERFIL', fields: [{ label: 'XP', value: 0 }] }).includes('*XP*'));
});

test('acabamento do runtime não duplica negrito nem divide aliases com ponto', () => {
  assert.equal(highlightMenuCommands('│ ⤷ *!menu*\n!role.vou', '!'), '│ ⤷ *!menu*\n*!role.vou*');
  assert.equal(highlightMenuCommands('```\n!menu\n```', '!'), '```\n!menu\n```');
});

test('menu customizado continua reconhecido depois de destacar orientações no rodapé', async () => {
  const custom = { ...createShogunMenuTheme(), header: 'CUSTOM #title#', middleBorder: 'SIDE', bottomBorder: 'FIM' };
  const menu = await menus.menuSticker('!', 'SHOGUN', 'Lua', custom);
  const highlighted = highlightMenuCommands(menu, '!');
  assert.equal(formatCommandResponse(highlighted, 'menufig', custom), highlighted);
});
