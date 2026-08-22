import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

import { analyzeRuntimeCommandSurface } from '../../scripts/analyze-runtime-command-surface.mjs';
import { deriveVNextOwnershipMetrics } from '../../scripts/vnext-ownership-metrics.mjs';

const manifest = JSON.parse(fs.readFileSync('.github/deploy/refactor-active-manifest.json', 'utf8'));
const finalizeSource = fs.readFileSync('dados/src/.scripts/finalizeGyomeiRuntime.js', 'utf8');
const bridgeSource = fs.readFileSync('dados/src/.scripts/vnextMacrotrancheBridge.js', 'utf8');
const deploySource = fs.readFileSync('scripts/deploy-refactor-active-direct.mjs', 'utf8');
const fastRunnerSource = fs.readFileSync('scripts/run-deploy-refactor-active-fast.mjs', 'utf8');
const qualifySource = fs.readFileSync('scripts/qualify-refactor-safe.sh', 'utf8');
const promoteSource = fs.readFileSync('scripts/promote-refactor-active-safe.sh', 'utf8');
const parallelPromoteSource = fs.readFileSync('scripts/promote-refactor-parallel-safe.sh', 'utf8');
const controllerSource = fs.readFileSync('scripts/refactor-control-safe.sh', 'utf8');

test('manifesto ativo registra ownership real e inclui contratos runtime do cutover por domínio', () => {
  const metrics = deriveVNextOwnershipMetrics();

  assert.equal(manifest.role, 'gyomei-refactor-active');
  assert.equal(manifest.repository, 'dgreych/shogun-core');
  assert.equal(manifest.branch, 'refactor/gyomei-ts-modular-20260817');
  assert.equal(manifest.server.identifier, 'd56f3096');
  assert.equal(manifest.inheritFilesFrom, '.github/deploy/refactor-parallel-manifest.json');
  assert.deepEqual(manifest.files, [
    'dados/src/.scripts/finalizeGyomeiRuntime.js',
    'dados/src/.scripts/prepareRuntimeSources.js',
    'dados/src/.scripts/start.js',
    'dados/src/.scripts/vnextDomainCutoverPlan.json',
    'dados/src/.scripts/vnextDomainOwnershipOverlay.js',
    'dados/src/.scripts/vnextMacrotrancheBridge.js',
    'dados/src/.scripts/vnextMacrotrancheSeeds.json',
    'dados/src/.scripts/vnextMembersDomainScope.json',
    'dados/src/connect.js',
    'dados/src/core/messageQueue.js',
    'dados/src/funcs/downloads/pinterest.js',
    'dados/src/funcs/private/ia.js',
    'dados/src/index.js',
    'dados/src/services/bunnyfy/BunnyFyClient.js',
    'dados/src/services/bunnyfy/capabilityGateway.js',
    'dados/src/services/bunnyfy/contracts.js',
    'dados/src/utils/gyomeiCore.js',
  ]);
  assert.deepEqual(manifest.generatedRoots, ['dist-vnext']);
  assert.equal(manifest.runtimeProof.path, 'dados/src/.runtime-index.js');
  assert.equal(manifest.runtimeProof.marker, 'executeLegacyOwnedCommand: __gyomeiExecuteMacrotrancheLegacy');
  assert.equal(manifest.runtimeProof.entrypoint, 'dist-vnext/runtime/legacy-switch-hook.js');

  assert.equal(manifest.ownership.strategy, 'accepted-base-plus-full-known-surface');
  assert.equal(manifest.ownership.acceptedBaseFamilies, 19);
  assert.equal(manifest.ownership.acceptedBaseTokens, 381);
  assert.equal(manifest.ownership.macroFamilies, 526);
  assert.equal(manifest.ownership.macroTokens, 1280);
  assert.equal(manifest.ownership.nativeFamilies, metrics.nativeFamilies);
  assert.equal(manifest.ownership.nativeTokens, metrics.nativeTokens);
  assert.equal(manifest.ownership.compatibilityFamilies, metrics.compatibilityFamilies);
  assert.equal(manifest.ownership.compatibilityTokens, metrics.compatibilityTokens);
  assert.equal(manifest.ownership.totalFamilies, metrics.legacyFamilies);
  assert.equal(manifest.ownership.totalTokens, metrics.legacyTokens);
  assert.equal('legacyFallbackFamilies' in manifest.ownership, false);
  assert.equal('legacyFallbackTokens' in manifest.ownership, false);
});

test('scanner reproduz superfície preparada no boot e baseline de duplicatas', () => {
  const runtime = analyzeRuntimeCommandSurface();
  assert.equal(runtime.raw.familyCount, 529);
  assert.equal(runtime.raw.uniqueTokenCount, 1627);
  assert.equal(runtime.injectedFamilyCount, 16);
  assert.equal(runtime.injectedTokenCount, 34);
  assert.equal(runtime.prepared.familyCount, 545);
  assert.equal(runtime.prepared.uniqueTokenCount, 1661);
  assert.deepEqual([...runtime.prepared.duplicateTokens].sort(), ['equip', 'inventario', 'slots', 'vender'].sort());
});

test('métricas reais fecham toda a superfície e fallback permanece zero', () => {
  const metrics = deriveVNextOwnershipMetrics();
  assert.equal(metrics.runtimeInjectedFamilies, 16);
  assert.equal(metrics.runtimeInjectedTokens, 34);
  assert.equal(metrics.legacyFamilies, 545);
  assert.equal(metrics.legacyTokens, 1661);
  assert.equal(metrics.nativeFamilies + metrics.compatibilityFamilies, 545);
  assert.equal(metrics.nativeTokens + metrics.compatibilityTokens, 1661);
  assert.equal(metrics.ownedFamilies, 545);
  assert.equal(metrics.ownedTokens, 1661);
  assert.equal(metrics.fallbackFamilies, 0);
  assert.equal(metrics.fallbackTokens, 0);
});

test('seam ativo preserva contexto legado, scope Members lazy e bridge compatível fechado', () => {
  assert.match(finalizeSource, /prefix:\s*groupPrefix,/);
  assert.match(finalizeSource, /isLiteMode:\s*isModoLite,/);
  assert.match(finalizeSource, /rejectInLiteMode,/);
  assert.match(finalizeSource, /mentionedUser:\s*menc_os2,/);
  assert.match(finalizeSource, /groupMembers:\s*AllgroupMembers,/);
  assert.match(finalizeSource, /buildGroupFilePath/);
  assert.match(finalizeSource, /pickLoadingMessage,/);
  assert.match(finalizeSource, /styleText,/);
  assert.match(finalizeSource, /qrReader:\s*qrcode,/);
  assert.match(finalizeSource, /dictionary:\s*Dicionary,/);
  assert.match(finalizeSource, /uploadMedia:\s*upload,/);
  assert.match(finalizeSource, /buildMembersScopeFactorySource/);
  assert.match(finalizeSource, /vnextMembersDomainScope\.json/);
  assert.match(finalizeSource, /isMacrotrancheOwnedCommand:/);
  assert.match(finalizeSource, /executeLegacyOwnedCommand:\s*__gyomeiExecuteMacrotrancheLegacy/);
  assert.match(finalizeSource, /buildMacrotrancheLegacyBridge\(runtimeIndex\)/);

  assert.match(bridgeSource, /selectionMode !== 'all-non-native'/);
  assert.match(bridgeSource, /nativeSeeds/);
  assert.match(bridgeSource, /applyAtomicDomainOwnership/);
  assert.match(bridgeSource, /vnextDomainCutoverPlan\.json/);
  assert.match(bridgeSource, /compatibilityIndexes/);
  assert.match(bridgeSource, /__gyomeiMacrotrancheOwnedCommands/);
  assert.match(bridgeSource, /__gyomeiExecuteMacrotrancheLegacy/);
});

test('seam ativo não reintroduz identificador livre isLiteMode na raiz do contexto', () => {
  const rootOnly = finalizeSource.slice(0, finalizeSource.indexOf('buildMembersScope:'));
  const withoutExplicitProperty = rootOnly.replace(/isLiteMode:\s*isModoLite/g, '');
  assert.doesNotMatch(withoutExplicitProperty, /\n\s*isLiteMode\s*(?:,|\n)/);
});

test('deploy ativo mantém estado vivo fora do allowlist e Mendes na denylist', () => {
  assert.match(deploySource, /STATE_ROOTS\s*=\s*Object\.freeze\(\['dados\/database'\]\)/);
  assert.match(deploySource, /STATE_FILES\s*=\s*Object\.freeze\(\['dados\/src\/config\.json'\]\)/);
  assert.match(deploySource, /DENYLIST\s*=\s*new Set\(\['0b8a7d48'\]\)/);
  assert.match(deploySource, /Estado operacional jamais pode entrar na promoção ativa/);
  assert.match(deploySource, /RUNTIME_PROOF=OK/);
  assert.match(deploySource, /ROLLBACK_CODIGO=CONFIRMADO/);
  assert.match(deploySource, /'dados\/src\/\.scripts\/start\.js'/);
});

test('runner rápido protege estado, deriva métricas reais e mantém shim de montagem isolado', () => {
  assert.match(fastRunnerSource, /START_ANCHOR = 'async function downloadStateItem/);
  assert.match(fastRunnerSource, /END_ANCHOR = 'async function snapshotCode/);
  assert.match(fastRunnerSource, /createStateProtectionReceipt/);
  assert.match(fastRunnerSource, /locked-pterodactyl-backup-plus-readonly-state-inventory/);
  assert.match(fastRunnerSource, /STATE_PROTECTION=OK/);
  assert.match(fastRunnerSource, /deriveVNextOwnershipMetrics/);
  assert.match(fastRunnerSource, /accepted-base-plus-full-known-surface/);
  assert.match(fastRunnerSource, /ownership\.macroFamilies !== 526/);
  assert.match(fastRunnerSource, /ownership\.macroTokens !== 1280/);
  assert.match(fastRunnerSource, /fallback conhecido/);
  assert.match(fastRunnerSource, /PROMOTION_LOG_DERIVED/);
  assert.match(fastRunnerSource, /fallback hardcoded/);
  assert.match(fastRunnerSource, /Snapshot integral antigo permaneceu/);
  assert.match(fastRunnerSource, /execFileSync\(process\.execPath, \['--check', RUNTIME_PATH\]/);
  assert.match(fastRunnerSource, /RUNTIME_DEPLOY_FAST_VALIDATE=OK/);
  assert.match(promoteSource, /scripts\/run-deploy-refactor-active-fast\.mjs/);
  assert.doesNotMatch(promoteSource, /scripts\/deploy-refactor-active-direct\.mjs \\\n\s*--apply/);
});

test('controladores shell executam JavaScript ESM via stdin de forma explícita', () => {
  assert.match(qualifySource, /node --input-type=module - "\$AUDIT_JSON" "\$AUDIT_EXIT"/);
  assert.match(promoteSource, /node --input-type=module - "\$CREDENTIALS_FILE"/);
  assert.match(parallelPromoteSource, /node --input-type=module - "\$CREDENTIALS_FILE"/);

  assert.doesNotMatch(qualifySource, /node - "\$AUDIT_JSON"/);
  assert.doesNotMatch(promoteSource, /node - "\$CREDENTIALS_FILE"/);
  assert.doesNotMatch(parallelPromoteSource, /node - "\$CREDENTIALS_FILE"/);
});

test('scripts e runtime temporário passam parser e métricas reais antes de produção', () => {
  execFileSync(process.execPath, ['--check', 'scripts/deploy-refactor-active-direct.mjs'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/run-deploy-refactor-active-fast.mjs'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/analyze-runtime-command-surface.mjs'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/vnext-ownership-metrics.mjs'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'dados/src/.scripts/vnextDomainOwnershipOverlay.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'dados/src/.scripts/vnextMacrotrancheBridge.js'], { stdio: 'pipe' });

  const surfaceOutput = execFileSync(process.execPath, ['scripts/analyze-runtime-command-surface.mjs'], { encoding: 'utf8' });
  assert.match(surfaceOutput, /RUNTIME_COMMAND_FAMILIES=545/);
  assert.match(surfaceOutput, /RUNTIME_COMMAND_TOKENS=1661/);
  assert.match(surfaceOutput, /RUNTIME_INJECTED_FAMILIES=16/);
  assert.match(surfaceOutput, /RUNTIME_INJECTED_TOKENS=34/);

  const metrics = deriveVNextOwnershipMetrics();
  const validationOutput = execFileSync(
    process.execPath,
    ['scripts/run-deploy-refactor-active-fast.mjs', '--validate-runtime'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  assert.match(validationOutput, /RUNTIME_DEPLOY_FAST_VALIDATE=OK producao_contatada=NAO/);
  assert.match(validationOutput, new RegExp(`ownership=${metrics.ownedTokens}\\/${metrics.legacyTokens}`));
  assert.match(validationOutput, /fallback=0/);
  assert.equal(fs.existsSync('scripts/.runtime-deploy-refactor-active-direct.mjs'), false);
  execFileSync('bash', ['-n', 'scripts/qualify-refactor-safe.sh'], { stdio: 'pipe' });
  execFileSync('bash', ['-n', 'scripts/promote-refactor-active-safe.sh'], { stdio: 'pipe' });
  execFileSync('bash', ['-n', 'scripts/promote-refactor-parallel-safe.sh'], { stdio: 'pipe' });
  execFileSync('bash', ['-n', 'scripts/refactor-control-safe.sh'], { stdio: 'pipe' });
});

test('controlador exige qualificação, fallback zero e usa métricas derivadas', () => {
  assert.match(controllerSource, /deploy-active\) mode_deploy_active/);
  assert.match(controllerSource, /macro-plan\) mode_macro_plan/);
  assert.match(controllerSource, /PROMOCAO_HIBRIDA_ATIVA/);
  assert.match(controllerSource, /fallback conhecido zero/i);
  assert.match(controllerSource, /print_ownership_metrics/);
  assert.match(controllerSource, /QUALIFICACAO=OK/);
  assert.match(controllerSource, /ACEITE_OPERACIONAL=PENDENTE_INSPECAO_E_WHATSAPP/);
});

test('controlador mantém um único relatório vivo no Desktop durante toda a etapa', () => {
  assert.match(controllerSource, /DESKTOP_REPORT=.*GYOMEI-REFATORACAO-ATUAL\.txt/);
  assert.match(controllerSource, /RELATORIO_LIVE=SIM/);
  assert.match(controllerSource, /tee -a \"\$CANON_REPORT\" \"\$DESKTOP_REPORT\"/);
  assert.match(controllerSource, /stdbuf -oL -eL tee -a/);
});

test('legado só entra na promoção ativa sob trava de drift declarada', () => {
  // O recorte fechado virou verificação. Se a trava sumir, o deploy volta a
  // poder sobrescrever cegamente um connect.js que tenha divergido em produção
  // — e neste projeto produção já esteve à frente do git.
  assert.ok(deploySource.includes('function assertLegacyBaseline('), 'trava de drift precisa existir');
  assert.ok(
    deploySource.includes('if (isLegacyRuntimePath(relativePath)) assertLegacyBaseline('),
    'a trava precisa ser chamada antes de escrever',
  );
  assert.ok(
    fastRunnerSource.includes("|| isLegacyRuntimePath(relativePath)"),
    'o runner precisa injetar o caminho legado na allowlist',
  );

  // Sem baseline declarada o deploy falha fechado, em vez de escrever às cegas.
  assert.deepEqual(Object.keys(manifest.legacyBaseline ?? {}), [
    'dados/src/.scripts/prepareRuntimeSources.js',
    'dados/src/.scripts/start.js',
    'dados/src/connect.js',
    'dados/src/core/messageQueue.js',
    'dados/src/funcs/downloads/pinterest.js',
    'dados/src/funcs/private/ia.js',
    'dados/src/index.js',
    'dados/src/services/bunnyfy/BunnyFyClient.js',
    'dados/src/services/bunnyfy/capabilityGateway.js',
    'dados/src/services/bunnyfy/contracts.js',
    'dados/src/utils/gyomeiCore.js',
  ]);
  // Toda baseline é hash do que foi efetivamente promovido; null só enquanto o
  // arquivo ainda não existe em produção.
  for (const [caminho, esperado] of Object.entries(manifest.legacyBaseline)) {
    if (esperado === null) continue;
    assert.match(esperado, /^[0-9a-f]{64}$/, `baseline inválida para ${caminho}`);
  }
});

test('a admissão de legado é lista DECRESCENTE, não depósito', () => {
  // O recorte fechado não era só proteção contra drift: era pressão
  // arquitetural. Se o legado não pode ser publicado, a única saída é migrar.
  // Ao abrir esse portão eu removi a pressão — este teto a devolve.
  // Subiu de 7 para 10 em 22/08: a assistente vazava JSON na conversa e a
  // identidade padrão precisava mudar, e o pipeline legado exige GitHub Actions
  // — documentado como perigoso para deploy incremental. Registrar o motivo
  // aqui é o que impede o teto de subir por conveniência na próxima vez.
  // Subiu para 11 somente para entregar o bootstrap SHOGUN/Termux junto do
  // patch que o transforma. Sem start.js no lote, o anchor novo quebraria o boot.
  const TETO = 11;
  const admitidos = Object.keys(manifest.legacyBaseline ?? {});
  assert.ok(
    admitidos.length <= TETO,
    `a lista de legado cresceu para ${admitidos.length}; o objetivo é esvaziá-la, não alimentá-la`,
  );

  // Sem destino declarado o arquivo vira morador permanente.
  for (const caminho of admitidos) {
    assert.ok(
      manifest.legacyExit?.[caminho],
      `${caminho} entrou sem destino de saída declarado em legacyExit`,
    );
  }
});
