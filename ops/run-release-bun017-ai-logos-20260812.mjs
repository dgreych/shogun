#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const home = os.homedir();
const source = process.env.BUN017_OP_SOURCE;

function run(command, args, cwd = undefined) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function normalizeRemote(value) {
  return String(value || '')
    .trim()
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

function discoverGitRepos() {
  const roots = [path.join(home, 'Downloads'), path.join(home, 'whatsapp-bot')]
    .filter(dir => fs.existsSync(dir));
  const repos = [];

  for (const root of roots) {
    const found = run('find', [root, '-maxdepth', '5', '-name', '.git', '-print0']);
    if (found.status !== 0) continue;
    for (const gitEntry of String(found.stdout || '').split('\0').filter(Boolean)) {
      const repo = path.dirname(gitEntry);
      const remote = run('git', ['remote', 'get-url', 'origin'], repo);
      if (remote.status !== 0) continue;
      const branch = run('git', ['branch', '--show-current'], repo);
      const status = run('git', ['status', '--porcelain'], repo);
      repos.push({
        repo,
        remote: normalizeRemote(remote.stdout),
        branch: String(branch.stdout || '').trim(),
        clean: status.status === 0 && !String(status.stdout || '').trim()
      });
    }
  }
  return repos;
}

function selectRepo(repos, expectedRemote, kind) {
  const expected = normalizeRemote(expectedRemote);
  const candidates = repos.filter(item => item.remote === expected && item.clean);
  if (!candidates.length) {
    throw new Error(`${kind}: nenhum checkout limpo encontrado para ${expectedRemote}.`);
  }

  const score = item => {
    const base = path.basename(item.repo);
    let points = 0;
    if (item.branch === 'release/gyomei-bun017-ai-exclusive-logos-20260812' || item.branch === 'release/bun017-ai-cut-logos-20260812') points += 100;
    if (kind === 'Gyomei' && item.branch === 'reconcile/gyomei-20260810') points += 80;
    if (kind === 'BunnyFy' && item.branch === 'feature/bun-018a-visual-rollout-20260812') points += 80;
    if (kind === 'BunnyFy' && /^feature\/bun-018/.test(item.branch)) points += 70;
    if (kind === 'Gyomei' && base === 'reconcile-gyomei-20260810') points += 50;
    if (kind === 'BunnyFy' && base === 'BunnyFy-logos') points += 50;
    if (fs.existsSync(path.join(item.repo, 'package.json'))) points += 10;
    return points;
  };

  const ranked = candidates.map(item => ({ ...item, score: score(item) })).sort((a, b) => b.score - a.score);
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    throw new Error(`${kind}: múltiplos checkouts limpos igualmente válidos: ${ranked.filter(item => item.score === ranked[0].score).map(item => item.repo).join(', ')}`);
  }
  return ranked[0];
}

if (!source || !fs.existsSync(source)) {
  console.error('BUN017_OP_SOURCE não aponta para o executor extraído do remoto.');
  process.exitCode = 1;
} else {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..+/, '');
  const pre = path.join(home, 'Downloads', `BUN-017-AI-LOGOS-PRECHECK-${ts}`);
  fs.mkdirSync(pre, { recursive: true });
  const report = path.join(pre, 'REPORT.md');
  const patched = path.join(pre, 'release-patched.mjs');

  try {
    const repos = discoverGitRepos();
    const gyomei = selectRepo(repos, 'https://github.com/dgreych/nazuna-gyomei', 'Gyomei');
    const bunny = selectRepo(repos, 'https://github.com/dgreych/BunnyFy', 'BunnyFy');

    let text = fs.readFileSync(source, 'utf8');

    text = text.replace(
      "const BUNNY = path.join(HOME, 'Downloads', 'BunnyFy-logos');",
      `const BUNNY = ${JSON.stringify(bunny.repo)};`
    );
    text = text.replace(
      "const GYOMEI = path.join(HOME, 'Downloads', 'reconcile-gyomei-20260810');",
      `const GYOMEI = ${JSON.stringify(gyomei.repo)};`
    );
    text = text.replace("'Authorization: `Bearer'", "'Authorization:'");
    text = text.replace(
      "git(BUNNY, ['add', '.']);",
      "git(BUNNY, ['add', 'src/app.ts', 'src/config.ts', 'src/lib/stickers.ts', 'src/routes/health.ts', 'src/routes/stickers.ts', '.env.example', 'tests/helpers/testApp.ts', ...addedTests, 'docs/RELEASE_BUN017_AI_LOGOS_20260812.md']);"
    );
    text = text.replace(
      "git(GYOMEI, ['add', '.']);",
      "git(GYOMEI, ['add', ...GYOMEI_AI_CUT_FILES, '.env.example', 'docs/RELEASE_BUN017_AI_EXCLUSIVE_LOGOS_20260812.md']);"
    );

    const requiredPatches = [
      [`const BUNNY = ${JSON.stringify(bunny.repo)};`, 'caminho BunnyFy descoberto'],
      [`const GYOMEI = ${JSON.stringify(gyomei.repo)};`, 'caminho Gyomei descoberto'],
      ["'Authorization:'", 'marcador Authorization sanitizado'],
      ["git(BUNNY, ['add', 'src/app.ts'", 'staging BunnyFy restrito'],
      ["git(GYOMEI, ['add', ...GYOMEI_AI_CUT_FILES", 'staging Gyomei restrito']
    ];
    for (const [marker, label] of requiredPatches) {
      if (!text.includes(marker)) throw new Error(`Launcher não conseguiu aplicar: ${label}.`);
    }

    fs.writeFileSync(patched, text);

    const check = spawnSync(process.execPath, ['--check', patched], { encoding: 'utf8' });
    if (check.status !== 0) {
      fs.writeFileSync(report, [
        '# PRECHECK — rollout BUN-017 + IA + logos',
        '',
        'Estado: `BLOQUEADO_ANTES_DE_MUTACAO`.',
        '',
        `Gyomei selecionado: ${gyomei.repo}`,
        `BunnyFy selecionada: ${bunny.repo}`,
        '',
        'O executor não passou em `node --check`. Nenhuma operação de Git de projeto ou Pterodactyl foi iniciada.',
        '',
        '```text',
        String(check.stderr || check.stdout || '').trim(),
        '```',
        ''
      ].join('\n'));
      const archive = `${pre}.tar.gz`;
      spawnSync('tar', ['-C', path.dirname(pre), '-czf', archive, path.basename(pre)], { encoding: 'utf8' });
      console.error('PRECHECK=BLOQUEADO');
      console.error(`REPORT=${report}`);
      console.error(`PACOTE=${archive}`);
      process.exitCode = 1;
    } else {
      fs.writeFileSync(report, [
        '# PRECHECK — rollout BUN-017 + IA + logos',
        '',
        'Estado: `SINTAXE_APROVADA`.',
        '',
        `Gyomei selecionado: ${gyomei.repo}`,
        `Gyomei branch antes do executor: ${gyomei.branch || '(detached)'}`,
        `BunnyFy selecionada: ${bunny.repo}`,
        `BunnyFy branch antes do executor: ${bunny.branch || '(detached)'}`,
        '',
        '- checkouts localizados pelo remote GitHub, não pelo nome da pasta;',
        '- somente checkouts limpos foram elegíveis;',
        '- executor extraído do remoto;',
        '- correção determinística do marcador de Authorization aplicada;',
        '- staging Git restrito a manifests explícitos;',
        '- `node --check` aprovado;',
        '- nenhum segredo foi registrado.',
        ''
      ].join('\n'));
      console.log(`GYOMEI_ROOT=${gyomei.repo}`);
      console.log(`BUNNYFY_ROOT=${bunny.repo}`);
      console.log('PRECHECK=SINTAXE_APROVADA');
      const childEnv = { ...process.env, GYOMEI_RELEASE_ROOT: gyomei.repo, BUNNYFY_RELEASE_ROOT: bunny.repo };
      const runResult = spawnSync(process.execPath, [patched], { stdio: 'inherit', env: childEnv });
      process.exitCode = runResult.status ?? 1;
    }
  } catch (error) {
    fs.writeFileSync(report, [
      '# PRECHECK — rollout BUN-017 + IA + logos',
      '',
      'Estado: `BLOQUEADO_ANTES_DE_MUTACAO`.',
      '',
      String(error?.message || error),
      '',
      'Nenhuma operação do executor foi iniciada.',
      ''
    ].join('\n'));
    const archive = `${pre}.tar.gz`;
    spawnSync('tar', ['-C', path.dirname(pre), '-czf', archive, path.basename(pre)], { encoding: 'utf8' });
    console.error('PRECHECK=BLOQUEADO');
    console.error(`REPORT=${report}`);
    console.error(`PACOTE=${archive}`);
    process.exitCode = 1;
  }
}
