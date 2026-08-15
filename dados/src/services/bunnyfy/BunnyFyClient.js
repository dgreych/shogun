import crypto from 'node:crypto';

import { BunnyFyError } from './BunnyFyError.js';
import {
  BUNNYFY_ROUTES,
  parseAnimatedLogo,
  parseAiChat,
  parseEnvelope,
  parseImageProcess,
  parseMediaUpload,
  parseMovieQuiz,
  parseSocialCard,
  parseSocialDownload,
  parseSticker,
  parseTranscription,
  parseYouTubeDownload
} from './contracts.js';

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TEMPORARY_INSECURE_BUNNYFY_ORIGIN = 'http://node1.vexhost.com.br:20056';

function normalizeBaseUrl(value, { allowInsecureHttp = false } = {}) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  if (url.protocol === 'http:' && !loopbackHosts.has(url.hostname.toLowerCase())) {
    const isTemporaryVexHostEndpoint = allowInsecureHttp === true
      && url.origin === TEMPORARY_INSECURE_BUNNYFY_ORIGIN
      && (url.pathname === '' || url.pathname === '/')
      && !url.search
      && !url.hash;
    if (!isTemporaryVexHostEndpoint) {
      throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
    }
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function validateToken(value) {
  const token = String(value || '').trim();
  if (!token || /COLOQUE|PLACEHOLDER|SUA?_CHAVE|SEU_TOKEN/i.test(token)) {
    throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  }
  return token;
}

function readRequestId(response, envelope, fallback) {
  return response.headers.get('x-request-id') || envelope?.meta?.requestId || fallback;
}

async function readLimitedBuffer(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new BunnyFyError('BUNNYFY_TOO_LARGE', { status: 413 });

  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new BunnyFyError('BUNNYFY_TOO_LARGE', { status: 413 });
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BunnyFyError('BUNNYFY_TOO_LARGE', { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function readLimitedText(response, maxBytes) {
  return (await readLimitedBuffer(response, maxBytes)).toString('utf8');
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
}

function normalizeYouTubeDownloadInput(input) {
  if (typeof input === 'string') {
    const url = input.trim();
    if (!url || url.length > 2048) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    return { url };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
  }

  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  if (Boolean(url) === Boolean(query)) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
  if (url) {
    if (url.length > 2048) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    return { url };
  }
  if (query.length > 200 || [...query].some(character => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  })) {
    throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
  }
  return { query };
}

class BunnyFyClient {
  constructor({
    baseUrl,
    token,
    allowInsecureHttp = false,
    timeoutMs = 120_000,
    maxResponseBytes = 2 * 1024 * 1024,
    retries = 1,
    fetchImpl = globalThis.fetch,
    sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
    requestIdFactory = () => crypto.randomUUID()
  }) {
    if (typeof fetchImpl !== 'function') throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
    this.baseUrl = normalizeBaseUrl(baseUrl, { allowInsecureHttp });
    this.token = validateToken(token);
    this.timeoutMs = Math.max(1, Number(timeoutMs) || 120_000);
    this.maxResponseBytes = Math.max(1024, Number(maxResponseBytes) || 2 * 1024 * 1024);
    this.retries = Math.max(0, Math.min(3, Number(retries) || 0));
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.requestIdFactory = requestIdFactory;
  }

  resolveMediaDescriptor(media) {
    if (!media || typeof media !== 'object' || Array.isArray(media) || typeof media.mediaUrl !== 'string') {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }
    let resolved;
    const base = new URL(this.baseUrl);
    try {
      resolved = new URL(media.mediaUrl, `${this.baseUrl}/`);
    } catch {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }
    if (resolved.origin !== base.origin || resolved.username || resolved.password) {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }
    return { ...media, mediaUrl: resolved.toString() };
  }

  async downloadMedia(media, {
    maxBytes = 100 * 1024 * 1024,
    timeoutMs = this.timeoutMs
  } = {}) {
    const descriptor = this.resolveMediaDescriptor(media);
    const resolved = new URL(descriptor.mediaUrl);
    if (!resolved.pathname.startsWith('/v1/media/')) {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }

    const byteLimit = Math.max(1, Number(maxBytes) || 100 * 1024 * 1024);
    const expectedBytes = Number(descriptor.bytes);
    if (
      Object.hasOwn(descriptor, 'bytes') &&
      (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0)
    ) {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }
    if (Number.isFinite(expectedBytes) && expectedBytes > byteLimit) {
      throw new BunnyFyError('BUNNYFY_TOO_LARGE', { status: 413 });
    }

    const requestId = this.requestIdFactory();
    const effectiveTimeout = Math.max(1, Number(timeoutMs) || this.timeoutMs);
    try {
      const signedAccess = resolved.searchParams.has('exp') && resolved.searchParams.has('sig');
      const requestHeaders = {
        Accept: descriptor.mime || 'application/octet-stream',
        'X-Request-Id': requestId
      };
      if (!signedAccess) requestHeaders.Authorization = `Bearer ${this.token}`;

      const response = await this.fetchImpl(descriptor.mediaUrl, {
        method: 'GET',
        headers: requestHeaders,
        signal: AbortSignal.timeout(effectiveTimeout),
        redirect: 'error'
      });

      if (!response.ok) {
        throw BunnyFyError.fromStatus(response.status, {
          requestId: response.headers.get('x-request-id') || requestId
        });
      }

      const expectedMime = typeof descriptor.mime === 'string'
        ? descriptor.mime.split(';', 1)[0].trim().toLowerCase()
        : '';
      const receivedMime = String(response.headers.get('content-type') || '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (expectedMime && receivedMime && expectedMime !== receivedMime) {
        throw new BunnyFyError('BUNNYFY_BAD_RESPONSE', { requestId });
      }

      const buffer = await readLimitedBuffer(response, byteLimit);
      if (Number.isSafeInteger(expectedBytes) && expectedBytes >= 0 && buffer.length !== expectedBytes) {
        throw new BunnyFyError('BUNNYFY_BAD_RESPONSE', { requestId });
      }

      return {
        buffer,
        mime: receivedMime || expectedMime || 'application/octet-stream',
        bytes: buffer.length,
        requestId: response.headers.get('x-request-id') || requestId
      };
    } catch (error) {
      if (error instanceof BunnyFyError) throw error;
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new BunnyFyError(
        timedOut ? 'BUNNYFY_TIMEOUT' : 'BUNNYFY_NETWORK_ERROR',
        { retryable: true, requestId }
      );
    }
  }

  async request(path, {
    method = 'GET',
    json,
    body,
    headers = {},
    idempotencyKey = null
  } = {}) {
    const normalizedMethod = String(method).toUpperCase();
    const requestId = this.requestIdFactory();
    const canRetry = ['GET', 'HEAD'].includes(normalizedMethod) || Boolean(idempotencyKey);
    const attempts = canRetry ? this.retries + 1 : 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const requestHeaders = {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          'X-Request-Id': requestId,
          ...headers
        };
        let requestBody = body;
        if (json !== undefined) {
          requestHeaders['Content-Type'] = 'application/json';
          requestBody = JSON.stringify(json);
        }
        if (idempotencyKey) requestHeaders['Idempotency-Key'] = idempotencyKey;

        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: normalizedMethod,
          headers: requestHeaders,
          body: requestBody,
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: 'error'
        });
        let text;
        try {
          text = await readLimitedText(response, this.maxResponseBytes);
        } catch (error) {
          if (!response.ok) {
            const statusError = BunnyFyError.fromStatus(response.status, {
              requestId: response.headers.get('x-request-id') || requestId
            });
            if (attempt < attempts && (statusError.retryable || TRANSIENT_STATUS.has(response.status))) {
              await this.sleep(attempt * 100);
              continue;
            }
            throw statusError;
          }
          throw error;
        }

        if (!response.ok) {
          let errorEnvelope = null;
          if (text) {
            try {
              errorEnvelope = parseEnvelope(JSON.parse(text));
            } catch {}
          }
          const responseRequestId = readRequestId(response, errorEnvelope, requestId);
          const error = BunnyFyError.fromStatus(response.status, {
            requestId: responseRequestId
          });
          if (attempt < attempts && (error.retryable || TRANSIENT_STATUS.has(response.status))) {
            await this.sleep(attempt * 100);
            continue;
          }
          throw error;
        }

        const envelope = parseEnvelope(parseJson(text));
        const responseRequestId = readRequestId(response, envelope, requestId);

        if (!envelope.ok) {
          const error = BunnyFyError.fromStatus(response.status, {
            code: envelope.error.code,
            retryable: envelope.error.retryable,
            requestId: responseRequestId
          });
          if (attempt < attempts && (error.retryable || TRANSIENT_STATUS.has(response.status))) {
            await this.sleep(attempt * 100);
            continue;
          }
          throw error;
        }
        return { data: envelope.data, meta: envelope.meta, requestId: responseRequestId };
      } catch (error) {
        if (error instanceof BunnyFyError) throw error;
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        const wrapped = new BunnyFyError(
          timedOut ? 'BUNNYFY_TIMEOUT' : 'BUNNYFY_NETWORK_ERROR',
          { retryable: true, requestId }
        );
        if (attempt < attempts) {
          await this.sleep(attempt * 100);
          continue;
        }
        throw wrapped;
      }
    }
    throw new BunnyFyError('BUNNYFY_NETWORK_ERROR', { requestId });
  }

  async uploadMedia(buffer, {
    filename = 'media.bin',
    mime = 'application/octet-stream',
    idempotencyKey = crypto.randomUUID()
  } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mime }), filename);
    const response = await this.request(BUNNYFY_ROUTES.media, {
      method: 'POST',
      body: form,
      idempotencyKey
    });
    return this.resolveMediaDescriptor(parseMediaUpload(response.data));
  }

  async uploadImage(buffer, {
    filename = 'image.png',
    mime = 'image/png',
    idempotencyKey = crypto.randomUUID()
  } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !String(mime).toLowerCase().startsWith('image/')) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mime }), filename);
    const response = await this.request(BUNNYFY_ROUTES.imageMedia, {
      method: 'POST',
      body: form,
      idempotencyKey
    });
    return this.resolveMediaDescriptor(parseMediaUpload(response.data));
  }

  async upscaleImage(mediaId, scale = 2, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (typeof mediaId !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/.test(mediaId) || ![2, 4].includes(scale)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.imageUpscale, {
      method: 'POST',
      json: { mediaId, scale },
      idempotencyKey
    });
    const result = parseImageProcess(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async removeImageBackground(mediaId, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (typeof mediaId !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/.test(mediaId)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.imageBackgroundRemoval, {
      method: 'POST',
      json: { mediaId },
      idempotencyKey
    });
    const result = parseImageProcess(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async renderTavernBoard(state, playerNames = {}, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (!state || typeof state !== 'object') throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    const response = await this.request(BUNNYFY_ROUTES.tavernBoard, {
      method: 'POST',
      json: { state, playerNames },
      idempotencyKey
    });
    const result = parseImageProcess(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async renderTavernHand(state, playerId, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (!state || typeof state !== 'object' || typeof playerId !== 'string' || !playerId.trim()) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.tavernHand, {
      method: 'POST',
      json: { state, playerId },
      idempotencyKey
    });
    const result = parseImageProcess(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async renderTavernScene(kind, payload = {}, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (!['invite', 'mulligan', 'turn', 'victory'].includes(kind)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.tavernScene, {
      method: 'POST',
      json: { kind, payload },
      idempotencyKey
    });
    const result = parseImageProcess(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async generateImage(prompt, { width, height, idempotencyKey = crypto.randomUUID() } = {}) {
    if (typeof prompt !== 'string' || !prompt.trim()) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    const json = { prompt };
    if (width) json.width = width;
    if (height) json.height = height;
    const response = await this.request(BUNNYFY_ROUTES.imageGenerate, {
      method: 'POST',
      json,
      idempotencyKey
    });
    const result = parseImageProcess(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async createSticker(mediaId, {
    kind,
    fit = 'contain',
    idempotencyKey = crypto.randomUUID()
  } = {}) {
    if (
      typeof mediaId !== 'string'
      || !/^[A-Za-z0-9_-]{10,64}$/.test(mediaId)
      || !['static', 'animated'].includes(kind)
      || !['contain', 'cover'].includes(fit)
    ) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.stickers, {
      method: 'POST',
      json: { mediaId, kind, fit },
      idempotencyKey
    });
    const result = parseSticker(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async createStickerCanvas(payload, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.stickerCanvas, {
      method: 'POST',
      json: payload,
      idempotencyKey
    });
    const result = parseSticker(response.data);
    if (result.animated || typeof result.template !== 'string') {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async createAnimatedLogo(model, texts, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (
      typeof model !== 'string'
      || !/^[a-z0-9]{2,24}$/.test(model)
      || !Array.isArray(texts)
      || texts.length < 1
      || texts.length > 2
      || texts.some(text => typeof text !== 'string' || !text.trim() || [...text].length > 40)
    ) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.animatedLogo, {
      method: 'POST',
      json: { model, texts: texts.map(text => text.trim()) },
      idempotencyKey
    });
    const result = parseAnimatedLogo(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async createChatCompletion(messages, {
    temperature = 0.7,
    maxOutputTokens = 2000,
    model
  } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    if (model !== undefined && (typeof model !== 'string' || !/^[A-Za-z0-9._/-]{1,200}$/.test(model))) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.aiChat, {
      method: 'POST',
      json: { messages, temperature, maxOutputTokens, ...(model ? { model } : {}) }
    });
    return {
      ...parseAiChat(response.data),
      requestId: response.requestId
    };
  }

  async downloadYouTubeAudio(input, { quality } = {}) {
    const source = normalizeYouTubeDownloadInput(input);
    const response = await this.request(BUNNYFY_ROUTES.youtubeAudio, {
      method: 'POST',
      json: { ...source, ...(quality ? { quality } : {}) }
    });
    const result = parseYouTubeDownload(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async downloadYouTubeAudioByQuery(query, options) {
    return this.downloadYouTubeAudio({ query }, options);
  }

  async downloadYouTubeVideo(input, { quality } = {}) {
    const source = normalizeYouTubeDownloadInput(input);
    const response = await this.request(BUNNYFY_ROUTES.youtubeVideo, {
      method: 'POST',
      json: { ...source, ...(quality ? { quality } : {}) }
    });
    const result = parseYouTubeDownload(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async downloadYouTubeVideoByQuery(query, options) {
    return this.downloadYouTubeVideo({ query }, options);
  }

  async requestSocialCard(route, payload, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(route, {
      method: 'POST',
      json: payload,
      idempotencyKey
    });
    const result = parseSocialCard(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async createWelcomeCard(payload, options) {
    return this.requestSocialCard(BUNNYFY_ROUTES.welcomeCard, payload, options);
  }

  async createProfileCard(payload, options) {
    return this.requestSocialCard(BUNNYFY_ROUTES.profileCard, payload, options);
  }

  async createCompatibilityCard(payload, options) {
    return this.requestSocialCard(BUNNYFY_ROUTES.compatibilityCard, payload, options);
  }

  async createRankingCard(payload, options) {
    return this.requestSocialCard(BUNNYFY_ROUTES.rankingCard, payload, options);
  }

  async createAchievementCard(payload, options) {
    return this.requestSocialCard(BUNNYFY_ROUTES.achievementCard, payload, options);
  }

  async transcribeAudio(mediaId, { language, idempotencyKey = crypto.randomUUID() } = {}) {
    if (typeof mediaId !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/.test(mediaId)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    if (language !== undefined && (typeof language !== 'string' || !/^([a-z]{2}|auto)$/.test(language))) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.transcriptions, {
      method: 'POST',
      json: { mediaId, ...(language ? { language } : {}) },
      idempotencyKey
    });
    return parseTranscription(response.data);
  }

  async downloadSocialMedia(route, url, { idempotencyKey = crypto.randomUUID() } = {}) {
    if (typeof url !== 'string' || !url.trim() || url.length > 2048) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(route, {
      method: 'POST',
      json: { url: url.trim() },
      idempotencyKey
    });
    const result = parseSocialDownload(response.data);
    return { ...result, media: this.resolveMediaDescriptor(result.media) };
  }

  async downloadFacebook(url, options) {
    return this.downloadSocialMedia(BUNNYFY_ROUTES.downloadsFacebook, url, options);
  }

  async downloadPinterest(url, options) {
    return this.downloadSocialMedia(BUNNYFY_ROUTES.downloadsPinterest, url, options);
  }

  async downloadTiktok(url, options) {
    return this.downloadSocialMedia(BUNNYFY_ROUTES.downloadsTiktok, url, options);
  }

  async downloadKwai(url, options) {
    return this.downloadSocialMedia(BUNNYFY_ROUTES.downloadsKwai, url, options);
  }

  async getMovieQuiz({ difficulty } = {}) {
    if (difficulty !== undefined && !['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
    }
    const response = await this.request(BUNNYFY_ROUTES.movieQuiz, {
      method: 'POST',
      json: { category: 'movies', ...(difficulty ? { difficulty } : {}) }
    });
    return { ...parseMovieQuiz(response.data), requestId: response.requestId };
  }
}

export { BunnyFyClient, normalizeBaseUrl, normalizeYouTubeDownloadInput, readLimitedBuffer, readLimitedText, validateToken };
