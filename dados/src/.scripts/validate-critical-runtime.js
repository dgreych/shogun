#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const srcDir = path.resolve(scriptsDir, '..');
const runtimeIndexPath = path.join(srcDir, '.runtime-index.js');
const runtimeAssistantPath = path.join(srcDir, 'funcs', 'private', '.runtime-assistant.js');
const runtimeIndex = fs.readFileSync(runtimeIndexPath, 'utf8');
const runtimeAssistant = fs.readFileSync(runtimeAssistantPath, 'utf8');

function hasValidSyntax(filePath) {
  return spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' }).status === 0;
}

const checks = [
  [hasValidSyntax(runtimeIndexPath), 'sintaxe do runtime principal após correções'],
  [hasValidSyntax(runtimeAssistantPath), 'sintaxe do runtime de conversa após correções'],
  [runtimeIndex.includes('resolveCommandInput'), 'roteamento determinístico dos aliases'],
  [runtimeIndex.includes('loadSafeCommandAliases'), 'migração segura de commandAliases.json'],
  [runtimeIndex.includes("case 'd': {"), 'alias d ligado ao delete corrigido'],
  [runtimeIndex.includes('getQuotedContextInfo(info.message)'), 'delete reconhece mensagem citada'],
  [runtimeIndex.includes('const messagePreview = buildSafeMessagePreview({'), 'logger usa preview seguro no runtime'],
  [!runtimeIndex.includes('const messagePreview = isCmd ?'), 'runtime não monta preview diretamente da consulta'],
  [runtimeIndex.includes('reply(respAssist.message)'), 'erro da conversa chega ao usuário'],
  [runtimeIndex.includes('*Maurício Almeida*'), 'autoria profissional do SHOGUN presente'],
  [runtimeIndex.includes('Criador e mantenedor do SHOGUN'), 'cartão atual do mantenedor presente'],
  [runtimeIndex.includes('../../dist-vnext/voice/personas/shogun.js'), 'entrada usa a voz única do produto'],
  [!runtimeAssistant.includes('requestNvidiaChat'), 'runtime não usa cliente NVIDIA direto'],
  [!runtimeAssistant.includes('function getNvidiaApiKey()'), 'runtime não lê chave NVIDIA diretamente'],
  [runtimeAssistant.includes('[BUNNYFY_CONVERSATION] Erro na assistente') || runtimeAssistant.includes('BUNNYFY_CONVERSATION'), 'log identifica gateway BunnyFy conversa'],
  [!runtimeAssistant.includes('Erro na API Cognima'), 'log legado da Cognima removido'],
  [!runtimeAssistant.includes('Tentativa ${attempt + 1} falhou'), 'repetição legada removida'],
  [runtimeAssistant.includes('createBunnyFyConversationClient'), 'cliente BunnyFy conversa carregado'],
  [!runtimeAssistant.includes('resolveEmbeddedNvidiaKey'), 'fallback embutido NVIDIA removido']
];

let failures = 0;
for (const [passed, description] of checks) {
  if (passed) console.log(`✅ ${description}`);
  else {
    failures += 1;
    console.error(`❌ ${description}`);
  }
}

console.log(`\nCorreções críticas: ${checks.length - failures} aprovadas, ${failures} falhas.`);
process.exit(failures ? 1 : 0);
