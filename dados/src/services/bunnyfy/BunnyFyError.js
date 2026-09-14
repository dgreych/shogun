const STATUS_CODES = Object.freeze({
  400: 'BUNNYFY_BAD_REQUEST',
  401: 'BUNNYFY_AUTH_FAILED',
  403: 'BUNNYFY_FORBIDDEN',
  404: 'BUNNYFY_NOT_FOUND',
  408: 'BUNNYFY_TIMEOUT',
  409: 'BUNNYFY_CONFLICT',
  413: 'BUNNYFY_TOO_LARGE',
  429: 'BUNNYFY_RATE_LIMITED',
  500: 'BUNNYFY_REMOTE_ERROR',
  502: 'BUNNYFY_UNAVAILABLE',
  503: 'BUNNYFY_UNAVAILABLE',
  504: 'BUNNYFY_TIMEOUT'
});

// Contato de quem distribui as chaves da API. Fica numa constante porque
// aparece em mais de uma mensagem e muda junto.
const CONTATO_API = 'wa.me/5522997028553';

const PUBLIC_MESSAGES = Object.freeze({
  BUNNYFY_AUTH_FAILED: `🔑 *Este recurso usa a BunnyFy e precisa de chave.*\n\nSem chave configurada, ele fica indisponível.\n\nFale comigo para pegar a sua: ${CONTATO_API}`,
  BUNNYFY_BAD_REQUEST: 'A BunnyFy recusou os dados enviados.',
  BUNNYFY_BAD_RESPONSE: 'A BunnyFy retornou uma resposta inválida.',
  BUNNYFY_CONFIG_INVALID: 'A configuração da BunnyFy é inválida.',
  BUNNYFY_CONFLICT: 'A operação entrou em conflito com outra solicitação.',
  BUNNYFY_CONTENT_BLOCKED: 'Esse pedido não pode ser atendido: este serviço não gera conteúdo sexual explícito, nem qualquer conteúdo que sexualize menores de idade.',
  BUNNYFY_FORBIDDEN: `🚫 *Sua chave não cobre este recurso.*\n\nFale comigo para liberar: ${CONTATO_API}`,
  BUNNYFY_NETWORK_ERROR: 'Não foi possível conectar à BunnyFy.',
  BUNNYFY_NOT_FOUND: 'O recurso solicitado não foi encontrado.',
  BUNNYFY_RATE_LIMITED: `⏳ *Limite de requisições atingido.*\n\nO uso gratuito sem chave é limitado por instância. Com chave própria o limite é seu, não compartilhado.\n\nFale comigo para pegar a sua: ${CONTATO_API}`,
  BUNNYFY_REMOTE_ERROR: 'A BunnyFy encontrou um erro interno.',
  BUNNYFY_TIMEOUT: 'A BunnyFy demorou mais que o permitido para responder.',
  BUNNYFY_TOO_LARGE: 'A resposta da BunnyFy excedeu o tamanho permitido.',
  BUNNYFY_UNAVAILABLE: 'A BunnyFy está temporariamente indisponível.'
});

class BunnyFyError extends Error {
  constructor(code, {
    status = null,
    retryable = false,
    requestId = null
  } = {}) {
    super(PUBLIC_MESSAGES[code] || PUBLIC_MESSAGES.BUNNYFY_REMOTE_ERROR);
    this.name = 'BunnyFyError';
    this.code = code;
    this.status = status;
    this.retryable = Boolean(retryable);
    this.requestId = requestId;
  }

  static fromStatus(status, { code, retryable, requestId } = {}) {
    const resolvedCode = code && /^BUNNYFY_[A-Z0-9_]+$/.test(code)
      ? code
      : STATUS_CODES[status] || 'BUNNYFY_REMOTE_ERROR';
    return new BunnyFyError(resolvedCode, {
      status,
      requestId,
      retryable: retryable ?? (status === 408 || status === 429 || status >= 500)
    });
  }
}

export { BunnyFyError, PUBLIC_MESSAGES, STATUS_CODES };
