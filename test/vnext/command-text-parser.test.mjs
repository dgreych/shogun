import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommandText } from '../../dist-vnext/commands/text-parser.js';

test('parser aceita comando direto e preserva argumentos', () => {
  const parsed = parseCommandText('!play música teste', '!', []);
  assert.equal(parsed.isCommand, true);
  assert.equal(parsed.command, 'play');
  assert.deepEqual(parsed.args, ['música', 'teste']);
  assert.equal(parsed.query, 'música teste');
});

test('parser preserva suporte legado a espaço depois do prefixo', () => {
  const parsed = parseCommandText('!   menu', '!', []);
  assert.equal(parsed.command, 'menu');
  assert.equal(parsed.rawCommandToken, 'menu');
});

test('parser aplica alias customizado e fixedParams antes dos argumentos do usuário', () => {
  const parsed = parseCommandText('!yt minha busca', '!', [{
    alias: 'yt',
    command: 'play',
    fixedParams: 'audio',
  }]);
  assert.equal(parsed.command, 'play');
  assert.equal(parsed.resolution.source, 'custom');
  assert.deepEqual(parsed.args, ['audio', 'minha', 'busca']);
  assert.equal(parsed.query, 'audio minha busca');
});

test('parser preserva alias builtin de delete', () => {
  const parsed = parseCommandText('!d', '!', []);
  assert.equal(parsed.command, 'delete');
  assert.equal(parsed.resolution.source, 'builtin');
});

test('texto sem prefixo não vira comando vNext', () => {
  const parsed = parseCommandText('menu', '!', []);
  assert.equal(parsed.isCommand, false);
  assert.equal(parsed.command, null);
});

test('prefixo customizado de grupo é aceito sem conhecimento de Baileys', () => {
  const parsed = parseCommandText('#menu', '#', []);
  assert.equal(parsed.command, 'menu');
  assert.equal(parsed.prefix, '#');
});
