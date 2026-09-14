#!/usr/bin/env node

import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  BUNNYFY_MODE_KEYS,
  ROOT_DIR,
  loadEnvDocument,
  loadInstanceConfig,
  normalizeOwnerNumber,
  saveEnvUpdates,
  saveInstanceConfig,
  secretState,
  validateEnvUpdates,
  validateIdentity
} from './instanceConfigStore.js';

const rl = readline.createInterface({ input, output });
const BASIC_SETUP = process.argv.includes('--basic');

const MODE_LABELS = Object.freeze({
  BUNNYFY_AI_MODE: 'Assistente / IA',
  BUNNYFY_YOUTUBE_MODE: 'YouTube',
  BUNNYFY_IMAGES_MODE: 'Tratamento de imagens',
  BUNNYFY_STICKERS_MODE: 'Figurinhas',
  BUNNYFY_CANVAS_MODE: 'Cards e canvas',
  BUNNYFY_LOGOS_MODE: 'Logos animadas',
  BUNNYFY_TRANSCRIPTION_MODE: 'Transcrição',
  BUNNYFY_FACEBOOK_MODE: 'Downloads do Facebook',
  BUNNYFY_PINTEREST_MODE: 'Pinterest',
  BUNNYFY_TIKTOK_MODE: 'Downloads do TikTok',
  BUNNYFY_KWAI_MODE: 'Downloads do Kwai',
  BUNNYFY_GAMES_MODE: 'Jogos servidos pela API',
  BUNNYFY_IMAGE_GEN_MODE: 'Geração de imagem',
  BUNNYFY_TAVERN_RENDER_MODE: 'Renderização Tavern',
  BUNNYFY_NEXO_RENDER_MODE: 'Renderização NEXO'
});

const KNOWN_PERSONAS = ['shogun', 'alaska', 'gyomei', 'nazuna', 'tanjiro', 'zenitsu', 'inosuke', 'shinobu'];

function clear() {
  if (output.isTTY) output.write('\x1Bc');
}

function title(text) {
  output.write(`\n⛩️  ${text}\n${'─'.repeat(Math.max(18, text.length + 4))}\n`);
}

function envValue(draft, key, fallback = '') {
  return Object.hasOwn(draft, key) ? String(draft[key] ?? '') : fallback;
}

function yes(value) {
  return ['1', 'true', 'yes', 'sim', 's', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function printHeader(subtitle) {
  clear();
  output.write('\n╭──────────────────────────────────────────────────────────────╮\n');
  output.write('│                SHOGUN · QUARTEL DE CONFIGURAÇÃO             │\n');
  output.write('├──────────────────────────────────────────────────────────────┤\n');
  output.write(`│ ${subtitle.padEnd(60, ' ')} │\n`);
  output.write('╰──────────────────────────────────────────────────────────────╯\n');
}

async function askText(label, current = '', { required = false, normalize = value => value, validate = null } = {}) {
  while (true) {
    const suffix = current ? ` [${current}]` : '';
    const answer = (await rl.question(`${label}${suffix}: `)).trim();
    const value = normalize(answer || current);
    if (required && !String(value).trim()) {
      output.write('  ⚠️ Este campo é obrigatório.\n');
      continue;
    }
    const problem = validate?.(value);
    if (problem) {
      output.write(`  ⚠️ ${problem}\n`);
      continue;
    }
    return value;
  }
}

async function askYesNo(label, current = false) {
  const marker = current ? 'S/n' : 's/N';
  while (true) {
    const answer = (await rl.question(`${label} [${marker}]: `)).trim().toLowerCase();
    if (!answer) return current;
    if (['s', 'sim', 'y', 'yes'].includes(answer)) return true;
    if (['n', 'nao', 'não', 'no'].includes(answer)) return false;
    output.write('  ⚠️ Responda s ou n.\n');
  }
}

async function askChoice(label, choices, currentIndex = 0) {
  output.write(`\n${label}\n`);
  choices.forEach((choice, index) => output.write(`  ${index + 1}. ${choice}\n`));
  while (true) {
    const answer = (await rl.question(`Escolha [${currentIndex + 1}]: `)).trim();
    if (!answer) return currentIndex;
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && index >= 0 && index < choices.length) return index;
    output.write('  ⚠️ Opção inválida.\n');
  }
}

async function askSecret(label, current = '') {
  output.write(`${label} [${secretState(current)}]\n`);
  output.write('  Enter mantém • - remove • novo valor substitui: ');
  let answer = '';
  try {
    if (output.isTTY) output.write('\x1b[8m');
    answer = await rl.question('');
  } finally {
    if (output.isTTY) output.write('\x1b[0m');
    output.write('\n');
  }
  if (answer === '-') return '';
  if (!answer) return current;
  return answer.trim();
}

async function editBasicIdentity(config, envDraft) {
  title('Configuração inicial');

  const ownerCurrent = config.nomedono === 'Comandante' ? '' : config.nomedono;
  const normalizedCurrentNumber = normalizeOwnerNumber(config.numerodono);
  const numberCurrent = /^\d{10,15}$/.test(normalizedCurrentNumber) ? normalizedCurrentNumber : '';

  config.nomedono = await askText('Como o SHOGUN deve chamar você?', ownerCurrent, { required: true });
  config.numerodono = await askText('Seu número com país e DDD (somente dígitos)', numberCurrent, {
    required: true,
    normalize: normalizeOwnerNumber,
    validate: value => /^\d{10,15}$/.test(value) ? null : 'Use entre 10 e 15 dígitos.'
  });
  config.nomebot = await askText('Nome do bot', config.nomebot || 'SHOGUN', { required: true });
  config.prefixo = await askText('Prefixo de comando', config.prefixo || '!', {
    required: true,
    validate: value => String(value).length === 1 ? null : 'Use exatamente um caractere.'
  });

  envDraft.DEFAULT_PERSONA = 'shogun';
  envDraft.BOT_NAME = config.nomebot;
}

async function runBasicSetup(config, envDraft) {
  printHeader('Primeiro uso: só o necessário para ligar o bot.');
  output.write('\nVocê responderá quatro perguntas. Integrações avançadas ficam para depois.\n');
  output.write('A persona padrão desta instalação será shogun.\n');

  await editBasicIdentity(config, envDraft);

  const failures = validateIdentity(config);
  if (failures.length) throw new Error(failures.join(' '));

  saveInstanceConfig(config);
  saveEnvUpdates({
    DEFAULT_PERSONA: 'shogun',
    BOT_NAME: config.nomebot
  });

  output.write('\n✅ Configuração local salva.\n');
  output.write('✅ Persona padrão: shogun.\n');
  output.write('ℹ️ BunnyFy, NVIDIA e integrações legadas não são necessárias para o primeiro uso.\n');
  output.write('ℹ️ Para configuração avançada, use: npm run config\n');
}

async function editIdentity(config, envDraft) {
  title('Identidade da instância');
  config.nomedono = await askText('Nome do dono principal', config.nomedono, { required: true });
  config.numerodono = await askText('Número do dono (país + DDD + número)', config.numerodono, {
    required: true,
    normalize: normalizeOwnerNumber,
    validate: value => /^\d{10,15}$/.test(value) ? null : 'Use entre 10 e 15 dígitos.'
  });
  config.nomebot = await askText('Nome desta instalação', config.nomebot, { required: true });
  config.prefixo = await askText('Prefixo de comandos', config.prefixo, {
    required: true,
    validate: value => String(value).length === 1 ? null : 'Use exatamente um caractere.'
  });

  const currentPersona = envValue(envDraft, 'DEFAULT_PERSONA', 'shogun').toLowerCase();
  const personaChoices = [...KNOWN_PERSONAS, 'outra (digitar)'];
  const currentPersonaIndex = Math.max(0, KNOWN_PERSONAS.indexOf(currentPersona));
  const personaIndex = await askChoice('Persona padrão', personaChoices, currentPersonaIndex);
  envDraft.DEFAULT_PERSONA = personaIndex === personaChoices.length - 1
    ? await askText('Identificador da persona', currentPersona, { required: true })
    : personaChoices[personaIndex];
  envDraft.BOT_NAME = config.nomebot;
}

async function editBunnyFy(envDraft) {
  title('Integração BunnyFy');
  output.write('A BunnyFy é um serviço separado. Esta instalação recebe somente URL e credencial de consumidor.\n');
  output.write('Chaves internas dos provedores da API não pertencem ao SHOGUN.\n\n');

  const enabled = await askYesNo('Usar BunnyFy nesta instância?', yes(envValue(envDraft, 'BUNNYFY_ENABLED', 'false')));
  envDraft.BUNNYFY_ENABLED = enabled ? 'true' : 'false';
  if (!enabled) {
    output.write('ℹ️ BunnyFy ficará desligada. Os modos foram preservados para uma reativação futura.\n');
    return;
  }

  envDraft.BUNNYFY_BASE_URL = await askText('URL da BunnyFy', envValue(envDraft, 'BUNNYFY_BASE_URL'), {
    required: true,
    validate: value => {
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? null : 'Use uma URL http ou https.';
      } catch {
        return 'URL inválida.';
      }
    }
  });
  envDraft.BUNNYFY_API_TOKEN = await askSecret('Credencial BunnyFy do consumidor', envValue(envDraft, 'BUNNYFY_API_TOKEN'));
  envDraft.BUNNYFY_ALLOW_INSECURE_HTTP = (await askYesNo(
    'Permitir HTTP sem TLS? Use apenas em loopback/laboratório controlado',
    yes(envValue(envDraft, 'BUNNYFY_ALLOW_INSECURE_HTTP', 'false'))
  )) ? 'true' : 'false';

  const action = await askChoice('Como deseja configurar as capacidades?', [
    'Manter os modos atuais',
    'Configurar cada capacidade',
    'Desligar todas as capacidades BunnyFy'
  ], 0);

  if (action === 2) {
    for (const key of BUNNYFY_MODE_KEYS) envDraft[key] = 'off';
    return;
  }
  if (action !== 1) return;

  for (const key of BUNNYFY_MODE_KEYS) {
    const current = envValue(envDraft, key, 'off').toLowerCase();
    const currentIndex = Math.max(0, ['off', 'primary', 'exclusive'].indexOf(current));
    const mode = await askChoice(MODE_LABELS[key] || key, [
      'off — não usar BunnyFy',
      'primary — BunnyFy primeiro; fallback quando o recurso permitir',
      'exclusive — somente BunnyFy'
    ], currentIndex);
    envDraft[key] = ['off', 'primary', 'exclusive'][mode];
  }
}

async function editDirectProviders(envDraft) {
  title('Integrações diretas e compatibilidade');
  output.write('Essas credenciais são opcionais. Deixe em branco quando a BunnyFy assumir a capacidade.\n\n');
  envDraft.NVIDIA_API_KEY = await askSecret('NVIDIA direta', envValue(envDraft, 'NVIDIA_API_KEY'));

  const uploadEnabled = await askYesNo(
    'Usar upload GitHub legado?',
    Boolean(envValue(envDraft, 'UPLOAD_GITHUB_TOKEN') || envValue(envDraft, 'UPLOAD_GITHUB_REPO'))
  );
  if (uploadEnabled) {
    envDraft.UPLOAD_GITHUB_REPO = await askText('Repositório de upload (owner/repo)', envValue(envDraft, 'UPLOAD_GITHUB_REPO'), { required: true });
    envDraft.UPLOAD_GITHUB_TOKEN = await askSecret('Token de upload', envValue(envDraft, 'UPLOAD_GITHUB_TOKEN'));
  } else {
    envDraft.UPLOAD_GITHUB_REPO = '';
    envDraft.UPLOAD_GITHUB_TOKEN = '';
  }
}

function showReview(config, envDraft) {
  title('Revisão segura');
  const identityFailures = validateIdentity(config);
  const envFailures = validateEnvUpdates(envDraft);
  output.write(`Dono principal: ${config.nomedono || 'não configurado'}\n`);
  output.write(`Número do dono: ${normalizeOwnerNumber(config.numerodono) ? 'configurado' : 'não configurado'}\n`);
  output.write(`Nome do bot: ${config.nomebot || 'não configurado'}\n`);
  output.write(`Prefixo: ${config.prefixo || 'não configurado'}\n`);
  output.write(`Persona padrão: ${envValue(envDraft, 'DEFAULT_PERSONA', 'shogun')}\n`);
  output.write(`BunnyFy: ${yes(envValue(envDraft, 'BUNNYFY_ENABLED')) ? 'ativa' : 'desativada'}\n`);
  output.write(`Credencial BunnyFy: ${secretState(envValue(envDraft, 'BUNNYFY_API_TOKEN'))}\n`);
  output.write(`NVIDIA direta: ${secretState(envValue(envDraft, 'NVIDIA_API_KEY'))}\n`);
  output.write(`Upload GitHub legado: ${secretState(envValue(envDraft, 'UPLOAD_GITHUB_TOKEN'))}\n`);

  const activeModes = BUNNYFY_MODE_KEYS
    .filter(key => envValue(envDraft, key, 'off') !== 'off')
    .map(key => `${MODE_LABELS[key] || key}: ${envValue(envDraft, key, 'off')}`);
  output.write(`Capacidades BunnyFy ativas: ${activeModes.length || 0}\n`);
  for (const line of activeModes) output.write(`  • ${line}\n`);

  const failures = [...identityFailures, ...envFailures];
  if (failures.length) {
    output.write('\n🚫 Pendências:\n');
    failures.forEach(problem => output.write(`  • ${problem}\n`));
  } else {
    output.write('\n✅ Configuração pronta para ser salva. Nenhum segredo foi exibido.\n');
  }
  return failures;
}

function runPreflight() {
  title('Diagnóstico pós-configuração');
  const preflightPath = path.join(ROOT_DIR, 'scripts', 'preflight-platform.mjs');
  const result = spawnSync(process.execPath, [preflightPath], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: process.env
  });
  return result.status ?? 1;
}

async function main() {
  const config = loadInstanceConfig();
  const envDocument = loadEnvDocument();
  const envDraft = Object.fromEntries(envDocument.values);

  if (BASIC_SETUP) {
    await runBasicSetup(config, envDraft);
    return;
  }

  printHeader('Configuração avançada: integrações e ajustes opcionais.');
  output.write('\nUse este painel depois do primeiro uso quando precisar de BunnyFy, NVIDIA ou compatibilidade legada.\n');

  let dirty = false;
  while (true) {
    const choice = await askChoice('Painel avançado', [
      'Identidade, dono e persona',
      'BunnyFy e capacidades',
      'NVIDIA e integrações legadas',
      'Revisar configuração sem revelar segredos',
      'Salvar configuração',
      'Salvar e executar diagnóstico',
      'Sair sem salvar'
    ], 0);

    if (choice === 0) {
      await editIdentity(config, envDraft);
      dirty = true;
    } else if (choice === 1) {
      await editBunnyFy(envDraft);
      dirty = true;
    } else if (choice === 2) {
      await editDirectProviders(envDraft);
      dirty = true;
    } else if (choice === 3) {
      showReview(config, envDraft);
    } else if (choice === 4 || choice === 5) {
      const failures = showReview(config, envDraft);
      if (failures.length) continue;
      saveInstanceConfig(config);
      saveEnvUpdates(envDraft);
      dirty = false;
      output.write('\n✅ Configuração salva em arquivos privados locais com permissões restritas.\n');
      if (choice === 5) runPreflight();
    } else {
      if (dirty) {
        const exit = await askYesNo('Há alterações não salvas. Sair mesmo assim?', false);
        if (!exit) continue;
      }
      break;
    }
  }
}

main()
  .catch(error => {
    output.write(`\n❌ O painel não conseguiu concluir: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
