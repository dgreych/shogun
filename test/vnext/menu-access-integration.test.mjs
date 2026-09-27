import assert from 'node:assert/strict';
import test from 'node:test';
import menu from '../../dados/src/menus/menu.js';
import menuAdmin from '../../dados/src/menus/menuadm.js';
import { MenuDomainDispatchTarget } from '../../dist-vnext/menu/domain.js';
import { LegacySwitchHook } from '../../dist-vnext/runtime/legacy-switch-hook.js';
import { ModerationDomainDispatchTarget } from '../../dist-vnext/moderation/domain.js';
import { evaluateCommandAccess } from '../../dist-vnext/commands/access-policy.js';
import { findCommandAccessPolicy } from '../../dist-vnext/commands/access-catalog.js';

const member = Object.freeze({ resolved: true, isGroup: true, isOwner: false, isSubOwner: false,
  isGroupAdmin: false, isRealGroupAdmin: false, isBotAdmin: true });
const accessFor = access => (command, entry) => evaluateCommandAccess(findCommandAccessPolicy(command, { arguments: entry?.arguments }), access);
const context = access => ({ access, isOwner: access?.isOwner === true, isGroup: true, reply: async () => {},
  socket: {}, message: {}, messagesCache: new Map(), rentalExpirationManager: null, prefix: '!', botName: 'Shogun', pushName: 'Membro', isLiteMode: false });

test('menu principal não divulga gestão para membro, subdono ou conversa privada', async () => {
  for (const access of [member, { ...member, isSubOwner: true }, { ...member, isGroup: false }]) {
    const text = await menu('!', 'Shogun', 'Membro', { accessFor: accessFor(access) });
    assert.doesNotMatch(text, /!menuadm|!menudono|ADMINISTRAÇÃO & GESTÃO/);
    assert.match(text, /!menudown/);
  }
});

test('admin sem poder no bot vê apenas gestão do grupo', async () => {
  const text = await menu('!', 'Shogun', 'Admin', { accessFor: accessFor({ ...member, isGroupAdmin: true, isRealGroupAdmin: true }) });
  assert.match(text, /!menuadm/);
  assert.doesNotMatch(text, /!menudono/);
});

test('moderador vê somente ações concedidas e o bot sem admin mantém aviso', async () => {
  const text = await menuAdmin('!', 'Shogun', 'Mod', { accessFor: accessFor({ ...member, isBotAdmin: false, moderatorCommands: ['mute'] }) });
  assert.match(text, /!mute\b/);
  assert.match(text, /Indisponível:/);
  assert.doesNotMatch(text, /!ban\b|!promover|!setprefix|!addmod/);
});

test('menu reservado chamado por alias é consumido sem envio ou fallback', async () => {
  let sends = 0;
  const target = new MenuDomainDispatchTarget({ present: async () => { sends++; }, replyText: async () => {}, reportError: () => {} });
  assert.equal(await target.dispatch('admmenu', context(member)), true);
  assert.equal(await target.dispatch('ownermenu', context({ ...member, isSubOwner: true })), true);
  assert.equal(sends, 0);
});

test('falha de contexto bloqueia comando restrito antes do target nativo ou legado', async () => {
  let executions = 0;
  const hook = new LegacySwitchHook({ dispatch: async () => { executions++; return false; } });
  assert.equal(await hook.dispatch('kick', context(undefined)), true);
  assert.equal(await hook.dispatch('setprefix', context({ ...member, resolved: false })), true);
  assert.equal(executions, 0);
});

test('moderação direta usa autoridade resolvida antes de qualquer mutação', async () => {
  let mutations = 0;
  const input = { ...context({ ...member, isOwner: true }), isGroupAdmin: true, isRealGroupAdmin: true,
    isBotAdmin: true, groupId: 'test@g.us', groupData: {}, mentionedUser: 'target@lid', sender: 'owner@lid',
    query: '', quotedParticipant: null, botIds: [], identitiesMatch: (a, b) => a === b,
    validateModerationTarget: () => ({ allowed: true, targetId: 'target@lid' }),
    socket: { sendMessage: async () => {}, groupParticipantsUpdate: async () => { mutations++; } } };
  assert.equal(await new ModerationDomainDispatchTarget().dispatch('kick', input), true);
  assert.equal(mutations, 0);
});
