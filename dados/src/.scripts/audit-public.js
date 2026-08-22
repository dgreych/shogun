#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { ROOT_DIR } from './envLoader.js';

const failures = [];
let passed = 0;

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe'
  });
}

function ok(message) {
  passed += 1;
  console.log(`✅ ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`❌ ${message}`);
}

console.log('\n🔐 Auditoria da árvore destinada à publicação pública\n');

const tree = run('git', ['ls-files']);
if (tree.status !== 0) {
  fail('Não foi possível ler a árvore Git atual.');
} else {
  const files = tree.stdout.split(/\r?\n/).filter(Boolean);
  const forbidden = files.filter(file =>
    file === '.env.local'
    || file === '.env'
    || file.startsWith('dados/database/qr-code/')
    || file.startsWith('dist/')
    // Documentos de continuidade falam de agente, sessão e contextualização —
    // são vestígio direto da ferramenta que os escreveu. O cabeçalho "não
    // publicar" que vários deles trazem é aviso para humano, não trava.
    || /ORIENTACOES[-_]PARA[-_]O[-_]AGENTE/i.test(file)
    || /^AGENTS\.md$/i.test(file)
    || /^docs\/(HANDOFF|CHECKPOINT|RETOMADA|INCIDENTE|SESSAO|COMECE_AQUI)/i.test(file)
  );

    // Segunda trava, independente de lista: qualquer arquivo que se declare
  // privado no próprio conteúdo não pode estar rastreado. Assim um documento
  // novo nasce protegido sem ninguém lembrar de atualizar a lista acima.
  const marcados = [];
  for (const file of files) {
    if (!/\.(md|txt)$/i.test(file)) continue;
    let cabecalho = '';
    try { cabecalho = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8').slice(0, 600); } catch { continue; }
    if (/n[aã]o publicar|documento operacional privado|INTERNO —|INTERNO --/i.test(cabecalho)) {
      marcados.push(file);
    }
  }
  if (marcados.length) {
    fail(`Documentos declarados privados estão rastreados: ${marcados.join(', ')}`);
  }

if (forbidden.length) {
    fail(`Arquivos privados rastreados: ${forbidden.join(', ')}`);
  } else {
    ok('Nenhum ambiente local, sessão ou artefato de deploy está rastreado');
  }
}

const secretSearch = run('git', [
  'grep', '--cached', '-I', '-n', '-E',
  'nvapi-[A-Za-z0-9_-]+|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|refresh_token["=: ]|client_secret["=: ]',
  '--',
  ':!node_modules/**',
  ':!README.md',
  ':!DEPLOY.md',
  ':!.env.example',
  ':!dados/src/.scripts/audit-public.js',
  ':!dados/src/.scripts/validate-local.js'
]);

if (secretSearch.status === 0 && secretSearch.stdout.trim()) {
  const findings = secretSearch.stdout.trim().split(/\r?\n/);
  fail(`Possíveis segredos encontrados em ${findings.length} ocorrência(s).`);
  for (const finding of findings.slice(0, 10)) {
    console.error(`   ${finding.replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-[REDACTED]')}`);
  }
} else if (secretSearch.status === 1) {
  ok('Nenhum padrão conhecido de segredo foi encontrado na árvore atual');
} else {
  fail(`A busca de segredos falhou: ${(secretSearch.stderr || '').trim()}`);
}

const trackedConfig = run('git', ['ls-files', '--error-unmatch', 'dados/src/config.json']);
if (trackedConfig.status === 0) {
  fail('dados/src/config.json é local e não pode estar versionado.');
} else {
  ok('config.json local não está versionado');
}

let configExample = '';
try { configExample = fs.readFileSync(path.join(ROOT_DIR, 'dados/src/config.example.json'), 'utf8'); } catch {}
if (!configExample) {
  fail('Não foi possível ler o config.example.json versionado.');
} else {
  try {
    const config = JSON.parse(configExample);
    const serialized = JSON.stringify(config);
    const hasRealOwner = /^\d{10,15}$/.test(String(config.numerodono || '').replace(/\D/g, ''));
    const hasCredential = /nvapi-|apikey[^\n]{0,20}[A-Za-z0-9_-]{20,}/i.test(serialized);

    hasRealOwner
      ? fail('O config.example.json parece conter um número real de dono.')
      : ok('O config.example.json usa identidade neutra');

    hasCredential
      ? fail('O config.example.json parece conter uma credencial real.')
      : ok('O config.example.json não aparenta conter credenciais reais');
  } catch (error) {
    fail(`O config.example.json é inválido: ${error.message}`);
  }
}

console.log(`\nAprovados: ${passed}`);
console.log(`Falhas: ${failures.length}`);

if (failures.length) {
  console.log('\n🚫 Publicação bloqueada. Revogue credenciais e limpe a árvore e o histórico antes de abrir o repositório.');
  process.exit(1);
}

console.log('\n✅ A árvore atual passou na auditoria pública. O histórico Git ainda deve ser analisado separadamente.');
