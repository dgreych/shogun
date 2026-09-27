import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCommandAccess } from '../../dist-vnext/commands/access-policy.js';
import { findCommandAccessPolicy } from '../../dist-vnext/commands/access-catalog.js';

const member = { resolved: true, isGroup: true, isOwner: false, isSubOwner: false,
    isGroupAdmin: false, isRealGroupAdmin: false, isBotAdmin: true };
const policy = overrides => ({ tokens: ['sample'], groupOnly: false, ownerOnly: false,
    ownerOrSub: false, admin: false, realAdmin: false, botAdmin: false, ...overrides });

const cases = [
    ['membro vê recurso público', {}, {}, true, true, 'allowed'],
    ['membro não vê gestão do dono', { ownerOnly: true }, {}, false, false, 'owner'],
    ['subdono não equivale a dono', { ownerOnly: true }, { isSubOwner: true }, false, false, 'owner'],
    ['subdono acessa família delegada', { ownerOrSub: true }, { isSubOwner: true }, true, true, 'allowed'],
    ['dono acessa família delegada', { ownerOrSub: true }, { isOwner: true }, true, true, 'allowed'],
    ['admin real acessa moderação', { admin: true, realAdmin: true }, { isGroupAdmin: true, isRealGroupAdmin: true }, true, true, 'allowed'],
    ['admin efetivo não passa por admin real', { admin: true, realAdmin: true }, { isGroupAdmin: true }, false, false, 'real-admin'],
    ['dono fora da administração real é recusado', { realAdmin: true }, { isOwner: true, isGroupAdmin: true }, false, false, 'real-admin'],
    ['privado não oferece comando de grupo', { groupOnly: true }, { isGroup: false, isOwner: true }, false, false, 'group'],
    ['bot sem admin mantém indicação de indisponível', { admin: true, botAdmin: true }, { isGroupAdmin: true, isBotAdmin: false }, true, false, 'bot-admin'],
    ['bot admin não amplia os poderes do membro', { admin: true, botAdmin: true }, {}, false, false, 'admin'],
    ['metadata não resolvida não concede gestão', { ownerOnly: true }, { resolved: false, isOwner: true }, false, false, 'unresolved'],
];
for (const [name, requirements, context, visible, executable, reason] of cases) {
    test(name, () => assert.deepEqual(evaluateCommandAccess(policy(requirements), { ...member, ...context }), { visible, executable, reason }));
}

test('família desconhecida não aparece nem executa', () => {
    assert.deepEqual(evaluateCommandAccess(undefined, { ...member, isOwner: true }), { visible: false, executable: false, reason: 'unknown' });
});

test('aliases consultam a mesma política e preservam requisito real de moderação', () => {
    const ban = findCommandAccessPolicy('ban');
    assert.ok(ban);
    assert.equal(findCommandAccessPolicy('kick'), ban);
    assert.equal(findCommandAccessPolicy('BANIR'), ban);
    assert.equal(ban.realAdmin, true);
    assert.equal(ban.botAdmin, true);
    assert.equal(evaluateCommandAccess(ban, { ...member, isOwner: true, isGroupAdmin: true }).executable, false);
});

test('aliases de menus reservados conservam a restrição ao dono', () => {
    const owner = findCommandAccessPolicy('menudono');
    assert.equal(findCommandAccessPolicy('ownermenu'), owner);
    assert.equal(evaluateCommandAccess(owner, { ...member, isSubOwner: true }).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('menuadm'), member).visible, false);
});

test('dono original, conversa privada e subdono mantêm guardas próprias', () => {
    const owner = { ...member, isOwner: true, isGroupAdmin: true };
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('adddono'), owner).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('adddono'), { ...owner, isPrimaryOwner: true }).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('gruposbot'), owner).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('gruposbot'), { ...owner, isGroup: false }).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('cmdlimitar'), member).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('cmdlimit'), { ...member, isSubOwner: true }).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('update'), { ...owner, isSubOwner: true }).visible, false);
});

test('modelos respeitam dono ou administrador real, sem promover subdonos', () => {
    const model = findCommandAccessPolicy('modeloconversa');
    assert.equal(evaluateCommandAccess(model, { ...member, isSubOwner: true, isGroupAdmin: true }).visible, false);
    assert.equal(evaluateCommandAccess(model, { ...member, isGroupAdmin: true, isRealGroupAdmin: true }).executable, true);
    assert.equal(evaluateCommandAccess(model, { ...member, isGroup: false, isOwner: true }).executable, true);
});

test('moderador recebe apenas os comandos explicitamente concedidos', () => {
    const moderator = { ...member, moderatorCommands: ['mute'] };
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('mute'), moderator).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('setprefix'), moderator).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('ban'), { ...moderator, moderatorCommands: ['ban'] }).visible, false);
});

test('NEXO separa comandos do jogador e ações administrativas com o mesmo token', () => {
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('tutorial', { domain: 'nexo' }), member).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('tutorial', { domain: 'legacy' }), member).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('nexo', { arguments: 'status' }), member).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('nexo', { arguments: 'ativar casual' }), member).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('nexo', { arguments: 'desativar' }), { ...member, isRealGroupAdmin: true }).executable, true);
});

test('reset de jogador e configuração do suporte não herdam acesso público da família', () => {
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('resetrpg'), member).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('suporte', { arguments: 'preciso de ajuda' }), member).executable, true);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('ticket', { arguments: 'off' }), member).visible, false);
    assert.equal(evaluateCommandAccess(findCommandAccessPolicy('suporte', { arguments: 'on' }), { ...member, isGroupAdmin: true }).executable, true);
});
