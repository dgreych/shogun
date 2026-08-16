#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import { ROOT_DIR } from './envLoader.js';

const runtimeIndexPath = path.join(ROOT_DIR, 'dados', 'src', '.runtime-index.js');
const runtimeIaPath = path.join(
  ROOT_DIR,
  'dados',
  'src',
  'funcs',
  'private',
  '.runtime-ia.js'
);
const runtimeStartPath = path.join(ROOT_DIR, 'dados', 'src', '.scripts', '.runtime-start.js');
const storePath = path.join(ROOT_DIR, 'dados', 'src', 'utils', 'gyomeiStore.js');
const packagePath = path.join(ROOT_DIR, 'package.json');

const failures = [];
let passed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`✅ ${message}`);
  } else {
    failures.push(message);
    console.error(`❌ ${message}`);
  }
}

console.log('\n🤖 Validando NAZUNA BOT — versão modificada GYOMEI 1.0\n');

assert(fs.existsSync(runtimeIndexPath), 'runtime principal foi gerado');
assert(fs.existsSync(runtimeIaPath), 'runtime da IA foi gerado');
assert(fs.existsSync(runtimeStartPath), 'runtime de inicialização foi gerado');

if (fs.existsSync(runtimeIndexPath)) {
  const runtimeIndex = fs.readFileSync(runtimeIndexPath, 'utf8');
  assert(runtimeIndex.includes("case 'criador'"), 'comando criador presente');
  assert(runtimeIndex.includes('NAZUNA BOT'), 'nome principal NAZUNA BOT presente');
  assert(
    runtimeIndex.includes('github.com/dgreych') && runtimeIndex.includes('wa.me/5522997028553'),
    'GitHub e contato de Alaska_dev presentes no comando criador'
  );
  assert(runtimeIndex.includes('criação original') && runtimeIndex.includes('github.com/hiudyy'), 'criação original de Hiudy preservada, com GitHub');
  assert(runtimeIndex.includes('wa.me/553391967445'), 'contato original de Hiudy preservado');
  assert(runtimeIndex.includes('continuidade da Nazuna') && runtimeIndex.includes('github.com/DevTokyoVx'), 'continuidade de DevTokyo preservada, com GitHub');
  assert(runtimeIndex.includes('wa.me/5532985076326'), 'contato de DevTokyo preservado');
  assert(runtimeIndex.includes('versão GYOMEI'), 'crédito dos aprimoramentos de Alaska_dev presente');
  assert(runtimeIndex.includes('Comando não reconhecido'), 'novo cartão de comando inválido presente');
  assert(runtimeIndex.includes('Talvez você procurasse'), 'sugestões de similaridade presentes');
  assert(runtimeIndex.includes('comandos disponíveis'), 'total de comandos aparece de forma discreta');
  assert(runtimeIndex.includes('downloadQuotedCommandMedia'), 'setmidia usa download independente');
  assert(!runtimeIndex.includes('requestNvidiaChat'), 'runtime principal não chama NVIDIA diretamente');
  assert(!runtimeIndex.includes('moonshotai/kimi-k2-instruct'), 'runtime principal não contém modelo Kimi');
  assert(runtimeIndex.includes("case 'return5'"), 'return1 a return5 presentes');
}

if (fs.existsSync(runtimeIaPath)) {
  const runtimeIa = fs.readFileSync(runtimeIaPath, 'utf8');
  assert(runtimeIa.includes('createBunnyFyAiClient'), 'assistente usa BunnyFy como gateway de IA');
  assert(!runtimeIa.includes('moonshotai/kimi-k2-instruct'), 'assistente não contém modelo Kimi');
  assert(runtimeIa.includes('buildAssistantSystemPrompt'), 'prompt protegido do GYOMEI composto');
  assert(!runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'runtime não lê NVIDIA_API_KEY diretamente');
  assert(!/const IA_API_KEY = ['"]nvapi-/.test(runtimeIa), 'runtime não contém chave NVIDIA hardcoded');
}

if (fs.existsSync(runtimeStartPath)) {
  const runtimeStart = fs.readFileSync(runtimeStartPath, 'utf8');
  assert(
    runtimeStart.includes('GYOMEI — O guardião despertou'),
    'inicialização reflete a identidade e o tom do Gyomei'
  );
}

if (fs.existsSync(storePath)) {
  const storeSource = fs.readFileSync(storePath, 'utf8');
  assert(storeSource.includes('Buffer.from(value.data)'), 'buffers persistidos pelo return são restaurados');
  assert(storeSource.includes('JSON.parse(fs.readFileSync(file, \'utf8\'), reviveJsonValue)'), 'bancos JSON usam o reviver binário');
}

if (fs.existsSync(packagePath)) {
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert(packageData.name === 'nazuna-gyomei', 'pacote identificado como Nazuna Gyomei');
  assert(packageData.version === '1.0.0', 'versão modificada definida como 1.0.0');
  assert(
    String(packageData.description || '').includes('NAZUNA BOT - versão modificada GYOMEI'),
    'descrição do pacote preserva o nome correto'
  );
  assert(Boolean(packageData.scripts?.['build:server']), 'script build:server disponível');
}

console.log(`\nAprovados: ${passed}`);
console.log(`Falhas: ${failures.length}`);

if (failures.length) process.exit(1);
console.log('✅ Identidade, créditos e experiência da versão modificada 1.0 aprovadas.');
