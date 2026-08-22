#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

const ROOT_DIR = process.cwd();
const CONFIG_FILE = path.join(ROOT_DIR, 'dados', 'src', 'config.json');
const EXAMPLE_FILE = path.join(ROOT_DIR, 'dados', 'src', 'config.example.json');
const isWindows = process.platform === 'win32';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} terminou com código ${code}`)));
  });
}

async function installDependencies() {
  console.log('\n📦 Instalando as dependências do SHOGUN de forma reproduzível...\n');
  await run(isWindows ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], {
    env: {
      ...process.env,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
      GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
    },
  });
  console.log('\n✅ Dependências prontas. Nenhum pacote do sistema foi alterado.');
  console.log('   Confira Git, Node.js e FFmpeg com: npm run preflight\n');
}

function ask(rl, label, current, validate = () => true) {
  return new Promise((resolve) => {
    const next = () => {
      rl.question(`${label}${current ? ` [${current}]` : ''}: `, (answer) => {
        const value = answer.trim() || current;
        if (validate(value)) resolve(value);
        else { console.log('⚠️ Valor inválido. Tente novamente.'); next(); }
      });
    };
    next();
  });
}

async function readInitialConfig() {
  for (const file of [CONFIG_FILE, EXAMPLE_FILE]) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  }
  return { nomebot: 'SHOGUN', prefixo: '!', nomedono: '', numerodono: '' };
}

async function configure() {
  console.log('\n⛩️  Quartel de configuração do SHOGUN\n');
  const config = await readInitialConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    config.nomedono = await ask(rl, 'Como o SHOGUN deve chamar você?', config.nomedono || 'Comandante');
    config.numerodono = await ask(rl, 'Seu número com país e DDD, somente dígitos', config.numerodono || '', (value) => /^\d{10,15}$/.test(value));
    config.nomebot = await ask(rl, 'Nome do bot', config.nomebot || 'SHOGUN');
    config.prefixo = await ask(rl, 'Prefixo de comando', config.prefixo || '!', (value) => value.length === 1);
  } finally { rl.close(); }

  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  if (!isWindows) await fs.chmod(CONFIG_FILE, 0o600);
  console.log('\n✅ Configuração local salva. Ela está protegida pelo .gitignore.');
  console.log('🛡️  Próximo passo: npm start\n');
}

async function main() {
  if (process.argv.includes('--install')) return installDependencies();
  if (fsSync.existsSync(CONFIG_FILE)) console.log('ℹ️ Pressione Enter para manter cada valor atual.');
  await configure();
}

main().catch((error) => {
  console.error(`\n❌ Não foi possível preparar o SHOGUN: ${error.message}\n`);
  process.exitCode = 1;
});
