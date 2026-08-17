#!/usr/bin/env node
import { loadLocalEnv } from './envLoader.js';

loadLocalEnv();
process.env.BUNNYFY_ENABLED = 'true';
process.env.BUNNYFY_AI_MODE = 'exclusive';
process.env.BUNNYFY_CANVAS_MODE = 'exclusive';
process.env.BUNNYFY_STICKERS_MODE = 'exclusive';
process.env.BUNNYFY_LOGOS_MODE = 'exclusive';
process.env.BUNNYFY_ALLOW_INSECURE_HTTP = process.env.BUNNYFY_ALLOW_INSECURE_HTTP || 'true';

const required = ['BUNNYFY_BASE_URL', 'BUNNYFY_API_TOKEN'];
for (const key of required) {
  if (!String(process.env[key] || '').trim()) {
    console.error(`❌ ${key} ausente no ambiente.`);
    process.exit(2);
  }
}

const { createBunnyFyAiClient } = await import('../services/bunnyfy/index.js');
const ai = await createBunnyFyAiClient().createChatCompletion([
  { role: 'system', content: 'Responda apenas com: GYOMEI BUNNYFY AI OK' },
  { role: 'user', content: 'teste' },
], { temperature: 0, maxOutputTokens: 32 });
if (!String(ai.text || '').includes('GYOMEI BUNNYFY AI OK')) {
  throw new Error(`AI gateway não confirmou: ${JSON.stringify(ai).slice(0, 600)}`);
}
console.log('gyomeiAiGateway=OK');
console.log('GYOMEI_BUNNYFY_GATEWAYS_SMOKE_V2=OK');
