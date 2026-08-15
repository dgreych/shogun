#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import { loadLocalEnv, ROOT_DIR } from './envLoader.js';

loadLocalEnv();

const apiKey = String(process.env.NVIDIA_API_KEY || '').trim();
if (!apiKey) {
  console.error('❌ Defina NVIDIA_API_KEY somente no ambiente antes de executar este teste.');
  process.exit(1);
}

const contextFile = path.join(ROOT_DIR, 'dados', 'database', 'userContext.json');
const contextExisted = fs.existsSync(contextFile);
const contextBackup = contextExisted ? fs.readFileSync(contextFile) : null;
const testUser = `live-test-${Date.now()}`;

function restoreContext() {
  try {
    if (contextExisted && contextBackup) {
      fs.mkdirSync(path.dirname(contextFile), { recursive: true });
      fs.writeFileSync(contextFile, contextBackup);
    } else if (fs.existsSync(contextFile)) {
      fs.rmSync(contextFile, { force: true });
    }
  } catch (error) {
    console.error(`⚠️ Não foi possível restaurar userContext.json: ${error.message}`);
  }
}

try {
  const { makeAssistentRequest } = await import('../funcs/private/ia.js');
  console.log('🔎 Testando o fluxo completo da assistente com NVIDIA/Llama 3.1 70B...');

  const result = await makeAssistentRequest(
    {
      mensagens: [{
        texto: 'Siga seu formato JSON obrigatório. Na primeira resposta, escreva exatamente: FLUXO NAZUNA OK',
        id_enviou: testUser,
        nome_enviou: 'Teste Local',
        id_grupo: 'teste-local@g.us',
        nome_grupo: 'Teste Local',
        tem_midia: false,
        marcou_mensagem: false,
        marcou_sua_mensagem: false,
        tem_midia_marcada: false,
        id_mensagem: `msg-${Date.now()}`
      }]
    },
    null,
    null,
    'nazuna'
  );

  if (!result || !Array.isArray(result.resp) || result.resp.length === 0) {
    throw new Error(`A assistente não retornou respostas válidas: ${JSON.stringify(result)}`);
  }

  const texts = result.resp
    .map(item => typeof item === 'string' ? item : item?.resp)
    .filter(value => typeof value === 'string' && value.trim());

  if (!texts.some(text => text.includes('FLUXO NAZUNA OK'))) {
    throw new Error(`A resposta não confirmou o fluxo: ${JSON.stringify(result)}`);
  }

  console.log('✅ Fluxo completo aprovado.');
  console.log(`🤖 Resposta recebida: ${texts.join(' | ')}`);
} catch (error) {
  console.error('❌ Fluxo completo da assistente reprovado:', {
    name: error.name,
    code: error.code,
    status: error.status || error.response?.status,
    message: error.message
  });
  process.exitCode = 1;
} finally {
  await new Promise(resolve => setTimeout(resolve, 2500));
  restoreContext();
}
