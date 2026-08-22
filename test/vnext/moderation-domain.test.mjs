import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  MODERATION_COMMAND_DESCRIPTORS,
  MODERATION_COMMAND_TOKENS,
  findModerationCommandDescriptor,
} from '../../dist-vnext/moderation/catalog.js';
import { ModerationDomainDispatchTarget } from '../../dist-vnext/moderation/domain.js';

function sameId(first, second) {
  return String(first || '').split('@')[0] === String(second || '').split('@')[0];
}

function removeUserFromMap(map, userId) {
  if (!map || !userId) return false;
  let removed = false;
  for (const key of Object.keys(map)) {
    if (sameId(key, userId)) {
      delete map[key];
      removed = true;
    }
  }
  return removed;
}

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-moderation-'));
  const groupFile = path.join(root, 'group.json');
  fs.writeFileSync(groupFile, JSON.stringify({ x9: false, mutedUsers: {}, mutedUsers2: {} }));

  const sent = [];
  const participantUpdates = [];
  const replies = [];
  const policyCalls = [];
  const socket = {
    user: { id: 'bot@s.whatsapp.net', lid: 'bot@lid' },
    async sendMessage(jid, content, options) {
      sent.push({ jid, content, options });
    },
    async groupParticipantsUpdate(jid, participants, action) {
      participantUpdates.push({ jid, participants, action });
    },
  };

  const context = {
    socket,
    message: { key: { id: 'command-message' } },
    mediaPath: null,
    messagesCache: {},
    rentalExpirationManager: {},
    prefix: '!',
    botName: 'GYOMEI',
    pushName: 'Teste',
    isOwner: false,
    isLiteMode: false,
    async reply(text, options) { replies.push({ text, options }); },
    async rejectInLiteMode() {},
    isGroup: true,
    isModoBn: true,
    sender: '5511000000000@s.whatsapp.net',
    mentionedUser: '5511000000001@s.whatsapp.net',
    groupId: '120363000000000000@g.us',
    groupMembers: [
      '5511000000000@s.whatsapp.net',
      '5511000000001@s.whatsapp.net',
      '5511000000002@s.whatsapp.net',
    ],
    getUserName: (id) => String(id).split('@')[0],
    buildGroupFilePath: () => groupFile,
    isGroupAdmin: true,
    isRealGroupAdmin: true,
    isBotAdmin: true,
    query: '',
    groupName: 'Grupo Teste',
    groupFile,
    groupData: { x9: false, mutedUsers: {}, mutedUsers2: {} },
    quotedContextInfo: null,
    quotedParticipant: null,
    botIds: ['bot@s.whatsapp.net', 'bot@lid'],
    identitiesMatch: sameId,
    async validateModerationTarget(action, target) {
      policyCalls.push({ action, target });
      return { allowed: true, targetId: target || context.mentionedUser };
    },
    removeUserFromMap,
    ...overrides,
  };

  return {
    root,
    groupFile,
    context,
    sent,
    participantUpdates,
    replies,
    policyCalls,
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); },
  };
}

test('catálogo de moderação cobre onze famílias completas e 26 tokens únicos', () => {
  assert.equal(MODERATION_COMMAND_DESCRIPTORS.length, 11);
  assert.equal(MODERATION_COMMAND_TOKENS.length, 26);
  assert.equal(new Set(MODERATION_COMMAND_TOKENS).size, 26);
  for (const token of MODERATION_COMMAND_TOKENS) {
    assert.ok(findModerationCommandDescriptor(token), `alias sem descriptor: ${token}`);
  }
});

test('comando fora do kernel permanece no fallback legado', async () => {
  const fx = fixture();
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('ping', fx.context), false);
    assert.equal(fx.sent.length, 0);
    assert.equal(fx.replies.length, 0);
  } finally {
    fx.cleanup();
  }
});

test('ban exige administrador real mesmo quando moderador possui acesso efetivo', async () => {
  const fx = fixture({ isGroupAdmin: true, isRealGroupAdmin: false });
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('ban', fx.context), true);
    assert.equal(fx.participantUpdates.length, 0);
    assert.match(fx.replies[0].text, /administradores do grupo/i);
  } finally {
    fx.cleanup();
  }
});

test('ban autorizado reutiliza policy de alvo e remove exatamente uma vez', async () => {
  const fx = fixture();
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('kick', fx.context), true);
    assert.deepEqual(fx.policyCalls, [{ action: 'ban', target: undefined }]);
    assert.deepEqual(fx.participantUpdates, [{
      jid: fx.context.groupId,
      participants: [fx.context.mentionedUser],
      action: 'remove',
    }]);
  } finally {
    fx.cleanup();
  }
});

test('moderador autorizado pode mutar sem receber privilégio de ban', async () => {
  const fx = fixture({ isGroupAdmin: true, isRealGroupAdmin: false, isBotAdmin: true });
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('mutar', fx.context), true);
    const persisted = JSON.parse(fs.readFileSync(fx.groupFile, 'utf8'));
    assert.equal(persisted.mutedUsers[fx.context.mentionedUser], true);
    assert.equal(fx.sent.length, 1);
    assert.match(fx.sent[0].content.text, /foi mutado/i);
  } finally {
    fx.cleanup();
  }
});

test('mute2 preserva bucket mutedUsers2 e desmute2 remove identidade equivalente', async () => {
  const fx = fixture();
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('mute2', fx.context), true);
    let persisted = JSON.parse(fs.readFileSync(fx.groupFile, 'utf8'));
    assert.equal(persisted.mutedUsers2[fx.context.mentionedUser], true);

    assert.equal(await target.dispatch('unmute2', fx.context), true);
    persisted = JSON.parse(fs.readFileSync(fx.groupFile, 'utf8'));
    assert.equal(Object.keys(persisted.mutedUsers2).length, 0);
  } finally {
    fx.cleanup();
  }
});

test('blockuser persiste motivo no formato legado e unblockuser remove o alvo', async () => {
  const fx = fixture({ query: '@5511000000001 spam recorrente' });
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('blockuser', fx.context), true);
    let persisted = JSON.parse(fs.readFileSync(fx.groupFile, 'utf8'));
    assert.equal(persisted.blockedUsers[fx.context.mentionedUser].reason, 'spam recorrente');
    assert.equal(typeof persisted.blockedUsers[fx.context.mentionedUser].timestamp, 'number');

    assert.equal(await target.dispatch('unblockuser', fx.context), true);
    persisted = JSON.parse(fs.readFileSync(fx.groupFile, 'utf8'));
    assert.equal(Object.keys(persisted.blockedUsers).length, 0);
  } finally {
    fx.cleanup();
  }
});

test('delete usa chave da mensagem citada e não exige admin real', async () => {
  const fx = fixture({
    isGroupAdmin: true,
    isRealGroupAdmin: false,
    quotedContextInfo: {
      stanzaId: 'quoted-id',
      participant: '5511000000002@s.whatsapp.net',
    },
  });
  try {
    const target = new ModerationDomainDispatchTarget();
    assert.equal(await target.dispatch('d', fx.context), true);
    assert.deepEqual(fx.sent[0].content, {
      delete: {
        remoteJid: fx.context.groupId,
        fromMe: false,
        id: 'quoted-id',
        participant: '5511000000002@s.whatsapp.net',
      },
    });
  } finally {
    fx.cleanup();
  }
});
