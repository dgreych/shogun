#!/usr/bin/env node

import { loadLocalEnv } from './envLoader.js';
import {
  buildBoundedChatMessages,
  createBunnyFyAiClient
} from '../services/bunnyfy/aiGateway.js';

loadLocalEnv();

const bunnyfyToken = String(process.env.BUNNYFY_API_TOKEN || '').trim();
const bunnyfyBase = String(process.env.BUNNYFY_BASE_URL || '').trim();
if (!bunnyfyToken || !bunnyfyBase) {
  console.error('❌ BUNNYFY_API_TOKEN e BUNNYFY_BASE_URL são obrigatórios para o diagnóstico de IA.');
  process.exit(1);
}

process.env.BUNNYFY_ENABLED = 'true';
process.env.BUNNYFY_AI_MODE = 'exclusive';
console.log('🔎 Testando a assistente pelo gateway BunnyFy...');

try {
  const messages = buildBoundedChatMessages({
    text: 'Responda apenas: OK',
    history: [],
    systemPrompt: null
  });
  const response = await createBunnyFyAiClient().createChatCompletion(messages, {
    temperature: 0,
    maxOutputTokens: 8
  });
  if (typeof response?.text !== 'string' || !response.text.trim()) {
    throw new Error('A BunnyFy devolveu uma resposta vazia.');
  }
  console.log('✅ Gateway BunnyFy AI respondeu corretamente.');
} catch (error) {
  console.error('❌ Diagnóstico BunnyFy AI reprovado:', {
    code: error?.code,
    status: error?.status,
    message: error?.message
  });
  process.exitCode = 1;
}
