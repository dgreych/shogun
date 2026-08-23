#!/usr/bin/env node

import path from 'path';

import { loadLocalEnv } from './envLoader.js';
import { adquirirTravaDeSessao } from './sessionLock.js';
import { prepareRuntimeSources } from './prepareRuntimeSources.js';
import { finalizeShogunRuntime } from './finalizeShogunRuntime.js';
import { applyCriticalRuntimeFixes } from './applyCriticalRuntimeFixes.js';

try {
  const envResult = loadLocalEnv();
  if (envResult.exists && envResult.loaded.length > 0) {
    console.log(`🔐 Ambiente local carregado (${envResult.loaded.length} variável(is)).`);
  }

  adquirirTravaDeSessao(path.join(process.cwd(), 'dados', 'database', 'qr-code'));

  prepareRuntimeSources();
  finalizeShogunRuntime();
  applyCriticalRuntimeFixes();
  await import('./.runtime-start.js');
} catch (error) {
  if (error.code === 'SESSAO_EM_USO') {
    console.error(`⛔ ${error.message}`);
    process.exit(1);
  }
  console.error(`❌ Falha ao preparar o runtime do bot: ${error.message}`);
  process.exit(1);
}
