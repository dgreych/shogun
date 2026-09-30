import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ENV_EXAMPLE_PATH,
  parseEnvText,
  secretState,
  updateEnvText,
  validateEnvUpdates,
  validateIdentity
} from '../dados/src/.scripts/instanceConfigStore.js';

test('updateEnvText preserva comentários e chaves desconhecidas', () => {
  const input = [
    '# comentário humano',
    'DESCONHECIDA=fica',
    'BUNNYFY_ENABLED=false',
    'BUNNYFY_API_TOKEN=antigo',
    ''
  ].join('\n');

  const result = updateEnvText(input, {
    BUNNYFY_ENABLED: 'true',
    BUNNYFY_API_TOKEN: 'novo-segredo',
    NVIDIA_API_KEY: 'nv-key'
  });

  assert.match(result, /# comentário humano/);
  assert.match(result, /DESCONHECIDA=fica/);
  assert.match(result, /BUNNYFY_ENABLED=true/);
  assert.match(result, /BUNNYFY_API_TOKEN=novo-segredo/);
  assert.match(result, /NVIDIA_API_KEY=nv-key/);
  assert.doesNotMatch(result, /BUNNYFY_API_TOKEN=antigo/);
});

test('parseEnvText lê valores simples, entre aspas e com sinal de igual', () => {
  const values = parseEnvText('A=1\nB="valor com espaço"\nTOKEN="abc=def=="\n# C=3\n');
  assert.equal(values.get('A'), '1');
  assert.equal(values.get('B'), 'valor com espaço');
  assert.equal(values.get('TOKEN'), 'abc=def==');
  assert.equal(values.has('C'), false);
});

test('updateEnvText é idempotente para o mesmo conjunto de alterações', () => {
  const input = 'BOT_NAME=SHOGUN\nBUNNYFY_ENABLED=false\n';
  const updates = { BOT_NAME: 'SHOGUN Prime', BUNNYFY_ENABLED: 'true' };
  const once = updateEnvText(input, updates);
  const twice = updateEnvText(once, updates);
  assert.equal(twice, once);
});

test('updateEnvText permite remoção explícita de segredo sem remover a chave', () => {
  const result = updateEnvText('NVIDIA_API_KEY=segredo\n', { NVIDIA_API_KEY: '' });
  assert.match(result, /^NVIDIA_API_KEY=\n$/);
  assert.doesNotMatch(result, /segredo/);
});

test('validateIdentity exige dono real e prefixo unitário', () => {
  assert.deepEqual(validateIdentity({
    nomedono: 'Mauricio',
    numerodono: '5522999999999',
    nomebot: 'SHOGUN',
    prefixo: '!'
  }), []);

  assert.ok(validateIdentity({
    nomedono: '',
    numerodono: '123',
    nomebot: '',
    prefixo: '!!'
  }).length >= 4);
});

test('validateEnvUpdates reprova modo inválido', () => {
  const failures = validateEnvUpdates({
    BUNNYFY_ENABLED: 'false',
    BUNNYFY_CONVERSATION_MODE: 'talvez'
  });
  assert.ok(failures.some(item => item.includes('BUNNYFY_CONVERSATION_MODE')));
});

test('validateEnvUpdates exige URL e permite a ausência de chave para o acesso gratuito', () => {
  const failures = validateEnvUpdates({
    BUNNYFY_ENABLED: 'true',
    BUNNYFY_CONVERSATION_MODE: 'exclusive',
    BUNNYFY_BASE_URL: '',
    BUNNYFY_API_TOKEN: ''
  });
  assert.ok(failures.some(item => item.includes('URL')));
  assert.equal(failures.some(item => item.includes('credencial')), false);
  assert.deepEqual(validateEnvUpdates({ BUNNYFY_ENABLED: 'true', BUNNYFY_CONVERSATION_MODE: 'exclusive', BUNNYFY_BASE_URL: 'http://node1.vexhost.com.br:20056', BUNNYFY_API_TOKEN: '' }), []);
});

test('validateEnvUpdates aceita BunnyFy local com credencial e modo válido', () => {
  assert.deepEqual(validateEnvUpdates({
    BUNNYFY_ENABLED: 'true',
    BUNNYFY_CONVERSATION_MODE: 'exclusive',
    BUNNYFY_BASE_URL: 'http://127.0.0.1:18080',
    BUNNYFY_API_TOKEN: 'consumer-token'
  }), []);
});

test('.env.example nunca simula segredo já configurado', () => {
  const values = parseEnvText(fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8'));
  assert.equal(values.has('BUNNYFY_API_TOKEN'), true);
  for (const key of [...values.keys()].filter(key => /(?:_KEY|_TOKEN|_SECRET)$/.test(key))) {
    assert.equal(values.get(key), '', `${key} deve permanecer vazio no exemplo`);
  }
});

test('secretState nunca devolve o segredo', () => {
  const secret = 'nao-pode-vazar-123';
  assert.equal(secretState(secret), 'configurado');
  assert.equal(secretState(''), 'não configurado');
  assert.doesNotMatch(secretState(secret), /nao-pode-vazar/);
});

test('arquivo temporário de env mantém conteúdo após transformação', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shogun-config-'));
  const file = path.join(dir, '.env.local');
  fs.writeFileSync(file, 'BOT_NAME=SHOGUN\nCUSTOM_FLAG=abc\n');
  const next = updateEnvText(fs.readFileSync(file, 'utf8'), { BOT_NAME: 'Meu Shogun' });
  fs.writeFileSync(file, next);
  const stored = fs.readFileSync(file, 'utf8');
  assert.match(stored, /BOT_NAME="Meu Shogun"/);
  assert.match(stored, /CUSTOM_FLAG=abc/);
  fs.rmSync(dir, { recursive: true, force: true });
});
