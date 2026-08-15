import axios from 'axios';

export const NVIDIA_CHAT_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
export const DEFAULT_NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';

// Modelos gratuitos da NVIDIA selecionados para a tarefa de assistente em
// grupos, testados ao vivo (latência real e aderência ao personagem, não só
// presença no catálogo público — vários modelos "grandes" do catálogo
// respondem em mais de um minuto ou nem respondem no tier gratuito, e
// modelos pequenos demais ignoram a personalidade do prompt). Donos
// escolhem entre eles com "!modeloia".
export const NVIDIA_MODEL_CATALOG = [
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    label: 'Nemotron Super 49B (mais completo)',
    description: 'Responde em poucos segundos e mantém a personalidade do Gyomei de forma consistente.'
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B (mais rápido)',
    description: 'Resposta em menos de 1s, mas segue a personalidade com menos consistência.'
  },
  {
    id: 'meta/llama-3.2-3b-instruct',
    label: 'Llama 3.2 3B (mais leve)',
    description: 'Modelo mais enxuto da família, útil só para perguntas simples e diretas.'
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B (equilíbrio)',
    description: 'Meio-termo entre o 8B e o Nemotron: mais consistente com a personalidade que o 8B, sem pesar tanto quanto o 49B. Recém-adicionado, ainda sem teste de latência ao vivo — vale testar com !modeloia antes de deixar como padrão de algum grupo.'
  }
];

export function isKnownNvidiaModel(modelId) {
  return NVIDIA_MODEL_CATALOG.some(entry => entry.id === modelId);
}

export class NvidiaApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'NvidiaApiError';
    this.code = options.code || 'NVIDIA_REQUEST_FAILED';
    this.status = options.status ?? null;
    this.retryable = Boolean(options.retryable);
    this.userMessage = options.userMessage || '🤖 A assistente está temporariamente indisponível.';
    this.cause = options.cause;
  }
}

function extractErrorDetail(error) {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  return String(
    data?.error?.message
    || data?.detail
    || data?.message
    || data?.title
    || error?.message
    || 'Falha desconhecida'
  ).trim();
}

export function isRetryableNvidiaError(error) {
  const status = Number(error?.response?.status || 0);
  if (!status) return true;
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function normalizeNvidiaError(error) {
  const status = Number(error?.response?.status || 0) || null;
  const detail = extractErrorDetail(error);
  const retryable = isRetryableNvidiaError(error);

  if (status === 410) {
    return new NvidiaApiError(
      `NVIDIA recusou a requisição com HTTP 410: ${detail}. A chave pode estar revogada ou sem acesso aos Public API Endpoints.`,
      {
        code: 'NVIDIA_ACCESS_GONE',
        status,
        retryable: false,
        userMessage: '🤖 A integração NVIDIA recusou a chave configurada. O dono precisa gerar uma nova chave com acesso aos Public API Endpoints.',
        cause: error
      }
    );
  }

  if (status === 401 || status === 403) {
    return new NvidiaApiError(
      `NVIDIA recusou a credencial (HTTP ${status}): ${detail}`,
      {
        code: 'NVIDIA_UNAUTHORIZED',
        status,
        retryable: false,
        userMessage: '🤖 A chave NVIDIA configurada não foi autorizada. O dono precisa revisar ou substituir a credencial.',
        cause: error
      }
    );
  }

  if (status === 404) {
    return new NvidiaApiError(
      `Endpoint ou modelo NVIDIA não encontrado (HTTP 404): ${detail}`,
      {
        code: 'NVIDIA_NOT_FOUND',
        status,
        retryable: false,
        userMessage: '🤖 O endpoint ou modelo configurado na NVIDIA não foi encontrado.',
        cause: error
      }
    );
  }

  if (status === 429) {
    return new NvidiaApiError(
      `Limite de uso da NVIDIA atingido (HTTP 429): ${detail}`,
      {
        code: 'NVIDIA_RATE_LIMITED',
        status,
        retryable: true,
        userMessage: '🤖 A NVIDIA limitou temporariamente as requisições. Tente novamente em alguns instantes.',
        cause: error
      }
    );
  }

  return new NvidiaApiError(
    `Falha na API NVIDIA${status ? ` (HTTP ${status})` : ''}: ${detail}`,
    {
      code: 'NVIDIA_REQUEST_FAILED',
      status,
      retryable,
      userMessage: '🤖 A assistente não conseguiu consultar a NVIDIA agora. Tente novamente em alguns instantes.',
      cause: error
    }
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function requestNvidiaChat({
  apiKey,
  model = DEFAULT_NVIDIA_MODEL,
  messages,
  temperature = 0.7,
  maxTokens = 2000,
  retries = 3,
  timeout = 120000,
  httpClient = axios,
  retryDelay = sleep
}) {
  const normalizedKey = String(apiKey || '').trim();
  if (!normalizedKey) {
    throw new NvidiaApiError('NVIDIA_API_KEY não foi configurada.', {
      code: 'NVIDIA_KEY_MISSING',
      retryable: false,
      userMessage: '🤖 A chave NVIDIA ainda não foi configurada pelo dono do bot.'
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new NvidiaApiError('A lista de mensagens da NVIDIA está vazia.', {
      code: 'NVIDIA_MESSAGES_EMPTY',
      retryable: false
    });
  }

  const attempts = Math.max(1, Number(retries) || 1);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await httpClient.post(
        NVIDIA_CHAT_ENDPOINT,
        {
          messages,
          model: model || DEFAULT_NVIDIA_MODEL,
          temperature,
          max_tokens: maxTokens
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${normalizedKey}`
          },
          timeout
        }
      );

      if (!response?.data?.choices?.[0]) {
        throw new NvidiaApiError('Resposta da API NVIDIA inválida ou vazia.', {
          code: 'NVIDIA_INVALID_RESPONSE',
          retryable: false,
          userMessage: '🤖 A NVIDIA devolveu uma resposta vazia. Tente novamente mais tarde.'
        });
      }

      return { success: true, data: response.data };
    } catch (error) {
      const normalized = error instanceof NvidiaApiError ? error : normalizeNvidiaError(error);
      lastError = normalized;

      console.warn(`[NVIDIA] Tentativa ${attempt}/${attempts} falhou:`, {
        status: normalized.status,
        code: normalized.code,
        message: normalized.message
      });

      if (!normalized.retryable || attempt >= attempts) throw normalized;
      await retryDelay(Math.pow(2, attempt - 1) * 1000);
    }
  }

  throw lastError;
}
