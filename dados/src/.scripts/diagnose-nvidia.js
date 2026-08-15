#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import { loadLocalEnv, ROOT_DIR } from './envLoader.js';
import { DEFAULT_NVIDIA_MODEL, requestNvidiaChat } from '../utils/nvidiaApi.js';

loadLocalEnv();

const configFile = path.join(ROOT_DIR, 'dados', 'src', 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (error) {
  console.error(`❌ Não foi possível ler config.json: ${error.message}`);
  process.exit(1);
}

const apiKey = String(process.env.NVIDIA_API_KEY || config.nvidia_api_key || '').trim();
if (!apiKey) {
  console.error('❌ NVIDIA_API_KEY não foi encontrada em .env.local, no ambiente ou em config.json.');
  process.exit(1);
}

console.log(`🔎 Testando NVIDIA com ${DEFAULT_NVIDIA_MODEL}...`);

try {
  const response = await requestNvidiaChat({
    apiKey,
    model: DEFAULT_NVIDIA_MODEL,
    messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    temperature: 0,
    maxTokens: 8,
    retries: 1
  });
  const content = response.data.choices[0]?.message?.content || '';
  console.log(`✅ NVIDIA respondeu corretamente${content ? `: ${content.trim()}` : '.'}`);
  process.exit(0);
} catch (error) {
  console.error('❌ Diagnóstico NVIDIA reprovado:', {
    code: error.code,
    status: error.status,
    message: error.message
  });
  process.exit(1);
}
