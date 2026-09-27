import assert from 'node:assert/strict';
import test from 'node:test';

import menuShogun from '../dados/src/menus/menushogun.js';
import { evaluateCommandAccess } from '../dist-vnext/commands/access-policy.js';
import { findCommandAccessPolicy } from '../dist-vnext/commands/access-catalog.js';
import { resolveCommandInput } from '../dados/src/utils/commandResolver.js';
import { DEFAULT_NVIDIA_MODEL, NVIDIA_MODEL_CATALOG } from '../dados/src/utils/nvidiaApi.js';

test('modelos é alias oficial do seletor persistente de conversa', () => {
  const resolved = resolveCommandInput('modelos', []);
  assert.equal(resolved.command, 'modeloconversa');
  assert.equal(resolved.source, 'builtin');
});

test('menu visual apresenta os dez modelos e marca Ultra como padrão', async () => {
  const owner = { resolved: true, isGroup: true, isOwner: true, isSubOwner: false,
    isGroupAdmin: true, isRealGroupAdmin: false, isBotAdmin: true };
  const rendered = await menuShogun('!', 'SHOGUN', 'Teste', {
    accessFor: token => evaluateCommandAccess(findCommandAccessPolicy(token), owner),
  });
  assert.equal(NVIDIA_MODEL_CATALOG.length, 10);
  assert.equal(DEFAULT_NVIDIA_MODEL, 'nvidia/nemotron-3-ultra-550b-a55b');

  for (const entry of NVIDIA_MODEL_CATALOG) {
    assert.match(rendered, new RegExp(entry.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(rendered, /!modeloconversa/);
  assert.match(rendered, /Nemotron 3 Ultra 550B/);
  assert.match(rendered, /padrão/);
});

test('menu de conversa esconde modelos e controles para membro', async () => {
  const member = { resolved: true, isGroup: true, isOwner: false, isSubOwner: false,
    isGroupAdmin: false, isRealGroupAdmin: false, isBotAdmin: true };
  const rendered = await menuShogun('!', 'SHOGUN', 'Teste', {
    accessFor: token => evaluateCommandAccess(findCommandAccessPolicy(token), member),
  });
  assert.match(rendered, /!resumir/);
  assert.doesNotMatch(rendered, /modeloconversa|modeloshogun|CONFIGURAÇÃO DE MODELO|nvidia\//);
});
