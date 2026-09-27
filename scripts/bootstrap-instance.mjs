import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareMediaTools } from './media-tools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function dependenciesReady(root) {
  const require = createRequire(path.join(root, 'package.json'));
  try { for (const name of ['baileys', 'mysql2', 'sql.js', 'jimp']) require.resolve(name); return true; }
  catch { return false; }
}

function run(command, args, root, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`A preparação terminou com código ${code}.`)));
  });
}

export async function bootstrapInstance(options = {}) {
  const root = options.root ?? ROOT;
  const execute = options.run ?? run;
  if (!(options.dependenciesReady ?? dependenciesReady)(root)) {
    const npmCli = options.npmCli ?? process.env.npm_execpath;
    if (!npmCli) throw new Error('Inicie a instalação com npm start.');
    console.log('📦 Instalando as dependências do Shogun. A primeira instalação pode levar alguns minutos.');
    const index = Number(process.env.GIT_CONFIG_COUNT ?? 0);
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('A configuração temporária do Git está inválida.');
    const installEnv = {
      ...process.env,
      GIT_CONFIG_COUNT: String(index + 1),
      [`GIT_CONFIG_KEY_${index}`]: 'url.https://github.com/.insteadOf',
      [`GIT_CONFIG_VALUE_${index}`]: 'ssh://git@github.com/',
    };
    await execute(process.execPath, [npmCli, 'ci', '--no-audit', '--no-fund'], root, installEnv);
  }
  (options.prepareMediaTools ?? prepareMediaTools)({ root });
  const file = path.join(root, 'dados', 'src', 'config.json');
  let configured = false;
  if (fs.existsSync(file)) {
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    configured = /^\d{10,15}$/.test(String(current.numerodono ?? '').replace(/\D/g, '')) && Boolean(String(current.nomebot ?? '').trim());
  }
  if (!configured) await execute(process.execPath, [path.join(root, 'dados', 'src', '.scripts', 'config-panel.js')], root);
}
