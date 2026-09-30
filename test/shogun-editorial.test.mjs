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
    assert.match(text, /^⟡━━〔 🐈‍⬛ \*SHOGUN\* 〕━━⟡/u, name);
    assert.match(text, /☾ Salve, \*Lua\*\./u, name);
    const introduction = text.split('\n').find(line => line.startsWith('│  ') && !line.includes('Prefixo') && !line.includes('Salve,'));
    assert.ok(introduction, name);
    introductions.add(introduction);
    assert.match(text, /╭─ 01 ⟡ \*\p{Extended_Pictographic}/u, name);
    assert.match(text, /🐾 /u, name);
    assert.equal(text.includes('#intro#'), false, name);
    assert.equal(text.includes('#footer#'), false, name);
  }
  assert.equal(introductions.size, 14);
});

test('principal explica cada rota e downloads orientam busca e envio de link', async () => {
  const main = await menus.menu('!', 'SHOGUN', 'Lua');
  for (const text of ['Seu atalho para', 'Músicas, vídeos e redes sociais', 'Transforme mídia em figurinha', 'Crônicas da Ruptura']) assert.ok(main.includes(text), text);
  const media = await menus.menudown('/', 'SHOGUN', 'Lua');
  assert.ok(media.includes('Busque pelo nome ou mande o link'));
  assert.ok(media.includes('*/play* <nome ou link>'));
  assert.ok(media.includes('*/instagram* <link>'));
});

test('migração v3 troca apenas defaults e conserva todos os campos personalizados', () => {
  const old = { styleVersion: 3, header: '╭━━━〔 🐈‍⬛ *SHOGUN* 〕━━━\n┃  *#title#*\n┃  #nome# #separator# prefixo #prefix#\n┣━━━━━━━━━━━━━━━━━━━━', menuItemIcon: '  › ', middleBorder: '┃', menuTopBorder: '┣━', bottomBorder: 'FIM ESCOLHIDO', menuTitleIcon: '⚡ ', separatorIcon: '◆', separator: '·' };
  const next = withShogunMenuTheme(old);
  assert.equal(next.styleVersion, 4);
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
