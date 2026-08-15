import assert from 'node:assert/strict';
import test from 'node:test';

import { BunnyFyError } from './BunnyFyError.js';
import {
  animatedLogoWithBunnyFy,
  imageGenerateWithBunnyFy,
  movieQuizWithBunnyFy,
  removeBackgroundWithBunnyFy,
  resolveCapabilityMode,
  shouldUseLegacyFallback,
  socialCardWithBunnyFy,
  socialDownloadWithBunnyFy,
  stickerCanvasWithBunnyFy,
  stickerWithBunnyFy,
  tavernBoardWithBunnyFy,
  tavernHandWithBunnyFy,
  tavernSceneWithBunnyFy,
  transcriptionWithBunnyFy,
  upscaleImageWithBunnyFy,
  welcomeCardWithBunnyFy
} from './capabilityGateway.js';

const BASE_ENV = {
  BUNNYFY_ENABLED: 'true',
  BUNNYFY_IMAGES_MODE: 'exclusive',
  BUNNYFY_CANVAS_MODE: 'exclusive',
  BUNNYFY_LOGOS_MODE: 'exclusive',
  BUNNYFY_STICKERS_MODE: 'exclusive',
  BUNNYFY_GAMES_MODE: 'exclusive',
  BUNNYFY_TAVERN_RENDER_MODE: 'exclusive',
  BUNNYFY_IMAGE_GEN_MODE: 'exclusive',
  BUNNYFY_TRANSCRIPTION_MODE: 'exclusive',
  BUNNYFY_FACEBOOK_MODE: 'exclusive',
  BUNNYFY_PINTEREST_MODE: 'exclusive',
  BUNNYFY_TIKTOK_MODE: 'exclusive',
  BUNNYFY_KWAI_MODE: 'exclusive'
};

test('master flag e modos independentes mantêm rollback granular', () => {
  assert.equal(resolveCapabilityMode('BUNNYFY_IMAGES_MODE', { ...BASE_ENV, BUNNYFY_ENABLED: 'false' }), 'off');
  assert.equal(resolveCapabilityMode('BUNNYFY_CANVAS_MODE', BASE_ENV), 'exclusive');
  assert.throws(
    () => resolveCapabilityMode('BUNNYFY_GAMES_MODE', { ...BASE_ENV, BUNNYFY_GAMES_MODE: 'typo' }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_CONFIG_INVALID'
  );
});

test('upscale faz upload, processa e baixa sem expor mídia intermediária', async () => {
  const calls = [];
  const clientFactory = () => ({
    async uploadImage(buffer, options) {
      calls.push(['upload', buffer, options]);
      return { mediaId: 'media-source-12345' };
    },
    async upscaleImage(mediaId, scale) {
      calls.push(['upscale', mediaId, scale]);
      return { width: 100, height: 80, scale, media: { mediaId: 'media-output-12345' } };
    },
    async downloadMedia(media) {
      calls.push(['download', media.mediaId]);
      return { buffer: Buffer.from('imagem-final'), mime: 'image/png' };
    }
  });

  const result = await upscaleImageWithBunnyFy(Buffer.from('imagem'), {
    env: BASE_ENV,
    clientFactory,
    mime: 'image/png',
    scale: 2
  });
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.buffer.toString(), 'imagem-final');
  assert.deepEqual(calls.map(call => call[0]), ['upload', 'upscale', 'download']);
});

test('remoção de fundo faz upload, processa e baixa sem expor mídia intermediária', async () => {
  const calls = [];
  const clientFactory = () => ({
    async uploadImage(buffer, options) {
      calls.push(['upload', buffer, options]);
      return { mediaId: 'media-source-12345' };
    },
    async removeImageBackground(mediaId) {
      calls.push(['rmbg', mediaId]);
      return { width: 100, height: 80, media: { mediaId: 'media-output-12345' } };
    },
    async downloadMedia(media) {
      calls.push(['download', media.mediaId]);
      return { buffer: Buffer.from('imagem-sem-fundo'), mime: 'image/png' };
    }
  });

  const result = await removeBackgroundWithBunnyFy(Buffer.from('imagem'), {
    env: BASE_ENV,
    clientFactory,
    mime: 'image/png'
  });
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.buffer.toString(), 'imagem-sem-fundo');
  assert.deepEqual(calls.map(call => call[0]), ['upload', 'rmbg', 'download']);
});

test('remoção de fundo cai no fallback só em falha transitória e modo primary', async () => {
  let fallbackCalls = 0;
  const result = await removeBackgroundWithBunnyFy(Buffer.from('imagem'), {
    env: { ...BASE_ENV, BUNNYFY_IMAGES_MODE: 'primary' },
    clientFactory: () => ({
      async uploadImage() { return { mediaId: 'media-source-12345' }; },
      async removeImageBackground() { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); }
    }),
    legacyFallback: async () => { fallbackCalls += 1; return { local: true }; }
  });
  assert.deepEqual(result, { local: true });
  assert.equal(fallbackCalls, 1);
});

test('transcrição faz upload do buffer e usa o mediaId resultante, sem chamar o fallback', async () => {
  const calls = [];
  const clientFactory = () => ({
    async uploadMedia(buffer, options) {
      calls.push(['upload', buffer.toString(), options.mime]);
      return { mediaId: 'media-audio-1234567890' };
    },
    async transcribeAudio(mediaId, options) {
      calls.push(['transcribe', mediaId, options.language]);
      return { text: 'Texto transcrito', language: 'pt', durationSeconds: 4.2 };
    }
  });

  const result = await transcriptionWithBunnyFy(Buffer.from('audio'), {
    env: BASE_ENV,
    clientFactory,
    mime: 'audio/ogg',
    language: 'pt',
    legacyFallback: async () => { throw new Error('não deveria cair no fallback'); }
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.texto, 'Texto transcrito');
  assert.equal(result.language, 'pt');
  assert.equal(result.durationSeconds, 4.2);
  assert.deepEqual(calls, [
    ['upload', 'audio', 'audio/ogg'],
    ['transcribe', 'media-audio-1234567890', 'pt']
  ]);
});

test('transcrição cai no fallback só em falha transitória e modo primary', async () => {
  let fallbackCalls = 0;
  const result = await transcriptionWithBunnyFy(Buffer.from('audio'), {
    env: { ...BASE_ENV, BUNNYFY_TRANSCRIPTION_MODE: 'primary' },
    clientFactory: () => ({
      async uploadMedia() { return { mediaId: 'media-audio-1234567890' }; },
      async transcribeAudio() { throw new BunnyFyError('BUNNYFY_INTERNAL_ERROR', { status: 500 }); }
    }),
    legacyFallback: async () => { fallbackCalls += 1; return { ok: true, texto: 'via vex', source: 'vex' }; }
  });
  assert.equal(fallbackCalls, 1);
  assert.equal(result.source, 'vex');

  await assert.rejects(
    () => transcriptionWithBunnyFy(Buffer.from('audio'), {
      env: { ...BASE_ENV, BUNNYFY_TRANSCRIPTION_MODE: 'primary' },
      clientFactory: () => ({
        async uploadMedia() { return { mediaId: 'media-audio-1234567890' }; },
        async transcribeAudio() { throw new BunnyFyError('BUNNYFY_BAD_REQUEST', { status: 400 }); }
      }),
      legacyFallback: async () => { throw new Error('erro 4xx não deveria acionar o fallback nem em modo primary'); }
    }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('social download usa o método do provedor e devolve a mediaUrl sem baixar buffer aqui', async () => {
  const calls = [];
  const clientFactory = () => ({
    async downloadTiktok(url, options) {
      calls.push(['tiktok', url, options.idempotencyKey]);
      return { title: 'Vídeo', durationSeconds: 10, thumbnail: null, media: { mediaUrl: 'https://bunnyfy.test/v1/media/x', mime: 'video/mp4' } };
    }
  });

  const result = await socialDownloadWithBunnyFy('tiktok', 'https://www.tiktok.com/@u/video/1', {
    env: BASE_ENV,
    clientFactory,
    legacyFallback: async () => { throw new Error('não deveria cair no fallback'); }
  });

  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.mediaUrl, 'https://bunnyfy.test/v1/media/x');
  assert.equal(result.title, 'Vídeo');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'tiktok');
  assert.match(calls[0][2], /^social-download-tiktok-/);
});

test('social download cai no fallback só em falha transitória e modo primary, por provedor', async () => {
  let fallbackCalls = 0;
  const result = await socialDownloadWithBunnyFy('facebook', 'https://www.facebook.com/watch/?v=1', {
    env: { ...BASE_ENV, BUNNYFY_FACEBOOK_MODE: 'primary' },
    clientFactory: () => ({
      async downloadFacebook() { throw new BunnyFyError('BUNNYFY_UNAVAILABLE', { status: 503 }); }
    }),
    legacyFallback: async () => { fallbackCalls += 1; return { ok: true, buffer: Buffer.from('x') }; }
  });
  assert.equal(fallbackCalls, 1);
  assert.deepEqual(result, { ok: true, buffer: Buffer.from('x') });

  await assert.rejects(
    () => socialDownloadWithBunnyFy('pinterest', 'https://www.pinterest.com/pin/1/', {
      env: BASE_ENV,
      clientFactory: () => ({
        async downloadPinterest() { throw new BunnyFyError('BUNNYFY_BAD_REQUEST', { status: 400 }); }
      }),
      legacyFallback: async () => { throw new Error('erro 4xx não deveria acionar o fallback nem em modo primary'); }
    }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('social download recusa provedor desconhecido', async () => {
  await assert.rejects(
    () => socialDownloadWithBunnyFy('desconhecido', 'https://example.com', { env: BASE_ENV }),
    error => error instanceof BunnyFyError && error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('canvas e quiz usam cliente e preservam fallback apenas no modo primary', async () => {
  const calls = [];
  const clientFactory = () => ({
    async uploadImage(buffer, options) {
      calls.push(['upload', buffer.toString(), options.filename]);
      return { mediaId: `media-${options.filename}-12345` };
    },
    async createWelcomeCard(payload) {
      calls.push(['card', payload]);
      return { ...payload, width: 1200, height: 675, media: { mediaId: 'card-1234567890' } };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('card'), mime: 'image/png' };
    },
    async getMovieQuiz() {
      return { question: 'Pergunta', choices: [], correctChoiceId: 'A' };
    }
  });
  const card = await welcomeCardWithBunnyFy({ event: 'join', name: 'Pessoa' }, {
    env: BASE_ENV,
    clientFactory,
    avatarBuffer: Buffer.from('avatar'),
    avatarMime: 'image/png',
    backgroundBuffer: Buffer.from('background'),
    backgroundMime: 'image/jpeg'
  });
  assert.equal(card.buffer.toString(), 'card');
  assert.deepEqual(calls.map(call => call[0]), ['upload', 'upload', 'card']);
  assert.equal(calls[2][1].avatarMediaId, 'media-member-avatar-12345');
  assert.equal(calls[2][1].backgroundMediaId, 'media-group-background-12345');
  const quiz = await movieQuizWithBunnyFy({ env: BASE_ENV, clientFactory });
  assert.equal(quiz.question, 'Pergunta');

  let fallbackCalls = 0;
  const result = await movieQuizWithBunnyFy({
    env: { ...BASE_ENV, BUNNYFY_GAMES_MODE: 'primary' },
    clientFactory: () => ({ getMovieQuiz: async () => { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); } }),
    legacyFallback: async () => { fallbackCalls += 1; return { local: true }; }
  });
  assert.deepEqual(result, { local: true });
  assert.equal(fallbackCalls, 1);
});

test('logo animado usa BunnyFy e baixa sticker WebP com limite próprio', async () => {
  const calls = [];
  const clientFactory = () => ({
    async createAnimatedLogo(model, texts) {
      calls.push(['create', model, texts]);
      return {
        model,
        animated: true,
        format: 'sticker',
        width: 512,
        height: 512,
        fps: 9,
        frames: 18,
        durationSeconds: 2,
        media: { mediaId: 'logo-1234567890', mime: 'image/webp' }
      };
    },
    async downloadMedia(media, options) {
      calls.push(['download', media.mediaId, options.maxBytes]);
      return { buffer: Buffer.from('webp'), mime: 'image/webp' };
    }
  });
  const result = await animatedLogoWithBunnyFy('neon2', ['Bunny', 'Fy'], { env: BASE_ENV, clientFactory });
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.mime, 'image/webp');
  assert.equal(result.format, 'sticker');
  assert.deepEqual(calls[0].slice(0, 3), ['create', 'neon2', ['Bunny', 'Fy']]);
  assert.equal(calls[1][2], 1024 * 1024);
});

test('stickers fazem upload genérico, conversão e download com modo próprio', async () => {
  const calls = [];
  const clientFactory = () => ({
    async uploadMedia(buffer, options) {
      calls.push(['upload', buffer.toString(), options.mime]);
      return { mediaId: 'sticker-source-12345' };
    },
    async createSticker(mediaId, options) {
      calls.push(['convert', mediaId, options]);
      return { animated: true, durationSeconds: 1.1, media: { mediaId: 'sticker-output-12345' } };
    },
    async downloadMedia(media, options) {
      calls.push(['download', media.mediaId, options.maxBytes]);
      return { buffer: Buffer.from('webp'), mime: 'image/webp' };
    }
  });
  const result = await stickerWithBunnyFy(Buffer.from('video'), {
    kind: 'animated', mime: 'video/mp4', env: BASE_ENV, clientFactory
  });
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.animated, true);
  assert.deepEqual(calls.map(call => call[0]), ['upload', 'convert', 'download']);
  assert.equal(calls[2][2], 5 * 1024 * 1024);
});

test('Canvas de sticker mantém fallback somente no modo primary', async () => {
  let fallbackCalls = 0;
  const result = await stickerCanvasWithBunnyFy({ template: 'text', text: 'BunnyFy' }, {
    env: { ...BASE_ENV, BUNNYFY_STICKERS_MODE: 'primary' },
    clientFactory: () => ({
      createStickerCanvas: async () => { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); }
    }),
    legacyFallback: async () => { fallbackCalls += 1; return { local: true }; }
  });
  assert.deepEqual(result, { local: true });
  assert.equal(fallbackCalls, 1);
});

test('falhas 4xx não acionam fallback e modo off não constrói cliente', async () => {
  assert.equal(shouldUseLegacyFallback(new BunnyFyError('BUNNYFY_BAD_REQUEST', { status: 400 })), false);
  let clientCalls = 0;
  let fallbackCalls = 0;
  const result = await upscaleImageWithBunnyFy(Buffer.from('imagem'), {
    env: { ...BASE_ENV, BUNNYFY_ENABLED: 'false' },
    clientFactory: () => { clientCalls += 1; return {}; },
    legacyFallback: async () => { fallbackCalls += 1; return { legacy: true }; }
  });
  assert.deepEqual(result, { legacy: true });
  assert.equal(clientCalls, 0);
  assert.equal(fallbackCalls, 1);
});

test('cards sociais adicionais usam apenas método allowlisted', async () => {
  const calls = [];
  const clientFactory = () => ({
    async createProfileCard(payload) {
      calls.push(payload);
      return { width: 1200, height: 675, media: { mediaId: 'profile-1234567890' } };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('profile'), mime: 'image/png' };
    }
  });
  const result = await socialCardWithBunnyFy('profile', { name: 'Pessoa' }, { env: BASE_ENV, clientFactory });
  assert.equal(result.buffer.toString(), 'profile');
  assert.equal(calls.length, 1);
  await assert.rejects(
    () => socialCardWithBunnyFy('desconhecido', {}, { env: BASE_ENV, clientFactory }),
    error => error.code === 'BUNNYFY_BAD_REQUEST'
  );
});

test('render do board da Tavern usa a BunnyFy e devolve o Buffer PNG diretamente, sem envelope', async () => {
  const calls = [];
  const clientFactory = () => ({
    async renderTavernBoard(state, playerNames) {
      calls.push(['render', state.matchId, playerNames]);
      return { width: 1200, height: 675, media: { mediaId: 'board-1234567890' } };
    },
    async downloadMedia(media) {
      calls.push(['download', media.mediaId]);
      return { buffer: Buffer.from('png-board'), mime: 'image/png' };
    }
  });

  const buffer = await tavernBoardWithBunnyFy({ matchId: 'm1' }, { p1: 'Um' }, { env: BASE_ENV, clientFactory });
  assert.equal(buffer.toString(), 'png-board');
  assert.deepEqual(calls.map(call => call[0]), ['render', 'download']);
});

test('render da mão da Tavern cai no Jimp local só em falha transitória e modo primary', async () => {
  let fallbackCalls = 0;
  const buffer = await tavernHandWithBunnyFy({ matchId: 'm1' }, 'p1', {
    env: { ...BASE_ENV, BUNNYFY_TAVERN_RENDER_MODE: 'primary' },
    clientFactory: () => ({
      async renderTavernHand() { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); }
    }),
    legacyFallback: async () => { fallbackCalls += 1; return Buffer.from('png-hand-local'); }
  });
  assert.equal(buffer.toString(), 'png-hand-local');
  assert.equal(fallbackCalls, 1);
});

test('render de cena da Tavern (modo off) nunca chama a BunnyFy, só o Jimp local', async () => {
  let bunnyfyCalls = 0;
  const buffer = await tavernSceneWithBunnyFy('invite', { challengerName: 'Um' }, {
    env: { ...BASE_ENV, BUNNYFY_TAVERN_RENDER_MODE: 'off' },
    clientFactory: () => ({
      async renderTavernScene() { bunnyfyCalls += 1; return { media: {} }; }
    }),
    legacyFallback: async () => Buffer.from('png-scene-local')
  });
  assert.equal(buffer.toString(), 'png-scene-local');
  assert.equal(bunnyfyCalls, 0);
});

test('geração de imagem por prompt faz o download e devolve buffer com metadados', async () => {
  const calls = [];
  const clientFactory = () => ({
    async generateImage(prompt, options) {
      calls.push(['generate', prompt, options]);
      return { width: 768, height: 768, media: { mediaId: 'img-1234567890' } };
    },
    async downloadMedia(media) {
      calls.push(['download', media.mediaId]);
      return { buffer: Buffer.from('png-gerado'), mime: 'image/png' };
    }
  });

  const result = await imageGenerateWithBunnyFy('um dragão vermelho', { env: BASE_ENV, clientFactory });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'bunnyfy');
  assert.equal(result.buffer.toString(), 'png-gerado');
  assert.equal(result.width, 768);
  assert.deepEqual(calls.map(call => call[0]), ['generate', 'download']);
});

test('geração de imagem (modo off) nunca chama a BunnyFy, devolve null pelo fallback padrão', async () => {
  let bunnyfyCalls = 0;
  const result = await imageGenerateWithBunnyFy('um dragão vermelho', {
    env: { ...BASE_ENV, BUNNYFY_IMAGE_GEN_MODE: 'off' },
    clientFactory: () => ({ async generateImage() { bunnyfyCalls += 1; return { media: {} }; } })
  });
  assert.equal(result, null);
  assert.equal(bunnyfyCalls, 0);
});
