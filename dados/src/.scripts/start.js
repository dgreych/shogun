#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline/promises';
import os from 'os';

const CONFIG_PATH = path.join(process.cwd(), 'dados', 'src', 'config.json');
const NODE_MODULES_PATH = path.join(process.cwd(), 'node_modules');
const QR_CODE_DIR = path.join(process.cwd(), 'dados', 'database', 'qr-code');
const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', 'connect.js');
const isWindows = os.platform() === 'win32';
const isTermux = fsSync.existsSync('/data/data/com.termux');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[1;32m',
  red: '\x1b[1;31m',
  blue: '\x1b[1;34m',
  yellow: '\x1b[1;33m',
  cyan: '\x1b[1;36m',
  bold: '\x1b[1m',
};

const mensagem = (text) => console.log(`${colors.green}${text}${colors.reset}`);
const aviso = (text) => console.log(`${colors.red}${text}${colors.reset}`);
const info = (text) => console.log(`${colors.cyan}${text}${colors.reset}`);
const separador = () => console.log(`${colors.blue}============================================${colors.reset}`);

const getVersion = () => {
  try {
    const packageJson = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return packageJson.version || 'Desconhecida';
  } catch {
    return 'Desconhecida';
  }
};

let botProcess = null;
const version = getVersion();

async function showTermuxGuidance() {
  if (!isTermux) return;
  info('📱 Termux detectado. Para manter a patrulha acordada, use termux-wake-lock.');
  info('📖 A inicialização no Android fica em docs/instalacao/termux.md.');
}

function setupGracefulShutdown() {
  const shutdown = () => {
    mensagem('🛑 Encerrando o SHOGUN. Até a próxima patrulha!');
    if (botProcess) {
      botProcess.removeAllListeners();
      botProcess.kill();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (isWindows) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on('SIGINT', shutdown);
  }
}

async function displayHeader() {
  const header = [
    `${colors.bold}⛩️ SHOGUN — Conexão WhatsApp${colors.reset}`,
    `${colors.bold}📦 Versão: ${version}${colors.reset}`,
  ];

  separador();
  for (const line of header) {
    console.log(line);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  separador();
  console.log();
}

async function checkPrerequisites() {
  if (!fsSync.existsSync(CONFIG_PATH)) {
    aviso('⚠️ Arquivo de configuração (config.json) não encontrado! Iniciando configuração automática...');
    try {
      await new Promise((resolve, reject) => {
        const configProcess = spawn('npm', ['run', 'config'], { stdio: 'inherit', shell: isWindows });
        configProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Configuração falhou com código ${code}`))));
        configProcess.on('error', reject);
      });
      mensagem('📝 Configuração concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na configuração: ${error.message}`);
      mensagem('📝 Tente executar manualmente: npm run config');
      process.exit(1);
    }
  }

  if (!fsSync.existsSync(NODE_MODULES_PATH)) {
    aviso('⚠️ Módulos do Node.js não encontrados! Iniciando instalação automática...');
    try {
      await new Promise((resolve, reject) => {
        const installProcess = spawn('npm', ['run', 'config:install'], { stdio: 'inherit', shell: isWindows });
        installProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Instalação falhou com código ${code}`))));
        installProcess.on('error', reject);
      });
      mensagem('📦 Instalação dos módulos concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na instalação dos módulos: ${error.message}`);
      mensagem('📦 Tente executar manualmente: npm run config:install');
      process.exit(1);
    }
  }

  if (!fsSync.existsSync(CONNECT_FILE)) {
    aviso(`⚠️ Arquivo de conexão (${CONNECT_FILE}) não encontrado!`);
    aviso('🔍 Verifique a instalação do projeto.');
    process.exit(1);
  }
}

function startBot(codeMode = false) {
  const args = ['--expose-gc', CONNECT_FILE];
  if (codeMode) args.push('--code');

  info(`📷 Iniciando com ${codeMode ? 'código de pareamento' : 'QR Code'}`);

  botProcess = spawn('node', args, {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  botProcess.on('error', (error) => {
    aviso(`❌ Erro ao iniciar o processo do bot: ${error.message}`);
    restartBot(codeMode);
  });

  botProcess.on('close', (code) => {
    if (code === 0) {
      info(`✅ O bot terminou normalmente (código: ${code}). Reiniciando...`);
    } else {
      aviso(`⚠️ O bot terminou com erro (código: ${code}). Reiniciando...`);
    }
    restartBot(codeMode);
  });

  return botProcess;
}

function restartBot(codeMode) {
  aviso('🔄 Reiniciando o bot em 500ms...');
  setTimeout(() => {
    if (botProcess) botProcess.removeAllListeners();
    startBot(codeMode);
  }, 500);
}

async function checkAutoConnect() {
  try {
    if (!fsSync.existsSync(QR_CODE_DIR)) {
      await fs.mkdir(QR_CODE_DIR, { recursive: true });
      return false;
    }
    const files = await fs.readdir(QR_CODE_DIR);
    return files.length > 2;
  } catch (error) {
    aviso(`❌ Erro ao verificar diretório de QR Code: ${error.message}`);
    return false;
  }
}

async function promptConnectionMethod() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`${colors.yellow}🔧 Escolha o método de conexão:${colors.reset}`);
  console.log(`${colors.yellow}1. 📷 Conectar via QR Code${colors.reset}`);
  console.log(`${colors.yellow}2. 🔑 Conectar via código de pareamento${colors.reset}`);
  console.log(`${colors.yellow}3. 🚪 Sair${colors.reset}`);

  const answer = await rl.question('➡️ Digite o número da opção desejada: ');
  console.log();
  rl.close();

  switch (answer.trim()) {
    case '1':
      mensagem('📷 Iniciando conexão via QR Code...');
      return { method: 'qr' };
    case '2':
      mensagem('🔑 Iniciando conexão via código de pareamento...');
      return { method: 'code' };
    case '3':
      mensagem('👋 Encerrando... Até mais!');
      process.exit(0);
    default:
      aviso('⚠️ Opção inválida! Usando conexão via QR Code como padrão.');
      return { method: 'qr' };
  }
}

async function main() {
  try {
    setupGracefulShutdown();
    await displayHeader();
    await checkPrerequisites();
    await showTermuxGuidance();

    const hasSession = await checkAutoConnect();
    if (hasSession) {
      mensagem('📷 Sessão de QR Code detectada. Conectando automaticamente...');
      startBot(false);
    } else {
      const { method } = await promptConnectionMethod();
      startBot(method === 'code');
    }
  } catch (error) {
    aviso(`❌ Erro inesperado: ${error.message}`);
    process.exit(1);
  }
}

(async () => {
  await main();
})();
