import { BunnyFyClient } from './BunnyFyClient.js';
import { BunnyFyError } from './BunnyFyError.js';
import { resolveBunnyFyRuntimeEnv } from './runtimeConfig.js';
import { getConfig } from '../../utils/shogunStore.js';
import { DEFAULT_NVIDIA_MODEL, isKnownNvidiaModel, requestNvidiaChat } from '../../utils/nvidiaApi.js';

const AI_MODES = new Set(['off', 'primary', 'exclusive']);
const DIRECT_FALLBACK_CODES = new Set([
  'BUNNYFY_BAD_RESPONSE',
  'BUNNYFY_NETWORK_ERROR',
  'BUNNYFY_REMOTE_ERROR',
  'BUNNYFY_TIMEOUT',
  'BUNNYFY_TOOL_UNAVAILABLE',
  'BUNNYFY_UNAVAILABLE'
]);
const DEFAULT_LIMITS = Object.freeze({
  maxMessages: 24,
  maxMessageChars: 16_000,
  maxTotalChars: 48_000
});

function isNvidiaIsolated(env = resolveBunnyFyRuntimeEnv()) {
  return ['true', '1'].includes(String(env.BUNNYFY_NVIDIA_ISOLATED || '').trim().toLowerCase());
}

function resolveBunnyFyAiMode(env = resolveBunnyFyRuntimeEnv()) {
  if (!['true', '1'].includes(String(env.BUNNYFY_ENABLED || '').trim().toLowerCase())) {
    return 'off';
  }
  const mode = String(env.BUNNYFY_AI_MODE || 'off').trim().toLowerCase();
  if (!AI_MODES.has(mode)) throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
  return mode;
}

function shouldFallbackDirectAi(error) {
  const status = Number(error?.status);
  if (Number.isInteger(status) && status >= 500) return true;
  return DIRECT_FALLBACK_CODES.has(error?.code);
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

function buildBunnyFyAccessMessage(env = resolveBunnyFyRuntimeEnv()) {
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

function directCredentials(env) {
  const config = getConfig() || {};
  return {
    apiKey: String(env.NVIDIA_API_KEY || config.nvidia_api_key || '').trim(),
    model: String(config.nvidia_model || DEFAULT_NVIDIA_MODEL).trim() || DEFAULT_NVIDIA_MODEL
  };
}

function directResultToCanonical(result) {
  const data = result?.data;
  const choice = data?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('NVIDIA_DIRECT_INVALID_RESPONSE');
  }
  const usage = data?.usage;
  return {
    text,
    finishReason: choice?.finish_reason ?? null,
    usage: usage && Number.isFinite(usage.prompt_tokens) && Number.isFinite(usage.completion_tokens) && Number.isFinite(usage.total_tokens)
      ? {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        }
      : null
  };
}

async function createDirectCompletion(messages, options, env, directRequest = requestNvidiaChat) {
  const credentials = directCredentials(env);
  const configuredTimeout = Number(env.BUNNYFY_AI_TIMEOUT_MS);
  const result = await directRequest({
    apiKey: credentials.apiKey,
    model: options?.model || credentials.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxOutputTokens ?? 2000,
    retries: 3,
    timeout: Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 120_000
  });
  return directResultToCanonical(result);
}

function bunnyFyManagedOptions(options = {}) {
  const { model, ...managedOptions } = options || {};
  return isKnownNvidiaModel(model)
    ? { ...managedOptions, model }
    : managedOptions;
}

function createBunnyFyAiClient(env = resolveBunnyFyRuntimeEnv(), dependencies = {}) {
  const configuredTimeout = Number(env.BUNNYFY_AI_TIMEOUT_MS);
  const initialMode = resolveBunnyFyAiMode(env);
  const initialIsolation = isNvidiaIsolated(env);
  let bunnyFyClient = dependencies.bunnyFyClient || null;
  const directRequest = dependencies.directRequest || requestNvidiaChat;

  function buildBunnyFyClient() {
    return new BunnyFyClient({
      baseUrl: env.BUNNYFY_BASE_URL,
      token: env.BUNNYFY_API_TOKEN,
      allowInsecureHttp: ['true', '1'].includes(
        String(env.BUNNYFY_ALLOW_INSECURE_HTTP || '').trim().toLowerCase()
      ),
      timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 130_000,
      maxResponseBytes: 2 * 1024 * 1024,
      retries: 0
    });
  }

  // A quarentena de NVIDIA é intencionalmente anterior aos modos de IA.
  // Ela impede tanto BunnyFy-AI quanto o fallback NVIDIA direto, sem alterar
  // BUNNYFY_ENABLED nem os modos independentes de imagens, stickers, canvas,
  // logos, jogos e demais capacidades.
  if (!initialIsolation && initialMode !== 'off' && !bunnyFyClient) bunnyFyClient = buildBunnyFyClient();

  function getBunnyFyClient() {
    if (!bunnyFyClient) bunnyFyClient = buildBunnyFyClient();
    return bunnyFyClient;
  }

  return {
    baseUrl: bunnyFyClient?.baseUrl ?? null,
    async createChatCompletion(messages, options = {}) {
      if (isNvidiaIsolated(env)) {
        throw new BunnyFyError('BUNNYFY_UNAVAILABLE', {
          status: 503,
          retryable: false
        });
      }

      const mode = resolveBunnyFyAiMode(env);
      if (mode === 'off') {
        return createDirectCompletion(messages, options, env, directRequest);
      }

      // Em modos gerenciados, somente uma preferência pertencente ao catálogo
      // canônico do SHOGUN atravessa a fronteira. A BunnyFy continua dona da
      // validação final e do failover entre os dez modelos qualificados.
      const managedOptions = bunnyFyManagedOptions(options);
      try {
        return await getBunnyFyClient().createChatCompletion(messages, managedOptions);
      } catch (error) {
        if (mode !== 'primary' || !shouldFallbackDirectAi(error)) throw error;
        console.warn('[BUNNYFY_AI] Falha transitória na BunnyFy; usando fallback NVIDIA direto.', {
          code: error?.code,
          status: error?.status
        });
        return createDirectCompletion(messages, options, env, directRequest);
      }
    }
  };
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
  bunnyFyManagedOptions,
  createBunnyFyAiClient,
  isBunnyFyAccessError,
  isNvidiaIsolated,
  resolveBunnyFyAccountUrl,
  resolveBunnyFyAiMode,
  shouldFallbackDirectAi,
  toLegacyChatResponse
};
