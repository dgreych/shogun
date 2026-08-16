import assert from 'node:assert/strict';
import test from 'node:test';

import { BunnyFyClient } from './BunnyFyClient.js';
import { BunnyFyError } from './BunnyFyError.js';

const TOKEN = 'token-local-de-teste';

const BOARD_VIEW = {
  schemaVersion: 1,
  kind: 'board',
  status: 'ACTIVE',
  phase: 'MAIN',
  turn: { number: 2, activeSlot: 'bottom', deadlineAt: '2026-08-15T20:00:00.000Z' },
  terrain: { name: 'Salão da Tavern' },
  players: [
    {
      slot: 'bottom', displayName: 'Aventureiro', classId: 'GUARDIAN',
      hero: { hp: 29, armor: 2 }, mana: { current: 3, max: 3 },
      handCount: 4, deckCount: 25, board: []
    },
    {
      slot: 'top', displayName: 'Oponente', classId: 'EXILE',
      hero: { hp: 25, armor: 0 }, mana: { current: 0, max: 2 },
      handCount: 5, deckCount: 24, board: []
    }
  ]
};

const HAND_VIEW = {
  schemaVersion: 1,
  kind: 'hand',
  status: 'ACTIVE',
  phase: 'MAIN',
  isActive: true,
  viewer: {
    classId: 'GUARDIAN', mana: { current: 3, max: 3 }, nextSpellDiscount: 0, boardCount: 1
  },
  cards: [{
    cardId: 'GY-001', name: 'Sentinela', type: 'MINION', rarity: 'COMMON', cost: 2,
    attack: 2, health: 3, keywords: ['GUARD'], classId: 'GUARDIAN', text: 'Protege a mesa.'
  }]
};

const TURN_SCENE_VIEW = {
  schemaVersion: 1,
  kind: 'scene',
  sceneKind: 'turn',
  payload: {
    playerName: 'Aventureiro',
    classId: 'GUARDIAN',
    turnNumber: 2,
    deadlineLabel: '2min'
  }
};

function envelope(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

function success(data) {
  return envelope({ ok: true, data, error: null, meta: { requestId: 'remote-id', durationMs: 2 } });
}

function failure(status, code, retryable = false) {
  return envelope({
    ok: false,
    data: null,
    error: { code, message: 'detalhe remoto privado', retryable },
    meta: { requestId: 'remote-id', durationMs: 2 }
  }, { status });
}

function makeClient(fetchImpl, options = {}) {
  return new BunnyFyClient({
    baseUrl: 'https://api.bunnyfy.test',
    token: TOKEN,
    fetchImpl,
    requestIdFactory: () => 'local-id',
    sleep: () => Promise.resolve(),
    ...options
  });
}

test('renders da Tavern enviam somente Render View v1 em {view}', async () => {
  const requests = [];
  const client = makeClient(async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return success({
      width: url.includes('/hand?') ? 720 : 1200,
      height: url.includes('/hand?') ? 960 : url.endsWith('/board') ? 940 : 675,
      media: { mediaId: 'tavern-render-12345', mediaUrl: '/v1/media/tavern-render-12345' }
    });
  });

  await client.renderTavernBoard(BOARD_VIEW, { idempotencyKey: 'board-view-1' });
  await client.renderTavernHand(HAND_VIEW, { page: 2, idempotencyKey: 'hand-view-1' });
  await client.renderTavernScene(TURN_SCENE_VIEW, { idempotencyKey: 'scene-view-1' });

  assert.deepEqual(requests.map(request => request.body), [
    { view: BOARD_VIEW },
    { view: HAND_VIEW },
    { view: TURN_SCENE_VIEW }
  ]);
  assert.equal(JSON.stringify(requests).includes('playerId'), false);
  assert.equal(JSON.stringify(requests).includes('playerNames'), false);
  assert.equal(JSON.stringify(requests).includes('state'), false);
  assert.equal(requests[1].url, 'https://api.bunnyfy.test/v1/games/tavern/hand?page=2');
});

test('Render View v1 recusa campos extras, identidade crua e contrato legado antes da rede', async () => {
  let fetchCalls = 0;
  const client = makeClient(async () => {
    fetchCalls += 1;
    return success({});
  });

  const jidBoard = structuredClone(BOARD_VIEW);
  jidBoard.players[0].displayName = 'Nome 5511999999999@s.whatsapp.net (privado)';
  const phoneBoard = structuredClone(BOARD_VIEW);
  phoneBoard.players[0].displayName = '+55 (11) 99999-9999';
  const invalidCompactIdBoard = structuredClone(BOARD_VIEW);
  invalidCompactIdBoard.players[0].classId = 'GUARDIAN/fora-do-contrato';
  const oversizedTurnBoard = structuredClone(BOARD_VIEW);
  oversizedTurnBoard.turn.number = 100_000;
  for (const operation of [
    () => client.renderTavernBoard({ ...BOARD_VIEW, seed: 'SEGREDO' }),
    () => client.renderTavernBoard(jidBoard),
    () => client.renderTavernBoard(phoneBoard),
    () => client.renderTavernBoard(invalidCompactIdBoard),
    () => client.renderTavernBoard(oversizedTurnBoard),
    () => client.renderTavernHand({ ...HAND_VIEW, opponent: { hand: ['SEGREDO'] } }),
    () => client.renderTavernHand(HAND_VIEW, { page: 0 }),
    () => client.renderTavernHand(HAND_VIEW, { page: 3 }),
    () => client.renderTavernScene({
      ...TURN_SCENE_VIEW,
      payload: { ...TURN_SCENE_VIEW.payload, playerId: '5511999999999@s.whatsapp.net' }
    }),
    () => client.renderTavernHand({ state: {}, playerId: 'p1' })
  ]) {
    await assert.rejects(operation, error => error.code === 'BUNNYFY_BAD_REQUEST');
  }
  assert.equal(fetchCalls, 0);
});

test('Bearer exige HTTPS fora do loopback, salvo exceção temporária VexHost exata', () => {
  assert.throws(
    () => new BunnyFyClient({ baseUrl: 'http://api.bunnyfy.test', token: TOKEN }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_CONFIG_INVALID'
  );

  const localClient = new BunnyFyClient({ baseUrl: 'http://127.0.0.1:8080', token: TOKEN });
  assert.equal(localClient.baseUrl, 'http://127.0.0.1:8080');

  assert.throws(
    () => new BunnyFyClient({
      baseUrl: 'http://node1.vexhost.com.br:20056',
      token: TOKEN
    }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_CONFIG_INVALID'
  );

  const temporaryVexHostClient = new BunnyFyClient({
    baseUrl: 'http://node1.vexhost.com.br:20056',
    token: TOKEN,
    allowInsecureHttp: true
  });
  assert.equal(temporaryVexHostClient.baseUrl, 'http://node1.vexhost.com.br:20056');

  for (const baseUrl of [
    'http://node1.vexhost.com.br:20057',
    'http://outro.vexhost.com.br:20056',
    'http://node1.vexhost.com.br:20056/caminho'
  ]) {
    assert.throws(
      () => new BunnyFyClient({ baseUrl, token: TOKEN, allowInsecureHttp: true }),
      error => error instanceof BunnyFyError && error.code === 'BUNNYFY_CONFIG_INVALID'
    );
  }
});

test('busca textual envia Bearer, contrato query e nenhum retry ou Idempotency-Key', async () => {
  let received;
  let calls = 0;
  const client = makeClient(async (url, options) => {
    calls += 1;
    received = { url, options };
    return success({
      title: 'Faixa de teste',
      durationSeconds: 30,
      thumbnail: 'https://i.ytimg.test/faixa.jpg',
      media: {
        mediaId: 'media-1',
        mediaUrl: '/v1/media/media-1?exp=1&sig=fake',
        expiresAt: '2026-08-09T15:00:00Z',
        mime: 'audio/mpeg',
        bytes: 5
      }
    });
  }, { retries: 3 });

  const result = await client.downloadYouTubeAudio({ query: 'Faixa de teste' });
  assert.equal(calls, 1);
  assert.equal(received.url, 'https://api.bunnyfy.test/v1/downloads/youtube/audio');
  assert.equal(received.options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(received.options.headers['Idempotency-Key'], undefined);
  assert.deepEqual(JSON.parse(received.options.body), { query: 'Faixa de teste' });
  assert.equal(received.url.includes(TOKEN), false);
  assert.equal(result.media.mediaId, 'media-1');
  assert.equal(result.media.mediaUrl, 'https://api.bunnyfy.test/v1/media/media-1?exp=1&sig=fake');
  assert.equal(result.title, 'Faixa de teste');
});

test('download do YouTube preserva entrada URL antiga e POST transitório não é repetido', async () => {
  let receivedBody;
  const successClient = makeClient(async (_url, options) => {
    receivedBody = JSON.parse(options.body);
    return success({
      title: 'Faixa por URL',
      durationSeconds: 20,
      media: { mediaId: 'media-url', mediaUrl: '/v1/media/media-url', mime: 'audio/mpeg', bytes: 4 }
    });
  });
  await successClient.downloadYouTubeAudio('https://www.youtube.com/watch?v=teste');
  assert.deepEqual(receivedBody, { url: 'https://www.youtube.com/watch?v=teste' });

  let calls = 0;
  const unavailable = makeClient(async () => {
    calls += 1;
    return failure(503, 'BUNNYFY_UNAVAILABLE', true);
  }, { retries: 3 });
  await assert.rejects(
    () => unavailable.downloadYouTubeAudioByQuery('Faixa de teste'),
    error => error.code === 'BUNNYFY_UNAVAILABLE'
  );
  assert.equal(calls, 1);
});

test('logo animado envia modelo allowlisted e valida o sticker WebP canônico', async () => {
  let received;
  const client = makeClient(async (url, options) => {
    received = { url, options };
    return success({
      model: 'glitch',
      animated: true,
      format: 'sticker',
      width: 512,
      height: 512,
      fps: 9,
      frames: 18,
      durationSeconds: 2,
      media: {
        mediaId: 'logo-media-12345',
        mediaUrl: '/v1/media/logo-media-12345',
        mime: 'image/webp',
        bytes: 420000
      }
    });
  });
  const result = await client.createAnimatedLogo('glitch', ['BunnyFy'], { idempotencyKey: 'logo-operation-1' });
  assert.equal(received.url, 'https://api.bunnyfy.test/v1/images/logo');
  assert.equal(received.options.headers['Idempotency-Key'], 'logo-operation-1');
  assert.deepEqual(JSON.parse(received.options.body), { model: 'glitch', texts: ['BunnyFy'] });
  assert.equal(result.animated, true);
  assert.equal(result.format, 'sticker');
  assert.equal(result.media.mime, 'image/webp');
  assert.equal(result.media.mediaUrl, 'https://api.bunnyfy.test/v1/media/logo-media-12345');
  await assert.rejects(
    () => client.createAnimatedLogo('../glitch', ['BunnyFy']),
    error => error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('stickers usam somente mediaId opaco e validam o WebP 512 retornado', async () => {
  let received;
  const client = makeClient(async (url, options) => {
    received = { url, options };
    return success({
      width: 512,
      height: 512,
      animated: true,
      durationSeconds: 1.2,
      media: { mediaId: 'sticker-media-12345', mediaUrl: '/v1/media/sticker-media-12345', mime: 'image/webp', bytes: 800 }
    });
  });
  const result = await client.createSticker('source-media-12345', {
    kind: 'animated', fit: 'cover', idempotencyKey: 'sticker-operation-1'
  });
  assert.equal(received.url, 'https://api.bunnyfy.test/v1/stickers');
  assert.equal(received.options.headers['Idempotency-Key'], 'sticker-operation-1');
  assert.deepEqual(JSON.parse(received.options.body), {
    mediaId: 'source-media-12345', kind: 'animated', fit: 'cover'
  });
  assert.equal(result.animated, true);
  assert.equal(result.media.mime, 'image/webp');
  await assert.rejects(
    () => client.createSticker('../arquivo', { kind: 'static' }),
    error => error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('Canvas de sticker exige resposta estática com template declarado', async () => {
  const client = makeClient(async () => success({
    template: 'quote', width: 512, height: 512, animated: false, durationSeconds: null,
    media: { mediaId: 'canvas-sticker-12345', mediaUrl: '/v1/media/canvas-sticker-12345', mime: 'image/webp', bytes: 700 }
  }));
  const result = await client.createStickerCanvas({ template: 'quote', text: 'BunnyFy' });
  assert.equal(result.template, 'quote');
  assert.equal(result.animated, false);
});

test('401, 413 e 429 geram erros tipados sem expor token ou detalhe remoto', async () => {
  for (const [status, code] of [
    [401, 'BUNNYFY_AUTH_FAILED'],
    [413, 'BUNNYFY_TOO_LARGE'],
    [429, 'BUNNYFY_RATE_LIMITED']
  ]) {
    const client = makeClient(async () => failure(status, code, false), { retries: 0 });
    await assert.rejects(
      () => client.request('/v1/test'),
      error => {
        assert.ok(error instanceof BunnyFyError);
        assert.equal(error.code, code);
        assert.equal(error.message.includes(TOKEN), false);
        assert.equal(error.message.includes('detalhe remoto privado'), false);
        return true;
      }
    );
  }
});

test('status HTTP não-ok prevalece quando o corpo é HTML, vazio ou inválido', async () => {
  for (const [status, body, expectedCode] of [
    [401, '<html>não autorizado</html>', 'BUNNYFY_AUTH_FAILED'],
    [403, '', 'BUNNYFY_FORBIDDEN'],
    [413, 'payload grande', 'BUNNYFY_TOO_LARGE'],
    [429, '{', 'BUNNYFY_RATE_LIMITED']
  ]) {
    const client = makeClient(async () => new Response(body, {
      status,
      headers: { 'content-type': 'text/html', 'x-request-id': `status-${status}` }
    }), { retries: 0 });

    await assert.rejects(
      () => client.request('/v1/test'),
      error => {
        assert.ok(error instanceof BunnyFyError);
        assert.equal(error.code, expectedCode);
        assert.equal(error.status, status);
        assert.equal(error.requestId, `status-${status}`);
        return true;
      }
    );
  }
});

test('status não-ok com corpo de erro legível preserva o código real do envelope, não só o status HTTP', async () => {
  // BUNNYFY_CONTENT_BLOCKED e BUNNYFY_BAD_REQUEST são ambos status 400 —
  // sem ler o código do envelope, os dois ficariam indistinguíveis pro
  // consumidor (ex: Gyomei precisa diferenciar recusa de política de
  // qualquer outro 400 pra não sugerir "tente de novo" pra algo que
  // nenhuma tentativa nova vai resolver).
  const client = makeClient(async () => failure(400, 'BUNNYFY_CONTENT_BLOCKED', false), { retries: 0 });
  await assert.rejects(
    () => client.request('/v1/test'),
    error => {
      assert.ok(error instanceof BunnyFyError);
      assert.equal(error.code, 'BUNNYFY_CONTENT_BLOCKED');
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test('falha ao ler body de resposta não-ok continua mapeada pelo status HTTP', async () => {
  const client = makeClient(async () => new Response(new ReadableStream({
    pull(controller) {
      controller.error(new Error('falha privada ao ler body'));
    }
  }), {
    status: 403,
    headers: { 'x-request-id': 'body-rejeitado' }
  }), { retries: 0 });

  await assert.rejects(
    () => client.request('/v1/test'),
    error => {
      assert.equal(error.code, 'BUNNYFY_FORBIDDEN');
      assert.equal(error.status, 403);
      assert.equal(error.requestId, 'body-rejeitado');
      assert.equal(error.message.includes('falha privada'), false);
      return true;
    }
  );
});

test('timeout é sanitizado e não inclui URL nem token', async () => {
  const client = makeClient(async () => {
    const error = new Error('request https://api.bunnyfy.test?token=segredo');
    error.name = 'TimeoutError';
    throw error;
  }, { retries: 0 });
  await assert.rejects(
    () => client.request('/v1/test'),
    error => {
      assert.equal(error.code, 'BUNNYFY_TIMEOUT');
      assert.equal(error.message.includes('https://'), false);
      assert.equal(error.message.includes('segredo'), false);
      assert.equal(error.cause, undefined);
      assert.equal(JSON.stringify(error).includes('segredo'), false);
      return true;
    }
  );
});

test('resposta acima do limite é interrompida', async () => {
  const client = makeClient(async () => new Response('x'.repeat(4096), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }), { maxResponseBytes: 1024 });
  await assert.rejects(
    () => client.request('/v1/test'),
    error => error.code === 'BUNNYFY_TOO_LARGE'
  );
});

test('JSON inválido e envelope inválido são recusados', async () => {
  const invalidJson = makeClient(async () => new Response('{', { status: 200 }));
  await assert.rejects(
    () => invalidJson.request('/v1/test'),
    error => error.code === 'BUNNYFY_BAD_RESPONSE'
  );

  const invalidEnvelope = makeClient(async () => envelope({ data: {} }));
  await assert.rejects(
    () => invalidEnvelope.request('/v1/test'),
    error => error.code === 'BUNNYFY_BAD_RESPONSE'
  );
});

test('POST sem idempotência não é repetido em falha transitória', async () => {
  let calls = 0;
  const client = makeClient(async () => {
    calls += 1;
    return failure(503, 'BUNNYFY_UNAVAILABLE', true);
  }, { retries: 3 });
  await assert.rejects(
    () => client.request('/v1/test', { method: 'POST', json: { value: 1 } }),
    error => error.code === 'BUNNYFY_UNAVAILABLE'
  );
  assert.equal(calls, 1);
});

test('conversa usa modelo validado sem endpoint arbitrário, idempotência ou retry', async () => {
  let calls = 0;
  let received;
  const client = makeClient(async (url, options) => {
    calls += 1;
    received = { url, options };
    return success({
      text: 'Resposta de teste',
      finishReason: 'stop',
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 }
    });
  }, { retries: 3 });

  const result = await client.createChatCompletion(
    [
      { role: 'system', content: 'Instrução' },
      { role: 'user', content: 'Pergunta' }
    ],
    { model: 'example/fast' }
  );

  assert.equal(calls, 1);
  assert.equal(received.url, 'https://api.bunnyfy.test/v1/ai/chat/completions');
  assert.equal(received.options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(received.options.headers['Idempotency-Key'], undefined);
  assert.deepEqual(JSON.parse(received.options.body), {
    messages: [
      { role: 'system', content: 'Instrução' },
      { role: 'user', content: 'Pergunta' }
    ],
    temperature: 0.7,
    maxOutputTokens: 2000,
    model: 'example/fast'
  });
  assert.equal(result.text, 'Resposta de teste');
  assert.equal(result.finishReason, 'stop');
  assert.equal(result.requestId, 'remote-id');
});

test('conversa recusa saída fora do contrato e não repete POST transitório', async () => {
  const invalid = makeClient(async () => success({
    text: 'Resposta',
    finishReason: 'segredo-fora-da-allowlist',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
  }));
  await assert.rejects(
    () => invalid.createChatCompletion([{ role: 'user', content: 'Pergunta' }]),
    error => error.code === 'BUNNYFY_BAD_RESPONSE'
  );

  let calls = 0;
  const unavailable = makeClient(async () => {
    calls += 1;
    return failure(503, 'BUNNYFY_UNAVAILABLE', true);
  }, { retries: 3 });
  await assert.rejects(
    () => unavailable.createChatCompletion([{ role: 'user', content: 'Pergunta' }]),
    error => error.code === 'BUNNYFY_UNAVAILABLE'
  );
  assert.equal(calls, 1);

  await assert.rejects(
    () => unavailable.createChatCompletion([{ role: 'user', content: 'Pergunta' }], { model: 'https://host/model' }),
    error => error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('conversa aceita usage ausente no provedor sem inventar contagens', async () => {
  const client = makeClient(async () => success({ text: 'Resposta', finishReason: null, usage: null }));
  const result = await client.createChatCompletion([{ role: 'user', content: 'Pergunta' }]);
  assert.equal(result.usage, null);
});

test('POST idempotente repete somente falha transitória', async () => {
  let calls = 0;
  const client = makeClient(async () => {
    calls += 1;
    if (calls === 1) return failure(503, 'BUNNYFY_UNAVAILABLE', true);
    return success({ value: 'ok' });
  }, { retries: 2 });
  const result = await client.request('/v1/test', {
    method: 'POST',
    json: { value: 1 },
    idempotencyKey: 'operation-2'
  });
  assert.equal(calls, 2);
  assert.equal(result.data.value, 'ok');
});

test('upload multipart usa contrato de mídia sem colocar token na URL', async () => {
  let received;
  const client = makeClient(async (url, options) => {
    received = { url, options };
    return success({ mediaId: 'upload-1', mediaUrl: '/v1/media/upload-1', expiresAt: '2026-08-09T15:00:00Z' });
  });
  const result = await client.uploadMedia(Buffer.from('arquivo'), {
    filename: 'audio.ogg',
    mime: 'audio/ogg',
    idempotencyKey: 'upload-operation'
  });
  assert.ok(received.options.body instanceof FormData);
  assert.equal(received.url.includes(TOKEN), false);
  assert.equal(result.mediaId, 'upload-1');
  assert.equal(result.mediaUrl, 'https://api.bunnyfy.test/v1/media/upload-1');
});

test('rejeita mediaUrl absoluta apontando para origem diferente da BunnyFy', async () => {
  const client = makeClient(async () => success({
    mediaId: 'upload-2',
    mediaUrl: 'https://host-nao-confiavel.test/arquivo',
    expiresAt: '2026-08-09T15:00:00Z'
  }));
  await assert.rejects(
    () => client.uploadMedia(Buffer.from('arquivo')),
    error => error.code === 'BUNNYFY_BAD_RESPONSE'
  );
});

test('download binário assinado exige mesma origem, omite Bearer e respeita MIME e tamanho', async () => {
  let received;
  const audio = Buffer.from('audio');
  const client = makeClient(async (url, options) => {
    received = { url, options };
    return new Response(audio, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'content-length': String(audio.length),
        'x-request-id': 'media-request-id'
      }
    });
  });

  const result = await client.downloadMedia({
    mediaId: 'media-audio',
    mediaUrl: '/v1/media/media-audio?exp=1&sig=fake',
    mime: 'audio/mpeg',
    bytes: audio.length
  }, { maxBytes: 10, timeoutMs: 5000 });

  assert.equal(received.url, 'https://api.bunnyfy.test/v1/media/media-audio?exp=1&sig=fake');
  assert.equal(received.options.method, 'GET');
  assert.equal(received.options.redirect, 'error');
  assert.equal(received.options.headers.Authorization, undefined);
  assert.equal(received.options.headers.Accept, 'audio/mpeg');
  assert.deepEqual(result.buffer, audio);
  assert.equal(result.mime, 'audio/mpeg');
  assert.equal(result.requestId, 'media-request-id');
});

test('download binário recusa outra origem, caminho estranho e resposta acima do teto', async () => {
  let calls = 0;
  const client = makeClient(async () => {
    calls += 1;
    return new Response(Buffer.alloc(6), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'content-length': '6' }
    });
  });

  for (const mediaUrl of [
    'https://outra-origem.test/v1/media/arquivo',
    'https://usuario:senha@api.bunnyfy.test/v1/media/arquivo',
    'https://api.bunnyfy.test/admin/arquivo'
  ]) {
    await assert.rejects(
      () => client.downloadMedia({ mediaUrl, mime: 'audio/mpeg' }, { maxBytes: 5 }),
      error => error.code === 'BUNNYFY_BAD_RESPONSE'
    );
  }
  assert.equal(calls, 0);

  await assert.rejects(
    () => client.downloadMedia({ mediaUrl: '/v1/media/grande', mime: 'audio/mpeg' }, { maxBytes: 5 }),
    error => error.code === 'BUNNYFY_TOO_LARGE'
  );
  assert.equal(calls, 1);
});

test('download binário sanitiza timeout, redirecionamento e erro HTTP', async () => {
  const descriptor = { mediaUrl: '/v1/media/audio?exp=segredo&sig=segredo', mime: 'audio/mpeg' };
  const timeoutClient = makeClient(async () => {
    const error = new Error('https://api.bunnyfy.test/v1/media/audio?sig=segredo');
    error.name = 'TimeoutError';
    throw error;
  });
  await assert.rejects(
    () => timeoutClient.downloadMedia(descriptor),
    error => error.code === 'BUNNYFY_TIMEOUT' && !error.message.includes('segredo') && error.cause === undefined
  );

  const redirectClient = makeClient(async () => {
    throw new Error('redirect para https://host.test/?sig=segredo');
  });
  await assert.rejects(
    () => redirectClient.downloadMedia(descriptor),
    error => error.code === 'BUNNYFY_NETWORK_ERROR' && !JSON.stringify(error).includes('segredo')
  );

  const unauthorizedClient = makeClient(async () => new Response('', { status: 401 }));
  await assert.rejects(
    () => unauthorizedClient.downloadMedia(descriptor),
    error => error.code === 'BUNNYFY_AUTH_FAILED'
  );
});

test('métodos Social Canvas usam as cinco rotas e resolvem mídia relativa', async () => {
  const calls = [];
  const client = makeClient(async (url, options) => {
    calls.push({ url, options });
    const template = url.match(/\/(welcome|profile|compatibility|ranking|achievement)-card$/)?.[1];
    return success({
      template,
      width: 1200,
      height: 675,
      media: {
        mediaId: `media-${template}`,
        mediaUrl: `/v1/media/media-${template}`,
        expiresAt: '2026-08-09T15:00:00Z',
        mime: 'image/png',
        bytes: 12345
      }
    });
  });

  const methods = [
    ['createWelcomeCard', '/v1/images/welcome-card'],
    ['createProfileCard', '/v1/images/profile-card'],
    ['createCompatibilityCard', '/v1/images/compatibility-card'],
    ['createRankingCard', '/v1/images/ranking-card'],
    ['createAchievementCard', '/v1/images/achievement-card']
  ];

  for (const [method, route] of methods) {
    const result = await client[method]({ name: 'Entrada de teste' }, { idempotencyKey: `idem-${method}` });
    assert.equal(result.width, 1200);
    assert.equal(result.height, 675);
    assert.match(result.media.mediaUrl, /^https:\/\/api\.bunnyfy\.test\/v1\/media\//);
    const call = calls.at(-1);
    assert.equal(call.url, `https://api.bunnyfy.test${route}`);
    assert.equal(call.options.headers['Idempotency-Key'], `idem-${method}`);
    assert.equal(call.options.headers.Authorization, `Bearer ${TOKEN}`);
  }
});

test('upload e upscale de imagem usam contratos BunnyFy e mídia assinada', async () => {
  const calls = [];
  const client = makeClient(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/media/images')) {
      return success({
        mediaId: 'imagem-entrada-12345',
        mediaUrl: '/v1/media/imagem-entrada-12345?exp=1&sig=fake',
        mime: 'image/png',
        bytes: 10,
        kind: 'png'
      });
    }
    return success({
      width: 200,
      height: 100,
      scale: 2,
      media: {
        mediaId: 'imagem-saida-123456',
        mediaUrl: '/v1/media/imagem-saida-123456?exp=1&sig=fake',
        mime: 'image/png',
        bytes: 40
      }
    });
  });

  const uploaded = await client.uploadImage(Buffer.from('imagem'), { filename: 'foto.png', mime: 'image/png' });
  assert.equal(uploaded.mediaId, 'imagem-entrada-12345');
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(calls[0].url, 'https://api.bunnyfy.test/v1/media/images');

  const upscaled = await client.upscaleImage(uploaded.mediaId, 2, { idempotencyKey: 'upscale-1' });
  assert.equal(upscaled.width, 200);
  assert.equal(upscaled.height, 100);
  assert.equal(upscaled.media.mediaUrl, 'https://api.bunnyfy.test/v1/media/imagem-saida-123456?exp=1&sig=fake');
  assert.equal(calls[1].url, 'https://api.bunnyfy.test/v1/images/upscale');
  assert.deepEqual(JSON.parse(calls[1].options.body), { mediaId: uploaded.mediaId, scale: 2 });
  assert.equal(calls[1].options.headers['Idempotency-Key'], 'upscale-1');
});

test('quiz de cinema valida dificuldade e alternativas sem repetir POST', async () => {
  let calls = 0;
  const client = makeClient(async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://api.bunnyfy.test/v1/games/quiz');
    assert.deepEqual(JSON.parse(options.body), { category: 'movies', difficulty: 'medium' });
    assert.equal(options.headers['Idempotency-Key'], undefined);
    return success({
      category: 'movies',
      difficulty: 'medium',
      type: 'multiple-choice',
      question: 'Qual filme venceu?',
      choices: [
        { id: 'A', text: 'Filme A' },
        { id: 'B', text: 'Filme B' },
        { id: 'C', text: 'Filme C' },
        { id: 'D', text: 'Filme D' }
      ],
      correctChoiceId: 'B',
      attribution: { name: 'fonte', url: 'https://example.test' }
    });
  }, { retries: 3 });

  const result = await client.getMovieQuiz({ difficulty: 'medium' });
  assert.equal(result.correctChoiceId, 'B');
  assert.equal(result.requestId, 'remote-id');
  assert.equal(calls, 1);
  await assert.rejects(
    () => client.getMovieQuiz({ difficulty: 'impossivel' }),
    error => error.code === 'BUNNYFY_BAD_REQUEST'
  );

  const invalid = makeClient(async () => success({
    category: 'movies',
    difficulty: 'easy',
    type: 'multiple-choice',
    question: 'Pergunta',
    choices: [{ id: 'A', text: 'A' }, { id: 'A', text: 'B' }, { id: 'C', text: 'C' }, { id: 'D', text: 'D' }],
    correctChoiceId: 'A'
  }));
  await assert.rejects(
    () => invalid.getMovieQuiz(),
    error => error.code === 'BUNNYFY_BAD_RESPONSE'
  );
});

test('Social Canvas recusa template, dimensão e mediaUrl fora do contrato', async () => {
  const responses = [
    { template: 'desconhecido', width: 1200, height: 675, media: { mediaId: 'm1', mediaUrl: '/v1/media/m1' } },
    { template: 'profile', width: 0, height: 675, media: { mediaId: 'm1', mediaUrl: '/v1/media/m1' } },
    { template: 'profile', width: 1200, height: 675, media: { mediaId: 'm1', mediaUrl: 'https://outra-origem.test/m1' } }
  ];

  for (const data of responses) {
    const client = makeClient(async () => success(data));
    await assert.rejects(
      () => client.createProfileCard({ name: 'Teste' }),
      error => error.code === 'BUNNYFY_BAD_RESPONSE'
    );
  }
});
test('download binário sem assinatura mantém Bearer', async () => {
  let received;
  const audio = Buffer.from('audio-sem-assinatura');
  const client = makeClient(async (url, options) => {
    received = { url, options };
    return new Response(audio, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'content-length': String(audio.length)
      }
    });
  });

  const result = await client.downloadMedia({
    mediaId: 'media-auth',
    mediaUrl: '/v1/media/media-auth',
    mime: 'audio/mpeg',
    bytes: audio.length
  });

  assert.equal(received.options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(result.bytes, audio.length);
});
