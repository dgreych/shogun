#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { ROOT_DIR } from './envLoader.js';

const PACKAGE_FILE = path.join(ROOT_DIR, 'package.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const packageData = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
const version = String(packageData.version || '1.0.0');
const publicMode = process.argv.includes('--public');
const bundleName = `nazuna-gyomei-server-v${version}`;
const bundleDir = path.join(DIST_DIR, bundleName);
const rootTarPath = path.join(DIST_DIR, `${bundleName}-root.tar.gz`);
const rootZipPath = path.join(DIST_DIR, `${bundleName}-root.zip`);
const sourceArchivePath = path.join(DIST_DIR, `.nazuna-source-${process.pid}.tar`);

const LOCAL_FILES = [
  'dados/src/config.json',
  '.env.local',
  'dados/database/antiflood.json',
  'dados/database/antipv.json',
  'dados/database/antispam.json',
  'dados/database/globalBlocks.json',
  'dados/database/massMentionLimit.json',
  'dados/database/botState.json',
  'dados/database/modolite.json',
  'dados/database/autohorarios.json',
  'dados/database/automensagens.json',
  'dados/database/dono/menuDesign.json',
  'dados/database/dono/menuAudio.json',
  'dados/database/dono/menuLerMais.json',
  'dados/database/dono/groupCustomization.json',
  'dados/database/dono/msgprefix.json',
  'dados/database/dono/msgboton.json',
  'dados/database/dono/cmdNotFound.json',
  'dados/database/dono/massMentionConfig.json',
  'dados/database/dono/automacoes-v9.json',
  'dados/midias/menu_audio.mp3'
];

const LOCAL_DIRECTORIES = [
  'dados/database/grupos',
  'dados/database/dono/command-media'
];

const PRIVATE_DIRECTORIES = [
  'dados/database/qr-code',
  'dados/database/grupos',
  'dados/database/users',
  'dados/database/usuarios',
  'dados/database/dono/command-media'
];

const GENERATED_DATABASE_FILES = [
  'dados/database/commandStats.json',
  'dados/database/economy.json',
  'dados/database/leveling.json',
  'dados/database/jidLidCache.json',
  'dados/database/reminders.json',
  'dados/database/cmduserlimits.json',
  'dados/database/globalBlocks.json',
  'dados/database/antipv.json',
  'dados/database/antispam.json',
  'dados/database/antiflood.json',
  'dados/database/dono/alugueis.json',
  'dados/database/dono/codigos_aluguel.json',
  'dados/database/dono/globalBlacklist.json',
  'dados/database/dono/premium.json',
  'dados/database/dono/subdonos.json',
  'dados/database/dono/divulgacao_dono.json',
  'dados/database/dono/automacoes-v9.json',
  'dados/database/dono/deleted-messages-v9.json'
];

const RUNTIME_ARTIFACTS = [
  'dados/src/.runtime-index.js',
  'dados/src/.runtime-connect.js',
  'dados/src/funcs/private/.runtime-ia.js',
  'dados/src/menus/.runtime-index.js',
  'dados/src/menus/.runtime-menubn.js',
  'dados/src/.scripts/.runtime-start.js'
];

function runAt(cwd, command, args, options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options
  });
}

function run(command, args, options = {}) {
  return runAt(ROOT_DIR, command, args, options);
}

function ensureInsideRoot(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^([/\\])+/, '');
  const source = path.resolve(ROOT_DIR, normalized);
  if (source !== ROOT_DIR && !source.startsWith(`${ROOT_DIR}${path.sep}`)) {
    throw new Error(`Caminho fora do projeto recusado: ${relativePath}`);
  }
  return { normalized, source };
}

function copyEntry(relativePath, included) {
  const { normalized, source } = ensureInsideRoot(relativePath);
  if (!fs.existsSync(source)) return false;

  const destination = path.join(bundleDir, normalized);
  const stat = fs.lstatSync(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  if (stat.isSymbolicLink()) {
    try { fs.unlinkSync(destination); } catch {}
    fs.symlinkSync(fs.readlinkSync(source), destination);
  } else if (stat.isDirectory()) {
    fs.cpSync(source, destination, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
      filter: item => !item.includes(`${path.sep}qr-code${path.sep}`)
    });
  } else {
    fs.copyFileSync(source, destination);
    try { fs.chmodSync(destination, stat.mode); } catch {}
  }

  included.add(normalized.split(path.sep).join('/'));
  return true;
}

function exportCommittedTree(included) {
  const archiveResult = run(
    'git',
    ['archive', '--format=tar', `--output=${sourceArchivePath}`, 'HEAD'],
    { capture: true }
  );
  if (archiveResult.status !== 0) {
    throw new Error(`git archive falhou: ${(archiveResult.stderr || '').trim()}`);
  }

  try {
    const extractResult = run('tar', ['-xf', sourceArchivePath, '-C', bundleDir], { capture: true });
    if (extractResult.status !== 0) {
      throw new Error(`extração da árvore do commit falhou: ${(extractResult.stderr || '').trim()}`);
    }
  } finally {
    fs.rmSync(sourceArchivePath, { force: true });
  }

  const treeResult = run('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { capture: true });
  if (treeResult.status !== 0) {
    throw new Error(`git ls-tree falhou: ${(treeResult.stderr || '').trim()}`);
  }

  const tracked = treeResult.stdout.split(/\r?\n/).filter(Boolean);
  tracked.forEach(file => included.add(file));
  return tracked.length;
}

function transformAbsolutePaths(value) {
  if (Array.isArray(value)) return value.map(transformAbsolutePaths);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, transformAbsolutePaths(item)])
    );
  }
  if (typeof value !== 'string' || !path.isAbsolute(value)) return value;

  const resolved = path.resolve(value);
  const insideProject = resolved === ROOT_DIR || resolved.startsWith(`${ROOT_DIR}${path.sep}`);
  return insideProject ? path.relative(ROOT_DIR, resolved).split(path.sep).join('/') : value;
}

function rebaseJsonFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(transformAbsolutePaths(parsed), null, 2));
  } catch (error) {
    throw new Error(`não foi possível rebasear caminhos em ${path.relative(bundleDir, file)}: ${error.message}`);
  }
}

function rebaseLocalStatePaths(localState) {
  const visit = target => {
    if (!fs.existsSync(target)) return;
    const stat = fs.lstatSync(target);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) visit(path.join(target, entry));
      return;
    }
    if (target.toLowerCase().endsWith('.json')) rebaseJsonFile(target);
  };

  for (const relativePath of localState) visit(path.join(bundleDir, relativePath.replace(/\/$/, '')));
}

function secureIaDeclaration() {
  return "const IA_API_KEY = String(process.env.NVIDIA_API_KEY || '').trim();";
}

function sanitizeBundleSource() {
  const iaFile = path.join(bundleDir, 'dados', 'src', 'funcs', 'private', 'ia.js');
  if (!fs.existsSync(iaFile)) throw new Error('Arquivo legado da IA não foi encontrado na build.');

  let source = fs.readFileSync(iaFile, 'utf8');
  source = source.replace(
    /const IA_API_KEY\s*=\s*['"][^'"]*['"]\s*;/,
    secureIaDeclaration()
  );

  if (/nvapi-[A-Za-z0-9_-]+/.test(source)) {
    throw new Error('A build ainda contém uma chave NVIDIA hardcoded.');
  }
  if (!source.includes('process.env.NVIDIA_API_KEY')) {
    throw new Error('A credencial NVIDIA não foi externalizada no módulo legado.');
  }
  fs.writeFileSync(iaFile, source);
}

function resetJsonPreservingType(file) {
  if (!fs.existsSync(file)) return;
  try {
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(Array.isArray(current) ? [] : {}, null, 2));
  } catch {
    fs.writeFileSync(file, '{}\n');
  }
}

function sanitizePublicState() {
  for (const relativePath of PRIVATE_DIRECTORIES) {
    fs.rmSync(path.join(bundleDir, relativePath), { recursive: true, force: true });
  }
  for (const relativePath of GENERATED_DATABASE_FILES) {
    resetJsonPreservingType(path.join(bundleDir, relativePath));
  }

  fs.rmSync(path.join(bundleDir, '.env.local'), { force: true });

  const configFile = path.join(bundleDir, 'dados', 'src', 'config.json');
  fs.writeFileSync(configFile, JSON.stringify({
    nomedono: 'SEU_NOME',
    numerodono: '55DDDNUMERO',
    nomebot: 'NAZUNA BOT • GYOMEI',
    prefixo: '!',
    lidowner: '',
    site_vex: 'https://vexapi.com.br',
    apikey_vex: 'COLOQUE_SUA_CHAVE_VEX'
  }, null, 2) + '\n');
}

function validateMountedBundle() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const script = publicMode ? 'validate:ci' : 'validate:deploy';
  const result = runAt(bundleDir, npmCommand, ['run', script]);
  if (result.status !== 0) throw new Error(`A validação ${script} da build montada falhou.`);
}

function cleanupRuntimeArtifacts() {
  for (const relativePath of RUNTIME_ARTIFACTS) {
    fs.rmSync(path.join(bundleDir, relativePath), { force: true });
  }
}

function writeManifest(included, localState) {
  const commitResult = run('git', ['rev-parse', 'HEAD'], { capture: true });
  const branchResult = run('git', ['branch', '--show-current'], { capture: true });

  const manifest = {
    name: 'NAZUNA BOT - versão modificada GYOMEI',
    version,
    generatedAt: new Date().toISOString(),
    commit: commitResult.status === 0 ? commitResult.stdout.trim() : null,
    branch: branchResult.status === 0 ? branchResult.stdout.trim() : null,
    base: 'git archive HEAD + node_modules instalado por npm ci',
    mode: publicMode ? 'public-sanitized' : 'private-local-state',
    rootLayout: true,
    startupFileAtArchiveRoot: true,
    localStateIncluded: localState,
    sessionIncluded: false,
    credentialsIncluded: publicMode ? false : localState.includes('.env.local'),
    sourceCredentialSanitized: true,
    mountedBundleValidated: true,
    dependenciesBundledFromCleanInstall: true,
    localPathsRebased: true,
    sensitiveArtifact: !publicMode,
    credits: {
      originalCreation: 'Hiudy (Hiduy)',
      nazunaContinuity: 'DevTokyo',
      modifiedVersionEnhancements: 'Alaska_dev'
    },
    notes: [
      'Os arquivos do ZIP e do TAR ficam diretamente na raiz após a extração.',
      'A sessão do WhatsApp nunca é incluída automaticamente.',
      publicMode
        ? 'O artefato público contém somente placeholders e bancos gerados vazios.'
        : 'A build privada inclui apenas os estados locais permitidos pela lista controlada.',
      'Execute o script de validação correspondente antes de iniciar o serviço.'
    ],
    fileCount: included.size
  };

  fs.writeFileSync(path.join(bundleDir, 'DEPLOY-MANIFEST.json'), JSON.stringify(manifest, null, 2));
}

function createRootArchives() {
  fs.rmSync(rootTarPath, { force: true });
  fs.rmSync(rootZipPath, { force: true });

  const tarResult = runAt(bundleDir, 'tar', ['-czf', rootTarPath, '.'], { capture: true });
  if (tarResult.status !== 0) {
    throw new Error(`compactação TAR falhou: ${(tarResult.stderr || '').trim()}`);
  }

  const zipResult = runAt(bundleDir, 'zip', ['-qr', rootZipPath, '.'], { capture: true });
  if (zipResult.status !== 0) {
    console.warn('⚠️ ZIP não foi criado; o TAR root-ready continua disponível.');
    if (zipResult.stderr) console.warn(zipResult.stderr.trim());
  }

  try { fs.chmodSync(rootTarPath, 0o600); } catch {}
  if (fs.existsSync(rootZipPath)) {
    try { fs.chmodSync(rootZipPath, 0o600); } catch {}
  }
}

console.log(`🤖 Preparando build ${publicMode ? 'pública higienizada' : 'privada controlada'} da NAZUNA BOT • GYOMEI...`);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const preflightScript = publicMode ? 'validate:ci' : 'validate:deploy';
const validation = run(npmCommand, ['run', preflightScript]);
if (validation.status !== 0) {
  console.error(`❌ A build foi interrompida porque ${preflightScript} falhou.`);
  process.exit(validation.status || 1);
}

fs.mkdirSync(DIST_DIR, { recursive: true });
fs.rmSync(bundleDir, { recursive: true, force: true });
fs.rmSync(sourceArchivePath, { force: true });
fs.mkdirSync(bundleDir, { recursive: true });

const included = new Set();
const localState = [];

try {
  const trackedCount = exportCommittedTree(included);

  if (!copyEntry('node_modules', included)) {
    throw new Error('node_modules ausente. Execute npm ci antes de gerar a build.');
  }

  if (!publicMode) {
    for (const file of LOCAL_FILES) {
      if (copyEntry(file, included)) localState.push(file);
    }
    for (const directory of LOCAL_DIRECTORIES) {
      if (copyEntry(directory, included)) localState.push(`${directory}/`);
    }
  }

  fs.rmSync(path.join(bundleDir, 'dados', 'database', 'qr-code'), { recursive: true, force: true });
  if (publicMode) sanitizePublicState();
  else rebaseLocalStatePaths(localState);

  sanitizeBundleSource();
  validateMountedBundle();
  cleanupRuntimeArtifacts();
  writeManifest(included, localState);
  createRootArchives();

  console.log('\n✅ Build de servidor criada e validada.');
  console.log(`📁 Conteúdo para inspeção: ${bundleDir}`);
  console.log(`📦 TAR root-ready: ${rootTarPath}`);
  if (fs.existsSync(rootZipPath)) console.log(`📦 ZIP root-ready: ${rootZipPath}`);
  console.log(`🧱 Arquivos do commit processados: ${trackedCount}`);
  console.log('📦 Dependências: instaladas por npm ci e incluídas no artefato, fora do histórico Git');
  console.log('📂 Layout: package.json e dados/ diretamente na raiz da extração');
  console.log('🔒 Sessão do WhatsApp: não incluída');
  console.log(`🔐 Credenciais: ${publicMode ? 'somente placeholders' : 'somente estado privado autorizado'}`);
} catch (error) {
  fs.rmSync(sourceArchivePath, { force: true });
  console.error(`❌ Falha ao montar a build: ${error.message}`);
  process.exit(1);
}
