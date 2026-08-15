#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

import { loadLocalEnv, ROOT_DIR } from './envLoader.js';
import { prepareRuntimeSources } from './prepareRuntimeSources.js';
import { finalizeGyomeiRuntime } from './finalizeGyomeiRuntime.js';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
const SRC_DIR = path.resolve(SCRIPTS_DIR, '..');
const CONFIG_FILE = path.join(SRC_DIR, 'config.json');
const require = createRequire(import.meta.url);

const requestedMode = process.argv.find(argument => argument.startsWith('--')) || '--local';
const mode = requestedMode.replace(/^--/, '');
const validModes = new Set(['ci', 'local', 'deploy', 'public']);

if (!validModes.has(mode)) {
  console.error(`❌ Modo inválido: ${requestedMode}`);
  console.error('Use --ci, --local, --deploy ou --public.');
  process.exit(2);
}

const failures = [];
const warnings = [];
let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`✅ ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`⚠️ ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`❌ ${message}`);
}

function isPlaceholder(value) {
  const text = String(value || '').trim();
  return !text || /COLOQUE|SUA?_CHAVE|SEU_|55DDD|EXEMPLO|PLACEHOLDER/i.test(text);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options
  });
}

function checkSyntax(file) {
  const relative = path.relative(ROOT_DIR, file);
  const result = run(process.execPath, ['--check', file], { capture: true });
  if (result.status === 0) {
    ok(`Sintaxe válida: ${relative}`);
    return;
  }
  fail(`Sintaxe inválida em ${relative}: ${(result.stderr || result.stdout || '').trim()}`);
}

function checkWritable(directory) {
  const relative = path.relative(ROOT_DIR, directory);
  try {
    fs.mkdirSync(directory, { recursive: true });
    const testFile = path.join(directory, `.gyomei-write-test-${process.pid}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    ok(`Diretório gravável: ${relative}`);
  } catch (error) {
    fail(`Sem permissão de escrita em ${relative}: ${error.message}`);
  }
}

function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    ok('config.json é um JSON válido');
    return parsed;
  } catch (error) {
    fail(`config.json inválido ou ausente: ${error.message}`);
    return {};
  }
}

function validateConfig(config) {
  const strict = mode === 'local' || mode === 'deploy';

  for (const field of ['nomebot', 'prefixo', 'nomedono', 'numerodono']) {
    if (isPlaceholder(config[field])) {
      const message = `Campo ${field} não está configurado.`;
      strict ? fail(message) : warn(message);
    } else {
      ok(`Campo configurado: ${field}`);
    }
  }

  if (config.nomebot && String(config.nomebot).trim().toUpperCase() !== 'GYOMEI') {
    warn(`nomebot está como "${config.nomebot}"; a identidade recomendada é GYOMEI.`);
  }

  const ownerDigits = String(config.numerodono || '').replace(/\D/g, '');
  if (strict && ownerDigits && !/^\d{10,15}$/.test(ownerDigits)) {
    fail('numerodono deve conter entre 10 e 15 dígitos, incluindo código do país.');
  }

  const nvidiaKey = String(
    process.env.NVIDIA_API_KEY || config.nvidia_api_key || ''
  ).trim();
  const vexKey = String(
    process.env.VEX_API_KEY || config.apikey_vex || ''
  ).trim();
  const vexSite = String(
    process.env.VEX_SITE || config.site_vex || ''
  ).trim();

  if (isPlaceholder(nvidiaKey)) {
    const message = 'NVIDIA_API_KEY não foi definida em .env.local, no ambiente ou em nvidia_api_key.';
    mode === 'deploy' ? fail(message) : warn(message);
  } else {
    ok('Credencial NVIDIA disponível sem ser exibida');
  }

  if (isPlaceholder(vexKey) || isPlaceholder(vexSite)) {
    const message = 'Credenciais da Vex não estão completas; transcrição ficará indisponível.';
    mode === 'deploy' ? fail(message) : warn(message);
  } else {
    ok('Configuração da Vex disponível sem ser exibida');
  }
}

function validateDependencies() {
  if (!fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
    fail('node_modules não foi encontrado. Esta distribuição depende do diretório versionado.');
    return;
  }
  ok('node_modules encontrado');

  for (const dependency of ['baileys', 'axios']) {
    try {
      require.resolve(dependency);
      ok(`Dependência resolvida: ${dependency}`);
    } catch {
      fail(`Dependência não resolvida: ${dependency}`);
    }
  }
}

function validateRuntime() {
  try {
    prepareRuntimeSources();
    finalizeGyomeiRuntime();
    ok('Fontes runtime geradas e finalizadas');
  } catch (error) {
    fail(`Falha ao gerar fontes runtime: ${error.message}`);
    return;
  }

  const files = [
    path.join(SRC_DIR, '.runtime-index.js'),
    path.join(SRC_DIR, '.runtime-connect.js'),
    path.join(SRC_DIR, 'funcs', 'private', '.runtime-ia.js'),
    path.join(SRC_DIR, 'menus', '.runtime-index.js'),
    path.join(SRC_DIR, 'menus', '.runtime-menubn.js'),
    path.join(SCRIPTS_DIR, '.runtime-start.js')
  ];

  for (const file of files) checkSyntax(file);

  try {
    const runtimeIndex = fs.readFileSync(path.join(SRC_DIR, '.runtime-index.js'), 'utf8');
    const runtimeIa = fs.readFileSync(
      path.join(SRC_DIR, 'funcs', 'private', '.runtime-ia.js'),
      'utf8'
    );
    const runtimeStart = fs.readFileSync(path.join(SCRIPTS_DIR, '.runtime-start.js'), 'utf8');

    const assertions = [
      [runtimeIndex.includes("case 'adddono'"), 'Comando adddono presente'],
      [runtimeIndex.includes("case 'return1'"), 'Comandos return presentes'],
      [runtimeIndex.includes('downloadQuotedCommandMedia'), 'setmidia usa downloader independente'],
      [!runtimeIndex.match(/case 'setmidia'[\s\S]{0,2500}\b(foto1|video1)\b/), 'setmidia não usa variáveis legadas'],
      [runtimeIa.includes('meta/llama-3.3-70b-instruct') || runtimeIa.includes('DEFAULT_NVIDIA_MODEL'), 'Modelo NVIDIA padrão (3.3) configurado na assistente'],
      [runtimeIndex.includes('meta/llama-3.3-70b-instruct') || runtimeIndex.includes('DEFAULT_NVIDIA_MODEL'), 'Modelo NVIDIA padrão (3.3) configurado nas chamadas auxiliares'],
      [!runtimeIa.includes('moonshotai/kimi-k2-instruct') && !runtimeIndex.includes('moonshotai/kimi-k2-instruct'), 'Runtime sem referências ao modelo Kimi'],
      [runtimeIa.includes('buildAssistantSystemPrompt'), 'Prompt do GYOMEI composto'],
      [runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'Chave NVIDIA externalizada no runtime'],
      [!runtimeIa.includes("const IA_API_KEY = 'nvapi-"), 'Runtime sem chave NVIDIA hardcoded'],
      [runtimeStart.includes('GYOMEI'), 'Inicialização com identidade GYOMEI']
    ];

    for (const [condition, message] of assertions) {
      condition ? ok(message) : fail(message);
    }
  } catch (error) {
    fail(`Não foi possível inspecionar os runtimes: ${error.message}`);
  }
}

async function validateMediaExtraction() {
  try {
    const { getQuotedMediaSource } = await import('../utils/gyomeiCore.js');
    const fakeMedia = {
      url: 'https://example.invalid/media',
      mediaKey: Buffer.from('gyomei'),
      mimetype: 'image/jpeg'
    };
    const result = getQuotedMediaSource({
      extendedTextMessage: {
        contextInfo: {
          quotedMessage: {
            ephemeralMessage: {
              message: { imageMessage: fakeMedia }
            }
          }
        }
      }
    });

    if (result?.message === fakeMedia && result?.type === 'image') {
      ok('Extração de mídia citada passou no teste local');
    } else {
      fail('Extração de mídia citada retornou resultado inesperado.');
    }
  } catch (error) {
    fail(`Teste de mídia citada falhou: ${error.message}`);
  }
}

function auditCommittedSecrets() {
  const sessionResult = run(
    'git',
    ['ls-tree', '-r', '--name-only', 'HEAD'],
    { capture: true }
  );

  if (sessionResult.status !== 0) {
    warn('Não foi possível consultar a árvore Git para auditoria pública.');
    return;
  }

  const trackedFiles = sessionResult.stdout.split(/\r?\n/).filter(Boolean);
  const trackedSession = trackedFiles.some(file => file.startsWith('dados/database/qr-code/'));
  trackedSession
    ? fail('A árvore Git contém arquivos da sessão do WhatsApp.')
    : ok('Nenhum arquivo de sessão está presente na árvore atual');

  const secretResult = run(
    'git',
    [
      'grep', '-I', '-n', '-E',
      'nvapi-|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|refresh_token|client_secret',
      'HEAD', '--',
      ':!node_modules/**',
      ':!README.md',
      ':!DEPLOY.md'
    ],
    { capture: true }
  );

  if (secretResult.status === 0 && secretResult.stdout.trim()) {
    const lines = secretResult.stdout.trim().split(/\r?\n/);
    fail(`Possíveis segredos versionados encontrados em ${lines.length} ocorrência(s).`);
    for (const line of lines.slice(0, 5)) {
      console.error(`   ${line.replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-[REDACTED]')}`);
    }
  } else if (secretResult.status === 1) {
    ok('Nenhum padrão conhecido de segredo encontrado na árvore atual');
  } else {
    warn('A busca de segredos não pôde ser concluída.');
  }
}

console.log(`\n🪨 Validação GYOMEI — modo ${mode.toUpperCase()}\n`);

const envResult = loadLocalEnv();
if (envResult.exists) {
  ok(`.env.local carregado (${envResult.loaded.length} variável(is) nova(s))`);
} else if (mode === 'local' || mode === 'deploy') {
  warn('.env.local não encontrado; serão usadas apenas variáveis já exportadas e config.json.');
}

const majorNode = Number(process.versions.node.split('.')[0]);
majorNode >= 20
  ? ok(`Node.js compatível: ${process.version}`)
  : fail(`Node.js 20 ou superior é obrigatório; encontrado ${process.version}.`);

for (const relative of [
  'package.json',
  'dados/src/index.js',
  'dados/src/connect.js',
  'dados/src/.scripts/prepareRuntimeSources.js',
  'dados/src/.scripts/finalizeGyomeiRuntime.js',
  'dados/src/utils/gyomeiRuntime.js'
]) {
  const fullPath = path.join(ROOT_DIR, relative);
  fs.existsSync(fullPath) ? ok(`Arquivo encontrado: ${relative}`) : fail(`Arquivo ausente: ${relative}`);
}

validateDependencies();
const config = readConfig();
validateConfig(config);

for (const directory of [
  path.join(ROOT_DIR, 'dados', 'database', 'dono'),
  path.join(ROOT_DIR, 'dados', 'database', 'qr-code'),
  path.join(ROOT_DIR, 'dados', 'logs')
]) {
  checkWritable(directory);
}

validateRuntime();
await validateMediaExtraction();

if (mode === 'public') auditCommittedSecrets();

console.log('\n────────────────────────────────────────');
console.log(`Aprovados: ${passed}`);
console.log(`Avisos: ${warnings.length}`);
console.log(`Falhas: ${failures.length}`);

if (warnings.length) {
  console.log('\nAvisos:');
  warnings.forEach(message => console.log(`- ${message}`));
}

if (failures.length) {
  console.log('\nValidação reprovada. Corrija as falhas antes de prosseguir.');
  process.exit(1);
}

console.log('\n✅ Validação concluída. A próxima etapa permitida depende do modo executado.');
