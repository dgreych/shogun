#!/usr/bin/env node

import { loadLocalEnv } from './envLoader.js';
import { prepareRuntimeSources } from './prepareRuntimeSources.js';
import { finalizeShogunRuntime } from './finalizeShogunRuntime.js';

try {
  const envResult = loadLocalEnv();
  if (envResult.exists && envResult.loaded.length > 0) {
    console.log(`🔐 Ambiente local carregado (${envResult.loaded.length} variável(is)).`);
  }

  prepareRuntimeSources();
  finalizeShogunRuntime();
  await import('./.runtime-start.js');
} catch (error) {
  console.error(`❌ Falha ao preparar o runtime do bot: ${error.message}`);
  process.exit(1);
}
