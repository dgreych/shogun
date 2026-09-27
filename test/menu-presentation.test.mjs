import assert from 'node:assert/strict';
import test from 'node:test';
import menus from '../dados/src/menus/index.js';

const presentation = await import('../dados/src/menus/presentation.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url === new URL('../dados/src/menus/presentation.js', import.meta.url).href) return {};
  throw error;
});

test('principal organiza os recursos nas categorias aprovadas sem descrições forçadas', async () => {
  const output = await menus.menu('!', 'SHOGUN', 'Maurício');
  assert.match(output, /^╭━╼ 🐈‍⬛ \*SHOGUN\*\n/u);
  assert.match(output, /┃  \*MENU PRINCIPAL\*/u);
  assert.match(output, /┣━╼ 01 ╸ \*MÍDIA & CRIAÇÃO\*[\s\S]*!menudown[\s\S]*!menufig/u);
  assert.match(output, /┣━╼ 02 ╸ \*JOGOS & INTERAÇÕES\*[\s\S]*!menubn[\s\S]*!menumemb[\s\S]*!menurpg/u);
  assert.match(output, /┣━╼ 03 ╸ \*RECURSOS\*[\s\S]*!ferramentas[\s\S]*!menunexo/u);
  assert.match(output, /╰━╼ SHOGUN ━━━━━━━━━$/u);
});

test('nome vindo da mensagem não injeta comandos nem quebra a moldura', async () => {
  const output = await menus.menu('!', 'SHOGUN', '*Fulano*\n!exec\u202E\u200B');
  assert.equal(output.includes('\n!exec'), false);
  assert.equal(output.includes('\u202E'), false);
  assert.equal(output.includes('\u200B'), false);
  assert.equal(output.includes('*Fulano*'), false);
});

test('exemplos de comandos preservam prefixos reais e argumentos', async () => {
  for (const prefix of ['!', '/', '>>']) {
    const output = await menus.menubn(prefix, 'SHOGUN', 'Maurício', true);
    assert.ok(output.includes(`${prefix}uno jogar <n°>`));
    assert.ok(output.includes(`${prefix}quiz <categoria>`));
    assert.ok(output.includes(`${prefix}tictactoe @user`));
    assert.equal(output.includes(`${prefix}sexo`), false);
    assert.match(output, /^╭━╼ 🐈‍⬛ \*SHOGUN\*/u);
  }
});

test('todos os submenus carregados usam o mesmo acabamento sem ornamentação anterior', async () => {
  for (const [key, render] of Object.entries(menus)) {
    if (key === 'menuTopCmd') continue;
    const output = key === 'menubn'
      ? await render('!', 'SHOGUN', 'Maurício', true)
      : await render('!', 'SHOGUN', 'Maurício');
    assert.match(output, /^╭━╼ 🐈‍⬛ \*SHOGUN\*/u, key);
    assert.match(output, /╰━╼ SHOGUN ━━━━━━━━━$/u, key);
    assert.doesNotMatch(output, /🫟|🍧|❁|OPERADOR/u, key);
  }
});

test('compositor omite categorias vazias e mantém argumentos numa entrada', () => {
  assert.equal(typeof presentation.renderShogunMenu, 'function', 'compositor compartilhado ainda não existe');
  const output = presentation.renderShogunMenu({
    title: 'DOWNLOADS', prefix: '/', userName: 'Maurício',
    sections: [
      { title: 'VAZIO', entries: [] },
      { title: 'VÍDEOS', entries: [{ command: 'instagram', arguments: '<link>', description: 'Baixar publicação' }] },
    ],
  });
  assert.equal(output.includes('VAZIO'), false);
  assert.ok(output.includes('┃  ↳ /instagram <link>'));
  assert.ok(output.includes('┃    Baixar publicação'));
});

test('nome longo é limitado por grafemas sem separar sequências de emoji', () => {
  assert.equal(typeof presentation.sanitizeMenuDisplayName, 'function', 'sanitização ainda não existe');
  const name = presentation.sanitizeMenuDisplayName('👨‍👩‍👧‍👦'.repeat(60));
  assert.equal([...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(name)].length, 48);
  assert.equal(name.endsWith('👨‍👩‍👧‍👦'), true);
  assert.equal(presentation.sanitizeMenuDisplayName('  *Teste*\n`fulano`\u202E  '), 'Teste fulano');
});

test('ranking mantém estatísticas e exemplos de consulta com o prefixo escolhido', async () => {
  const output = await menus.menuTopCmd('/', 'SHOGUN', 'Maurício', [
    { name: 'play', count: 19, uniqueUsers: 4 },
    { name: 'sticker', count: 12, uniqueUsers: 3 },
  ]);
  assert.match(output, /^╭━╼ 🐈‍⬛ \*SHOGUN\*/u);
  assert.ok(output.includes('/play'));
  assert.ok(output.includes('19 usos'));
  assert.ok(output.includes('4 usuários'));
  assert.ok(output.includes('/cmdinfo'));
});

test('alteradores distinguem edição de vídeo, áudio e imagem', async () => {
  const output = await menus.menuAlterador('!', 'SHOGUN', 'Maurício');
  assert.match(output, /┣━╼ \d{2} ╸ \*VÍDEO · EDIÇÃO BÁSICA\*[\s\S]*!cortarvideo/u);
  assert.match(output, /┣━╼ \d{2} ╸ \*ÁUDIO · EDIÇÃO BÁSICA\*[\s\S]*!cortaraudio/u);
  assert.match(output, /┣━╼ \d{2} ╸ \*IMAGENS\*[\s\S]*!rmbg/u);
});

test('compositor preserva a exclusão aplicada pelo runtime anterior ao menu de brincadeiras', async () => {
  const output = await menus.menubn('!', 'SHOGUN', 'Maurício', false);
  assert.equal(output.includes('┃  ↳ !nazista\n'), false);
});
