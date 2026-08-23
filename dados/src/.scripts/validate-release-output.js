#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from './envLoader.js';

const runtimeIndexPath = path.join(ROOT_DIR, 'dados', 'src', '.runtime-index.js');
const runtimeIaPath = path.join(ROOT_DIR, 'dados', 'src', 'funcs', 'private', '.runtime-ia.js');
const runtimeStartPath = path.join(ROOT_DIR, 'dados', 'src', '.scripts', '.runtime-start.js');
const storePath = path.join(ROOT_DIR, 'dados', 'src', 'utils', 'shogunStore.js');
const packagePath = path.join(ROOT_DIR, 'package.json');
const bannerPath = path.join(ROOT_DIR, 'assets', 'brand', 'shogun-banner.png');
const markPath = path.join(ROOT_DIR, 'assets', 'brand', 'shogun-mark.png');

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

console.log('\n⛩️ Validando a entrega SHOGUN 2.0\n');

assert(fs.existsSync(runtimeIndexPath), 'runtime principal foi gerado');
assert(fs.existsSync(runtimeIaPath), 'runtime de voz foi gerado');
assert(fs.existsSync(runtimeStartPath), 'runtime de inicialização foi gerado');
assert(fs.existsSync(bannerPath) && fs.statSync(bannerPath).size > 1000, 'banner SHOGUN presente');
assert(fs.existsSync(markPath) && fs.statSync(markPath).size > 1000, 'marca SHOGUN presente');

if (fs.existsSync(runtimeIndexPath)) {
  const runtimeIndex = fs.readFileSync(runtimeIndexPath, 'utf8');
  assert(runtimeIndex.includes("case 'criador'"), 'comando criador presente');
  assert(runtimeIndex.includes('github.com/dgreych/shogun'), 'repositório do produto presente');
  assert(runtimeIndex.includes('*Maurício Almeida*'), 'autoria do produto presente');
  assert(!runtimeIndex.includes('Hiudy'), 'crédito de terceiro não aparece em saída do bot');
  assert(!/sentinela/i.test(runtimeIndex), 'sem rótulo genérico na identidade');
  assert(runtimeIndex.includes('Comando não reconhecido'), 'cartão de comando inválido presente');
  assert(runtimeIndex.includes('Talvez você procurasse'), 'sugestões de similaridade presentes');
  assert(runtimeIndex.includes('downloadQuotedCommandMedia'), 'setmidia usa download independente');
  assert(runtimeIndex.includes("case 'return5'"), 'return1 a return5 presentes');
}

if (fs.existsSync(runtimeIaPath)) {
  const runtimeIa = fs.readFileSync(runtimeIaPath, 'utf8');
  assert(runtimeIa.includes('buildAssistantSystemPrompt'), 'composição de voz preservada');
  assert(!/const IA_API_KEY = ['"]nvapi-/.test(runtimeIa), 'runtime não contém credencial embutida');
}

if (fs.existsSync(runtimeStartPath)) {
  const runtimeStart = fs.readFileSync(runtimeStartPath, 'utf8');
  assert(runtimeStart.includes('\u{1D598}\u{1D58D}\u{1D594}\u{1D58C}\u{1D59A}\u{1D593} online'), 'inicialização usa a grafia canônica');
}

if (fs.existsSync(storePath)) {
  const storeSource = fs.readFileSync(storePath, 'utf8');
  assert(storeSource.includes('Buffer.from(value.data)'), 'buffers persistidos são restaurados');
  assert(storeSource.includes("JSON.parse(fs.readFileSync(file, 'utf8'), reviveJsonValue)"), 'bancos JSON usam reviver binário');
}

if (fs.existsSync(packagePath)) {
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert(packageData.name === 'shogun-whatsapp', 'pacote identificado como SHOGUN');
  assert(packageData.version === '2.0.0', 'versão principal definida como 2.0.0');
  assert(String(packageData.description || '').startsWith('SHOGUN é seu sentinela'), 'descrição independente presente');
  assert(packageData.engines?.node === '>=20.19.0', 'piso real do Node.js declarado');
  assert(Boolean(packageData.scripts?.preflight), 'inspeção multiplataforma disponível');
}

console.log(`\nAprovados: ${passed}`);
console.log(`Falhas: ${failures.length}`);
if (failures.length) process.exit(1);
console.log('✅ Identidade, execução e arte SHOGUN aprovadas.');
