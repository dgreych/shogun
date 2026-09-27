import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLiveCommandDispatchInput } from '../../dist-vnext/adapters/live-message-context.js';

const access = Object.freeze({ resolved: true, isGroup: true, isOwner: false,
  isSubOwner: true, isGroupAdmin: false, isRealGroupAdmin: false, isBotAdmin: true });
const seed = participant => ({ socket: {}, messagesCache: new Map(), rentalExpirationManager: null,
  message: { key: { remoteJid: '120363000000000000@g.us', participant }, message: { conversation: '!menu' } } });
const port = overrides => ({ getPrefix: () => '!', getAliases: () => [], isOwner: () => true,
  isLiteMode: () => false, getBotName: () => 'Shogun', getCommandAccess: () => access, ...overrides });

for (const participant of ['5511999999999@s.whatsapp.net', '123456789@lid']) {
  test(`contexto de acesso vem da porta para ${participant.endsWith('@lid') ? 'LID' : 'JID'}`, async () => {
    const calls = [];
    const result = await resolveLiveCommandDispatchInput(seed(participant), port({ getCommandAccess(...args) {
      calls.push(args); return access;
    } }));
    assert.deepEqual(calls, [['120363000000000000@g.us', participant, true]]);
    assert.deepEqual(result.access, access);
    assert.equal(result.isOwner, false);
    assert.equal(Object.isFrozen(result.access), true);
  });
}

for (const [name, overrides] of [
  ['porta ausente', { getCommandAccess: undefined }],
  ['falha de metadata', { getCommandAccess: () => { throw new Error('metadata indisponível'); } }],
  ['resposta inválida', { getCommandAccess: () => ({ resolved: true, isOwner: 'true' }) }],
]) {
  test(`${name} não herda privilégio do antigo isOwner`, async () => {
    const result = await resolveLiveCommandDispatchInput(seed('123456789@lid'), port(overrides));
    assert.equal(result.access.resolved, false);
    assert.equal(result.access.isOwner, false);
    assert.equal(result.access.isSubOwner, false);
    assert.equal(result.access.isGroupAdmin, false);
    assert.equal(result.isOwner, false);
  });
}

test('mensagem de grupo sem participante nunca consulta poderes de identidade vazia', async () => {
  let calls = 0;
  const result = await resolveLiveCommandDispatchInput(seed(undefined), port({ getCommandAccess() {
    calls++; return { ...access, isOwner: true };
  } }));
  assert.equal(calls, 0);
  assert.equal(result.access.resolved, false);
  assert.equal(result.isOwner, false);
});

test('contexto que diverge do tipo de conversa não concede acesso', async () => {
  const result = await resolveLiveCommandDispatchInput(seed('123456789@lid'), port({
    getCommandAccess: () => ({ ...access, isGroup: false, isOwner: true }),
  }));
  assert.equal(result.access.resolved, false);
  assert.equal(result.isOwner, false);
});
