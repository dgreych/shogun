#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const srcDir = path.resolve(scriptsDir, '..');
const runtimeIndexPath = path.join(srcDir, '.runtime-index.js');
const runtimeIaPath = path.join(srcDir, 'funcs', 'private', '.runtime-ia.js');
const runtimeIndex = fs.readFileSync(runtimeIndexPath, 'utf8');
const runtimeIa = fs.readFileSync(runtimeIaPath, 'utf8');

function hasValidSyntax(filePath) {
  return spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' }).status === 0;
}

const checks = [
  [hasValidSyntax(runtimeIndexPath), 'sintaxe do runtime principal após correções'],
  [hasValidSyntax(runtimeIaPath), 'sintaxe do runtime de IA após correções'],
  [runtimeIndex.includes('resolveCommandInput'), 'roteamento determinístico dos aliases'],
  [runtimeIndex.includes('loadSafeCommandAliases'), 'migração segura de commandAliases.json'],
  [runtimeIndex.includes("case 'd': {"), 'alias d ligado ao delete corrigido'],
  [runtimeIndex.includes('getQuotedContextInfo(info.message)'), 'delete reconhece mensagem citada'],
  [runtimeIndex.includes('const messagePreview = buildSafeMessagePreview({'), 'logger usa preview seguro no runtime'],
  [!runtimeIndex.includes('const messagePreview = isCmd ?'), 'runtime não monta preview diretamente da consulta'],
  [runtimeIndex.includes('reply(respAssist.message)'), 'erro da IA chega ao usuário'],
  [!runtimeIa.includes('requestNvidiaChat'), 'runtime não usa cliente NVIDIA direto'],
  [!runtimeIa.includes('function getNvidiaApiKey()'), 'runtime não lê chave NVIDIA diretamente'],
  [runtimeIa.includes('[BUNNYFY_AI] Erro na assistente') || runtimeIa.includes('BUNNYFY_AI'), 'log identifica gateway BunnyFy AI'],
  [!runtimeIa.includes('Erro na API Cognima'), 'log legado da Cognima removido'],
  [!runtimeIa.includes('Tentativa ${attempt + 1} falhou'), 'repetição legada removida'],
  [runtimeIa.includes('createBunnyFyAiClient'), 'cliente BunnyFy AI carregado'],
  [!runtimeIa.includes('resolveEmbeddedNvidiaKey'), 'fallback embutido NVIDIA removido']
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
