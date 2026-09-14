import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBunnyFyRuntimeEnv } from './runtimeConfig.js';

test('config.json alimenta BunnyFy quando ambiente não define valores', () => {
  const resolved = resolveBunnyFyRuntimeEnv({}, {
    bunnyfy_enabled: true,
    bunnyfy_base_url: 'http://node1.vexhost.com.br:20072',
    bunnyfy_api_token: 'token-local-ficticio',
    bunnyfy_ai_mode: 'exclusive',
    bunnyfy_canvas_mode: 'exclusive'
  });

  assert.equal(resolved.BUNNYFY_ENABLED, 'true');
  assert.equal(resolved.BUNNYFY_BASE_URL, 'http://node1.vexhost.com.br:20072');
  assert.equal(resolved.BUNNYFY_API_TOKEN, 'token-local-ficticio');
  assert.equal(resolved.BUNNYFY_AI_MODE, 'exclusive');
  assert.equal(resolved.BUNNYFY_CANVAS_MODE, 'exclusive');
});

test('ambiente tem precedência sobre config.json como override opcional', () => {
  const resolved = resolveBunnyFyRuntimeEnv({
    BUNNYFY_ENABLED: 'false',
    BUNNYFY_BASE_URL: 'https://override.example',
    BUNNYFY_API_TOKEN: 'override-token'
  }, {
    bunnyfy_enabled: true,
    bunnyfy_base_url: 'http://node1.vexhost.com.br:20072',
    bunnyfy_api_token: 'config-token'
  });

  assert.equal(resolved.BUNNYFY_ENABLED, 'false');
  assert.equal(resolved.BUNNYFY_BASE_URL, 'https://override.example');
  assert.equal(resolved.BUNNYFY_API_TOKEN, 'override-token');
});
