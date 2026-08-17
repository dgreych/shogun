import { getConfig } from '../../utils/gyomeiStore.js';

const BUNNYFY_CONFIG_KEYS = Object.freeze([
  'BUNNYFY_ENABLED',
  'BUNNYFY_BASE_URL',
  'BUNNYFY_API_TOKEN',
  'BUNNYFY_ALLOW_INSECURE_HTTP',
  'BUNNYFY_AI_MODE',
  'BUNNYFY_AI_TIMEOUT_MS',
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

  return resolved;
}

export {
  BUNNYFY_CONFIG_KEYS,
  resolveBunnyFyRuntimeEnv
};
