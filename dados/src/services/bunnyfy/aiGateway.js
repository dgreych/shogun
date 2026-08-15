import { BunnyFyClient } from './BunnyFyClient.js';
import { BunnyFyError } from './BunnyFyError.js';

const AI_MODES = new Set(['off', 'primary', 'exclusive']);
const DEFAULT_LIMITS = Object.freeze({
  maxMessages: 24,
  maxMessageChars: 16_000,
  maxTotalChars: 48_000
});

function resolveBunnyFyAiMode(env = process.env) {
  if (!['true', '1'].includes(String(env.BUNNYFY_ENABLED || '').trim().toLowerCase())) {
    return 'off';
  }
  const mode = String(env.BUNNYFY_AI_MODE || 'off').trim().toLowerCase();
  if (!AI_MODES.has(mode)) throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  return mode;
}

function resolveBunnyFyAccountUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function buildBunnyFyAccessMessage(env = process.env) {
  const accountUrl = resolveBunnyFyAccountUrl(env.BUNNYFY_ACCOUNT_URL);
  return [
    '🐰 *BunnyFy*',
    'Este bot ainda não possui uma chave de acesso ativa para esta função.',
    accountUrl ? `Planos e chaves: ${accountUrl}` : ''
  ].filter(Boolean).join('\n\n');
}

function isBunnyFyAccessError(error) {
  return ['BUNNYFY_AUTH_FAILED', 'BUNNYFY_CONFIG_INVALID', 'BUNNYFY_FORBIDDEN'].includes(error?.code);
}

function truncateKeepingEnds(value, maxChars) {
  if (value.length <= maxChars) return value;
  const marker = '\n…[conteúdo reduzido]…\n';
  if (maxChars <= marker.length + 2) return value.slice(0, maxChars);
  const remaining = maxChars - marker.length;
  const left = Math.ceil(remaining / 2);
  const right = Math.floor(remaining / 2);
  return `${value.slice(0, left)}${marker}${value.slice(value.length - right)}`;
}

function normalizedMessage(value, maxMessageChars) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!['user', 'assistant'].includes(value.role) || typeof value.content !== 'string' || !value.content.trim()) {
    return null;
  }
  return {
    role: value.role,
    content: truncateKeepingEnds(value.content, maxMessageChars)
  };
}

function buildBoundedChatMessages({
  systemPrompt,
  history,
  text,
  limits = DEFAULT_LIMITS
}) {
  if (typeof text !== 'string' || !text.trim()) throw new BunnyFyError('BUNNYFY_BAD_REQUEST');

  const system = typeof systemPrompt === 'string' && systemPrompt.trim()
    ? { role: 'system', content: truncateKeepingEnds(systemPrompt, limits.maxMessageChars) }
    : null;
  const user = { role: 'user', content: truncateKeepingEnds(text, limits.maxMessageChars) };
  const fixed = system ? [system, user] : [user];
  let remainingChars = limits.maxTotalChars - fixed.reduce((total, message) => total + message.content.length, 0);
  let remainingSlots = limits.maxMessages - fixed.length;
  const selectedHistory = [];
  const candidates = Array.isArray(history) ? history : [];

  for (let index = candidates.length - 1; index >= 0 && remainingSlots > 0 && remainingChars > 0; index -= 1) {
    const normalized = normalizedMessage(candidates[index], limits.maxMessageChars);
    if (!normalized) continue;
    const content = truncateKeepingEnds(normalized.content, remainingChars);
    if (!content.trim()) continue;
    selectedHistory.unshift({ ...normalized, content });
    remainingChars -= content.length;
    remainingSlots -= 1;
  }

  return system
    ? [system, ...selectedHistory, user]
    : [...selectedHistory, user];
}

function createBunnyFyAiClient(env = process.env) {
  const configuredTimeout = Number(env.BUNNYFY_AI_TIMEOUT_MS);
  return new BunnyFyClient({
    baseUrl: env.BUNNYFY_BASE_URL,
    token: env.BUNNYFY_API_TOKEN,
    timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 130_000,
    maxResponseBytes: 2 * 1024 * 1024,
    retries: 0
  });
}

function toLegacyChatResponse(result) {
  return {
    success: true,
    data: {
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.text },
        finish_reason: result.finishReason
      }],
      usage: result.usage ? {
        prompt_tokens: result.usage.inputTokens,
        completion_tokens: result.usage.outputTokens,
        total_tokens: result.usage.totalTokens
      } : null
    }
  };
}

export {
  DEFAULT_LIMITS,
  buildBunnyFyAccessMessage,
  buildBoundedChatMessages,
  createBunnyFyAiClient,
  isBunnyFyAccessError,
  resolveBunnyFyAccountUrl,
  resolveBunnyFyAiMode,
  toLegacyChatResponse
};
