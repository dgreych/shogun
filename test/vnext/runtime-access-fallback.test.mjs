import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { patchVNextOwnershipHook } from '../../dados/src/.scripts/finalizeShogunRuntime.js';
import { resolveCommandInput } from '../../dist-vnext/commands/input-resolver.js';
import { findCommandAccessPolicy } from '../../dist-vnext/commands/access-catalog.js';
import { evaluateCommandAccess, commandAccessMessage } from '../../dist-vnext/commands/access-policy.js';

const anchor = "import { MessageReplayGuard, createMessageReplayKey } from './security/MessageReplayGuard.js';";
const patched = patchVNextOwnershipHook(`${anchor}\n    switch (command) { default: break; }`);
const start = patched.indexOf('// ===== VNEXT OWNERSHIP SEAM: PRE-SWITCH =====');
const end = patched.indexOf('if (isCmd && command && !__gyomeiVNextContextCircuitOpen)', start);
const prefix = patched.slice(start, end);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function reachFallback(command, aliases = [], q = '', resolved = true, probe, overrides = {}) {
  const replies = [];
  const bindings = {
    isCmd: true, command, isGroup: true, isOwner: false, isSubOwner: false,
    isRealGroupAdmin: false, isBotAdmin: true, groupMetadata: resolved ? { participants: [] } : null,
    automacoesV9: { isPrimaryOwner: () => false }, sender: 'membro@lid', numerodono: '', lidowner: '',
    info: { key: { participant: '123456789@lid', fromMe: false } }, groupData: {}, idsMatch: (a, b) => a === b,
    canGrantModeratorCommand: () => false, aliases, q, resolveCommandInput,
    findCommandAccessPolicy, evaluateCommandAccess, commandAccessMessage,
    reply: async text => replies.push(text),
    ...overrides,
  };
  const result = await new AsyncFunction(...Object.keys(bindings), `${prefix}\n${probe ? `return __commandAccessFor(${JSON.stringify(probe)});` : "return 'legacy-reached';"}`)(...Object.values(bindings));
  return { result, replies };
}

test('guarda de acesso permanece antes da montagem do contexto e do circuit breaker', async () => {
  const result = await reachFallback('menudono');
  assert.notEqual(result.result, 'legacy-reached');
  assert.equal(result.replies.length, 1);
  assert.equal((await reachFallback('play')).result, 'legacy-reached');
  assert.notEqual((await reachFallback('mute', [], '', false)).result, 'legacy-reached');
});

test('remetente citado nunca assume os privilégios do dono ou administrador', async () => {
  const source = fs.readFileSync('dados/src/index.js', 'utf8');
  const identityBlock = source.slice(source.indexOf('    let sender;'), source.indexOf('    // Debug: log do sender identificado'));
  const resolveSender = new AsyncFunction('info', 'nazu', 'isValidJid', 'getLidFromJidCached',
    `const isGroup = info.key.remoteJid.endsWith('@g.us');\n${identityBlock}\nreturn sender;`);
  const quote = { extendedTextMessage: { text: '!menudono', contextInfo: { participant: '5511999999999@s.whatsapp.net' } } };
  const missing = { key: { remoteJid: '123456789@g.us', fromMe: false }, message: quote };
  assert.equal(await resolveSender(missing, {}, () => false, async (_, value) => value), undefined);
  for (const participant of ['123456789@lid', '5511888888888@s.whatsapp.net']) {
    assert.equal(await resolveSender({ ...missing, key: { ...missing.key, participant } }, {}, () => false, async (_, value) => value), participant);
  }
  assert.equal(await resolveSender({ ...missing, key: { ...missing.key, participantAlt: '123456789@lid' } }, {}, () => false, async (_, value) => value), '123456789@lid');
  assert.equal(await resolveSender({ ...missing, key: { ...missing.key, participant: '123@g.us' } }, {}, () => false, async (_, value) => value), undefined);
  for (const command of ['menudono', 'addmod']) {
    const denied = await reachFallback(command, [], '', true, undefined, {
      info: missing, isOwner: true, isRealGroupAdmin: true,
      automacoesV9: { isPrimaryOwner: () => true },
    });
    assert.notEqual(denied.result, 'legacy-reached');
    assert.equal(denied.replies.length, 1);
    const allowed = await reachFallback(command, [], '', true, undefined, {
      isOwner: true, isRealGroupAdmin: true, automacoesV9: { isPrimaryOwner: () => true },
    });
    assert.equal(allowed.result, 'legacy-reached');
  }
});

test('aliases de grupo e parâmetros fixos conservam a restrição do comando de destino', async () => {
  const aliases = [
    { alias: 'gerenciar', command: 'nexo', fixedParams: 'ativar' },
    { alias: 'ajuda', command: 'suporte', fixedParams: 'on' },
    { alias: 'tocar', command: 'play' },
    { alias: 'modelos', command: 'play' },
  ];
  for (const alias of ['gerenciar', 'ajuda', 'modelos']) {
    assert.equal((await reachFallback('play', aliases, '', true, alias)).result.visible, false);
  }
  assert.equal((await reachFallback('play', aliases, '', true, 'tocar')).result.visible, true);
});
