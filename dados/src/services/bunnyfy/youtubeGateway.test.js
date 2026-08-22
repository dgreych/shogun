import assert from 'node:assert/strict';
import test from 'node:test';

import { BunnyFyClient } from './BunnyFyClient.js';
import { BunnyFyError } from './BunnyFyError.js';
import {
  DEFAULT_YOUTUBE_MAX_BYTES,
  buildYoutubePreviewCaption,
  createBunnyFyYoutubeClient,
  createYoutubePlayConcurrencyLimiter,
  downloadYoutubeAudioForPlay,
  downloadYoutubeVideoForPlay,
  normalizeYoutubePlayInput,
  resolveBunnyFyYoutubeMode,
  resolveYoutubeMaxConcurrency,
  sanitizeYoutubeThumbnail,
  shouldFallbackYoutubeError,
  youtubePlayErrorMessage
} from './youtubeGateway.js';

const ACTIVE_ENV = Object.freeze({
  BUNNYFY_ENABLED: 'true',
  BUNNYFY_YOUTUBE_MODE: 'exclusive',
  BUNNYFY_BASE_URL: 'https://api.bunnyfy.test',
  BUNNYFY_API_TOKEN: 'token-local-de-teste',
  BUNNYFY_YOUTUBE_TIMEOUT_MS: '5000',
  BUNNYFY_YOUTUBE_MAX_BYTES: '1024'
});

function legacyYoutubeFixture() {
  const calls = [];
  return {
    calls,
    async search(query) {
      calls.push({ method: 'search', value: query });
      return {
        ok: true,
        data: {
          url: 'https://youtube.com/watch?v=legacy00001',
          title: 'Faixa legado',
          thumbnail: 'https://i.ytimg.com/vi/legacy00001/default.jpg',
          seconds: 90,
          timestamp: '1:30',
          description: 'Descrição de teste',
        ago: 'há 2 anos',
        views: 128500,
        author: { name: 'Canal de teste' }
        }
      };
    },
    async getMetadataByVideoId(videoId) {
      calls.push({ method: 'metadata', value: videoId });
      return {
        ok: true,
        data: {
          videoId,
          url: `https://youtube.com/watch?v=${videoId}`,
          title: 'Faixa legado',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/default.jpg`,
          seconds: 90,
          timestamp: '1:30'
        }
      };
    },
    async mp3(url) {
      calls.push({ method: 'mp3', value: url });
      return {
        ok: true,
        buffer: Buffer.from('legacy-audio'),
        title: 'Faixa legado',
        thumbnail: 'https://i.ytimg.com/vi/legacy00001/default.jpg',
        filename: 'Faixa legado.mp3',
        tempo: 90
      };
    },
    async mp4(url) {
      calls.push({ method: 'mp4', value: url });
      return {
        ok: true,
        buffer: Buffer.from('legacy-video'),
        title: 'Vídeo legado',
        thumbnail: 'https://i.ytimg.com/vi/legacy00001/default.jpg',
        filename: 'Vídeo legado.mp4',
        tempo: 90
      };
    }
  };
}

test('modo YouTube depende da ativação global e recusa valor desconhecido', () => {
  assert.equal(resolveBunnyFyYoutubeMode({ BUNNYFY_ENABLED: 'false', BUNNYFY_YOUTUBE_MODE: 'exclusive' }), 'off');
  assert.equal(resolveBunnyFyYoutubeMode({ BUNNYFY_ENABLED: '1', BUNNYFY_YOUTUBE_MODE: 'primary' }), 'primary');
  assert.throws(
    () => resolveBunnyFyYoutubeMode({ BUNNYFY_ENABLED: 'true', BUNNYFY_YOUTUBE_MODE: 'incorreto' }),
    error => error.code === 'BUNNYFY_CONFIG_INVALID'
  );
});

test('cliente YouTube só aceita allocation HTTP temporária com flag explícita', () => {
  const insecureEnv = {
    ...ACTIVE_ENV,
    BUNNYFY_BASE_URL: 'http://node1.vexhost.com.br:20056'
  };

  assert.throws(
    () => createBunnyFyYoutubeClient(insecureEnv),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_CONFIG_INVALID'
  );

  const client = createBunnyFyYoutubeClient({
    ...insecureEnv,
    BUNNYFY_ALLOW_INSECURE_HTTP: 'true'
  });
  assert.equal(client.baseUrl, 'http://node1.vexhost.com.br:20056');

  assert.throws(
    () => createBunnyFyYoutubeClient({
      ...insecureEnv,
      BUNNYFY_BASE_URL: 'http://node1.vexhost.com.br:20057',
      BUNNYFY_ALLOW_INSECURE_HTTP: 'true'
    }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_CONFIG_INVALID'
  );
});

test('entrada reconhece apenas hosts reais do YouTube e preserva busca textual', () => {
  assert.deepEqual(normalizeYoutubePlayInput('youtube.com/watch?v=abc'), {
    type: 'url',
    value: 'https://youtube.com/watch?v=abc'
  });
  assert.deepEqual(normalizeYoutubePlayInput('https://youtu.be/abc#trecho'), {
    type: 'url',
    value: 'https://youtu.be/abc'
  });
  assert.deepEqual(normalizeYoutubePlayInput('evil-youtube.com música'), {
    type: 'query',
    value: 'evil-youtube.com música'
  });
});

test('thumbnail aceita somente hosts HTTPS explícitos do YouTube sem credenciais ou porta', () => {
  assert.equal(
    sanitizeYoutubeThumbnail('https://i.ytimg.com/vi/abc/default.jpg#fragmento'),
    'https://i.ytimg.com/vi/abc/default.jpg'
  );
  assert.equal(
    sanitizeYoutubeThumbnail('https://i9.ytimg.com/vi/abc/default.jpg'),
    'https://i9.ytimg.com/vi/abc/default.jpg'
  );
  for (const value of [
    'http://i.ytimg.com/vi/abc/default.jpg',
    'https://i.ytimg.com:443/vi/abc/default.jpg',
    'https://usuario@i.ytimg.com/vi/abc/default.jpg',
    'https://i.ytimg.com.evil.test/vi/abc/default.jpg',
    'https://example.test/thumbnail.jpg'
  ]) {
    assert.equal(sanitizeYoutubeThumbnail(value), null);
  }
});

test('limite local de concorrência tem padrão quatro, teto quatro e liberação idempotente', () => {
  assert.equal(DEFAULT_YOUTUBE_MAX_BYTES, 50 * 1024 * 1024);
  // O padrão acompanha o alvo de 4 simultâneos por pessoa/grupo. Com 1, todo
  // download de YouTube era serializado no bot e a fila justa não teria efeito.
  assert.equal(resolveYoutubeMaxConcurrency({}), 4);
  assert.equal(resolveYoutubeMaxConcurrency({ BUNNYFY_YOUTUBE_MAX_CONCURRENCY: '99' }), 4);

  const limiter = createYoutubePlayConcurrencyLimiter(2);
  const releaseFirst = limiter.tryAcquire();
  const releaseSecond = limiter.tryAcquire();
  assert.equal(typeof releaseFirst, 'function');
  assert.equal(typeof releaseSecond, 'function');
  assert.equal(limiter.active, 2);
  assert.equal(limiter.tryAcquire(), null);
  releaseFirst();
  releaseFirst();
  assert.equal(limiter.active, 1);
  const releaseThird = limiter.tryAcquire();
  assert.equal(typeof releaseThird, 'function');
  releaseSecond();
  releaseThird();
  assert.equal(limiter.active, 0);
});

test('modo exclusivo envia query uma vez à BunnyFy e baixa a mídia autenticada pelo cliente', async () => {
  const calls = [];
  const client = {
    async downloadYouTubeAudio(input) {
      calls.push({ method: 'request', input });
      return {
        title: 'Faixa BunnyFy',
        durationSeconds: 75,
        thumbnail: 'https://i.ytimg.com/vi/bunnyfy0001/default.jpg',
        media: { mediaUrl: 'https://api.bunnyfy.test/v1/media/audio', mime: 'audio/mpeg', bytes: 5 }
      };
    },
    async downloadMedia(media, limits) {
      calls.push({ method: 'media', media, limits });
      return { buffer: Buffer.from('audio'), mime: 'audio/mpeg', bytes: 5 };
    }
  };
  const legacyYoutube = legacyYoutubeFixture();

  const result = await downloadYoutubeAudioForPlay('Faixa BunnyFy', {
    env: ACTIVE_ENV,
    legacyYoutube,
    clientFactory: () => client
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.inputType, 'query');
  assert.equal(result.duration, '1:15');
  assert.deepEqual(result.buffer, Buffer.from('audio'));
  assert.deepEqual(calls[0], { method: 'request', input: { query: 'Faixa BunnyFy' } });
  assert.deepEqual(calls[1].limits, { timeoutMs: 5000, maxBytes: 1024 });
  assert.deepEqual(legacyYoutube.calls, []);
});

test('modo exclusivo preserva URL direta e não executa busca no bot', async () => {
  let receivedInput;
  const client = {
    async downloadYouTubeAudio(input) {
      receivedInput = input;
      return {
        title: 'Faixa por URL',
        durationSeconds: 10,
        thumbnail: null,
        media: { mediaUrl: 'https://api.bunnyfy.test/v1/media/audio', mime: 'audio/mpeg', bytes: 5 }
      };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('audio'), mime: 'audio/mpeg', bytes: 5 };
    }
  };
  const legacyYoutube = legacyYoutubeFixture();

  const result = await downloadYoutubeAudioForPlay('https://www.youtube.com/watch?v=abc12345678', {
    env: ACTIVE_ENV,
    legacyYoutube,
    clientFactory: () => client
  });
  assert.deepEqual(receivedInput, { url: 'https://www.youtube.com/watch?v=abc12345678' });
  assert.equal(result.inputType, 'url');
  assert.equal(result.sourceUrl, 'https://www.youtube.com/watch?v=abc12345678');
  assert.deepEqual(legacyYoutube.calls, []);
});

test('resolução local opcional transforma query em URL antes da BunnyFy', async () => {
  let receivedInput;
  const order = [];
  const client = {
    async downloadYouTubeAudio(input) {
      order.push('bunnyfy-request');
      receivedInput = input;
      return {
        title: '',
        durationSeconds: 0,
        thumbnail: null,
        media: { mediaUrl: 'https://api.bunnyfy.test/v1/media/audio', mime: 'audio/mpeg', bytes: 5 }
      };
    },
    async downloadMedia() {
      order.push('media-download');
      return { buffer: Buffer.from('audio'), mime: 'audio/mpeg', bytes: 5 };
    }
  };
  const legacyYoutube = legacyYoutubeFixture();
  const result = await downloadYoutubeAudioForPlay('Faixa BunnyFy', {
    env: { ...ACTIVE_ENV, BUNNYFY_YOUTUBE_RESOLVE_QUERY_LOCALLY: 'true' },
    legacyYoutube,
    clientFactory: () => client,
    onMetadata: async preview => {
      order.push('preview');
      assert.equal(preview.title, 'Faixa legado');
      assert.equal(preview.channel, 'Canal de teste');
      assert.equal(preview.views, 128500);
      assert.equal(preview.url, 'https://youtube.com/watch?v=legacy00001');
    }
  });
  assert.deepEqual(receivedInput, { url: 'https://www.youtube.com/watch?v=legacy00001' });
  assert.equal(result.inputType, 'query');
  assert.equal(result.title, 'Faixa legado');
  assert.equal(result.durationSeconds, 90);
  assert.deepEqual(legacyYoutube.calls.map(call => call.method), ['search', 'metadata']);
  assert.deepEqual(order, ['preview', 'bunnyfy-request', 'media-download']);
});

test('prévia do play é formatada com metadados seguros e sem quebrar markdown', () => {
  const caption = buildYoutubePreviewCaption({
    title: 'Faixa sem markup',
    channel: 'Canal',
    duration: '1:29',
    durationSeconds: 89,
    views: 128500,
    published: 'há 10 anos',
    description: 'Descrição curta',
    url: 'https://youtube.com/watch?v=legacy00001',
    thumbnail: null
  });
  assert.match(caption, /128\.500/);
  assert.match(caption, /1:29 \(89 segundos\)/);
  assert.match(caption, /Baixando e processando sua música/);
  assert.match(caption, /https:\/\/youtube\.com\/watch\?v=legacy00001/);
});

test('vídeo usa BunnyFy para URL e query resolvida, com fallback legado só em primary', async () => {
  const received = [];
  const client = {
    async downloadYouTubeVideo(input, options) {
      received.push({ input, options });
      return {
        title: 'Vídeo BunnyFy',
        durationSeconds: 90,
        thumbnail: null,
        media: { mediaUrl: 'https://api.bunnyfy.test/v1/media/video', mime: 'video/mp4', bytes: 5 }
      };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('video'), mime: 'video/mp4', bytes: 5 };
    }
  };
  const legacyYoutube = legacyYoutubeFixture();
  const result = await downloadYoutubeVideoForPlay('Vídeo de teste', {
    env: ACTIVE_ENV,
    legacyYoutube,
    clientFactory: () => client,
    quality: '360p'
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.mime, 'video/mp4');
  assert.deepEqual(received[0], {
    input: { url: 'https://www.youtube.com/watch?v=legacy00001' },
    options: { quality: '360p' }
  });
  assert.deepEqual(legacyYoutube.calls.map(call => call.method), ['search', 'metadata']);

  const fallbackLegacy = legacyYoutubeFixture();
  const fallback = await downloadYoutubeVideoForPlay('Vídeo de teste', {
    env: { ...ACTIVE_ENV, BUNNYFY_YOUTUBE_MODE: 'primary' },
    legacyYoutube: fallbackLegacy,
    clientFactory: () => ({
      async downloadYouTubeVideo() {
        throw new BunnyFyError('BUNNYFY_UNAVAILABLE', { status: 503, retryable: true });
      }
    })
  });
  assert.equal(fallback.source, 'legacy');
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(fallback.mime, 'video/mp4');
  assert.deepEqual(fallbackLegacy.calls.map(call => call.method), ['search', 'metadata', 'search', 'metadata', 'mp4']);
});

test('modo off mantém pesquisa e download legados sem construir cliente BunnyFy', async () => {
  const legacyYoutube = legacyYoutubeFixture();
  const result = await downloadYoutubeAudioForPlay('Faixa legado', {
    env: { BUNNYFY_ENABLED: 'false', BUNNYFY_YOUTUBE_MODE: 'exclusive' },
    legacyYoutube,
    clientFactory: () => {
      throw new Error('cliente BunnyFy não deveria ser criado');
    }
  });

  assert.equal(result.source, 'legacy');
  assert.deepEqual(legacyYoutube.calls.map(call => call.method), ['search', 'metadata', 'mp3']);
});

test('primary usa fallback somente em falha transitória ou 5xx', async () => {
  const legacyYoutube = legacyYoutubeFixture();
  const unavailableClient = {
    async downloadYouTubeAudio() {
      throw new BunnyFyError('BUNNYFY_UNAVAILABLE', { status: 503, retryable: true });
    }
  };
  const result = await downloadYoutubeAudioForPlay('Faixa legado', {
    env: { ...ACTIVE_ENV, BUNNYFY_YOUTUBE_MODE: 'primary' },
    legacyYoutube,
    clientFactory: () => unavailableClient
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'legacy');
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(legacyYoutube.calls.map(call => call.method), ['search', 'metadata', 'mp3']);
  assert.equal(shouldFallbackYoutubeError({ code: 'BUNNYFY_OUTRO_ERRO', status: 500 }), true);
  assert.equal(shouldFallbackYoutubeError(new BunnyFyError('BUNNYFY_RATE_LIMITED', { status: 429, retryable: true })), false);
});

test('primary não mascara autenticação, payload, tamanho ou rate limit', async () => {
  for (const [code, status] of [
    ['BUNNYFY_AUTH_FAILED', 401],
    ['BUNNYFY_BAD_REQUEST', 400],
    ['BUNNYFY_TOO_LARGE', 413],
    ['BUNNYFY_RATE_LIMITED', 429]
  ]) {
    const legacyYoutube = legacyYoutubeFixture();
    const client = {
      async downloadYouTubeAudio() {
        throw new BunnyFyError(code, { status, retryable: status === 429 });
      }
    };
    await assert.rejects(
      () => downloadYoutubeAudioForPlay('Faixa BunnyFy', {
        env: { ...ACTIVE_ENV, BUNNYFY_YOUTUBE_MODE: 'primary' },
        legacyYoutube,
        clientFactory: () => client
      }),
      error => error.code === code
    );
    assert.deepEqual(legacyYoutube.calls, []);
  }
});

test('primary não cai no legado quando 401, 403, 413 ou 429 chegam com HTML ou corpo vazio', async () => {
  for (const [status, body, expectedCode] of [
    [401, '<html>unauthorized</html>', 'BUNNYFY_AUTH_FAILED'],
    [403, '', 'BUNNYFY_FORBIDDEN'],
    [413, '<html>too large</html>', 'BUNNYFY_TOO_LARGE'],
    [429, '', 'BUNNYFY_RATE_LIMITED']
  ]) {
    const legacyYoutube = legacyYoutubeFixture();
    const client = new BunnyFyClient({
      baseUrl: ACTIVE_ENV.BUNNYFY_BASE_URL,
      token: ACTIVE_ENV.BUNNYFY_API_TOKEN,
      retries: 0,
      fetchImpl: async () => new Response(body, {
        status,
        headers: { 'content-type': 'text/html' }
      })
    });

    await assert.rejects(
      () => downloadYoutubeAudioForPlay('Faixa protegida', {
        env: { ...ACTIVE_ENV, BUNNYFY_YOUTUBE_MODE: 'primary' },
        legacyYoutube,
        clientFactory: () => client
      }),
      error => error.code === expectedCode && error.status === status
    );
    assert.deepEqual(legacyYoutube.calls, []);
  }
});

test('primary não cai no legado quando o stream de um 401 falha durante a leitura', async () => {
  const legacyYoutube = legacyYoutubeFixture();
  const client = new BunnyFyClient({
    baseUrl: ACTIVE_ENV.BUNNYFY_BASE_URL,
    token: ACTIVE_ENV.BUNNYFY_API_TOKEN,
    retries: 0,
    fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) {
        controller.error(new Error('body privado indisponível'));
      }
    }), { status: 401 })
  });

  await assert.rejects(
    () => downloadYoutubeAudioForPlay('Faixa protegida', {
      env: { ...ACTIVE_ENV, BUNNYFY_YOUTUBE_MODE: 'primary' },
      legacyYoutube,
      clientFactory: () => client
    }),
    error => error.code === 'BUNNYFY_AUTH_FAILED' && error.status === 401
  );
  assert.deepEqual(legacyYoutube.calls, []);
});

test('fallback legado confirma duração por videoId antes de chamar o download', async () => {
  const directLegacy = legacyYoutubeFixture();
  const directResult = await downloadYoutubeAudioForPlay(
    'https://youtu.be/legacy00001',
    { env: { BUNNYFY_ENABLED: 'false' }, legacyYoutube: directLegacy }
  );
  assert.equal(directResult.ok, true);
  assert.deepEqual(directLegacy.calls.map(call => call.method), ['metadata', 'mp3']);

  for (const metadataData of [
    { seconds: 0, timestamp: '0:00' },
    { seconds: 1801, timestamp: '30:01' }
  ]) {
    const legacyYoutube = legacyYoutubeFixture();
    legacyYoutube.getMetadataByVideoId = async videoId => {
      legacyYoutube.calls.push({ method: 'metadata', value: videoId });
      return { ok: true, data: { videoId, ...metadataData } };
    };
    const result = await downloadYoutubeAudioForPlay('Faixa bloqueada', {
      env: { BUNNYFY_ENABLED: 'false' },
      legacyYoutube
    });
    assert.equal(result.ok, false);
    assert.equal(legacyYoutube.calls.some(call => call.method === 'mp3'), false);
  }
});

test('thumbnail maliciosa retornada pelo download é descartada', async () => {
  const client = {
    async downloadYouTubeAudio() {
      return {
        title: 'Faixa segura',
        durationSeconds: 30,
        thumbnail: 'https://127.0.0.1/admin',
        media: { mediaUrl: 'https://api.bunnyfy.test/v1/media/audio', mime: 'audio/mpeg', bytes: 5 }
      };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('audio'), mime: 'audio/mpeg', bytes: 5 };
    }
  };
  const result = await downloadYoutubeAudioForPlay('Faixa segura', {
    env: ACTIVE_ENV,
    legacyYoutube: legacyYoutubeFixture(),
    clientFactory: () => client
  });
  assert.equal(result.thumbnail, null);
});

test('modo exclusivo nunca cai no legado e mensagens de erro são neutras', async () => {
  const legacyYoutube = legacyYoutubeFixture();
  const client = {
    async downloadYouTubeAudio() {
      throw new BunnyFyError('BUNNYFY_TIMEOUT', { status: 504, retryable: true });
    }
  };
  await assert.rejects(
    () => downloadYoutubeAudioForPlay('Faixa BunnyFy', {
      env: ACTIVE_ENV,
      legacyYoutube,
      clientFactory: () => client
    }),
    error => error.code === 'BUNNYFY_TIMEOUT'
  );
  assert.deepEqual(legacyYoutube.calls, []);
  assert.match(youtubePlayErrorMessage({ code: 'BUNNYFY_TIMEOUT' }), /temporariamente indisponível/);
  assert.equal(youtubePlayErrorMessage({ code: 'BUNNYFY_TIMEOUT' }).includes('endpoint'), false);
});
