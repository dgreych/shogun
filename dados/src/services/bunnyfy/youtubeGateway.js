import { BunnyFyClient } from './BunnyFyClient.js';
import { BunnyFyError } from './BunnyFyError.js';
import { resolveBunnyFyRuntimeEnv } from './runtimeConfig.js';

const YOUTUBE_MODES = new Set(['off', 'primary', 'exclusive']);
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be'
]);
const SELECTIVE_FALLBACK_CODES = new Set([
  'BUNNYFY_BAD_RESPONSE',
  'BUNNYFY_NETWORK_ERROR',
  'BUNNYFY_REMOTE_ERROR',
  'BUNNYFY_TIMEOUT',
  'BUNNYFY_TOOL_UNAVAILABLE',
  'BUNNYFY_UNAVAILABLE'
]);

const DEFAULT_YOUTUBE_TIMEOUT_MS = 190_000;
const DEFAULT_YOUTUBE_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_YOUTUBE_MAX_CONCURRENCY = 1;
const MAX_YOUTUBE_MAX_CONCURRENCY = 4;
const MAX_PLAY_DURATION_SECONDS = 30 * 60;

function enabledByMasterFlag(env) {
  return ['true', '1'].includes(String(env.BUNNYFY_ENABLED || '').trim().toLowerCase());
}

function resolveBunnyFyYoutubeMode(env = resolveBunnyFyRuntimeEnv()) {
  if (!enabledByMasterFlag(env)) return 'off';
  const mode = String(env.BUNNYFY_YOUTUBE_MODE || 'off').trim().toLowerCase();
  if (!YOUTUBE_MODES.has(mode)) throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  return mode;
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveYoutubeLimits(env = resolveBunnyFyRuntimeEnv()) {
  return {
    timeoutMs: readPositiveNumber(env.BUNNYFY_YOUTUBE_TIMEOUT_MS, DEFAULT_YOUTUBE_TIMEOUT_MS),
    maxBytes: readPositiveNumber(env.BUNNYFY_YOUTUBE_MAX_BYTES, DEFAULT_YOUTUBE_MAX_BYTES)
  };
}

function resolveYoutubeMaxConcurrency(env = resolveBunnyFyRuntimeEnv()) {
  const parsed = Number(env.BUNNYFY_YOUTUBE_MAX_CONCURRENCY);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_YOUTUBE_MAX_CONCURRENCY;
  return Math.min(MAX_YOUTUBE_MAX_CONCURRENCY, Math.floor(parsed));
}

function createYoutubePlayConcurrencyLimiter(maxConcurrency = DEFAULT_YOUTUBE_MAX_CONCURRENCY) {
  const limit = Math.min(
    MAX_YOUTUBE_MAX_CONCURRENCY,
    Math.max(1, Math.floor(Number(maxConcurrency) || DEFAULT_YOUTUBE_MAX_CONCURRENCY))
  );
  let active = 0;

  return {
    get active() {
      return active;
    },
    limit,
    tryAcquire() {
      if (active >= limit) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
      };
    }
  };
}

const youtubePlayConcurrencyLimiter = createYoutubePlayConcurrencyLimiter(
  resolveYoutubeMaxConcurrency(resolveBunnyFyRuntimeEnv())
);

function tryAcquireYoutubePlaySlot() {
  return youtubePlayConcurrencyLimiter.tryAcquire();
}

function normalizeYoutubePlayInput(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    if (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password &&
      YOUTUBE_HOSTS.has(hostname)
    ) {
      parsed.protocol = 'https:';
      parsed.hash = '';
      return { type: 'url', value: parsed.toString() };
    }
  } catch {}

  return { type: 'query', value: raw };
}

function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function buildAudioFilename(title) {
  const safeTitle = String(title || 'audio')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .trim()
    .slice(0, 120);
  return `${safeTitle || 'audio'}.mp3`;
}

function buildVideoFilename(title) {
  return buildAudioFilename(title).replace(/\.mp3$/, '.mp4');
}

function sanitizeYoutubeThumbnail(value) {
  const raw = String(value || '').trim();
  const authority = /^https:\/\/([^/?#]+)/i.exec(raw)?.[1] || '';
  if (!authority || authority.includes('@') || authority.includes(':')) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowedHost = hostname === 'i.ytimg.com'
    || hostname === 'img.youtube.com'
    || /^i[1-9]\.ytimg\.com$/.test(hostname);
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || !allowedHost
  ) {
    return null;
  }

  parsed.hash = '';
  return parsed.toString();
}

function sanitizeYoutubePreviewText(value, fallback, maxLength) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function canonicalYoutubeVideoUrl(value) {
  const videoId = extractYoutubeVideoId(value);
  return videoId ? `https://youtube.com/watch?v=${videoId}` : null;
}

function createYoutubePreview({ input, effectiveInput, result = {}, metadata = {} }) {
  const secondsCandidate = Number(result.durationSeconds || metadata.seconds);
  const durationSeconds = Number.isFinite(secondsCandidate) && secondsCandidate > 0
    ? Math.floor(secondsCandidate)
    : 0;
  const viewsCandidate = Number(metadata.views);
  const views = Number.isSafeInteger(viewsCandidate) && viewsCandidate >= 0 ? viewsCandidate : null;
  const sourceUrl = canonicalYoutubeVideoUrl(metadata.url)
    || canonicalYoutubeVideoUrl(effectiveInput?.value)
    || (input.type === 'url' ? canonicalYoutubeVideoUrl(input.value) : null);

  return {
    title: sanitizeYoutubePreviewText(result.title || metadata.title, 'YouTube Audio', 180),
    channel: sanitizeYoutubePreviewText(metadata.author?.name, 'Não informado', 100),
    duration: durationSeconds > 0 ? formatDuration(durationSeconds) : 'Não informada',
    durationSeconds,
    views,
    published: sanitizeYoutubePreviewText(metadata.ago, 'Não informado', 80),
    description: sanitizeYoutubePreviewText(metadata.description, 'Sem descrição disponível', 240),
    url: sourceUrl,
    thumbnail: sanitizeYoutubeThumbnail(result.thumbnail || metadata.thumbnail)
  };
}

function buildYoutubePreviewCaption(preview) {
  const viewText = preview.views === null
    ? 'Não informadas'
    : new Intl.NumberFormat('pt-BR').format(preview.views);
  const durationText = preview.durationSeconds > 0
    ? `${preview.duration} (${preview.durationSeconds} segundos)`
    : preview.duration;
  const linkLine = preview.url ? `\n🔗 *Link:* ${preview.url}` : '';

  return `🎵 *Música Encontrada* 🎵\n\n` +
    `📌 *Título:* ${preview.title}\n` +
    `👤 *Artista/Canal:* ${preview.channel}\n` +
    `⏱️ *Duração:* ${durationText}\n` +
    `👀 *Visualizações:* ${viewText}\n` +
    `📅 *Publicado:* ${preview.published}\n` +
    `📜 *Descrição:* ${preview.description}${linkLine}\n\n` +
    '🎧 *Baixando e processando sua música, aguarde...*';
}

function extractYoutubeVideoId(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  let videoId = null;
  if (hostname === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] || null;
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    videoId = parsed.searchParams.get('v');
    if (!videoId) {
      const [kind, candidate] = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts'].includes(kind)) videoId = candidate || null;
    }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(String(videoId || '')) ? videoId : null;
}

function validateKnownLegacyDuration(videoInfo) {
  const seconds = Number(videoInfo?.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return {
      ok: false,
      code: 'YOUTUBE_DURATION_UNKNOWN',
      msg: 'Não foi possível confirmar a duração desse vídeo com segurança.'
    };
  }
  if (seconds > MAX_PLAY_DURATION_SECONDS) {
    return {
      ok: false,
      code: 'YOUTUBE_TOO_LONG',
      msg: `Este vídeo é muito longo (${videoInfo?.timestamp || formatDuration(seconds)}). Escolha um vídeo de até 30 minutos.`
    };
  }
  return { ok: true, seconds };
}

function normalizeSuccessfulDownload({
  buffer,
  title,
  thumbnail,
  durationSeconds,
  source,
  input,
  fallbackUsed = false,
  mime = 'audio/mpeg',
  filename
}) {
  const seconds = Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? durationSeconds
    : 0;
  return {
    ok: true,
    buffer,
    title: String(title || (mime === 'video/mp4' ? 'YouTube Video' : 'YouTube Audio')),
    thumbnail: sanitizeYoutubeThumbnail(thumbnail),
    durationSeconds: seconds,
    duration: formatDuration(seconds),
    filename: filename || (mime === 'video/mp4' ? buildVideoFilename(title) : buildAudioFilename(title)),
    mime: mime || 'audio/mpeg',
    source,
    inputType: input.type,
    sourceUrl: input.type === 'url' ? input.value : null,
    fallbackUsed
  };
}

async function resolveQueryForBunnyFy(input, legacyYoutube) {
  if (input.type !== 'query' || typeof legacyYoutube?.search !== 'function') return null;
  const searchResult = await legacyYoutube.search(input.value);
  if (!searchResult?.ok || !searchResult.data?.url) return null;
  const videoId = String(searchResult.data.videoId || extractYoutubeVideoId(searchResult.data.url) || '');
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

  let metadata = searchResult.data;
  if (typeof legacyYoutube?.getMetadataByVideoId === 'function') {
    const verified = await legacyYoutube.getMetadataByVideoId(videoId);
    if (!verified?.ok) return null;
    metadata = { ...metadata, ...verified.data };
  }
  const durationCheck = validateKnownLegacyDuration(metadata);
  if (!durationCheck.ok) return durationCheck;
  return {
    ok: true,
    input: { type: 'url', value: `https://www.youtube.com/watch?v=${videoId}` },
    metadata: { ...metadata, seconds: durationCheck.seconds }
  };
}

async function downloadLegacyYoutubeAudio(input, legacyYoutube, onMetadata) {
  if (
    !legacyYoutube
    || typeof legacyYoutube.mp3 !== 'function'
    || typeof legacyYoutube.getMetadataByVideoId !== 'function'
  ) {
    throw new Error('YOUTUBE_LEGACY_UNAVAILABLE');
  }

  let selectedVideo;
  if (input.type === 'url') {
    const videoId = extractYoutubeVideoId(input.value);
    if (!videoId) return { ok: false, msg: 'Envie um link válido de vídeo do YouTube.' };
    const metadata = await legacyYoutube.getMetadataByVideoId(videoId);
    if (!metadata?.ok) {
      return { ok: false, code: 'YOUTUBE_DURATION_UNKNOWN', msg: 'Não foi possível confirmar a duração desse vídeo com segurança.' };
    }
    selectedVideo = { ...metadata.data, url: input.value, videoId };
  } else {
    if (typeof legacyYoutube.search !== 'function') {
      throw new Error('YOUTUBE_LEGACY_SEARCH_UNAVAILABLE');
    }
    const searchResult = await legacyYoutube.search(input.value);
    if (!searchResult?.ok || !searchResult.data?.url) {
      return { ok: false, msg: 'Nenhum vídeo foi encontrado para essa busca.' };
    }
    const videoId = String(searchResult.data.videoId || extractYoutubeVideoId(searchResult.data.url) || '');
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return { ok: false, code: 'YOUTUBE_DURATION_UNKNOWN', msg: 'Não foi possível confirmar a duração desse vídeo com segurança.' };
    }
    const metadata = await legacyYoutube.getMetadataByVideoId(videoId);
    if (!metadata?.ok) {
      return { ok: false, code: 'YOUTUBE_DURATION_UNKNOWN', msg: 'Não foi possível confirmar a duração desse vídeo com segurança.' };
    }
    selectedVideo = {
      ...searchResult.data,
      ...metadata.data,
      url: searchResult.data.url,
      videoId
    };
  }

  const durationCheck = validateKnownLegacyDuration(selectedVideo);
  if (!durationCheck.ok) return durationCheck;

  await onMetadata?.(createYoutubePreview({
    input,
    effectiveInput: { type: 'url', value: selectedVideo.url },
    metadata: { ...selectedVideo, seconds: durationCheck.seconds }
  }));

  const downloaded = await legacyYoutube.mp3(selectedVideo.url, 128);
  if (!downloaded?.ok || !Buffer.isBuffer(downloaded.buffer)) {
    return { ok: false, msg: 'Não foi possível baixar esse áudio no momento.' };
  }
  return normalizeSuccessfulDownload({
    buffer: downloaded.buffer,
    title: downloaded.title || selectedVideo.title,
    thumbnail: downloaded.thumbnail || selectedVideo.thumbnail,
    durationSeconds: downloaded.tempo || durationCheck.seconds,
    source: 'legacy',
    input,
    mime: 'audio/mpeg'
  });
}

function createBunnyFyYoutubeClient(env = resolveBunnyFyRuntimeEnv()) {
  const { timeoutMs } = resolveYoutubeLimits(env);
  return new BunnyFyClient({
    baseUrl: env.BUNNYFY_BASE_URL,
    token: env.BUNNYFY_API_TOKEN,
    allowInsecureHttp: ['true', '1'].includes(
      String(env.BUNNYFY_ALLOW_INSECURE_HTTP || '').trim().toLowerCase()
    ),
    timeoutMs,
    maxResponseBytes: 2 * 1024 * 1024,
    retries: 0
  });
}

function shouldFallbackYoutubeError(error) {
  const status = Number(error?.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) return false;
  return SELECTIVE_FALLBACK_CODES.has(error?.code) || (Number.isInteger(status) && status >= 500);
}

async function downloadBunnyFyYoutubeAudio(input, env, clientFactory, legacyYoutube, onMetadata) {
  const limits = resolveYoutubeLimits(env);
  const client = clientFactory(env);
  let resolved = null;
  if (input.type === 'query' && ['true', '1'].includes(String(env.BUNNYFY_YOUTUBE_RESOLVE_QUERY_LOCALLY || '').toLowerCase())) {
    resolved = await resolveQueryForBunnyFy(input, legacyYoutube);
    if (resolved && resolved.ok === false) return resolved;
  }
  const effectiveInput = resolved?.input || input;
  if (resolved?.metadata) {
    await onMetadata?.(createYoutubePreview({
      input,
      effectiveInput,
      metadata: resolved.metadata
    }));
  }
  const requestInput = effectiveInput.type === 'url' ? { url: effectiveInput.value } : { query: effectiveInput.value };
  const result = await client.downloadYouTubeAudio(requestInput);

  if (input.type === 'query' && Number(result.durationSeconds) > MAX_PLAY_DURATION_SECONDS) {
    return {
      ok: false,
      code: 'YOUTUBE_TOO_LONG',
      msg: `Este vídeo é muito longo (${formatDuration(result.durationSeconds)}). Escolha um vídeo com menos de 30 minutos.`
    };
  }

  if (!resolved?.metadata) {
    await onMetadata?.(createYoutubePreview({ input, effectiveInput, result }));
  }

  const downloadedMedia = await client.downloadMedia(result.media, limits);
  if (!Buffer.isBuffer(downloadedMedia?.buffer) || downloadedMedia.buffer.length === 0) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return normalizeSuccessfulDownload({
    buffer: downloadedMedia.buffer,
    title: result.title || resolved?.metadata?.title,
    thumbnail: result.thumbnail || resolved?.metadata?.thumbnail,
    durationSeconds: result.durationSeconds || resolved?.metadata?.seconds,
    source: 'bunnyfy',
    input,
    mime: downloadedMedia.mime
  });
}

async function downloadLegacyYoutubeVideo(input, legacyYoutube, quality = '360p') {
  if (!legacyYoutube || typeof legacyYoutube.mp4 !== 'function') {
    throw new Error('YOUTUBE_LEGACY_UNAVAILABLE');
  }
  let selected = input;
  let metadata = null;
  if (input.type === 'query') {
    const resolved = await resolveQueryForBunnyFy(input, legacyYoutube);
    if (!resolved?.ok) return resolved || { ok: false, msg: 'Nenhum vídeo foi encontrado para essa busca.' };
    selected = resolved.input;
    metadata = resolved.metadata;
  }
  const downloaded = await legacyYoutube.mp4(selected.value, Number.parseInt(quality, 10) || 360);
  if (!downloaded?.ok || !Buffer.isBuffer(downloaded.buffer)) {
    return { ok: false, msg: 'Não foi possível baixar esse vídeo no momento.' };
  }
  return normalizeSuccessfulDownload({
    buffer: downloaded.buffer,
    title: downloaded.title || metadata?.title,
    thumbnail: downloaded.thumbnail || metadata?.thumbnail,
    durationSeconds: downloaded.tempo || metadata?.seconds,
    source: 'legacy',
    input,
    mime: 'video/mp4'
  });
}

async function downloadBunnyFyYoutubeVideo(input, quality, env, clientFactory, legacyYoutube) {
  const limits = resolveYoutubeLimits(env);
  const client = clientFactory(env);
  let resolved = null;
  if (input.type === 'query') {
    resolved = await resolveQueryForBunnyFy(input, legacyYoutube);
    if (resolved && resolved.ok === false) return resolved;
  }
  const effectiveInput = resolved?.input || input;
  const requestInput = effectiveInput.type === 'url' ? { url: effectiveInput.value } : { query: effectiveInput.value };
  const result = await client.downloadYouTubeVideo(requestInput, { quality });
  const downloadedMedia = await client.downloadMedia(result.media, limits);
  if (!Buffer.isBuffer(downloadedMedia?.buffer) || downloadedMedia.buffer.length === 0) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return normalizeSuccessfulDownload({
    buffer: downloadedMedia.buffer,
    title: result.title || resolved?.metadata?.title,
    thumbnail: result.thumbnail || resolved?.metadata?.thumbnail,
    durationSeconds: result.durationSeconds || resolved?.metadata?.seconds,
    source: 'bunnyfy',
    input,
    mime: downloadedMedia.mime || 'video/mp4'
  });
}

async function downloadYoutubeAudioForPlay(value, {
  env = resolveBunnyFyRuntimeEnv(),
  legacyYoutube,
  clientFactory = createBunnyFyYoutubeClient,
  onMetadata
} = {}) {
  const input = normalizeYoutubePlayInput(value);
  const mode = resolveBunnyFyYoutubeMode(env);
  let metadataSent = false;
  const emitMetadataOnce = async preview => {
    if (metadataSent || typeof onMetadata !== 'function') return;
    metadataSent = true;
    try {
      await onMetadata(preview);
    } catch {}
  };
  if (mode === 'off') return downloadLegacyYoutubeAudio(input, legacyYoutube, emitMetadataOnce);

  try {
    return await downloadBunnyFyYoutubeAudio(input, env, clientFactory, legacyYoutube, emitMetadataOnce);
  } catch (error) {
    if (mode === 'primary' && shouldFallbackYoutubeError(error)) {
      const fallback = await downloadLegacyYoutubeAudio(input, legacyYoutube, emitMetadataOnce);
      return fallback.ok ? { ...fallback, fallbackUsed: true } : fallback;
    }
    throw error;
  }
}

async function downloadYoutubeVideoForPlay(value, {
  quality = '360p',
  env = resolveBunnyFyRuntimeEnv(),
  legacyYoutube,
  clientFactory = createBunnyFyYoutubeClient
} = {}) {
  const input = normalizeYoutubePlayInput(value);
  const mode = resolveBunnyFyYoutubeMode(env);
  if (mode === 'off') return downloadLegacyYoutubeVideo(input, legacyYoutube, quality);

  try {
    return await downloadBunnyFyYoutubeVideo(input, quality, env, clientFactory, legacyYoutube);
  } catch (error) {
    if (mode === 'primary' && shouldFallbackYoutubeError(error)) {
      const fallback = await downloadLegacyYoutubeVideo(input, legacyYoutube, quality);
      return fallback?.ok ? { ...fallback, fallbackUsed: true } : fallback;
    }
    throw error;
  }
}

function youtubePlayErrorMessage(error) {
  switch (error?.code) {
    case 'BUNNYFY_BAD_REQUEST':
    case 'BUNNYFY_NOT_FOUND':
      return '❌ Não consegui localizar ou baixar essa mídia do YouTube.';
    case 'BUNNYFY_TOO_LARGE':
      return '📦 Esse áudio excede o tamanho permitido para download.';
    case 'BUNNYFY_RATE_LIMITED':
      return '⏳ Há muitos downloads em andamento. Tente novamente em instantes.';
    case 'BUNNYFY_TIMEOUT':
    case 'BUNNYFY_NETWORK_ERROR':
    case 'BUNNYFY_REMOTE_ERROR':
    case 'BUNNYFY_TOOL_UNAVAILABLE':
    case 'BUNNYFY_UNAVAILABLE':
      return '❌ O sistema de YouTube está temporariamente indisponível. Tente novamente em instantes.';
    default:
      return '❌ Não foi possível processar esse áudio agora. Tente novamente mais tarde.';
  }
}

export {
  DEFAULT_YOUTUBE_MAX_BYTES,
  DEFAULT_YOUTUBE_MAX_CONCURRENCY,
  DEFAULT_YOUTUBE_TIMEOUT_MS,
  MAX_YOUTUBE_MAX_CONCURRENCY,
  MAX_PLAY_DURATION_SECONDS,
  buildAudioFilename,
  buildVideoFilename,
  buildYoutubePreviewCaption,
  canonicalYoutubeVideoUrl,
  createYoutubePreview,
  createYoutubePlayConcurrencyLimiter,
  createBunnyFyYoutubeClient,
  downloadYoutubeAudioForPlay,
  downloadYoutubeVideoForPlay,
  extractYoutubeVideoId,
  formatDuration,
  normalizeYoutubePlayInput,
  resolveBunnyFyYoutubeMode,
  resolveYoutubeLimits,
  resolveYoutubeMaxConcurrency,
  sanitizeYoutubeThumbnail,
  shouldFallbackYoutubeError,
  tryAcquireYoutubePlaySlot,
  validateKnownLegacyDuration,
  youtubePlayErrorMessage
};
