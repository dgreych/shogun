#!/usr/bin/env node

import { loadLocalEnv } from './envLoader.js';
import { prepareRuntimeSources } from './prepareRuntimeSources.js';
import { finalizeGyomeiRuntime } from './finalizeGyomeiRuntime.js';

try {
  const envResult = loadLocalEnv();
  if (envResult.exists && envResult.loaded.length > 0) {
    console.log(`🔐 Ambiente local carregado (${envResult.loaded.length} variável(is)).`);
  }

  prepareRuntimeSources();
  finalizeGyomeiRuntime();
  await import('./.runtime-start.js');
} catch (error) {
  console.error(`❌ Falha ao preparar o NAZUNA BOT — versão modificada GYOMEI: ${error.message}`);
  process.exit(1);
}
