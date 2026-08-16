import crypto from 'node:crypto';

import { BunnyFyClient } from './BunnyFyClient.js';
import { BunnyFyError } from './BunnyFyError.js';

const MODES = new Set(['off', 'primary', 'exclusive']);
const TRANSIENT_CODES = new Set([
  'BUNNYFY_BAD_RESPONSE',
  'BUNNYFY_NETWORK_ERROR',
  'BUNNYFY_REMOTE_ERROR',
  'BUNNYFY_TIMEOUT',
  'BUNNYFY_TOOL_UNAVAILABLE',
  'BUNNYFY_UNAVAILABLE'
]);

function masterEnabled(env = process.env) {
  return ['true', '1'].includes(String(env.BUNNYFY_ENABLED || '').trim().toLowerCase());
}

function resolveCapabilityMode(name, env = process.env) {
  if (!masterEnabled(env)) return 'off';
  const mode = String(env[name] || 'off').trim().toLowerCase();
  if (!MODES.has(mode)) throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  return mode;
}

function createCapabilityClient(env = process.env) {
  const configuredTimeout = Number(env.BUNNYFY_CAPABILITY_TIMEOUT_MS);
  return new BunnyFyClient({
    baseUrl: env.BUNNYFY_BASE_URL,
    token: env.BUNNYFY_API_TOKEN,
    allowInsecureHttp: ['true', '1'].includes(
      String(env.BUNNYFY_ALLOW_INSECURE_HTTP || '').trim().toLowerCase()
    ),
    timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 120_000,
    maxResponseBytes: 2 * 1024 * 1024,
    retries: 0
  });
}

function shouldUseLegacyFallback(error) {
  const status = Number(error?.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) return false;
  return TRANSIENT_CODES.has(error?.code) || (Number.isInteger(status) && status >= 500);
}

async function executeCapability({ mode, operation, legacyFallback }) {
  if (mode === 'off') return legacyFallback();
  try {
    return await operation();
  } catch (error) {
    if (mode === 'primary' && shouldUseLegacyFallback(error)) return legacyFallback(error);
    throw error;
  }
}

async function upscaleImageWithBunnyFy(buffer, {
  mime = 'image/jpeg',
  scale = 2,
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_IMAGES_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const operationId = crypto.randomUUID();
      const source = await client.uploadImage(buffer, {
        filename: 'source-image',
        mime,
        idempotencyKey: `upload-${operationId}`
      });
      const result = await client.upscaleImage(source.mediaId, scale, {
        idempotencyKey: `upscale-${operationId}`
      });
      const downloaded = await client.downloadMedia(result.media, {
        maxBytes: 20 * 1024 * 1024
      });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        width: result.width,
        height: result.height,
        scale: result.scale
      };
    }
  });
}

async function removeBackgroundWithBunnyFy(buffer, {
  mime = 'image/jpeg',
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_IMAGES_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const operationId = crypto.randomUUID();
      const source = await client.uploadImage(buffer, {
        filename: 'source-image',
        mime,
        idempotencyKey: `upload-${operationId}`
      });
      const result = await client.removeImageBackground(source.mediaId, {
        idempotencyKey: `rmbg-${operationId}`
      });
      const downloaded = await client.downloadMedia(result.media, {
        maxBytes: 20 * 1024 * 1024
      });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        width: result.width,
        height: result.height
      };
    }
  });
}

async function imageGenerateWithBunnyFy(prompt, {
  width,
  height,
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_IMAGE_GEN_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client.generateImage(prompt, { width, height });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 20 * 1024 * 1024 });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        width: result.width,
        height: result.height
      };
    }
  });
}

// As três funções abaixo devolvem o Buffer do PNG diretamente (não um
// envelope com metadados) — de propósito, pra bater exatamente com o
// contrato que VNextBoardRenderer.render()/VNextHandRenderer.render()/
// VNextSceneRenderer.render*() já tinham antes de existir a BunnyFy. Isso
// deixa os wrappers em rendering/BunnyFy*Renderer.js um substituto
// transparente dos renderers locais, sem precisar tocar em nenhum
// controlador que já os chama.
async function tavernBoardWithBunnyFy(view, {
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_TAVERN_RENDER_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client.renderTavernBoard(view, {
        idempotencyKey: crypto.randomUUID()
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 20 * 1024 * 1024 });
      return downloaded.buffer;
    }
  });
}

async function tavernHandWithBunnyFy(view, {
  page = 1,
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_TAVERN_RENDER_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client.renderTavernHand(view, {
        page,
        idempotencyKey: crypto.randomUUID()
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 20 * 1024 * 1024 });
      return downloaded.buffer;
    }
  });
}

async function tavernSceneWithBunnyFy(view, {
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_TAVERN_RENDER_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client.renderTavernScene(view, {
        idempotencyKey: crypto.randomUUID()
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 20 * 1024 * 1024 });
      return downloaded.buffer;
    }
  });
}

async function stickerWithBunnyFy(buffer, {
  kind,
  fit = 'contain',
  mime = 'application/octet-stream',
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !['static', 'animated'].includes(kind)) {
    throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
  }
  const mode = resolveCapabilityMode('BUNNYFY_STICKERS_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const operationId = crypto.randomUUID();
      const source = await client.uploadMedia(buffer, {
        filename: kind === 'animated' ? 'sticker-source-video' : 'sticker-source-image',
        mime,
        idempotencyKey: `sticker-upload-${operationId}`
      });
      const result = await client.createSticker(source.mediaId, {
        kind,
        fit,
        idempotencyKey: `sticker-render-${operationId}`
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 5 * 1024 * 1024 });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        animated: result.animated,
        durationSeconds: result.durationSeconds
      };
    }
  });
}

async function stickerCanvasWithBunnyFy(payload, {
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_STICKERS_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client.createStickerCanvas(payload, {
        idempotencyKey: `sticker-canvas-${crypto.randomUUID()}`
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 5 * 1024 * 1024 });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        animated: false,
        template: result.template
      };
    }
  });
}

async function welcomeCardWithBunnyFy(payload, {
  avatarBuffer,
  avatarMime = 'image/jpeg',
  backgroundBuffer,
  backgroundMime = 'image/jpeg',
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_CANVAS_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const operationId = crypto.randomUUID();
      const visualPayload = { ...payload };
      if (Buffer.isBuffer(avatarBuffer) && avatarBuffer.length > 0) {
        const avatar = await client.uploadImage(avatarBuffer, {
          filename: 'member-avatar',
          mime: avatarMime,
          idempotencyKey: `welcome-avatar-${operationId}`
        });
        visualPayload.avatarMediaId = avatar.mediaId;
      }
      if (Buffer.isBuffer(backgroundBuffer) && backgroundBuffer.length > 0) {
        const background = await client.uploadImage(backgroundBuffer, {
          filename: 'group-background',
          mime: backgroundMime,
          idempotencyKey: `welcome-background-${operationId}`
        });
        visualPayload.backgroundMediaId = background.mediaId;
      }
      const result = await client.createWelcomeCard(visualPayload, {
        idempotencyKey: `welcome-card-${operationId}`
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 10 * 1024 * 1024 });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        width: result.width,
        height: result.height
      };
    }
  });
}

async function animatedLogoWithBunnyFy(model, texts, {
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_LOGOS_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client.createAnimatedLogo(model, texts, {
        idempotencyKey: `logo-${crypto.randomUUID()}`
      });
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 1024 * 1024 });
      if (downloaded.mime !== 'image/webp' || result.format !== 'sticker') {
        throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
      }
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        format: result.format,
        model: result.model,
        animated: result.animated,
        width: result.width,
        height: result.height,
        durationSeconds: result.durationSeconds
      };
    }
  });
}

async function socialCardWithBunnyFy(kind, payload, {
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const methods = {
    profile: 'createProfileCard',
    compatibility: 'createCompatibilityCard',
    ranking: 'createRankingCard',
    achievement: 'createAchievementCard'
  };
  const method = methods[kind];
  if (!method) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
  const mode = resolveCapabilityMode('BUNNYFY_CANVAS_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client[method](payload);
      const downloaded = await client.downloadMedia(result.media, { maxBytes: 10 * 1024 * 1024 });
      return {
        ok: true,
        source: 'bunnyfy',
        buffer: downloaded.buffer,
        mime: downloaded.mime,
        width: result.width,
        height: result.height
      };
    }
  });
}

async function transcriptionWithBunnyFy(buffer, {
  mime = 'audio/ogg',
  language,
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
  }
  const mode = resolveCapabilityMode('BUNNYFY_TRANSCRIPTION_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const operationId = crypto.randomUUID();
      const source = await client.uploadMedia(buffer, {
        filename: 'audio-source',
        mime,
        idempotencyKey: `transcription-upload-${operationId}`
      });
      const result = await client.transcribeAudio(source.mediaId, {
        language,
        idempotencyKey: `transcription-${operationId}`
      });
      return {
        ok: true,
        source: 'bunnyfy',
        texto: result.text,
        language: result.language,
        durationSeconds: result.durationSeconds
      };
    }
  });
}

const SOCIAL_DOWNLOAD_MODES = {
  facebook: 'BUNNYFY_FACEBOOK_MODE',
  pinterest: 'BUNNYFY_PINTEREST_MODE',
  tiktok: 'BUNNYFY_TIKTOK_MODE',
  kwai: 'BUNNYFY_KWAI_MODE'
};

const SOCIAL_DOWNLOAD_METHODS = {
  facebook: 'downloadFacebook',
  pinterest: 'downloadPinterest',
  tiktok: 'downloadTiktok',
  kwai: 'downloadKwai'
};

/**
 * Retorna a mediaUrl assinada da BunnyFy (não baixa o buffer aqui): cada
 * comando de download já sabe consumir uma URL de mídia (é exatamente o que
 * fazia com a Vex), então a "cola" de baixar/repassar fica no arquivo do
 * comando, sem duplicar essa lógica no gateway.
 */
async function socialDownloadWithBunnyFy(provider, url, {
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const modeName = SOCIAL_DOWNLOAD_MODES[provider];
  const method = SOCIAL_DOWNLOAD_METHODS[provider];
  if (!modeName || !method) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');

  const mode = resolveCapabilityMode(modeName, env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      const result = await client[method](url, {
        idempotencyKey: `social-download-${provider}-${crypto.randomUUID()}`
      });
      return {
        ok: true,
        source: 'bunnyfy',
        mediaUrl: result.media.mediaUrl,
        mime: result.media.mime,
        title: result.title,
        durationSeconds: result.durationSeconds,
        thumbnail: result.thumbnail
      };
    }
  });
}

async function movieQuizWithBunnyFy({
  difficulty,
  env = process.env,
  clientFactory = createCapabilityClient,
  legacyFallback = async () => null
} = {}) {
  const mode = resolveCapabilityMode('BUNNYFY_GAMES_MODE', env);
  return executeCapability({
    mode,
    legacyFallback,
    operation: async () => {
      const client = clientFactory(env);
      return client.getMovieQuiz({ difficulty });
    }
  });
}

export {
  animatedLogoWithBunnyFy,
  createCapabilityClient,
  executeCapability,
  imageGenerateWithBunnyFy,
  masterEnabled,
  movieQuizWithBunnyFy,
  removeBackgroundWithBunnyFy,
  resolveCapabilityMode,
  socialCardWithBunnyFy,
  socialDownloadWithBunnyFy,
  shouldUseLegacyFallback,
  stickerCanvasWithBunnyFy,
  stickerWithBunnyFy,
  tavernBoardWithBunnyFy,
  tavernHandWithBunnyFy,
  tavernSceneWithBunnyFy,
  transcriptionWithBunnyFy,
  upscaleImageWithBunnyFy,
  welcomeCardWithBunnyFy
};
