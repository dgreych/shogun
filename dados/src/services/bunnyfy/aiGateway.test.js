import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LIMITS,
  buildBunnyFyAccessMessage,
  buildBoundedChatMessages,
  isBunnyFyAccessError,
  resolveBunnyFyAccountUrl,
  resolveBunnyFyAiMode,
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
