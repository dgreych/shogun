import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import topcmd from '../dados/src/menus/topcmd.js';
import { prepareMenuSections, renderShogunMenu } from '../dados/src/menus/presentation.js';
import { evaluateCommandAccess } from '../dist-vnext/commands/access-policy.js';
import { findCommandAccessPolicy } from '../dist-vnext/commands/access-catalog.js';

const member = { resolved: true, isGroup: true, isOwner: false, isSubOwner: false,
  isGroupAdmin: false, isRealGroupAdmin: false, isBotAdmin: true };
const accessFor = command => evaluateCommandAccess(findCommandAccessPolicy(command), member);

test('resolvedor legado permite encerrar utilitários após a consulta', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--input-type=module', '-e',
    'await import("./dados/src/utils/commandResolver.js");'], { timeout: 5000, stdio: 'pipe' }));
});

test('as sugestões reais filtram permissões antes da similaridade, contagem e limite', () => {
  const source = fs.readFileSync('dados/src/index.js', 'utf8');
  const functions = source.slice(source.indexOf('function Commands('), source.indexOf('let cachedValidCommandSet'));
  const handlers = new Function('fs', '__dirname', 'fuzzySimilarity', `${functions}\nreturn { Commands, getTotalCommands, getTopSimilarCommands };`)(
    { readFileSync: () => "case 'reiniciar': case 'play': case 'menudono': case 'sticker':" }, '.',
    (_word, candidate) => ({ reiniciar: 100, play: 90, menudono: 95, sticker: 85 })[candidate],
  );
  assert.equal(handlers.Commands('erro', '!', accessFor).command, 'play');
  assert.equal(handlers.getTotalCommands(accessFor), 2);
  assert.deepEqual(handlers.getTopSimilarCommands('erro', 2, accessFor).map(item => item.command), ['play', 'sticker']);
});

test('ranking filtra comandos antes de numerar as posições', async () => {
  const text = await topcmd('!', 'Shogun', 'Membro', [
    { name: 'reiniciar', count: 50, uniqueUsers: 1 }, { name: 'play', count: 30, uniqueUsers: 8 },
    { name: 'menudono', count: 20, uniqueUsers: 1 }, { name: 'sticker', count: 10, uniqueUsers: 4 },
  ], { accessFor });
  assert.doesNotMatch(text, /!reiniciar|!menudono/);
  assert.match(text, /1º · 30 usos/);
  assert.match(text, /2º · 10 usos/);
  assert.doesNotMatch(text, /3º|4º/);
});

test('seleção conserva lite e elimina seção vazia e família desconhecida', () => {
  const sections = prepareMenuSections([
    { title: 'GESTÃO', entries: [{ command: 'reiniciar' }] },
    { title: 'PÚBLICO', entries: [{ command: 'play' }, { command: 'sticker', liteExcluded: true }, { command: 'naoexiste' }] },
  ], { accessFor }, { isLiteMode: true });
  const text = renderShogunMenu({ title: 'TESTE', prefix: '!', userName: 'Membro', sections });
  assert.match(text, /!play/);
  assert.doesNotMatch(text, /GESTÃO|!reiniciar|!sticker|!naoexiste/);
});
