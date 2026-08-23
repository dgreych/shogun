import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { analyzeRuntimeCommandSurface } from '../../scripts/analyze-runtime-command-surface.mjs';
import { planVNextMacrotranche } from '../../scripts/plan-vnext-macrotranche.mjs';
import { ADMIN_COLLECTION_COMMAND_TOKENS } from '../../dist-vnext/admin/collections-domain.js';
import { ADMIN_GROUP_COMMAND_TOKENS } from '../../dist-vnext/admin/group-domain.js';
import { ADMIN_SETTINGS_COMMAND_TOKENS } from '../../dist-vnext/admin/settings-domain.js';
import { ADMIN_BOOLEAN_SETTING_TOKENS } from '../../dist-vnext/admin/toggle-catalog.js';
import {
  MENU_COMMAND_DESCRIPTORS,
  MENU_COMMAND_TOKENS,
} from '../../dist-vnext/menu/catalog.js';
import {
  FUN_COMMAND_DESCRIPTORS,
  FUN_COMMAND_TOKENS,
} from '../../dist-vnext/fun/catalog.js';
import { MEMBERS_GENERATED_COMMAND_TOKENS } from '../../dist-vnext/members/domain.js';
import { MODERATION_COMMAND_TOKENS } from '../../dist-vnext/moderation/catalog.js';
import { TOOLS_NATIVE_COMMAND_TOKENS } from '../../dist-vnext/tools/domain.js';
import { EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS } from '../../dist-vnext/tools/external-domain.js';
import { LINK_CHECK_TOOLS_NATIVE_COMMAND_TOKENS } from '../../dist-vnext/tools/link-check-domain.js';
import { MISC_TOOLS_NATIVE_COMMAND_TOKENS } from '../../dist-vnext/tools/misc-domain.js';
import { UTILITY_TOOLS_NATIVE_COMMAND_TOKENS } from '../../dist-vnext/tools/utility-domain.js';

const cutover = JSON.parse(fs.readFileSync('dados/src/.scripts/vnextDomainCutoverPlan.json', 'utf8'));
const membersActive = cutover?.domains?.members?.state === 'active';

test('ownership vNext cobre toda a superfície preparada sem fallback e separa nativo de compatibilidade', () => {
  const runtime = analyzeRuntimeCommandSurface();
  const legacy = runtime.prepared;
  const plan = planVNextMacrotranche();
  const legacyTokens = new Set(legacy.tokens);
  const menuOwned = new Set(MENU_COMMAND_TOKENS);
  const funOwned = new Set(FUN_COMMAND_TOKENS);
  const moderationOwned = new Set(MODERATION_COMMAND_TOKENS);
  const adminBooleanOwned = new Set(ADMIN_BOOLEAN_SETTING_TOKENS);
  const adminSettingsOwned = new Set(ADMIN_SETTINGS_COMMAND_TOKENS);
  const adminGroupOwned = new Set(ADMIN_GROUP_COMMAND_TOKENS);
  const adminCollectionsOwned = new Set(ADMIN_COLLECTION_COMMAND_TOKENS);
  const toolsOwned = new Set(TOOLS_NATIVE_COMMAND_TOKENS);
  const utilityToolsOwned = new Set(UTILITY_TOOLS_NATIVE_COMMAND_TOKENS);
  const externalToolsOwned = new Set(EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS);
  const linkCheckToolsOwned = new Set(LINK_CHECK_TOOLS_NATIVE_COMMAND_TOKENS);
  const miscToolsOwned = new Set(MISC_TOOLS_NATIVE_COMMAND_TOKENS);
  const membersOwned = new Set(membersActive ? MEMBERS_GENERATED_COMMAND_TOKENS : []);
  const nativeOwned = new Set([
    ...menuOwned,
    ...funOwned,
    ...moderationOwned,
    ...adminBooleanOwned,
    ...adminSettingsOwned,
    ...adminGroupOwned,
    ...adminCollectionsOwned,
    ...toolsOwned,
    ...utilityToolsOwned,
    ...externalToolsOwned,
    ...linkCheckToolsOwned,
    ...miscToolsOwned,
    ...membersOwned,
  ]);
  const compatibilityOwned = new Set(plan.tokens);
  const owned = new Set([...nativeOwned, ...compatibilityOwned]);

  assert.equal(runtime.raw.familyCount, 509);
  assert.equal(runtime.raw.uniqueTokenCount, 1572);
  assert.equal(runtime.injectedFamilyCount, 16);
  assert.equal(runtime.injectedTokenCount, 34);
  assert.equal(legacy.familyCount, 525);
  assert.equal(legacy.uniqueTokenCount, 1606);
  assert.equal(plan.contractDrift, false);
  assert.deepEqual(plan.unresolved, []);
  assert.deepEqual(plan.crossBoundaryDuplicates, []);
  assert.equal(plan.nativeFamilies + plan.selectedFamilies, legacy.familyCount);
  assert.equal(plan.nativeTokens + plan.selectedTokens, legacy.uniqueTokenCount);
  assert.equal(plan.fallbackFamiliesAfterMacrotranche, 0);
  assert.equal(plan.fallbackTokensAfterMacrotranche, 0);

  assert.equal(nativeOwned.size, plan.nativeTokens);
  assert.equal(compatibilityOwned.size, plan.selectedTokens);

  for (const token of nativeOwned) {
    assert.ok(legacyTokens.has(token), `vNext nativo declarou token inexistente: ${token}`);
    assert.ok(!compatibilityOwned.has(token), `token nativo não pode permanecer na compatibilidade: ${token}`);
  }
  for (const token of compatibilityOwned) {
    assert.ok(legacyTokens.has(token), `compatibilidade declarou token inexistente: ${token}`);
  }

  for (const token of runtime.injectedTokens) {
    assert.ok(
      compatibilityOwned.has(token),
      `comando injetado ainda não migrado precisa permanecer na compatibilidade: ${token}`,
    );
  }

  for (const token of MODERATION_COMMAND_TOKENS) {
    assert.ok(nativeOwned.has(token), `moderação precisa ser nativa: ${token}`);
    assert.ok(!compatibilityOwned.has(token), `moderação não pode permanecer no bridge: ${token}`);
  }

  for (const token of [
    'antilinkhard', 'limitmessage', 'adv', 'hora', 'groupstats',
    'nota', 'notas', 'calc', 'lembrete', 'meuslembretes', 'apagalembrete', 'aniversario',
    'printsite', 'ssweb', 'signos', 'clima', 'tempo', 'weather', 'previsao', 'horoscopo', 'signo',
    'verificar', 'checklink', 'scanlink', 'urlscan',
    'nick', 'gerarnick', 'nickgenerator', 'qrcode', 'lerqr', 'readqr', 'scanqr',
    'encurtalink', 'tinyurl', 'dicionario', 'dictionary', 'tradutor', 'translator',
    'upload', 'imgpralink', 'videopralink', 'gerarlink',
  ]) {
    assert.ok(nativeOwned.has(token), `macrotranche nova precisa assumir ${token}`);
    assert.ok(!compatibilityOwned.has(token), `macrotranche nova precisa remover ${token} da compatibilidade`);
  }

  if (membersActive) {
    assert.equal(membersOwned.size, 152);
    for (const token of MEMBERS_GENERATED_COMMAND_TOKENS) {
      assert.ok(nativeOwned.has(token), `Members ativo precisa ser nativo: ${token}`);
      assert.ok(!compatibilityOwned.has(token), `Members ativo não pode permanecer no bridge: ${token}`);
    }
  }

  const intersectingFamilies = legacy.families.filter((family) =>
    family.tokens.some((token) => owned.has(token)),
  );
  for (const family of intersectingFamilies) {
    const missing = family.tokens.filter((token) => !owned.has(token));
    assert.deepEqual(missing, [], `ownership parcial da família ${family.primary}: faltam ${missing.join(', ')}`);
  }

  const nativeFamilies = legacy.families.filter((family) =>
    family.tokens.some((token) => nativeOwned.has(token)),
  );
  const compatibilityFamilies = legacy.families.filter((family) =>
    family.tokens.some((token) => compatibilityOwned.has(token)),
  );

  assert.equal(MENU_COMMAND_DESCRIPTORS.length, 13);
  assert.equal(menuOwned.size, 45);
  assert.equal(FUN_COMMAND_DESCRIPTORS.length, 5);
  assert.equal(funOwned.size, 333);
  assert.equal(moderationOwned.size, 26);
  assert.equal(miscToolsOwned.size, 17);
  assert.equal(nativeFamilies.length, plan.nativeFamilies);
  assert.equal(compatibilityFamilies.length, plan.selectedFamilies);
  assert.equal(intersectingFamilies.length, legacy.familyCount);
  assert.equal(owned.size, legacy.uniqueTokenCount);

  const fallbackTokens = legacy.uniqueTokenCount - owned.size;
  const fallbackFamilies = legacy.familyCount - intersectingFamilies.length;
  assert.equal(fallbackTokens, 0, 'nenhum token preparado pode cair no fallback');
  assert.equal(fallbackFamilies, 0, 'nenhuma família preparada pode cair no fallback');

  console.log(`LEGACY_COMMAND_TOKENS=${legacy.uniqueTokenCount}`);
  console.log(`LEGACY_COMMAND_FAMILIES=${legacy.familyCount}`);
  console.log(`VNEXT_NATIVE_COMMAND_TOKENS=${nativeOwned.size}`);
  console.log(`VNEXT_NATIVE_COMMAND_FAMILIES=${nativeFamilies.length}`);
  console.log(`VNEXT_COMPAT_COMMAND_TOKENS=${compatibilityOwned.size}`);
  console.log(`VNEXT_COMPAT_COMMAND_FAMILIES=${compatibilityFamilies.length}`);
  console.log(`LEGACY_FALLBACK_COMMAND_TOKENS=${fallbackTokens}`);
  console.log(`LEGACY_FALLBACK_COMMAND_FAMILIES=${fallbackFamilies}`);
});
