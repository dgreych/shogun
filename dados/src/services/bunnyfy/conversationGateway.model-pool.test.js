import assert from 'node:assert/strict';
import test from 'node:test';

import { createBunnyFyConversationClient } from './conversationGateway.js';
import { DEFAULT_NVIDIA_MODEL, NVIDIA_MODEL_CATALOG } from '../../utils/nvidiaApi.js';

const RESULT = {
  text: 'ok',
  finishReason: 'stop',
  usage: null
};

test('catálogo canônico contém exatamente os dez modelos qualificados e Ultra como padrão', () => {
  assert.equal(NVIDIA_MODEL_CATALOG.length, 10);
  assert.equal(DEFAULT_NVIDIA_MODEL, 'nvidia/nemotron-3-ultra-550b-a55b');
  assert.deepEqual(
    NVIDIA_MODEL_CATALOG.map((entry) => entry.id),
    [
      'minimaxai/minimax-m2.1',
      'minimaxai/minimax-m3',
      'moonshotai/kimi-k2.5',
      'qwen/qwen3.5-397b-a17b',
      'qwen/qwen3.5-122b-a10b',
      'qwen/qwen3-next-80b-a3b-thinking',
      'qwen/qwen3-next-80b-a3b-instruct',
      'nvidia/nemotron-3-super-120b-a12b',
      'nvidia/nemotron-3-ultra-550b-a55b',
      'inclusionai/ling-flash-2.0'
    ]
  );
});

test('modo exclusive encaminha preferência de modelo pertencente ao catálogo para a BunnyFy', async () => {
  let receivedOptions = null;
  let directCalls = 0;
  const client = createBunnyFyConversationClient(
    {
      BUNNYFY_ENABLED: 'true',
      BUNNYFY_CONVERSATION_MODE: 'exclusive',
      BUNNYFY_BASE_URL: 'http://127.0.0.1:18080',
      BUNNYFY_API_TOKEN: 'token-bunnyfy-1234567890'
    },
    {
      bunnyFyClient: {
        baseUrl: 'http://127.0.0.1:18080',
        async createChatCompletion(_messages, options) {
          receivedOptions = options;
          return RESULT;
        }
      },
      directRequest: async () => {
        directCalls += 1;
        throw new Error('fallback direto não deveria ser chamado');
      }
    }
  );

  const result = await client.createChatCompletion(
    [{ role: 'user', content: 'oi' }],
    {
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      temperature: 0.4,
      maxOutputTokens: 321
    }
  );

  assert.equal(result.text, 'ok');
  assert.deepEqual(receivedOptions, {
    temperature: 0.4,
    maxOutputTokens: 321,
    model: 'nvidia/nemotron-3-ultra-550b-a55b'
  });
  assert.equal(directCalls, 0);
});

test('modo exclusive não encaminha modelo fora do catálogo do SHOGUN', async () => {
  let receivedOptions = null;
  const client = createBunnyFyConversationClient(
    {
      BUNNYFY_ENABLED: 'true',
      BUNNYFY_CONVERSATION_MODE: 'exclusive',
      BUNNYFY_BASE_URL: 'http://127.0.0.1:18080',
      BUNNYFY_API_TOKEN: 'token-bunnyfy-1234567890'
    },
    {
      bunnyFyClient: {
        baseUrl: 'http://127.0.0.1:18080',
        async createChatCompletion(_messages, options) {
          receivedOptions = options;
          return RESULT;
        }
      }
    }
  );

  await client.createChatCompletion(
    [{ role: 'user', content: 'oi' }],
    { model: 'modelo/inventado', temperature: 0.2 }
  );

  assert.deepEqual(receivedOptions, { temperature: 0.2 });
});

test('modo off preserva seleção de modelo para o transporte NVIDIA legado', async () => {
  let selectedModel = null;
  const client = createBunnyFyConversationClient(
    {
      BUNNYFY_ENABLED: 'false',
      BUNNYFY_CONVERSATION_MODE: 'exclusive',
      NVIDIA_API_KEY: 'chave-local-de-teste-1234567890'
    },
    {
      directRequest: async ({ model }) => {
        selectedModel = model;
        return {
          success: true,
          data: {
            choices: [{ message: { content: 'direto' }, finish_reason: 'stop' }]
          }
        };
      }
    }
  );

  const result = await client.createChatCompletion(
    [{ role: 'user', content: 'oi' }],
    { model: 'qwen/qwen3.5-122b-a10b' }
  );

  assert.equal(result.text, 'direto');
  assert.equal(selectedModel, 'qwen/qwen3.5-122b-a10b');
});
