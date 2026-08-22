import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LIMITS,
  buildBunnyFyAccessMessage,
  buildBoundedChatMessages,
  createBunnyFyAiClient,
  isBunnyFyAccessError,
  resolveBunnyFyAccountUrl,
  resolveBunnyFyAiMode,
  shouldFallbackDirectAi,
  toLegacyChatResponse
} from './aiGateway.js';

test('modo BunnyFy exige ativação global e aceita somente estados explícitos', () => {
  assert.equal(resolveBunnyFyAiMode({ BUNNYFY_ENABLED: 'false', BUNNYFY_AI_MODE: 'exclusive' }), 'off');
  assert.equal(resolveBunnyFyAiMode({ BUNNYFY_ENABLED: 'true', BUNNYFY_AI_MODE: 'primary' }), 'primary');
  assert.equal(resolveBunnyFyAiMode({ BUNNYFY_ENABLED: '1', BUNNYFY_AI_MODE: 'exclusive' }), 'exclusive');
  assert.throws(
    () => resolveBunnyFyAiMode({ BUNNYFY_ENABLED: 'true', BUNNYFY_AI_MODE: 'typo' }),
    error => error.code === 'BUNNYFY_CONFIG_INVALID'
  );
});

test('fallback direto aceita somente indisponibilidade transitória da BunnyFy', () => {
  assert.equal(shouldFallbackDirectAi({ code: 'BUNNYFY_TOOL_UNAVAILABLE', status: 503 }), true);
  assert.equal(shouldFallbackDirectAi({ code: 'BUNNYFY_TIMEOUT', status: 504 }), true);
  assert.equal(shouldFallbackDirectAi({ code: 'BUNNYFY_NETWORK_ERROR' }), true);
  assert.equal(shouldFallbackDirectAi({ code: 'BUNNYFY_BAD_REQUEST', status: 400 }), false);
  assert.equal(shouldFallbackDirectAi({ code: 'BUNNYFY_AUTH_FAILED', status: 401 }), false);
  assert.equal(shouldFallbackDirectAi({ code: 'BUNNYFY_RATE_LIMITED', status: 429 }), false);
});

test('off usa NVIDIA direta sem encostar na BunnyFy', async () => {
  let bunnyCalls = 0;
  let directCalls = 0;
  const client = createBunnyFyAiClient(
    {
      BUNNYFY_ENABLED: 'false',
      BUNNYFY_AI_MODE: 'exclusive',
      NVIDIA_API_KEY: 'chave-local-de-teste-1234567890'
    },
    {
      bunnyFyClient: {
        async createChatCompletion() {
          bunnyCalls += 1;
          throw new Error('não deveria chamar BunnyFy');
        }
      },
      directRequest: async ({ model, messages }) => {
        directCalls += 1;
        assert.equal(model, 'meta/llama-3.1-8b-instruct');
        assert.equal(messages.at(-1).content, 'oi');
        return {
          success: true,
          data: {
            choices: [{ message: { content: 'direto' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
          }
        };
      }
    }
  );

  const result = await client.createChatCompletion([{ role: 'user', content: 'oi' }], {
    model: 'meta/llama-3.1-8b-instruct'
  });
  assert.equal(result.text, 'direto');
  assert.equal(bunnyCalls, 0);
  assert.equal(directCalls, 1);
});

test('primary cai para NVIDIA direta em 503 da BunnyFy', async () => {
  let bunnyCalls = 0;
  let directCalls = 0;
  const client = createBunnyFyAiClient(
    {
      BUNNYFY_ENABLED: 'true',
      BUNNYFY_AI_MODE: 'primary',
      BUNNYFY_BASE_URL: 'https://bunnyfy.example',
      BUNNYFY_API_TOKEN: 'token-bunnyfy-1234567890',
      NVIDIA_API_KEY: 'chave-local-de-teste-1234567890'
    },
    {
      bunnyFyClient: {
        async createChatCompletion() {
          bunnyCalls += 1;
          throw Object.assign(new Error('indisponível'), {
            code: 'BUNNYFY_TOOL_UNAVAILABLE',
            status: 503
          });
        }
      },
      directRequest: async () => {
        directCalls += 1;
        return {
          success: true,
          data: { choices: [{ message: { content: 'fallback' }, finish_reason: 'stop' }] }
        };
      }
    }
  );

  const result = await client.createChatCompletion([{ role: 'user', content: 'oi' }], {
    model: 'meta/llama-3.1-8b-instruct'
  });
  assert.equal(result.text, 'fallback');
  assert.equal(bunnyCalls, 1);
  assert.equal(directCalls, 1);
});

test('exclusive nunca cai para NVIDIA direta', async () => {
  let directCalls = 0;
  const expected = Object.assign(new Error('indisponível'), {
    code: 'BUNNYFY_TOOL_UNAVAILABLE',
    status: 503
  });
  const client = createBunnyFyAiClient(
    {
      BUNNYFY_ENABLED: 'true',
      BUNNYFY_AI_MODE: 'exclusive',
      BUNNYFY_BASE_URL: 'https://bunnyfy.example',
      BUNNYFY_API_TOKEN: 'token-bunnyfy-1234567890',
      NVIDIA_API_KEY: 'chave-local-de-teste-1234567890'
    },
    {
      bunnyFyClient: { async createChatCompletion() { throw expected; } },
      directRequest: async () => {
        directCalls += 1;
        throw new Error('não deveria chamar direto');
      }
    }
  );
  await assert.rejects(
    client.createChatCompletion([{ role: 'user', content: 'oi' }], { model: 'meta/llama-3.1-8b-instruct' }),
    error => error === expected
  );
  assert.equal(directCalls, 0);
});

test('mensagem de acesso usa branding sem inventar endereço comercial', () => {
  const withoutUrl = buildBunnyFyAccessMessage({ BUNNYFY_ACCOUNT_URL: '' });
  assert.match(withoutUrl, /BunnyFy/);
  assert.equal(withoutUrl.includes('http'), false);

  const withUrl = buildBunnyFyAccessMessage({ BUNNYFY_ACCOUNT_URL: 'https://bunnyfy.example/planos' });
  assert.match(withUrl, /https:\/\/bunnyfy\.example\/planos/);
  assert.equal(buildBunnyFyAccessMessage({ BUNNYFY_ACCOUNT_URL: 'http://inseguro.example' }).includes('http'), false);
  assert.equal(resolveBunnyFyAccountUrl('https://usuario:senha@bunnyfy.example/planos'), '');
  assert.equal(resolveBunnyFyAccountUrl('não é uma URL'), '');
  assert.equal(isBunnyFyAccessError({ code: 'BUNNYFY_AUTH_FAILED' }), true);
  assert.equal(isBunnyFyAccessError({ code: 'BUNNYFY_RATE_LIMITED' }), false);
});

test('mensagens preservam system e user, priorizam histórico recente e obedecem todos os tetos', () => {
  const history = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `hist-${index}-${'x'.repeat(4000)}`
  }));
  history.splice(20, 0, { role: 'system', content: 'system injetado' });

  const messages = buildBoundedChatMessages({
    systemPrompt: `system-${'s'.repeat(20_000)}`,
    history,
    text: `user-${'u'.repeat(20_000)}`
  });

  assert.equal(messages[0].role, 'system');
  assert.equal(messages.at(-1).role, 'user');
  assert.ok(messages.some(message => message.content.startsWith('hist-39-')));
  assert.equal(messages.some((message, index) => index > 0 && message.role === 'system'), false);
  assert.ok(messages.length <= DEFAULT_LIMITS.maxMessages);
  assert.ok(messages.every(message => message.content.length <= DEFAULT_LIMITS.maxMessageChars));
  assert.ok(messages.reduce((total, message) => total + message.content.length, 0) <= DEFAULT_LIMITS.maxTotalChars);
});

test('resposta canônica vira o envelope legado esperado pelos comandos', () => {
  assert.deepEqual(toLegacyChatResponse({
    text: 'Resposta',
    finishReason: 'stop',
    usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 }
  }), {
    success: true,
    data: {
      choices: [{ index: 0, message: { role: 'assistant', content: 'Resposta' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
    }
  });
});
