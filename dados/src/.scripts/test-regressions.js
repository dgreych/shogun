#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getQuotedContextInfo, loadSafeCommandAliases, normalizeCommandAliases, resolveCommandInput } from '../utils/commandResolver.js';
import { requestNvidiaChat } from '../utils/nvidiaApi.js';
import { extractJSON } from '../funcs/private/ia.js';
import { buildVexFailureLogEntry } from '../funcs/downloads/youtube.js';
import { getQuotedMediaSource } from '../utils/gyomeiCore.js';
import { normalizeVipCommandsData } from '../utils/vipCommandsManager.js';
import { buildSafeMessagePreview } from '../utils/safeCommandLog.js';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

await test('alias oficial d resolve sempre para delete', () => {
  const result = resolveCommandInput('d', [{ alias: 'd', command: 'menu' }]);
  assert.equal(result.command, 'delete');
  assert.equal(result.source, 'builtin');
});

await test('formatos antigos de aliases são normalizados', () => {
  assert.deepEqual(normalizeCommandAliases([]), []);
  assert.deepEqual(normalizeCommandAliases({}), []);
  assert.deepEqual(normalizeCommandAliases({ aliases: [{ alias: 'Oi', command: 'Menu' }] }), [
    { alias: 'oi', command: 'menu', fixedParams: '' }
  ]);
});

await test('commandAliases.json antigo é migrado em disco', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nazuna-alias-'));
  const file = path.join(tempDir, 'commandAliases.json');
  fs.writeFileSync(file, '[]');
  assert.deepEqual(loadSafeCommandAliases(file), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { aliases: [] });
  fs.rmSync(tempDir, { recursive: true, force: true });
});

await test('aliases inválidos e reservados são descartados', () => {
  const aliases = normalizeCommandAliases({ aliases: [
    null,
    { alias: 'd', command: 'menu' },
    { alias: '', command: 'menu' },
    { alias: 'ajuda', command: 'menu' }
  ] });
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].alias, 'ajuda');
});

await test('contexto de mensagem citada é reconhecido em texto e mídia', () => {
  const textContext = { stanzaId: 'ABC', participant: '1@s.whatsapp.net' };
  assert.equal(getQuotedContextInfo({ extendedTextMessage: { contextInfo: textContext } }), textContext);

  const imageContext = { stanzaId: 'DEF', participant: '2@s.whatsapp.net' };
  assert.equal(getQuotedContextInfo({ imageMessage: { contextInfo: imageContext } }), imageContext);

  const wrappedContext = { stanzaId: 'GHI', participant: '3@s.whatsapp.net' };
  assert.equal(getQuotedContextInfo({
    viewOnceMessageV2: { message: { videoMessage: { contextInfo: wrappedContext } } }
  }), wrappedContext);
});

await test('logger omite argumentos privados de play, ytmp3 e setnvidia sem alterar os demais previews', () => {
  const privateQuery = 'https://youtube.example/watch?v=consulta-privada';
  const fakeSecret = 'segredo-ficticio-que-nao-pode-vazar';

  assert.equal(buildSafeMessagePreview({
    isCommand: true,
    prefix: '!',
    command: 'play',
    query: privateQuery,
    body: `!play ${privateQuery}`
  }), '!play [argumentos omitidos]');
  assert.equal(buildSafeMessagePreview({
    isCommand: true,
    prefix: '!',
    command: 'YTMP3',
    query: privateQuery,
    body: `!YTMP3 ${privateQuery}`
  }), '!YTMP3 [argumentos omitidos]');
  const setNvidiaPreview = buildSafeMessagePreview({
    isCommand: true,
    prefix: '!',
    command: 'setnvidia',
    query: fakeSecret,
    body: `!setnvidia ${fakeSecret}`
  });
  assert.equal(setNvidiaPreview, '!setnvidia [argumentos omitidos]');
  assert.equal(setNvidiaPreview.includes(fakeSecret), false);
  assert.equal(buildSafeMessagePreview({
    isCommand: true,
    prefix: '!',
    command: 'menu',
    query: '12345678901234567890123456',
    body: ''
  }), '!menu 1234567890123456789012345...');
  assert.equal(buildSafeMessagePreview({
    isCommand: false,
    body: 'mensagem normal'
  }), 'mensagem normal');
});

await test('diagnóstico Vex do YouTube não inclui consulta, URL ou conteúdo da resposta', () => {
  const privateContent = 'consulta-privada-que-nao-pode-aparecer';
  const entry = buildVexFailureLogEntry('youtubemp3', {
    status: 502,
    data: {
      success: false,
      message: privateContent,
      query: privateContent,
      resultado: { url: `https://example.invalid/${privateContent}` }
    }
  });
  const serialized = JSON.stringify(entry);

  assert.deepEqual(Object.keys(entry).sort(), [
    'code',
    'endpoint',
    'hasMessage',
    'httpStatus',
    'marca',
    'responseShape',
    'success',
    'ts'
  ]);
  assert.equal(entry.endpoint, 'youtubemp3');
  assert.equal(entry.httpStatus, 502);
  assert.equal(entry.responseShape, 'resultado');
  assert.equal(entry.success, false);
  assert.equal(entry.hasMessage, true);
  assert.ok(!serialized.includes(privateContent));
  assert.ok(!serialized.includes('example.invalid'));

  const unknownEndpoint = buildVexFailureLogEntry(privateContent, { status: 999, data: 'texto privado' });
  assert.equal(unknownEndpoint.endpoint, 'desconhecido');
  assert.equal(unknownEndpoint.httpStatus, null);
  assert.ok(!JSON.stringify(unknownEndpoint).includes(privateContent));

  const youtubeSource = fs.readFileSync(new URL('../funcs/downloads/youtube.js', import.meta.url), 'utf8');
  assert.ok(!youtubeSource.includes('query=${youtubeUrl}'));
  assert.ok(!youtubeSource.includes('JSON.stringify(response.data).slice'));
  assert.ok(youtubeSource.includes('buildVexFailureLogEntry(endpoint, response)'));
});


await test('fontes usam o modelo NVIDIA padrão (3.3) sem depender de patch no startup', () => {
  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.ok(iaSource.includes('meta/llama-3.3-70b-instruct') || iaSource.includes('DEFAULT_NVIDIA_MODEL'));
  assert.ok(indexSource.includes('meta/llama-3.3-70b-instruct') || indexSource.includes('DEFAULT_NVIDIA_MODEL'));
  assert.ok(!iaSource.includes('moonshotai/kimi-k2-instruct'));
  assert.ok(!indexSource.includes('moonshotai/kimi-k2-instruct'));
});


await test('fonte principal já contém as correções críticas, sem depender da runtime', () => {
  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const prepareSource = fs.readFileSync(new URL('./prepareRuntimeSources.js', import.meta.url), 'utf8');

  assert.ok(iaSource.includes('requestNvidiaChat'));
  assert.ok(iaSource.includes('makeNvidiaRequest'));
  assert.ok(!iaSource.includes("import axios from 'axios'"));
  assert.ok(!iaSource.includes('Erro na API Cognima'));
  assert.ok(!iaSource.includes('Resposta da API Cognima'));
  assert.ok(indexSource.includes('loadSafeCommandAliases'));
  assert.ok(indexSource.includes("case 'd': {"));
  assert.ok(indexSource.includes('getQuotedContextInfo(info.message)'));
  assert.ok(!prepareSource.includes("replaceAll('moonshotai/kimi-k2-instruct'"));
  assert.ok(indexSource.includes('!isOwner && (!isGroup || !isRealGroupAdmin)'));
  assert.ok(indexSource.includes('groupData.aiModel = chosenEntry.id'));
  assert.ok(indexSource.includes('model: isKnownNvidiaModel(groupData.aiModel)'));
  assert.ok(!indexSource.includes('config.nvidia_api_key = q.trim()'));
  assert.ok(!indexSource.includes('!ia || !KeyCog'));
  assert.ok(!indexSource.includes("'mistralai/mistral-nemotron'"));
  assert.ok(!indexSource.includes('consultando o Mistral'));
  assert.ok(!indexSource.includes('consultando o Magistral'));
  assert.ok((indexSource.match(/isKnownNvidiaModel\(groupData\.aiModel\)/g) || []).length >= 3);
  assert.ok(iaSource.includes('outputTokens: result.usage?.outputTokens ?? null'));
  assert.ok(!iaSource.includes('Resultado extraído:'));
  assert.ok(!iaSource.includes('antes: __antesOverrideFinal'));
  assert.ok(!iaSource.includes('JSON.stringify(result).substring'));
  assert.ok(!prepareSource.includes('bodyPreview:'));
  assert.ok(!prepareSource.includes('quotedParticipant:'));
  assert.ok(!indexSource.includes('JSON.stringify(msgza)'));
  assert.ok(!indexSource.includes('respAssist.resp:`'));
  assert.ok(indexSource.includes('resolveBunnyFyAccountUrl(process.env.BUNNYFY_ACCOUNT_URL)'));
  assert.ok(indexSource.includes('const messagePreview = buildSafeMessagePreview({'));
  assert.ok(!indexSource.includes('const messagePreview = isCmd ?'));
  const playBlock = indexSource.match(/case 'play':[\s\S]*?case 'spotifydl':/)?.[0] || '';
  assert.ok(playBlock.includes('downloadYoutubeAudioForPlay(q, {'));
  assert.ok(playBlock.includes('legacyYoutube: youtube'));
  assert.ok(playBlock.includes('onMetadata: async preview'));
  assert.ok(playBlock.includes('buildYoutubePreviewCaption(preview)'));
  assert.ok(playBlock.includes('buildBunnyFyAccessMessage(process.env)'));
  assert.ok(playBlock.includes('tryAcquireYoutubePlaySlot()'));
  assert.ok(playBlock.includes('finally'));
  assert.ok(playBlock.includes('releaseYoutubePlaySlot?.()'));
  assert.ok(!playBlock.includes('youtube.search(q)'));
  assert.ok(!playBlock.includes('youtube.mp3('));
});

await test('rollout do YouTube permanece isolado e sem segredo no código', () => {
  const gatewaySource = fs.readFileSync(new URL('../services/bunnyfy/youtubeGateway.js', import.meta.url), 'utf8');
  const envExample = fs.readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
  assert.ok(gatewaySource.includes("new Set(['off', 'primary', 'exclusive'])"));
  assert.ok(gatewaySource.includes("retries: 0"));
  assert.ok(gatewaySource.includes('BUNNYFY_API_TOKEN'));
  assert.ok(!/bf_(?:test|live)_[A-Za-z0-9_-]{20,}/.test(gatewaySource));
  assert.ok(envExample.includes('BUNNYFY_YOUTUBE_MODE=off'));
  assert.ok(envExample.includes('BUNNYFY_YOUTUBE_TIMEOUT_MS='));
  assert.ok(envExample.includes('BUNNYFY_YOUTUBE_MAX_BYTES=52428800'));
  assert.ok(envExample.includes('BUNNYFY_YOUTUBE_MAX_CONCURRENCY=1'));
});

await test('resposta textual da NVIDIA é normalizada sem perder conteúdo', () => {
  assert.deepEqual(extractJSON('FLUXO NAZUNA OK'), {
    resp: [{ resp: 'FLUXO NAZUNA OK' }]
  });
});

await test('comandos VIP normalizam bancos vazios e formatos antigos', () => {
  const empty = normalizeVipCommandsData({});
  assert.deepEqual(empty.commands, []);
  assert.ok(empty.categories.ia);

  const legacy = normalizeVipCommandsData([{ command: 'play', enabled: true }]);
  assert.equal(legacy.commands.length, 1);
  assert.equal(legacy.commands[0].command, 'play');
});

await test('setmidia reconhece imagem e GIF citados', () => {
  const image = { url: 'imagem', mediaKey: Buffer.from('x') };
  const gif = { url: 'video', mediaKey: Buffer.from('y'), gifPlayback: true };

  assert.deepEqual(
    getQuotedMediaSource({ extendedTextMessage: { contextInfo: { quotedMessage: { imageMessage: image } } } }),
    { message: image, type: 'image', gifPlayback: false }
  );
  assert.deepEqual(
    getQuotedMediaSource({ extendedTextMessage: { contextInfo: { quotedMessage: { videoMessage: gif } } } }),
    { message: gif, type: 'video', gifPlayback: true }
  );
});

await test('HTTP 410 da NVIDIA não é repetido três vezes', async () => {
  let calls = 0;
  const httpClient = {
    async post() {
      calls += 1;
      const error = new Error('Gone');
      error.response = { status: 410, data: { message: 'Gone' } };
      throw error;
    }
  };

  await assert.rejects(
    requestNvidiaChat({
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'teste' }],
      retries: 3,
      httpClient,
      retryDelay: async () => {}
    }),
    error => error.code === 'NVIDIA_ACCESS_GONE' && error.retryable === false
  );
  assert.equal(calls, 1);
});

await test('falha transitória da NVIDIA é repetida e pode recuperar', async () => {
  let calls = 0;
  const httpClient = {
    async post() {
      calls += 1;
      if (calls === 1) {
        const error = new Error('temporário');
        error.response = { status: 503, data: { message: 'temporário' } };
        throw error;
      }
      return { data: { choices: [{ message: { content: 'ok' } }] } };
    }
  };

  const response = await requestNvidiaChat({
    apiKey: 'test-key',
    messages: [{ role: 'user', content: 'teste' }],
    retries: 3,
    httpClient,
    retryDelay: async () => {}
  });
  assert.equal(response.data.choices[0].message.content, 'ok');
  assert.equal(calls, 2);
});

await test('chave NVIDIA ausente falha antes da rede', async () => {
  let calls = 0;
  const httpClient = { async post() { calls += 1; } };
  await assert.rejects(
    requestNvidiaChat({
      apiKey: '',
      messages: [{ role: 'user', content: 'teste' }],
      httpClient
    }),
    error => error.code === 'NVIDIA_KEY_MISSING'
  );
  assert.equal(calls, 0);
});

const failures = results.filter(item => !item.ok);
console.log(`\nRegressões: ${results.length - failures.length} aprovadas, ${failures.length} falhas.`);
process.exit(failures.length ? 1 : 0);
