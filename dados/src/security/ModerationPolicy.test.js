import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canGrantModeratorCommand,
  evaluateModerationTarget,
  normalizeCommandName
} from './ModerationPolicy.js';

const base = {
  actorId: '100@lid',
  memberIds: ['100@lid', '200@lid', '300@lid', '400@lid', '500@lid'],
  adminIds: ['100@lid', '300@lid', '400@lid'],
  superAdminIds: ['400@lid'],
  ownerIds: ['500@lid'],
  botIds: ['999@lid']
};

test('mute e ban recusam autoalvo antes de qualquer efeito', () => {
  for (const action of ['mute', 'mute-delete', 'ban', 'block']) {
    const result = evaluateModerationTarget({ ...base, action, targetId: '100:7@lid' });
    assert.equal(result.allowed, false);
    assert.equal(result.code, 'SELF_TARGET');
  }
});

test('ações punitivas protegem bot, dono, criador e outros administradores', () => {
  const cases = [
    ['999@lid', 'BOT_TARGET'],
    ['500@lid', 'OWNER_TARGET'],
    ['400@lid', 'SUPERADMIN_TARGET'],
    ['300@lid', 'ADMIN_TARGET']
  ];
  for (const [targetId, code] of cases) {
    const result = evaluateModerationTarget({ ...base, action: 'ban', targetId });
    assert.equal(result.code, code);
  }
});

test('membro comum pode ser moderado e alvo externo é recusado', () => {
  assert.equal(evaluateModerationTarget({
    ...base,
    action: 'mute',
    targetId: '200@lid'
  }).allowed, true);
  assert.equal(evaluateModerationTarget({
    ...base,
    action: 'mute',
    targetId: '700@lid'
  }).code, 'TARGET_NOT_MEMBER');
});

test('promoção e rebaixamento validam o estado administrativo do alvo', () => {
  assert.equal(evaluateModerationTarget({
    ...base,
    action: 'promote',
    targetId: '300@lid'
  }).code, 'ALREADY_ADMIN');
  assert.equal(evaluateModerationTarget({
    ...base,
    action: 'demote',
    targetId: '200@lid'
  }).code, 'NOT_ADMIN');
  assert.equal(evaluateModerationTarget({
    ...base,
    action: 'demote',
    targetId: '300@lid'
  }).allowed, true);
});

test('moderadores só recebem comandos da lista segura', () => {
  for (const command of ['ban', 'ban2', 'promover', 'rebaixar', 'setname', 'grantmodcmd']) {
    assert.equal(canGrantModeratorCommand(command), false, command);
  }
  for (const command of ['mute', 'mutar', 'del', 'blockuser', 'unmute2']) {
    assert.equal(canGrantModeratorCommand(command), true, command);
  }
  assert.equal(normalizeCommandName('  DÉL  '), 'del');
});
