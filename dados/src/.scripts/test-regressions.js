#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getQuotedContextInfo, loadSafeCommandAliases, normalizeCommandAliases, resolveCommandInput } from '../utils/commandResolver.js';
import { extractJSON } from '../funcs/private/ia.js';
import { buildBoundedChatMessages, createBunnyFyAiClient, resolveBunnyFyAiMode, toLegacyChatResponse } from '../services/bunnyfy/aiGateway.js';
import { buildVexFailureLogEntry } from '../funcs/downloads/youtube.js';
import { getQuotedMediaSource, DEFAULT_PERSONA, PERSONALITY_KEYS, PERSONA_MENU_DESIGNS, describePersona } from '../utils/gyomeiCore.js';
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

await test('fontes usam BunnyFy como gateway de IA sem transporte NVIDIA direto', () => {
  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.ok(iaSource.includes('createBunnyFyAiClient'));
  assert.ok(iaSource.includes('toLegacyChatResponse'));
  assert.ok(!iaSource.includes('requestNvidiaChat'));
  assert.ok(!iaSource.includes('process.env.NVIDIA_API_KEY'));
  assert.ok(!iaSource.includes('moonshotai/kimi-k2-instruct'));
  assert.ok(!indexSource.includes('moonshotai/kimi-k2-instruct'));
});

await test('fonte principal já contém as correções críticas, sem depender da runtime', () => {
  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const prepareSource = fs.readFileSync(new URL('./prepareRuntimeSources.js', import.meta.url), 'utf8');

  assert.ok(iaSource.includes('createBunnyFyAiClient'));
  assert.ok(iaSource.includes('makeNvidiaRequest'));
  assert.ok(iaSource.includes('buildBoundedChatMessages'));
  assert.ok(iaSource.includes('createBunnyFyAiClient().createChatCompletion'));
  assert.ok(iaSource.includes('model || getBunnyFyAiModelOverride()'));
  assert.ok(!iaSource.includes('isKnownNvidiaModel('));
  assert.ok(!iaSource.includes('getNvidiaModel('));
  assert.match(
    iaSource,
    /const response = \(await makeNvidiaRequest\(\s*model\s*\|\|\s*getBunnyFyAiModelOverride\(\)\s*,\s*JSON\.stringify\(userInput\)\s*,/
  );
  assert.ok(!iaSource.includes('requestNvidiaChat'));
  assert.ok(!iaSource.includes('process.env.NVIDIA_API_KEY'));
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
  assert.ok(iaSource.includes('toLegacyChatResponse'));
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
  assert.ok(envExample.includes('BUNNYFY_YOUTUBE_MAX_CONCURRENCY=4'));
});

await test('resposta textual da assistente é normalizada sem perder conteúdo', () => {
  assert.deepEqual(extractJSON('FLUXO NAZUNA OK'), {
    resp: [{ resp: 'FLUXO NAZUNA OK' }]
  });
});

await test('JSON malformado da assistente nunca vaza para a conversa', () => {
  // Payload real capturado em produção: um "s" perdido depois da chave derruba
  // todos os parses, e o comportamento anterior despejava a estrutura interna
  // inteira no WhatsApp -- id, aprender, notas_importantes, tudo.
  const malformado = '{s "resp": [{ "id": "Mau_QuemEuSou", "resp": "Ah, você não sabia? Eu sou NAZUNA.", "react": "" }], "aprender": [{ "acao": "atualizar", "tipo": "nome_usuario", "valor": "Mauricio" }] }';
  const saida = extractJSON(malformado);
  const texto = saida.resp[0].resp;

  assert.equal(texto, 'Ah, você não sabia? Eu sou NAZUNA.');
  assert.ok(!texto.includes('aprender'), 'estrutura interna vazou para a resposta');
  assert.ok(!texto.includes('"resp"'), 'JSON cru vazou para a resposta');
  assert.ok(!texto.includes('nome_usuario'), 'dado de memória vazou para a resposta');
});

await test('JSON irrecuperável vira mensagem humana, nunca o payload', () => {
  const semResp = '{ "aprender": [{ "acao": "adicionar", "tipo": "gosto", "valor": "pizza" }] }';
  const texto = extractJSON(semResp).resp[0].resp;

  assert.ok(!texto.includes('aprender'));
  assert.ok(!texto.includes('{'));
  assert.ok(texto.length > 0);
});

await test('Shogun é a identidade padrão e nenhuma persona foi perdida', () => {
  // Shogun não é uma persona competindo com as outras: é como o bot chega
  // numa instância nova. Por isso é ele, e não uma das personagens, que
  // responde quando ninguém escolheu nada.
  assert.equal(DEFAULT_PERSONA, 'shogun');
  assert.ok(PERSONALITY_KEYS.includes('shogun'));
  for (const persona of ['alaska', 'gyomei', 'nazuna', 'tanjiro', 'zenitsu', 'inosuke', 'shinobu']) {
    assert.ok(PERSONALITY_KEYS.includes(persona), `persona ${persona} sumiu da lista`);
  }
});

await test('toda persona tem descrição própria, para a escolha não ser às cegas', () => {
  for (const chave of PERSONALITY_KEYS) {
    const texto = describePersona(chave);
    assert.ok(texto && texto.length > 20, `persona ${chave} sem descrição útil`);
    assert.notEqual(texto, 'Personalidade do bot.', `persona ${chave} caiu no texto genérico`);
  }
});

await test('a persona padrão tem tema de menu próprio, sem herdar o da anterior', () => {
  const tema = PERSONA_MENU_DESIGNS[DEFAULT_PERSONA];
  assert.ok(tema, 'a persona padrão precisa de tema próprio');
  assert.ok(tema.header.includes('{botName}'));
  // Se herdasse o tema da Nazuna, o menu continuaria com a identidade antiga
  // mesmo depois do !default.
  assert.notEqual(tema.header, PERSONA_MENU_DESIGNS.nazuna?.header);
  assert.notEqual(tema.header, PERSONA_MENU_DESIGNS.gyomei?.header);
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

await test('modo BunnyFy exclusive exige ativação global explícita', () => {
  assert.equal(
    resolveBunnyFyAiMode({ BUNNYFY_ENABLED: 'true', BUNNYFY_AI_MODE: 'exclusive' }),
    'exclusive'
  );
  assert.equal(
    resolveBunnyFyAiMode({ BUNNYFY_ENABLED: 'false', BUNNYFY_AI_MODE: 'exclusive' }),
    'off'
  );
});

await test('gateway de IA respeita BUNNYFY_ALLOW_INSECURE_HTTP do config bridge sem liberar HTTP arbitrário', () => {
  const temporaryVexHostEnv = {
    BUNNYFY_ENABLED: 'true',
    BUNNYFY_AI_MODE: 'exclusive',
    BUNNYFY_BASE_URL: 'http://node1.vexhost.com.br:20056',
    BUNNYFY_API_TOKEN: 'token-regressao-nao-secreto'
  };

  assert.throws(
    () => createBunnyFyAiClient(temporaryVexHostEnv),
    error => error?.code === 'BUNNYFY_CONFIG_INVALID'
  );

  const client = createBunnyFyAiClient({
    ...temporaryVexHostEnv,
    BUNNYFY_ALLOW_INSECURE_HTTP: 'true'
  });
  assert.equal(client.baseUrl, 'http://node1.vexhost.com.br:20056');

  assert.throws(
    () => createBunnyFyAiClient({
      BUNNYFY_ENABLED: 'true',
      BUNNYFY_AI_MODE: 'exclusive',
      BUNNYFY_BASE_URL: 'http://node1.vexhost.com.br:20072',
      BUNNYFY_API_TOKEN: 'token-regressao-nao-secreto',
      BUNNYFY_ALLOW_INSECURE_HTTP: 'true'
    }),
    error => error?.code === 'BUNNYFY_CONFIG_INVALID'
  );
});

await test('resposta canônica BunnyFy mantém o envelope legado da assistente', () => {
  const response = toLegacyChatResponse({
    text: 'ok',
    finishReason: 'stop',
    usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 }
  });
  assert.equal(response.success, true);
  assert.equal(response.data.choices[0].message.content, 'ok');
  assert.equal(response.data.usage.total_tokens, 3);
});

await test('gateway BunnyFy limita mensagens antes de qualquer transporte', () => {
  const messages = buildBoundedChatMessages({
    systemPrompt: 's'.repeat(20000),
    history: Array.from({ length: 40 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `h-${index}-${'x'.repeat(4000)}`
    })),
    text: 'u'.repeat(20000)
  });
  assert.equal(messages[0].role, 'system');
  assert.equal(messages.at(-1).role, 'user');
  assert.ok(messages.length > 0);
  assert.ok(messages.every(message => typeof message.content === 'string' && message.content.length > 0));
});

const failures = results.filter(item => !item.ok);
console.log(`\nRegressões: ${results.length - failures.length} aprovadas, ${failures.length} falhas.`);
process.exit(failures.length ? 1 : 0);
