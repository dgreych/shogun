import assert from 'node:assert/strict';
import test from 'node:test';

import { BunnyFyError } from './BunnyFyError.js';
import {
  animatedLogoWithBunnyFy,
  movieQuizWithBunnyFy,
  resolveCapabilityMode,
  shouldUseLegacyFallback,
  socialCardWithBunnyFy,
  stickerCanvasWithBunnyFy,
  stickerWithBunnyFy,
  upscaleImageWithBunnyFy,
  welcomeCardWithBunnyFy
} from './capabilityGateway.js';

const BASE_ENV = {
  BUNNYFY_ENABLED: 'true',
  BUNNYFY_IMAGES_MODE: 'exclusive',
  BUNNYFY_CANVAS_MODE: 'exclusive',
  BUNNYFY_LOGOS_MODE: 'exclusive',
  BUNNYFY_STICKERS_MODE: 'exclusive',
  BUNNYFY_GAMES_MODE: 'exclusive'
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
