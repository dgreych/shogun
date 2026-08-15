#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const HOME = os.homedir();
const TS = new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').replace(/\..+/, '');
const ART = path.join(HOME, 'Downloads', `BUN-017-AI-LOGOS-${TS}`);
const REPORT = path.join(ART, 'REPORT.md');
const EXEC_LOG = path.join(ART, 'execution.log');
const ROLLBACK = path.join(ART, 'rollback');
const SMOKE = path.join(ART, 'smoke');

const BUNNY = path.join(HOME, 'Downloads', 'BunnyFy-logos');
const GYOMEI = path.join(HOME, 'Downloads', 'reconcile-gyomei-20260810');
const CRED = path.join(HOME, 'Downloads', 'nazuna-main-final-20260806-175302', 'CREDENCIAIS-DEV.md');

const BUNNY_BRANCH = 'release/bun017-ai-cut-logos-20260812';
const GYOMEI_BRANCH = 'release/gyomei-bun017-ai-exclusive-logos-20260812';
const BUNNY_RELEASE_BASE = 'df8870b66e6480fa8d22346e595dcb4adf3ed29d';
const GYOMEI_RELEASE_BASE = '2faf3bfa1f4bbdce92ff812cc42f55f2937ef06f';
const STICKER_IMPL = 'a25fd8741044d3812d7c9b28f459e261183cd349';
const STICKER_PARENT = '26d15571ffdfddad1b6b8d4f03cf8dc13c5a9a97';

const BUNNY_SERVER = 'e75730fa';
const BUNNY_UUID = 'e75730fa-f3f9-4dc6-be1a-d50024ba00a1';
const GYOMEI_SERVER = 'd56f3096';
const PUBLIC = 'http://node1.vexhost.com.br:20072';

const LOGO_ONE = ['darkgreen','glitch','write','advanced','typography','pixel','neon','flag','americanflag','deleting'];
const LOGO_TWO = ['pornhub','avengers','graffiti','captainamerica','stone3d','neon2','thor','amongus','deadpool','blackpink'];
const NVIDIA_MODELS = [
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.1-70b-instruct'
];

const BUNNY_RUNTIME_FILES = [
  'src/app.ts',
  'src/config.ts',
  'src/lib/stickers.ts',
  'src/routes/health.ts',
  'src/routes/stickers.ts'
];

const GYOMEI_BUNNY_FILES = [
  'dados/src/index.js',
  'dados/src/services/bunnyfy/BunnyFyClient.js',
  'dados/src/services/bunnyfy/capabilityGateway.js',
  'dados/src/services/bunnyfy/contracts.js',
  'dados/src/services/bunnyfy/index.js'
];

const GYOMEI_AI_CUT_FILES = [
  'dados/src/funcs/private/ia.js',
  'dados/src/utils/nvidiaApi.js',
  'dados/src/utils/nvidiaEmbedded.js',
  'dados/src/utils/gyomeiStore.js',
  'dados/src/.scripts/finalizeGyomeiRuntime.js',
  'dados/src/.scripts/applyCriticalRuntimeFixes.js',
  'dados/src/.scripts/start-v9-fixed.js',
  'dados/src/.scripts/validateBunnyFyAiExclusive.js',
  'dados/src/.scripts/validate-critical-runtime.js',
  'dados/src/.scripts/validate-release-output.js',
  'dados/src/.scripts/validate-local.js',
  'dados/src/.scripts/test-regressions.js',
  'dados/src/.scripts/build-server.js',
  'dados/src/.scripts/diagnose-nvidia.js',
  'dados/src/.scripts/test-assistant-live.js',
  'package.json'
];

fs.mkdirSync(ART, { recursive: true });
fs.mkdirSync(ROLLBACK, { recursive: true });
fs.mkdirSync(SMOKE, { recursive: true });
fs.writeFileSync(REPORT, '# RELEASE BUN-017 + IA EXCLUSIVE + MENU LOGOS\n\n');
fs.writeFileSync(EXEC_LOG, '');

function log(line = '') {
  const text = String(line);
  console.log(text);
  fs.appendFileSync(REPORT, `${text}\n`);
  fs.appendFileSync(EXEC_LOG, `${text}\n`);
}

function sha(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function git(repo, args, { binary = false, allowFail = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: binary ? null : 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} falhou em ${repo}: ${String(result.stderr || result.stdout || '').trim()}`);
  }
  return binary ? result.stdout : String(result.stdout || '').trim();
}

function run(repo, command, args, logFile) {
  const result = spawnSync(command, args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: process.env
  });
  const text = `${result.stdout || ''}${result.stderr || ''}`;
  if (logFile) fs.writeFileSync(logFile, text);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} falhou com código ${result.status}. Consulte ${logFile || 'a saída'}.`);
  return text;
}

function assertClean(repo, label) {
  const dirty = git(repo, ['status', '--porcelain']);
  if (dirty) throw new Error(`${label}: worktree contém alterações locais; rollout bloqueado.`);
}

function switchRelease(repo, branch) {
  git(repo, ['fetch', 'origin', '--prune']);
  const local = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: repo }).status === 0;
  if (local) git(repo, ['switch', branch]);
  else git(repo, ['switch', '-c', branch, '--track', `origin/${branch}`]);
  git(repo, ['pull', '--ff-only', 'origin', branch]);
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function patchOnce(source, search, replacement, description) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Patch obrigatório não encontrado: ${description}`);
  return source.replace(search, replacement);
}

function patchBunnySource() {
  log('## Fase 1 - reconciliacao versionada BunnyFy');
  assertClean(BUNNY, 'BunnyFy');
  switchRelease(BUNNY, BUNNY_BRANCH);

  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', BUNNY_RELEASE_BASE, 'HEAD'], { cwd: BUNNY }).status === 0;
  if (!ancestor) throw new Error('BunnyFy release branch não descende do checkpoint BUN-018A esperado.');

  git(BUNNY, ['checkout', STICKER_IMPL, '--', 'src/lib/stickers.ts', 'src/routes/stickers.ts']);
  const addedTests = git(BUNNY, ['diff', '--name-only', '--diff-filter=A', STICKER_PARENT, STICKER_IMPL, '--', 'tests'])
    .split(/\r?\n/).filter(Boolean).filter(name => /sticker/i.test(name));
  for (const file of addedTests) git(BUNNY, ['checkout', STICKER_IMPL, '--', file]);

  const appPath = path.join(BUNNY, 'src/app.ts');
  let app = fs.readFileSync(appPath, 'utf8');
  app = patchOnce(
    app,
    "import type { TranscriptionDeps, TranscriptionResult } from './lib/transcription.ts';\n",
    "import type { TranscriptionDeps, TranscriptionResult } from './lib/transcription.ts';\nimport type { StickerFit, StickerKind, StickerProcessDeps, StickerProcessResult, StickerCanvasInput } from './lib/stickers.ts';\nimport { createStickerFromMedia, renderStickerCanvas } from './lib/stickers.ts';\n",
    'imports stickers no app'
  );
  app = patchOnce(
    app,
    "import { registerSocialCanvasRoutes } from './routes/socialCanvas.ts';\n",
    "import { registerSocialCanvasRoutes } from './routes/socialCanvas.ts';\nimport { registerStickerRoutes } from './routes/stickers.ts';\n",
    'rota stickers no app'
  );
  if (!app.includes('processSticker?:')) {
    app = patchOnce(
      app,
      '\n}\n\nexport interface BuiltApp',
      `\n  /** Injetável em teste para isolar o processamento de stickers. */\n  processSticker?: (\n    inputPath: string,\n    outputPath: string,\n    kind: StickerKind,\n    fit: StickerFit,\n    deps: StickerProcessDeps,\n  ) => Promise<StickerProcessResult>;\n  /** Injetável em teste para isolar o Canvas de stickers. */\n  renderStickerCanvas?: (input: StickerCanvasInput) => Promise<Buffer>;\n}\n\nexport interface BuiltApp`,
      'BuildAppOptions stickers'
    );
  }
  app = patchOnce(
    app,
    '    ffmpegPath: config.ffmpegPath,\n    denoPath: config.denoPath,',
    '    ffmpegPath: config.ffmpegPath,\n    ffprobePath: config.ffprobePath,\n    denoPath: config.denoPath,',
    'ffprobe health deps'
  );
  app = patchOnce(
    app,
    '    youtubeFallbackAvailable: config.youtubeFallbackEnabled,\n  });',
    '    youtubeFallbackAvailable: config.youtubeFallbackEnabled,\n    stickersAvailable: true,\n  });',
    'readiness stickers'
  );
  if (!app.includes('registerStickerRoutes(app, {')) {
    const block = `\n  registerStickerRoutes(app, {\n    tempStorage,\n    apiKeys: config.apiKeys,\n    mediaSigningSecret: config.mediaSigningSecret,\n    mediaTtlSeconds: config.mediaTtlSeconds,\n    limiter: new ConcurrencyLimiter(config.stickerMaxConcurrency),\n    maxInputBytes: config.stickerMaxInputBytes,\n    maxInputPixels: config.stickerMaxInputPixels,\n    maxOutputBytes: config.stickerMaxOutputBytes,\n    maxDurationSeconds: config.stickerMaxDurationSeconds,\n    timeoutMs: config.stickerTimeoutMs,\n    ffmpegPath: config.ffmpegPath,\n    ffprobePath: config.ffprobePath,\n    processSticker: options.processSticker ?? createStickerFromMedia,\n    renderCanvas: options.renderStickerCanvas ?? renderStickerCanvas,\n  });\n`;
    app = patchOnce(app, '\n  registerLogoRoute(app, {', `${block}\n  registerLogoRoute(app, {`, 'registro stickers antes de logos');
  }
  write(appPath, app);

  const configPath = path.join(BUNNY, 'src/config.ts');
  let config = fs.readFileSync(configPath, 'utf8');
  config = patchOnce(config, "  FFMPEG_PATH: z.string().default('ffmpeg'),\n", "  FFMPEG_PATH: z.string().default('ffmpeg'),\n  FFPROBE_PATH: z.string().default('ffprobe'),\n", 'FFPROBE_PATH');
  if (!config.includes('STICKER_TIMEOUT_MS:')) {
    config = patchOnce(
      config,
      '  CANVAS_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),\n',
      `  CANVAS_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),\n\n  STICKER_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(45_000),\n  STICKER_MAX_CONCURRENCY: z.coerce.number().int().positive().max(4).default(1),\n  STICKER_MAX_INPUT_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),\n  STICKER_MAX_INPUT_PIXELS: z.coerce.number().int().positive().default(16_000_000),\n  STICKER_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().max(5 * 1024 * 1024).default(1_000_000),\n  STICKER_MAX_DURATION_SECONDS: z.coerce.number().positive().max(15).default(10),\n`,
      'schema STICKER_*'
    );
  }
  config = patchOnce(config, '    ffmpegPath: data.FFMPEG_PATH,\n    denoPath:', '    ffmpegPath: data.FFMPEG_PATH,\n    ffprobePath: data.FFPROBE_PATH,\n    denoPath:', 'config ffprobePath');
  if (!config.includes('stickerTimeoutMs: data.STICKER_TIMEOUT_MS')) {
    config = patchOnce(
      config,
      '    canvasMaxOutputBytes: data.CANVAS_MAX_OUTPUT_BYTES,\n',
      `    canvasMaxOutputBytes: data.CANVAS_MAX_OUTPUT_BYTES,\n\n    stickerTimeoutMs: data.STICKER_TIMEOUT_MS,\n    stickerMaxConcurrency: data.STICKER_MAX_CONCURRENCY,\n    stickerMaxInputBytes: data.STICKER_MAX_INPUT_BYTES,\n    stickerMaxInputPixels: data.STICKER_MAX_INPUT_PIXELS,\n    stickerMaxOutputBytes: data.STICKER_MAX_OUTPUT_BYTES,\n    stickerMaxDurationSeconds: data.STICKER_MAX_DURATION_SECONDS,\n`,
      'config return stickers'
    );
  }
  write(configPath, config);

  const healthPath = path.join(BUNNY, 'src/routes/health.ts');
  let health = fs.readFileSync(healthPath, 'utf8');
  health = patchOnce(health, '  ffmpegPath: string;\n  denoPath:', '  ffmpegPath: string;\n  ffprobePath: string;\n  denoPath:', 'health ffprobe interface');
  health = patchOnce(health, '  youtubeFallbackAvailable: boolean;\n}', '  youtubeFallbackAvailable: boolean;\n  stickersAvailable: boolean;\n}', 'health stickers interface');
  health = patchOnce(
    health,
    'const [ytDlpVersion, ffmpegAvailable, youtubeJsRuntimeVersion, whisperCliAvailable, whisperModelAvailable, rembgAvailable, rembgModelAvailable] =',
    'const [ytDlpVersion, ffmpegAvailable, ffprobeAvailable, youtubeJsRuntimeVersion, whisperCliAvailable, whisperModelAvailable, rembgAvailable, rembgModelAvailable] =',
    'health ffprobe promise destructuring'
  );
  health = patchOnce(health, '        checkToolAvailable(deps.ffmpegPath),\n        readToolVersion(youtubeJsRuntimePath),', '        checkToolAvailable(deps.ffmpegPath),\n        checkToolAvailable(deps.ffprobePath),\n        readToolVersion(youtubeJsRuntimePath),', 'health ffprobe check');
  health = patchOnce(health, '        ffmpeg: ffmpegAvailable,\n        deno:', '        ffmpeg: ffmpegAvailable,\n        ffprobe: ffprobeAvailable,\n        deno:', 'health ffprobe output');
  if (!health.includes('stickersStatic:')) {
    health = patchOnce(
      health,
      '        movieQuiz: deps.movieQuizAvailable,\n',
      '        movieQuiz: deps.movieQuizAvailable,\n        stickersStatic: storageWritable && deps.stickersAvailable,\n        stickersAnimated: storageWritable && deps.stickersAvailable && ffmpegAvailable && ffprobeAvailable,\n',
      'health sticker capabilities'
    );
  }
  write(healthPath, health);

  const helperPath = path.join(BUNNY, 'tests/helpers/testApp.ts');
  if (fs.existsSync(helperPath)) {
    let helper = fs.readFileSync(helperPath, 'utf8');
    if (!helper.includes("processSticker?: BuildAppOptions['processSticker']")) {
      helper = patchOnce(helper, "  movieQuiz?: BuildAppOptions['movieQuiz'];\n", "  movieQuiz?: BuildAppOptions['movieQuiz'];\n  processSticker?: BuildAppOptions['processSticker'];\n  renderStickerCanvas?: BuildAppOptions['renderStickerCanvas'];\n", 'test helper sticker options');
      helper = patchOnce(helper, '    movieQuiz: options?.movieQuiz,\n', '    movieQuiz: options?.movieQuiz,\n    processSticker: options?.processSticker,\n    renderStickerCanvas: options?.renderStickerCanvas,\n', 'test helper sticker injection');
      write(helperPath, helper);
    }
  }

  const envExamplePath = path.join(BUNNY, '.env.example');
  let envExample = fs.readFileSync(envExamplePath, 'utf8');
  if (!envExample.includes('STICKER_TIMEOUT_MS=')) {
    envExample += `\n# Stickers BunnyFy\nFFPROBE_PATH=ffprobe\nSTICKER_TIMEOUT_MS=45000\nSTICKER_MAX_CONCURRENCY=1\nSTICKER_MAX_INPUT_BYTES=26214400\nSTICKER_MAX_INPUT_PIXELS=16000000\nSTICKER_MAX_OUTPUT_BYTES=1000000\nSTICKER_MAX_DURATION_SECONDS=10\n`;
    write(envExamplePath, envExample);
  }

  const doc = path.join(BUNNY, 'docs', 'RELEASE_BUN017_AI_LOGOS_20260812.md');
  write(doc, `# RELEASE BunnyFy — BUN-017 + IA + logos — 2026-08-12\n\nEstado inicial: PREPARADO_PARA_ROLLOUT_CONTROLADO.\n\nBase: BUN-018A documentado em ${BUNNY_RELEASE_BASE}.\n\nObjetivo: reconciliar BUN-017 sobre o baseline atual sem sobrescrever Canvas/logos/IA existentes; manter a chave NVIDIA apenas na BunnyFy; conceder stickers:write e ai:chat somente à chave privada Gyomei; provar os 20 modelos do menulogo por adapter Gyomei -> BunnyFy.\n\nNão mergear main por inferência. O commit efetivamente implantado deve ser registrado após o rollout.\n`);

  run(BUNNY, 'npm', ['run', 'verify'], path.join(ART, 'bunnyfy-verify.log'));
  git(BUNNY, ['add', '.']);
  if (git(BUNNY, ['status', '--porcelain'])) git(BUNNY, ['commit', '-m', 'Reconciliar stickers com BunnyFy atual']);
  git(BUNNY, ['push', 'origin', BUNNY_BRANCH]);
  assertClean(BUNNY, 'BunnyFy pós-commit');
  const head = git(BUNNY, ['rev-parse', 'HEAD']);
  log(`- BunnyFy release code HEAD: \`${head}\``);
  return head;
}

function patchGyomeiSource() {
  log('');
  log('## Fase 2 - corte de transporte NVIDIA no Gyomei');
  assertClean(GYOMEI, 'Gyomei');
  switchRelease(GYOMEI, GYOMEI_BRANCH);
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', GYOMEI_RELEASE_BASE, 'HEAD'], { cwd: GYOMEI }).status === 0;
  if (!ancestor) throw new Error('Gyomei release branch não descende do checkpoint 2faf3bf esperado.');

  const iaPath = path.join(GYOMEI, 'dados/src/funcs/private/ia.js');
  let ia = fs.readFileSync(iaPath, 'utf8');
  ia = ia.replace(
    "import { DEFAULT_NVIDIA_MODEL, isKnownNvidiaModel, requestNvidiaChat } from '../../utils/nvidiaApi.js';",
    "import { DEFAULT_NVIDIA_MODEL, isKnownNvidiaModel } from '../../utils/nvidiaApi.js';"
  );
  ia = ia.replace("import { resolveEmbeddedNvidiaKey } from '../../utils/nvidiaEmbedded.js';\n", '');
  ia = ia.replace(/function getNvidiaApiKey\(\) \{[\s\S]*?\n\}\n\nfunction getNvidiaModel\(\)/, 'function getNvidiaModel()');
  const directMarker = '\n  return requestNvidiaChat({';
  const directAt = ia.lastIndexOf(directMarker);
  if (directAt >= 0) {
    const directEnd = ia.indexOf('\n  });', directAt);
    if (directEnd < 0) throw new Error('Fim da chamada NVIDIA direta não localizado em ia.js.');
    ia = `${ia.slice(0, directAt)}\n  const directDisabled = new Error('Transporte NVIDIA direto desativado. A assistente exige BunnyFy.');\n  directDisabled.code = 'BUNNYFY_AI_REQUIRED';\n  throw directDisabled;${ia.slice(directEnd + '\n  });'.length)}`;
  }
  for (const forbidden of ['requestNvidiaChat(', 'getNvidiaApiKey(', 'resolveEmbeddedNvidiaKey', 'process.env.NVIDIA_API_KEY']) {
    if (ia.includes(forbidden)) throw new Error(`ia.js ainda contém caminho NVIDIA direto: ${forbidden}`);
  }
  if (!ia.includes('createBunnyFyAiClient')) throw new Error('ia.js perdeu o gateway BunnyFy.');
  write(iaPath, ia);

  write(path.join(GYOMEI, 'dados/src/utils/nvidiaApi.js'), `export const NVIDIA_CHAT_ENDPOINT = null;\nexport const DEFAULT_NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';\n\nexport const NVIDIA_MODEL_CATALOG = [\n  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', label: 'Nemotron Super 49B (mais completo)', description: 'Modelo selecionável via gateway BunnyFy.' },\n  { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (mais rápido)', description: 'Modelo selecionável via gateway BunnyFy.' },\n  { id: 'meta/llama-3.2-3b-instruct', label: 'Llama 3.2 3B (mais leve)', description: 'Modelo selecionável via gateway BunnyFy.' },\n  { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B (equilíbrio)', description: 'Modelo selecionável via gateway BunnyFy.' }\n];\n\nexport function isKnownNvidiaModel(modelId) {\n  return NVIDIA_MODEL_CATALOG.some(entry => entry.id === modelId);\n}\n\nexport class NvidiaApiError extends Error {\n  constructor(message = 'Transporte NVIDIA direto desativado.', options = {}) {\n    super(message);\n    this.name = 'NvidiaApiError';\n    this.code = options.code || 'NVIDIA_DIRECT_DISABLED';\n    this.status = null;\n    this.retryable = false;\n    this.userMessage = '🤖 A assistente usa a BunnyFy e está temporariamente indisponível.';\n  }\n}\n\nexport function isRetryableNvidiaError() { return false; }\nexport function normalizeNvidiaError() { return new NvidiaApiError(); }\nexport async function requestNvidiaChat() { throw new NvidiaApiError(); }\n`);

  write(path.join(GYOMEI, 'dados/src/utils/nvidiaEmbedded.js'), `// Compatibilidade histórica: a credencial NVIDIA não existe mais no Gyomei.\nexport function resolveEmbeddedNvidiaKey() { return ''; }\n`);

  const storePath = path.join(GYOMEI, 'dados/src/utils/gyomeiStore.js');
  let store = fs.readFileSync(storePath, 'utf8');
  store = patchOnce(store, "    nvidia_api_key: process.env.NVIDIA_API_KEY || stored.nvidia_api_key || '',", "    nvidia_api_key: '',", 'gyomeiStore sem credencial NVIDIA');
  write(storePath, store);

  const finalizePath = path.join(GYOMEI, 'dados/src/.scripts/finalizeGyomeiRuntime.js');
  let finalize = fs.readFileSync(finalizePath, 'utf8');
  const finStart = finalize.indexOf('function externalizeIaKey(source) {');
  const finEnd = finalize.indexOf('\n\nexport function finalizeGyomeiRuntime()', finStart);
  if (finStart < 0 || finEnd < 0) {
    if (!finalize.includes('function validateBunnyFyOnlyIa(source)')) throw new Error('Bloco externalizeIaKey não localizado.');
  } else {
    const guard = `function validateBunnyFyOnlyIa(source) {\n  const forbidden = ['requestNvidiaChat(', 'getNvidiaApiKey(', 'resolveEmbeddedNvidiaKey', 'process.env.NVIDIA_API_KEY'];\n  for (const marker of forbidden) {\n    if (source.includes(marker)) throw new Error(\`Runtime IA ainda contém transporte NVIDIA direto: \${marker}\`);\n  }\n  if (!source.includes('createBunnyFyAiClient')) throw new Error('Runtime IA perdeu o gateway BunnyFy.');\n  return source;\n}`;
    finalize = `${finalize.slice(0, finStart)}${guard}${finalize.slice(finEnd)}`;
  }
  finalize = finalize.replace('runtimeIa = externalizeIaKey(runtimeIa);', 'runtimeIa = validateBunnyFyOnlyIa(runtimeIa);');
  write(finalizePath, finalize);

  const applyPath = path.join(GYOMEI, 'dados/src/.scripts/applyCriticalRuntimeFixes.js');
  let apply = fs.readFileSync(applyPath, 'utf8');
  const applyStart = apply.indexOf('function patchRuntimeIa(source) {');
  const applyEnd = apply.indexOf('\n\nexport function applyCriticalRuntimeFixes()', applyStart);
  if (applyStart < 0 || applyEnd < 0) {
    if (!apply.includes('function patchRuntimeIa(source)')) throw new Error('patchRuntimeIa não localizado.');
  } else {
    const replacement = `function patchRuntimeIa(source) {\n  const forbidden = ['requestNvidiaChat(', 'getNvidiaApiKey(', 'resolveEmbeddedNvidiaKey', 'process.env.NVIDIA_API_KEY'];\n  for (const marker of forbidden) {\n    if (source.includes(marker)) throw new Error(\`Correção crítica recusou transporte NVIDIA direto: \${marker}\`);\n  }\n  if (!source.includes('createBunnyFyAiClient')) throw new Error('Correção crítica não encontrou gateway BunnyFy na IA.');\n  return source;\n}`;
    apply = `${apply.slice(0, applyStart)}${replacement}${apply.slice(applyEnd)}`;
  }
  write(applyPath, apply);

  const validatorPath = path.join(GYOMEI, 'dados/src/.scripts/validateBunnyFyAiExclusive.js');
  write(validatorPath, `#!/usr/bin/env node\nimport fs from 'fs';\nimport path from 'path';\nimport { fileURLToPath } from 'url';\nconst __filename = fileURLToPath(import.meta.url);\nconst scripts = path.dirname(__filename);\nconst src = path.resolve(scripts, '..');\nconst read = rel => fs.readFileSync(path.join(src, rel), 'utf8');\nexport function validateNoDirectNvidiaRuntime() {\n  const iaPath = fs.existsSync(path.join(src, 'funcs/private/.runtime-ia.js')) ? 'funcs/private/.runtime-ia.js' : 'funcs/private/ia.js';\n  const ia = read(iaPath);\n  const api = read('utils/nvidiaApi.js');\n  const embedded = read('utils/nvidiaEmbedded.js');\n  const store = read('utils/gyomeiStore.js');\n  const failures = [];\n  for (const marker of ['requestNvidiaChat(', 'getNvidiaApiKey(', 'resolveEmbeddedNvidiaKey', 'process.env.NVIDIA_API_KEY']) if (ia.includes(marker)) failures.push(\`IA:\${marker}\`);\n  for (const marker of ['integrate.api.nvidia.com', "import axios from 'axios'", 'Authorization: `Bearer']) if (api.includes(marker)) failures.push(\`nvidiaApi:\${marker}\`);\n  for (const marker of ['CIPHER_BYTES', 'createHash', 'gyomei-nove-guardioes-selam-a-chave']) if (embedded.includes(marker)) failures.push(\`embedded:\${marker}\`);\n  for (const marker of ['process.env.NVIDIA_API_KEY', 'stored.nvidia_api_key']) if (store.includes(marker)) failures.push(\`store:\${marker}\`);\n  if (!ia.includes('createBunnyFyAiClient')) failures.push('IA:gateway BunnyFy ausente');\n  if (failures.length) throw new Error(\`Corte NVIDIA direto reprovado: \${failures.join(', ')}\`);\n  return true;\n}\nif (process.argv[1] && path.resolve(process.argv[1]) === __filename) {\n  validateNoDirectNvidiaRuntime();\n  console.log('✅ IA runtime BunnyFy-only: transporte NVIDIA direto indisponível.');\n}\n`);

  const startPath = path.join(GYOMEI, 'dados/src/.scripts/start-v9-fixed.js');
  let start = fs.readFileSync(startPath, 'utf8');
  start = patchOnce(start, "import { applyCriticalRuntimeFixes } from './applyCriticalRuntimeFixes.js';\n", "import { applyCriticalRuntimeFixes } from './applyCriticalRuntimeFixes.js';\nimport { validateNoDirectNvidiaRuntime } from './validateBunnyFyAiExclusive.js';\n", 'import guard IA');
  start = patchOnce(start, '  applyCriticalRuntimeFixes();\n  await import', '  applyCriticalRuntimeFixes();\n  validateNoDirectNvidiaRuntime();\n  await import', 'guard IA no startup');
  write(startPath, start);

  const criticalPath = path.join(GYOMEI, 'dados/src/.scripts/validate-critical-runtime.js');
  let critical = fs.readFileSync(criticalPath, 'utf8');
  critical = critical.replace("  [runtimeIa.includes('requestNvidiaChat'), 'cliente NVIDIA robusto carregado'],\n  [runtimeIa.includes('function getNvidiaApiKey()'), 'chave NVIDIA lida dinamicamente'],\n  [runtimeIa.includes('[NVIDIA] Erro na assistente'), 'log identifica NVIDIA corretamente'],", "  [runtimeIa.includes('createBunnyFyAiClient'), 'gateway BunnyFy carregado na IA'],\n  [!runtimeIa.includes('requestNvidiaChat('), 'runtime sem transporte NVIDIA direto'],\n  [!runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'runtime sem leitura de chave NVIDIA'],");
  write(criticalPath, critical);

  const releasePath = path.join(GYOMEI, 'dados/src/.scripts/validate-release-output.js');
  let release = fs.readFileSync(releasePath, 'utf8');
  release = release.replace("  assert(runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'chave NVIDIA vem do ambiente');\n", "  assert(runtimeIa.includes('createBunnyFyAiClient'), 'IA usa gateway BunnyFy');\n  assert(!runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'runtime não lê chave NVIDIA');\n  assert(!runtimeIa.includes('requestNvidiaChat('), 'runtime não possui transporte NVIDIA direto');\n");
  write(releasePath, release);

  const localPath = path.join(GYOMEI, 'dados/src/.scripts/validate-local.js');
  let local = fs.readFileSync(localPath, 'utf8');
  local = local.replace(/  const nvidiaKey = String\([\s\S]*?\n  \)\.trim\(\);\n/, '');
  local = local.replace(/\n  if \(isPlaceholder\(nvidiaKey\)\) \{[\s\S]*?\n  \}\n\n  if \(isPlaceholder\(vexKey\)/, '\n  ok(\'Credencial NVIDIA não pertence mais ao Gyomei; IA exige BunnyFy\');\n\n  if (isPlaceholder(vexKey)');
  local = local.replace("      [runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'Chave NVIDIA externalizada no runtime'],", "      [runtimeIa.includes('createBunnyFyAiClient'), 'IA usa gateway BunnyFy'],\n      [!runtimeIa.includes('process.env.NVIDIA_API_KEY'), 'Runtime não lê chave NVIDIA'],\n      [!runtimeIa.includes('requestNvidiaChat('), 'Runtime não possui transporte NVIDIA direto'],");
  write(localPath, local);

  const regressPath = path.join(GYOMEI, 'dados/src/.scripts/test-regressions.js');
  let regress = fs.readFileSync(regressPath, 'utf8');
  regress = regress.replace("import { requestNvidiaChat } from '../utils/nvidiaApi.js';\n", '');
  regress = regress.replace("  assert.ok(iaSource.includes('requestNvidiaChat'));", "  assert.ok(!iaSource.includes('requestNvidiaChat('));\n  assert.ok(iaSource.includes('createBunnyFyAiClient'));" );
  const oldTestsAt = regress.indexOf("await test('HTTP 410 da NVIDIA não é repetido três vezes'");
  const failuresAt = regress.indexOf('\nconst failures = results.filter', oldTestsAt);
  if (oldTestsAt >= 0 && failuresAt > oldTestsAt) {
    const newTest = `await test('transporte NVIDIA direto está neutralizado e segredo não existe no Gyomei', () => {\n  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');\n  const apiSource = fs.readFileSync(new URL('../utils/nvidiaApi.js', import.meta.url), 'utf8');\n  const embeddedSource = fs.readFileSync(new URL('../utils/nvidiaEmbedded.js', import.meta.url), 'utf8');\n  assert.ok(iaSource.includes('createBunnyFyAiClient'));\n  assert.ok(!iaSource.includes('requestNvidiaChat('));\n  assert.ok(!iaSource.includes('process.env.NVIDIA_API_KEY'));\n  assert.ok(!apiSource.includes('integrate.api.nvidia.com'));\n  assert.ok(!embeddedSource.includes('CIPHER_BYTES'));\n});\n`;
    regress = `${regress.slice(0, oldTestsAt)}${newTest}${regress.slice(failuresAt)}`;
  }
  write(regressPath, regress);

  const buildPath = path.join(GYOMEI, 'dados/src/.scripts/build-server.js');
  let build = fs.readFileSync(buildPath, 'utf8');
  const buildStart = build.indexOf('function secureIaDeclaration()');
  const buildEnd = build.indexOf('\n\nfunction resetJsonPreservingType', buildStart);
  if (buildStart >= 0 && buildEnd > buildStart) {
    const replacement = `function sanitizeBundleSource() {\n  const iaFile = path.join(bundleDir, 'dados', 'src', 'funcs', 'private', 'ia.js');\n  const apiFile = path.join(bundleDir, 'dados', 'src', 'utils', 'nvidiaApi.js');\n  const embeddedFile = path.join(bundleDir, 'dados', 'src', 'utils', 'nvidiaEmbedded.js');\n  const sources = [iaFile, apiFile, embeddedFile].filter(fs.existsSync).map(file => fs.readFileSync(file, 'utf8')).join('\\n');\n  if (/nvapi-[A-Za-z0-9_-]+/.test(sources)) throw new Error('A build contém credencial NVIDIA.');\n  if (sources.includes('integrate.api.nvidia.com')) throw new Error('A build contém endpoint NVIDIA direto.');\n  if (fs.existsSync(iaFile)) {\n    const iaSource = fs.readFileSync(iaFile, 'utf8');\n    if (iaSource.includes('requestNvidiaChat(') || iaSource.includes('process.env.NVIDIA_API_KEY')) throw new Error('A build contém caminho NVIDIA direto.');\n    if (!iaSource.includes('createBunnyFyAiClient')) throw new Error('A build não contém gateway BunnyFy.');\n  }\n  const configFile = path.join(bundleDir, 'dados', 'src', 'config.json');\n  if (fs.existsSync(configFile)) {\n    try {\n      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));\n      delete config.nvidia_api_key;\n      fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\\n');\n    } catch {}\n  }\n  const envFile = path.join(bundleDir, '.env.local');\n  if (fs.existsSync(envFile)) {\n    const clean = fs.readFileSync(envFile, 'utf8').split(/\\r?\\n/).filter(line => !/^\\s*NVIDIA_API_KEY\\s*=/.test(line)).join('\\n');\n    fs.writeFileSync(envFile, clean);\n  }\n}`;
    build = `${build.slice(0, buildStart)}${replacement}${build.slice(buildEnd)}`;
  }
  write(buildPath, build);

  const diagnose = `#!/usr/bin/env node\nimport { buildBoundedChatMessages, createBunnyFyAiClient } from '../services/bunnyfy/aiGateway.js';\ntry {\n  const client = createBunnyFyAiClient(process.env);\n  const messages = buildBoundedChatMessages({ text: 'Responda apenas OK.', history: [], systemPrompt: 'Teste de conectividade BunnyFy.' });\n  const result = await client.createChatCompletion(messages, { maxOutputTokens: 16, model: process.env.NVIDIA_MODEL || undefined });\n  console.log(JSON.stringify({ ok: Boolean(result?.text), source: 'bunnyfy', outputChars: String(result?.text || '').length }));\n} catch (error) {\n  console.error(JSON.stringify({ ok: false, source: 'bunnyfy', code: error?.code || 'BUNNYFY_AI_FAILED' }));\n  process.exitCode = 1;\n}\n`;
  write(path.join(GYOMEI, 'dados/src/.scripts/diagnose-nvidia.js'), diagnose);
  write(path.join(GYOMEI, 'dados/src/.scripts/test-assistant-live.js'), "await import('./diagnose-nvidia.js');\n");

  const packagePath = path.join(GYOMEI, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const key of ['validate:ci', 'validate:local', 'validate:deploy']) {
    const value = String(packageData.scripts?.[key] || '');
    if (value && !value.includes('validateBunnyFyAiExclusive.js')) {
      packageData.scripts[key] = value.replace(
        'node dados/src/.scripts/applyCriticalRuntimeFixes.js &&',
        'node dados/src/.scripts/applyCriticalRuntimeFixes.js && node dados/src/.scripts/validateBunnyFyAiExclusive.js &&'
      );
    }
  }
  write(packagePath, JSON.stringify(packageData, null, 2) + '\n');

  const envExamplePath = path.join(GYOMEI, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    let envExample = fs.readFileSync(envExamplePath, 'utf8');
    if (!envExample.includes('BUNNYFY_STICKERS_MODE=')) envExample += '\nBUNNYFY_STICKERS_MODE=off\n';
    write(envExamplePath, envExample);
  }

  const doc = path.join(GYOMEI, 'docs', 'RELEASE_BUN017_AI_EXCLUSIVE_LOGOS_20260812.md');
  write(doc, `# RELEASE Gyomei — BUN-017 + IA BunnyFy-only + menulogo — 2026-08-12\n\nEstado inicial: PREPARADO_PARA_ROLLOUT_CONTROLADO.\n\nBase: ${GYOMEI_RELEASE_BASE}.\n\nDecisões: stickers iniciam em primary; IA entra em exclusive somente após smoke BunnyFy com a credencial ativa do Gyomei migrada em memória; após o corte, NVIDIA_API_KEY e nvidia_api_key deixam de ser utilizáveis no Gyomei e nvidiaEmbedded vira tombstone; o startup valida que .runtime-ia.js permaneceu BunnyFy-only; os 20 comandos do menulogo são exercitados pelo adapter animatedLogoWithBunnyFy, mantendo modo primary para rollback controlado.\n\nNão restaurar transporte NVIDIA direto em rollback.\n`);

  run(GYOMEI, 'npm', ['run', 'validate:ci'], path.join(ART, 'gyomei-validate-ci.log'));
  git(GYOMEI, ['add', '.']);
  if (git(GYOMEI, ['status', '--porcelain'])) git(GYOMEI, ['commit', '-m', 'Cortar NVIDIA direto e preparar stickers via BunnyFy']);
  git(GYOMEI, ['push', 'origin', GYOMEI_BRANCH]);
  assertClean(GYOMEI, 'Gyomei pós-commit');
  const head = git(GYOMEI, ['rev-parse', 'HEAD']);
  log(`- Gyomei release code HEAD: \`${head}\``);
  return head;
}

function parseCredentialField(markdown, label) {
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^\\s*(?:[-*]\\s*)?${safe}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return (match?.[1] || '').trim().replace(/^`|`$/g, '');
}

function parseEnv(text) {
  const result = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    else if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
    }
    result[key] = String(value);
  }
  return result;
}

function setEnvValue(text, key, value) {
  const line = `${key}=${JSON.stringify(String(value))}`;
  const rx = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=.*$`, 'm');
  return rx.test(text) ? text.replace(rx, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
}

function removeEnvValue(text, key) {
  const rx = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=.*(?:\\r?\\n|$)`, 'gm');
  return text.replace(rx, '');
}

function deriveEmbeddedKey(source) {
  const seed = source.match(/const SEED = '([^']+)'/)?.[1];
  const bytesRaw = source.match(/const CIPHER_BYTES = \[([^\]]+)\]/)?.[1];
  if (!seed || !bytesRaw) return '';
  const bytes = bytesRaw.split(',').map(v => Number(v.trim())).filter(Number.isFinite);
  if (!bytes.length) return '';
  const out = Buffer.alloc(bytes.length);
  let offset = 0;
  let counter = 0;
  while (offset < bytes.length) {
    const block = crypto.createHash('sha256').update(`${seed}:${counter}`).digest();
    for (let i = 0; i < block.length && offset < bytes.length; i += 1, offset += 1) out[offset] = bytes[offset] ^ block[i];
    counter += 1;
  }
  return out.toString('utf8').trim();
}

function createPanelClient() {
  const credentials = fs.readFileSync(CRED, 'utf8');
  const panelBase = parseCredentialField(credentials, 'URL').replace(/\/+$/, '');
  const panelKey = parseCredentialField(credentials, 'Client API key');
  if (!panelBase || !panelKey) throw new Error('Credenciais Pterodactyl incompletas.');

  async function request(server, endpoint, { method = 'GET', json, raw, allowFailure = false } = {}) {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${panelKey}` };
    let body;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (raw !== undefined) { headers['Content-Type'] = 'application/octet-stream'; body = raw; }
    try {
      const response = await fetch(`${panelBase}/api/client/servers/${server}${endpoint}`, {
        method, headers, body, signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok && !allowFailure) throw new Error(`${server}${endpoint}: HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (allowFailure) return null;
      throw error;
    }
  }

  async function identity(server) {
    const response = await request(server, '');
    const body = await response.json();
    return body.attributes || body.data?.attributes || {};
  }

  async function list(server, directory) {
    const dir = directory === '.' ? '' : directory;
    const response = await request(server, `/files/list?directory=${encodeURIComponent('/' + dir)}`);
    const body = await response.json();
    return (body.data || []).map(item => item.attributes || item);
  }

  async function exists(server, relative) {
    const dir = path.posix.dirname(relative);
    const name = path.posix.basename(relative);
    return (await list(server, dir)).some(item => item.name === name);
  }

  async function read(server, relative) {
    if (!(await exists(server, relative))) return null;
    const response = await request(server, `/files/contents?file=${encodeURIComponent('/' + relative)}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async function writeRemote(server, relative, buffer) {
    const response = await request(server, `/files/write?file=${encodeURIComponent('/' + relative)}`, { method: 'POST', raw: buffer });
    if (response.status !== 204) throw new Error(`${server}:${relative}: write HTTP ${response.status}`);
  }

  async function remove(server, relative) {
    const dir = path.posix.dirname(relative);
    const name = path.posix.basename(relative);
    await request(server, '/files/delete', { method: 'POST', json: { root: '/' + (dir === '.' ? '' : dir), files: [name] } });
  }

  async function resources(server) {
    const response = await request(server, '/resources');
    const body = await response.json();
    return body.attributes || body.data?.attributes || {};
  }

  async function power(server, signal) {
    await request(server, '/power', { method: 'POST', json: { signal } });
  }

  async function restartSafe(server) {
    await power(server, 'stop');
    for (let i = 0; i < 90; i += 1) {
      const state = await resources(server);
      if (state.current_state === 'offline') {
        await power(server, 'start');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`${server}: offline não confirmado após stop.`);
  }

  async function lockedBackups(server) {
    const response = await request(server, '/backups');
    const body = await response.json();
    return (body.data || []).filter(item => item?.attributes?.is_locked === true).length;
  }

  return { request, identity, exists, read, writeRemote, remove, resources, restartSafe, lockedBackups };
}

async function waitBunnyReady(requiredStickers = false) {
  let last = '';
  for (let i = 0; i < 120; i += 1) {
    try {
      const h = await fetch(`${PUBLIC}/health`, { signal: AbortSignal.timeout(10_000) });
      const r = await fetch(`${PUBLIC}/ready`, { signal: AbortSignal.timeout(10_000) });
      if (h.status === 200 && r.status === 200) {
        const body = await r.json();
        const caps = body?.data?.checks?.capabilities || {};
        const tools = body?.data?.checks?.tools || {};
        if (caps.socialCanvas === true && caps.animatedLogos === true && caps.aiChat === true && (!requiredStickers || (caps.stickersStatic === true && caps.stickersAnimated === true && tools.ffprobe === true))) return body;
        last = JSON.stringify({ caps: { socialCanvas: caps.socialCanvas, animatedLogos: caps.animatedLogos, aiChat: caps.aiChat, stickersStatic: caps.stickersStatic, stickersAnimated: caps.stickersAnimated }, ffprobe: tools.ffprobe });
      } else last = `health=${h.status} ready=${r.status}`;
    } catch (error) { last = error?.message || String(error); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`BunnyFy não ficou pronta: ${last}`);
}

async function importSharp() {
  const req = createRequire(path.join(BUNNY, 'package.json'));
  const sharpPath = req.resolve('sharp');
  const mod = await import(pathToFileURL(sharpPath).href);
  return mod.default || mod;
}

async function deployAndSmoke(bunnyHead, gyomeiHead) {
  log('');
  log('## Fase 3 - preflight e rollout Pterodactyl');
  const p = createPanelClient();
  const bunnyId = await p.identity(BUNNY_SERVER);
  const gyomeiId = await p.identity(GYOMEI_SERVER);
  if (bunnyId.name !== 'BunnyFy' || bunnyId.identifier !== BUNNY_SERVER || bunnyId.uuid !== BUNNY_UUID) throw new Error('Identidade BunnyFy divergente.');
  if (gyomeiId.name !== 'Gyomei Nazuna' || gyomeiId.identifier !== GYOMEI_SERVER) throw new Error('Identidade Gyomei divergente.');
  if (/mendes/i.test(`${bunnyId.name} ${gyomeiId.name}`)) throw new Error('DENYLIST Mendes acionada.');
  const bunnyLocked = await p.lockedBackups(BUNNY_SERVER);
  const gyomeiLocked = await p.lockedBackups(GYOMEI_SERVER);
  if (bunnyLocked < 1 || gyomeiLocked < 1) throw new Error('Backup locked não confirmado nos dois alvos.');
  if (!(await p.exists(GYOMEI_SERVER, '.gyomei-pre-bunnyfy-v20b-rollback.tar.gz'))) throw new Error('Snapshot Gyomei pré-BunnyFy não encontrado.');
  log(`- identidades: BunnyFy=${bunnyId.identifier}, Gyomei=${gyomeiId.identifier}; Mendes fora do alvo.`);
  log(`- backups locked: BunnyFy=${bunnyLocked}, Gyomei=${gyomeiLocked}; snapshot Gyomei confirmado.`);

  const bunnyEnvBuf = await p.read(BUNNY_SERVER, '.env');
  const gyomeiEnvBuf = await p.read(GYOMEI_SERVER, '.env');
  const gyomeiConfigBuf = await p.read(GYOMEI_SERVER, 'dados/src/config.json');
  const remoteEmbeddedBuf = await p.read(GYOMEI_SERVER, 'dados/src/utils/nvidiaEmbedded.js');
  if (!bunnyEnvBuf || !gyomeiEnvBuf || !gyomeiConfigBuf) throw new Error('Não foi possível ler os arquivos privados necessários em memória.');
  const bunnyEnvOriginal = bunnyEnvBuf.toString('utf8');
  const gyomeiEnvOriginal = gyomeiEnvBuf.toString('utf8');
  const gyomeiConfigOriginal = gyomeiConfigBuf.toString('utf8');
  const bunnyEnvMap = parseEnv(bunnyEnvOriginal);
  const gyomeiEnvMap = parseEnv(gyomeiEnvOriginal);
  let gyomeiConfig = {};
  try { gyomeiConfig = JSON.parse(gyomeiConfigOriginal); } catch { throw new Error('config.json Gyomei inválido.'); }

  let activeKey = String(gyomeiEnvMap.NVIDIA_API_KEY || '').trim();
  let keySource = activeKey ? 'Gyomei .env' : '';
  if (!activeKey) { activeKey = String(gyomeiConfig.nvidia_api_key || '').trim(); if (activeKey) keySource = 'Gyomei config.json'; }
  if (!activeKey && remoteEmbeddedBuf) { activeKey = deriveEmbeddedKey(remoteEmbeddedBuf.toString('utf8')); if (activeKey) keySource = 'Gyomei embedded legado'; }
  if (activeKey.length < 16) throw new Error('A credencial NVIDIA ativa do Gyomei não pôde ser resolvida sem expô-la.');
  const candidateModel = String(gyomeiConfig.nvidia_model || '').trim();
  const existingBunnyModel = String(bunnyEnvMap.NVIDIA_MODEL || '').trim();
  const activeModel = NVIDIA_MODELS.includes(candidateModel) ? candidateModel : NVIDIA_MODELS.includes(existingBunnyModel) ? existingBunnyModel : 'meta/llama-3.1-70b-instruct';
  const allowedModels = [...new Set([...String(bunnyEnvMap.NVIDIA_ALLOWED_MODELS || '').split(',').map(v => v.trim()).filter(Boolean), ...NVIDIA_MODELS, activeModel])];
  log(`- credencial NVIDIA ativa resolvida em memória a partir de: ${keySource}; valor não registrado.`);
  log(`- modelo padrão BunnyFy após migração: \`${activeModel}\`; allowlist=${allowedModels.length} modelos.`);

  let apiKeys;
  try { apiKeys = JSON.parse(bunnyEnvMap.BUNNYFY_API_KEYS || '[]'); } catch { throw new Error('BUNNYFY_API_KEYS da BunnyFy é inválido.'); }
  const principal = Array.isArray(apiKeys) ? apiKeys.find(item => item?.id === 'gyomei-production') : null;
  if (!principal?.key) throw new Error('Chave privada gyomei-production não encontrada na BunnyFy.');
  principal.scopes = [...new Set([...(Array.isArray(principal.scopes) ? principal.scopes : []), 'ai:chat', 'stickers:write'])];
  const bunnyToken = principal.key;

  const bunnyPre = new Map();
  for (const rel of BUNNY_RUNTIME_FILES) bunnyPre.set(rel, { existed: await p.exists(BUNNY_SERVER, rel), buffer: await p.read(BUNNY_SERVER, rel) });
  const gyomeiDeployFiles = [...new Set([...GYOMEI_BUNNY_FILES, ...GYOMEI_AI_CUT_FILES])];
  const gyomeiPre = new Map();
  for (const rel of gyomeiDeployFiles) gyomeiPre.set(rel, { existed: await p.exists(GYOMEI_SERVER, rel), buffer: await p.read(GYOMEI_SERVER, rel) });

  let bunnyMutated = false;
  let gyomeiMutated = false;
  let aiCutCommitted = false;

  async function restoreMap(server, map) {
    for (const [rel, before] of map) {
      if (before.existed && before.buffer) await p.writeRemote(server, rel, before.buffer);
      else if (await p.exists(server, rel)) await p.remove(server, rel);
    }
  }

  async function rollback(error) {
    log('');
    log('## Rollback automático');
    log(`- motivo: ${String(error?.message || error).replace(/\n/g, ' ')}`);
    if (!aiCutCommitted) {
      if (gyomeiMutated) {
        await restoreMap(GYOMEI_SERVER, gyomeiPre);
        await p.writeRemote(GYOMEI_SERVER, '.env', Buffer.from(gyomeiEnvOriginal));
        await p.writeRemote(GYOMEI_SERVER, 'dados/src/config.json', Buffer.from(gyomeiConfigOriginal));
        await p.restartSafe(GYOMEI_SERVER);
        log('- Gyomei restaurado integralmente ao estado pré-lote.');
      }
      if (bunnyMutated) {
        await restoreMap(BUNNY_SERVER, bunnyPre);
        await p.writeRemote(BUNNY_SERVER, '.env', Buffer.from(bunnyEnvOriginal));
        await p.restartSafe(BUNNY_SERVER);
        await waitBunnyReady(false);
        log('- BunnyFy restaurada integralmente ao estado pré-lote.');
      }
      return;
    }
    // Depois do corte, NVIDIA direta nunca volta ao Gyomei.
    let safeEnv = (await p.read(GYOMEI_SERVER, '.env'))?.toString('utf8') || gyomeiEnvOriginal;
    safeEnv = setEnvValue(safeEnv, 'BUNNYFY_ENABLED', 'true');
    safeEnv = setEnvValue(safeEnv, 'BUNNYFY_AI_MODE', 'off');
    safeEnv = setEnvValue(safeEnv, 'BUNNYFY_STICKERS_MODE', 'off');
    safeEnv = removeEnvValue(safeEnv, 'NVIDIA_API_KEY');
    await p.writeRemote(GYOMEI_SERVER, '.env', Buffer.from(safeEnv));
    let safeConfig = JSON.parse((await p.read(GYOMEI_SERVER, 'dados/src/config.json')).toString('utf8'));
    safeConfig.nvidia_api_key = '';
    await p.writeRemote(GYOMEI_SERVER, 'dados/src/config.json', Buffer.from(JSON.stringify(safeConfig, null, 2) + '\n'));
    await p.restartSafe(GYOMEI_SERVER);
    log('- Pós-corte: IA e stickers colocados em off; segredo NVIDIA continua ausente do Gyomei. BunnyFy não foi revertida para transporte direto.');
  }

  try {
    log('');
    log('### 3.1 BunnyFy: código, escopos e segredo NVIDIA');
    for (const rel of BUNNY_RUNTIME_FILES) {
      const local = fs.readFileSync(path.join(BUNNY, rel));
      await p.writeRemote(BUNNY_SERVER, rel, local);
      const remote = await p.read(BUNNY_SERVER, rel);
      if (!remote || sha(remote) !== sha(local)) throw new Error(`BunnyFy hash divergiu: ${rel}`);
      log(`- ${rel}: SHA OK`);
    }
    let bunnyEnv = bunnyEnvOriginal;
    bunnyEnv = setEnvValue(bunnyEnv, 'AI_CHAT_ENABLED', 'true');
    bunnyEnv = setEnvValue(bunnyEnv, 'NVIDIA_API_KEY', activeKey);
    bunnyEnv = setEnvValue(bunnyEnv, 'NVIDIA_MODEL', activeModel);
    bunnyEnv = setEnvValue(bunnyEnv, 'NVIDIA_ALLOWED_MODELS', allowedModels.join(','));
    bunnyEnv = setEnvValue(bunnyEnv, 'BUNNYFY_API_KEYS', JSON.stringify(apiKeys));
    bunnyEnv = setEnvValue(bunnyEnv, 'FFPROBE_PATH', 'ffprobe');
    bunnyEnv = setEnvValue(bunnyEnv, 'STICKER_TIMEOUT_MS', '45000');
    bunnyEnv = setEnvValue(bunnyEnv, 'STICKER_MAX_CONCURRENCY', '1');
    bunnyEnv = setEnvValue(bunnyEnv, 'STICKER_MAX_DURATION_SECONDS', '10');
    await p.writeRemote(BUNNY_SERVER, '.env', Buffer.from(bunnyEnv));
    bunnyMutated = true;
    await p.restartSafe(BUNNY_SERVER);
    const ready = await waitBunnyReady(true);
    log(`- BunnyFy ready: aiChat=${ready.data.checks.capabilities.aiChat}, stickersStatic=${ready.data.checks.capabilities.stickersStatic}, stickersAnimated=${ready.data.checks.capabilities.stickersAnimated}, animatedLogos=${ready.data.checks.capabilities.animatedLogos}`);

    log('');
    log('### 3.2 Smoke Gyomei adapters -> BunnyFy');
    const adapterEnv = {
      BUNNYFY_ENABLED: 'true',
      BUNNYFY_BASE_URL: PUBLIC,
      BUNNYFY_API_TOKEN: bunnyToken,
      BUNNYFY_ALLOW_INSECURE_HTTP: 'true',
      BUNNYFY_AI_MODE: 'exclusive',
      BUNNYFY_STICKERS_MODE: 'exclusive',
      BUNNYFY_LOGOS_MODE: 'exclusive',
      BUNNYFY_AI_TIMEOUT_MS: '130000',
      BUNNYFY_CAPABILITY_TIMEOUT_MS: '120000'
    };
    const aiGateway = await import(pathToFileURL(path.join(GYOMEI, 'dados/src/services/bunnyfy/aiGateway.js')).href + `?v=${Date.now()}`);
    const capability = await import(pathToFileURL(path.join(GYOMEI, 'dados/src/services/bunnyfy/capabilityGateway.js')).href + `?v=${Date.now()}`);
    const aiClient = aiGateway.createBunnyFyAiClient(adapterEnv);
    const aiStarted = performance.now();
    const aiResult = await aiClient.createChatCompletion([{ role: 'user', content: 'Responda apenas OK.' }], { model: activeModel, maxOutputTokens: 16 });
    if (!String(aiResult?.text || '').trim()) throw new Error('Smoke IA BunnyFy retornou texto vazio.');
    log(`- IA Gyomei adapter -> BunnyFy -> NVIDIA: OK em ${Math.round(performance.now() - aiStarted)}ms; conteúdo não registrado.`);

    const sharp = await importSharp();
    const staticPng = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#6f4ca5' } }).png().toBuffer();
    const staticStarted = performance.now();
    const staticSticker = await capability.stickerWithBunnyFy(staticPng, { kind: 'static', mime: 'image/png', env: adapterEnv, legacyFallback: async () => { throw new Error('fallback proibido no smoke'); } });
    const staticMeta = await sharp(staticSticker.buffer).metadata();
    if (staticMeta.format !== 'webp' || staticMeta.width !== 512 || staticMeta.height !== 512) throw new Error('Sticker estático inválido.');
    fs.writeFileSync(path.join(SMOKE, 'sticker-static.webp'), staticSticker.buffer);
    log(`- sticker static Gyomei adapter: OK ${Math.round(performance.now() - staticStarted)}ms`);

    const canvasStarted = performance.now();
    const canvasSticker = await capability.stickerCanvasWithBunnyFy({ template: 'badge', text: 'GYOMEI', title: 'BunnyFy', footer: 'Media in. Power out.', theme: 'midnight' }, { env: adapterEnv, legacyFallback: async () => { throw new Error('fallback proibido no smoke'); } });
    const canvasMeta = await sharp(canvasSticker.buffer).metadata();
    if (canvasMeta.format !== 'webp' || canvasMeta.width !== 512 || canvasMeta.height !== 512) throw new Error('Sticker Canvas inválido.');
    fs.writeFileSync(path.join(SMOKE, 'sticker-canvas.webp'), canvasSticker.buffer);
    log(`- sticker Canvas Gyomei adapter: OK ${Math.round(performance.now() - canvasStarted)}ms`);

    let firstLogoBuffer = null;
    for (const model of [...LOGO_ONE, ...LOGO_TWO]) {
      const texts = LOGO_ONE.includes(model) ? ['GYOMEI'] : ['GYOMEI', 'BUNNYFY'];
      const started = performance.now();
      const result = await capability.animatedLogoWithBunnyFy(model, texts, { env: adapterEnv, legacyFallback: async () => { throw new Error('fallback proibido no smoke'); } });
      if (!Buffer.isBuffer(result?.buffer) || result.buffer.length < 1000 || result.mime !== 'video/mp4') throw new Error(`Logo ${model} inválida.`);
      if (!firstLogoBuffer) firstLogoBuffer = result.buffer;
      log(`- menulogo ${model}: BunnyFy OK ${Math.round(performance.now() - started)}ms, ${result.buffer.length} bytes`);
    }
    if (!firstLogoBuffer) throw new Error('Nenhum logo produzido para sticker animado.');
    fs.writeFileSync(path.join(SMOKE, 'logo-sample.mp4'), firstLogoBuffer);
    const animatedStarted = performance.now();
    const animatedSticker = await capability.stickerWithBunnyFy(firstLogoBuffer, { kind: 'animated', mime: 'video/mp4', env: adapterEnv, legacyFallback: async () => { throw new Error('fallback proibido no smoke'); } });
    const animatedMeta = await sharp(animatedSticker.buffer, { animated: true }).metadata();
    if (animatedMeta.format !== 'webp' || animatedMeta.width !== 512 || animatedMeta.height !== 512) throw new Error('Sticker animado inválido.');
    fs.writeFileSync(path.join(SMOKE, 'sticker-animated.webp'), animatedSticker.buffer);
    log(`- sticker animated Gyomei adapter: OK ${Math.round(performance.now() - animatedStarted)}ms`);
    log('- menu logos: 20/20 modelos exercitados sem fallback legado.');

    log('');
    log('### 3.3 Gyomei: upload do source versionado antes do corte');
    for (const rel of gyomeiDeployFiles) {
      const local = fs.readFileSync(path.join(GYOMEI, rel));
      await p.writeRemote(GYOMEI_SERVER, rel, local);
      const remote = await p.read(GYOMEI_SERVER, rel);
      if (!remote || sha(remote) !== sha(local)) throw new Error(`Gyomei hash divergiu: ${rel}`);
    }
    gyomeiMutated = true;
    const verifier = spawnSync('npm', ['run', 'verify:server:bunnyfy', '--', `--server=${GYOMEI_SERVER}`, `--credentials=${CRED}`], { cwd: GYOMEI, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(ART, 'gyomei-remote-verifier-pre-restart.log'), `${verifier.stdout || ''}${verifier.stderr || ''}`);
    if (verifier.status !== 0) throw new Error('Remote verifier Gyomei reprovou após upload; corte não executado.');
    log('- remote verifier Gyomei: GREEN antes do restart.');

    for (const rel of ['dados/src/funcs/private/ia.js','dados/src/utils/nvidiaApi.js','dados/src/utils/nvidiaEmbedded.js','dados/src/utils/gyomeiStore.js']) {
      const remote = (await p.read(GYOMEI_SERVER, rel)).toString('utf8');
      if (rel.endsWith('/ia.js') && (remote.includes('requestNvidiaChat(') || remote.includes('process.env.NVIDIA_API_KEY'))) throw new Error('Gyomei source IA ainda contém caminho direto.');
      if (rel.endsWith('/nvidiaApi.js') && remote.includes('integrate.api.nvidia.com')) throw new Error('Gyomei nvidiaApi ainda contém endpoint direto.');
      if (rel.endsWith('/nvidiaEmbedded.js') && remote.includes('CIPHER_BYTES')) throw new Error('Gyomei embedded ainda contém credencial reconstruível.');
    }
    log('- gate source NVIDIA direto: removido/inutilizado antes do corte de segredo.');

    log('');
    log('### 3.4 Corte irreversível de segredo no Gyomei');
    let gyomeiEnv = gyomeiEnvOriginal;
    gyomeiEnv = setEnvValue(gyomeiEnv, 'BUNNYFY_ENABLED', 'true');
    gyomeiEnv = setEnvValue(gyomeiEnv, 'BUNNYFY_ALLOW_INSECURE_HTTP', 'true');
    gyomeiEnv = setEnvValue(gyomeiEnv, 'BUNNYFY_BASE_URL', PUBLIC);
    gyomeiEnv = setEnvValue(gyomeiEnv, 'BUNNYFY_AI_MODE', 'exclusive');
    gyomeiEnv = setEnvValue(gyomeiEnv, 'BUNNYFY_STICKERS_MODE', 'primary');
    gyomeiEnv = setEnvValue(gyomeiEnv, 'BUNNYFY_LOGOS_MODE', 'primary');
    gyomeiEnv = removeEnvValue(gyomeiEnv, 'NVIDIA_API_KEY');
    await p.writeRemote(GYOMEI_SERVER, '.env', Buffer.from(gyomeiEnv));
    gyomeiConfig.nvidia_api_key = '';
    await p.writeRemote(GYOMEI_SERVER, 'dados/src/config.json', Buffer.from(JSON.stringify(gyomeiConfig, null, 2) + '\n'));
    aiCutCommitted = true;
    log('- NVIDIA_API_KEY removida do .env Gyomei e nvidia_api_key neutralizada no config; valores nunca registrados.');
    log('- modos: AI=exclusive, STICKERS=primary, LOGOS=primary.');

    await p.restartSafe(GYOMEI_SERVER);
    await new Promise(resolve => setTimeout(resolve, 12_000));
    const gyRes = await p.resources(GYOMEI_SERVER);
    if (gyRes.current_state === 'offline') throw new Error('Gyomei ficou offline após restart.');
    log(`- Gyomei pós-restart: state=${gyRes.current_state}, memory_bytes=${gyRes.resources?.memory_bytes ?? gyRes.memory_bytes ?? 'n/a'}.`);

    const runtimeIaBuf = await p.read(GYOMEI_SERVER, 'dados/src/funcs/private/.runtime-ia.js');
    const runtimeIndexBuf = await p.read(GYOMEI_SERVER, 'dados/src/.runtime-index.js');
    if (!runtimeIaBuf || !runtimeIndexBuf) throw new Error('Runtimes gerados não foram encontrados após startup.');
    const runtimeIa = runtimeIaBuf.toString('utf8');
    const runtimeIndex = runtimeIndexBuf.toString('utf8');
    if (!runtimeIa.includes('createBunnyFyAiClient') || runtimeIa.includes('requestNvidiaChat(') || runtimeIa.includes('process.env.NVIDIA_API_KEY')) throw new Error('Runtime IA pós-start não está BunnyFy-only.');
    if (!runtimeIndex.includes('stickerWithBunnyFy') || !runtimeIndex.includes('animatedLogoWithBunnyFy')) throw new Error('Runtime index pós-start não contém gateways stickers/logos esperados.');
    const remoteEnvAfter = parseEnv((await p.read(GYOMEI_SERVER, '.env')).toString('utf8'));
    if (remoteEnvAfter.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY reapareceu no Gyomei após startup.');
    if (remoteEnvAfter.BUNNYFY_AI_MODE !== 'exclusive' || remoteEnvAfter.BUNNYFY_STICKERS_MODE !== 'primary' || remoteEnvAfter.BUNNYFY_LOGOS_MODE !== 'primary') throw new Error('Modos BunnyFy pós-start divergentes.');
    log('- runtime gerado pós-start: IA BunnyFy-only; sticker/logo gateways presentes; segredo NVIDIA não reapareceu.');

    const verifierAfter = spawnSync('npm', ['run', 'verify:server:bunnyfy', '--', `--server=${GYOMEI_SERVER}`, `--credentials=${CRED}`], { cwd: GYOMEI, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(ART, 'gyomei-remote-verifier-post-restart.log'), `${verifierAfter.stdout || ''}${verifierAfter.stderr || ''}`);
    if (verifierAfter.status !== 0) throw new Error('Remote verifier Gyomei reprovou após restart.');
    log('- remote verifier Gyomei: GREEN após restart.');

    const adapterAiAfter = aiGateway.createBunnyFyAiClient(adapterEnv);
    const finalAi = await adapterAiAfter.createChatCompletion([{ role: 'user', content: 'Responda apenas OK.' }], { model: activeModel, maxOutputTokens: 16 });
    if (!String(finalAi?.text || '').trim()) throw new Error('Smoke final IA gateway equivalente falhou.');
    log('- smoke final gateway equivalente Gyomei -> BunnyFy -> NVIDIA: GREEN; resposta não registrada.');

    log('');
    log('## Resultado operacional');
    log('- Estado: PRODUCAO_APROVADA_COMBINADA.');
    log(`- BunnyFy runtime source commit: \`${bunnyHead}\`.`);
    log(`- Gyomei runtime source commit: \`${gyomeiHead}\`.`);
    log('- Stickers: static + animated + Canvas GREEN; produção Gyomei em primary.');
    log('- IA: Gyomei exclusive -> BunnyFy -> NVIDIA GREEN; chave NVIDIA somente BunnyFy.');
    log('- Menulogo: 20/20 modelos GREEN via adapter BunnyFy; produção permanece primary para rollback controlado.');
    log('- Sem merge em main. Mendes não acessado. Sessão/DBs/backups não alterados.');
    return { ok: true, bunnyHead, gyomeiHead };
  } catch (error) {
    await rollback(error);
    throw error;
  }
}

function appendFinalDocs(result) {
  const bunnyDoc = path.join(BUNNY, 'docs', 'RELEASE_BUN017_AI_LOGOS_20260812.md');
  fs.appendFileSync(bunnyDoc, `\n## Rollout final\n\nEstado: PRODUCAO_APROVADA_COMBINADA.\n\nCommit de código implantado: ${result.bunnyHead}.\n\nStickes readiness e smokes static/animated/Canvas verdes; IA BunnyFy usa a credencial que estava ativa no Gyomei sem registrar o segredo; 20/20 modelos do menulogo foram exercitados pelo adapter Gyomei em modo exclusive de smoke. O modo de produção de logos permanece primary.\n`);
  git(BUNNY, ['add', bunnyDoc]);
  if (git(BUNNY, ['status', '--porcelain'])) git(BUNNY, ['commit', '-m', 'Registrar rollout combinado em produção']);
  git(BUNNY, ['push', 'origin', BUNNY_BRANCH]);
  const bunnyDocHead = git(BUNNY, ['rev-parse', 'HEAD']);

  const gyomeiDoc = path.join(GYOMEI, 'docs', 'RELEASE_BUN017_AI_EXCLUSIVE_LOGOS_20260812.md');
  fs.appendFileSync(gyomeiDoc, `\n## Rollout final\n\nEstado: PRODUCAO_APROVADA_COMBINADA.\n\nCommit de código implantado: ${result.gyomeiHead}.\n\nAI=exclusive, STICKERS=primary, LOGOS=primary. NVIDIA_API_KEY foi removida do ambiente Gyomei e nvidia_api_key neutralizada; runtime pós-start foi verificado sem transporte direto. 20/20 menulogos e os três tipos de sticker passaram por adapter BunnyFy.\n`);
  git(GYOMEI, ['add', gyomeiDoc]);
  if (git(GYOMEI, ['status', '--porcelain'])) git(GYOMEI, ['commit', '-m', 'Registrar corte IA e stickers em produção']);
  git(GYOMEI, ['push', 'origin', GYOMEI_BRANCH]);
  const gyomeiDocHead = git(GYOMEI, ['rev-parse', 'HEAD']);
  log(`- BunnyFy documentation HEAD: \`${bunnyDocHead}\` (runtime permanece ${result.bunnyHead}).`);
  log(`- Gyomei documentation HEAD: \`${gyomeiDocHead}\` (runtime permanece ${result.gyomeiHead}).`);
}

async function packageArtifact() {
  const archive = `${ART}.tar.gz`;
  const result = spawnSync('tar', ['-C', path.dirname(ART), '-czf', archive, path.basename(ART)], { encoding: 'utf8' });
  if (result.status !== 0) console.error(`Falha ao compactar report: ${result.stderr || result.stdout}`);
  console.log('');
  console.log('============================================================');
  console.log(' RELEASE BUN-017 + IA + LOGOS ENCERRADA');
  console.log('============================================================');
  console.log(`REPORT=${REPORT}`);
  console.log(`PACOTE=${archive}`);
  console.log('O terminal permanece aberto. Anexe o .tar.gz ao chat.');
}

let failed = null;
try {
  log(`Data: ${new Date().toISOString()}`);
  log('Natureza: rollout mutável controlado em BunnyFy e Gyomei; Client API somente; sem SFTP; sem merge main.');
  log('Segredos: processados apenas em memória; report não registra chave NVIDIA, token BunnyFy, API_KEYS ou signing secret.');
  const bunnyHead = patchBunnySource();
  const gyomeiHead = patchGyomeiSource();
  const result = await deployAndSmoke(bunnyHead, gyomeiHead);
  appendFinalDocs(result);
} catch (error) {
  failed = error;
  log('');
  log('## FALHA DO ROLLOUT');
  log(`- ${String(error?.message || error).replace(/\n/g, ' ')}`);
  log('- Não declarar produção aprovada sem revisar este report.');
  process.exitCode = 1;
} finally {
  await packageArtifact();
}
