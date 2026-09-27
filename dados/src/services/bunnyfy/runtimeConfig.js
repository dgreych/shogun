import { getConfig } from '../../utils/shogunStore.js';
import { BUNNYFY_SERVICE_ORIGIN } from './instanceAccess.js';

const BUNNYFY_CONFIG_KEYS = Object.freeze([
  'BUNNYFY_ENABLED',
  'BUNNYFY_BASE_URL',
  'BUNNYFY_API_TOKEN',
  'BUNNYFY_ALLOW_INSECURE_HTTP',
  'BUNNYFY_CONVERSATION_MODE',
  'BUNNYFY_CONVERSATION_TIMEOUT_MS',
  'BUNNYFY_ACCOUNT_URL',
  'BUNNYFY_YOUTUBE_MODE',
  'BUNNYFY_YOUTUBE_TIMEOUT_MS',
  'BUNNYFY_YOUTUBE_MAX_BYTES',
  'BUNNYFY_YOUTUBE_MAX_CONCURRENCY',
  'BUNNYFY_CAPABILITY_TIMEOUT_MS',
  'BUNNYFY_IMAGES_MODE',
  'BUNNYFY_STICKERS_MODE',
  'BUNNYFY_CANVAS_MODE',
  'BUNNYFY_LOGOS_MODE',
  'BUNNYFY_GAMES_MODE'
  , 'BUNNYFY_INSTAGRAM_MODE'
  , 'BUNNYFY_TRANSCRIPTION_MODE', 'BUNNYFY_FACEBOOK_MODE', 'BUNNYFY_PINTEREST_MODE', 'BUNNYFY_TIKTOK_MODE', 'BUNNYFY_KWAI_MODE', 'BUNNYFY_IMAGE_GEN_MODE', 'BUNNYFY_TAVERN_RENDER_MODE', 'BUNNYFY_NEXO_RENDER_MODE'
]);

const EXTRA_ALIASES = Object.freeze({
  BUNNYFY_API_TOKEN: ['bunnyfy_token'],
  BUNNYFY_BASE_URL: ['bunnyfy_url']
});

function configuredValue(config, key) {
  const candidates = [
    key,
    key.toLowerCase(),
    ...(EXTRA_ALIASES[key] || [])
  ];
  for (const candidate of candidates) {
    if (!Object.hasOwn(config || {}, candidate)) continue;
    const value = config[candidate];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }
  return undefined;
}

function resolveBunnyFyRuntimeEnv(env = process.env, config = getConfig()) {
  const resolved = { ...(env || {}) };

  for (const key of BUNNYFY_CONFIG_KEYS) {
    const envValue = resolved[key];
    if (envValue !== undefined && envValue !== null && String(envValue).trim() !== '') {
      continue;
    }
    const value = configuredValue(config, key);
    if (value !== undefined) resolved[key] = String(value);
  }

  // Endereço oficial do serviço. Não altere: o acesso gratuito depende dele.
  resolved.BUNNYFY_BASE_URL ||= BUNNYFY_SERVICE_ORIGIN;
  if (resolved.BUNNYFY_BASE_URL === BUNNYFY_SERVICE_ORIGIN) resolved.BUNNYFY_ALLOW_INSECURE_HTTP ||= 'true';
  resolved.BUNNYFY_ENABLED ||= 'true';
  for (const key of BUNNYFY_CONFIG_KEYS.filter(key => key.endsWith('_MODE'))) resolved[key] ||= 'exclusive';
  return resolved;
}

export {
  BUNNYFY_CONFIG_KEYS,
  resolveBunnyFyRuntimeEnv
};
