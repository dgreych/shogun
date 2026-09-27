import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../dados/src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('    let isGroupAdmin = false;');
const end = source.indexOf('    const validateModerationTarget =', start);
assert.ok(start > 0 && end > start);
const resolve = new Function('isGroup', 'isOwner', 'sender', 'groupAdmins', 'groupData', 'command', 'idsMatch', 'idInArray', 'canGrantModeratorCommand', 'debugLog', 'senderBase', 'isBotAdmin', 'botNumberLid',
  `${source.slice(start, end)}\nreturn { isGroupAdmin, isRealGroupAdmin, isModeratorActionAllowed };`);
function actor({ owner = false, admins = [], grants = [], command = 'menu', group = true } = {}) {
  const match = (left, right) => left === right;
  return resolve(group, owner, 'actor@lid', admins, { moderators: ['actor@lid'], allowedModCommands: grants }, command,
    match, (id, values) => values.includes(id), value => ['mute', 'mutar'].includes(value), () => {}, 'actor', true, 'bot@lid');
}

test('dono tem administração efetiva sem virar administrador real do grupo', () => {
  assert.deepEqual(actor({ owner: true }), { isGroupAdmin: true, isRealGroupAdmin: false, isModeratorActionAllowed: false });
});
test('admin identificado por LID mantém administração real', () => {
  assert.equal(actor({ admins: ['actor@lid'] }).isRealGroupAdmin, true);
});
test('concessão de mute não entrega gestão ao moderador', () => {
  assert.equal(actor({ grants: ['mute'], command: 'mute' }).isGroupAdmin, true);
  assert.equal(actor({ grants: ['mute'], command: 'setprefix' }).isGroupAdmin, false);
  assert.equal(actor({ grants: ['setprefix'], command: 'setprefix' }).isGroupAdmin, false);
});
