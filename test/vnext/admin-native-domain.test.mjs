import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AdminCollectionsDispatchTarget } from '../../dist-vnext/admin/collections-domain.js';
import { AdminGroupDispatchTarget } from '../../dist-vnext/admin/group-domain.js';
import { AdminSettingsDispatchTarget } from '../../dist-vnext/admin/settings-domain.js';
import { AdminBooleanSettingsDispatchTarget } from '../../dist-vnext/admin/toggle-domain.js';
import { ToolsDomainDispatchTarget } from '../../dist-vnext/tools/domain.js';

function sameId(first, second) {
  return String(first || '').split('@')[0] === String(second || '').split('@')[0];
}

function fixture(seed = {}, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gyomei-admin-native-'));
  const groupFile = path.join(root, 'group.json');
  const initial = { ...seed };
  fs.writeFileSync(groupFile, JSON.stringify(initial));

  const replies = [];
  const participantUpdates = [];
  const subjectUpdates = [];
  const socket = {
    user: { id: 'bot@s.whatsapp.net', lid: 'bot@lid' },
    async sendMessage() {},
    async groupMetadata() {
      return {
        subject: 'Grupo Teste',
        desc: 'Descrição de teste',
        participants: [
          { id: '5511000000000@s.whatsapp.net', admin: 'admin' },
          { id: '5511000000001@s.whatsapp.net', admin: null },
          { id: '5511000000002@s.whatsapp.net', admin: null },
        ],
      };
    },
    async groupInviteCode() { return 'CODIGOTESTE'; },
    async groupParticipantsUpdate(jid, participants, action) {
      participantUpdates.push({ jid, participants, action });
    },
    async groupUpdateSubject(jid, subject) {
      subjectUpdates.push({ jid, subject });
    },
    async groupUpdateDescription() {},
    async groupSettingUpdate() {},
    async groupGetRequestParticipants() { return []; },
  };

  const context = {
    socket,
    message: { key: { id: 'command-message' } },
    mediaPath: null,
    messagesCache: {},
    rentalExpirationManager: {},
    prefix: '!',
    groupPrefix: '!',
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
    groupData: { ...initial },
    quotedContextInfo: null,
    quotedParticipant: null,
    botIds: ['bot@s.whatsapp.net', 'bot@lid'],
    identitiesMatch: sameId,
    async validateModerationTarget(_action, target) {
      return { allowed: true, targetId: target || context.mentionedUser };
    },
    removeUserFromMap() { return false; },
    ...overrides,
  };

  return {
    root,
    groupFile,
    context,
    replies,
    participantUpdates,
    subjectUpdates,
    read() { return JSON.parse(fs.readFileSync(groupFile, 'utf8')); },
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); },
  };
}

test('antilinkhard é tratado nativamente e persiste o mesmo campo legado', async () => {
  const fx = fixture({ antilinkhard: false });
  try {
    const domain = new AdminBooleanSettingsDispatchTarget();
    assert.equal(await domain.dispatch('antilinkhard', fx.context), true);
    assert.equal(fx.read().antilinkhard, true);
    assert.equal(fx.context.groupData.antilinkhard, true);
    assert.match(fx.replies.at(-1).text, /ativado/i);
  } finally {
    fx.cleanup();
  }
});

test('limitmessage preserva formato persistido de quantidade, intervalo e ação', async () => {
  const fx = fixture({}, { query: '5 1m ban' });
  try {
    const domain = new AdminSettingsDispatchTarget();
    assert.equal(await domain.dispatch('limitmessage', fx.context), true);
    const persisted = fx.read().messageLimit;
    assert.equal(persisted.enabled, true);
    assert.equal(persisted.limit, 5);
    assert.equal(persisted.interval, 60);
    assert.equal(persisted.action, 'ban');
    assert.deepEqual(persisted.warnings, {});
    assert.deepEqual(persisted.users, {});
  } finally {
    fx.cleanup();
  }
});

test('terceira advertência mantém regra histórica de ban e limpa o bucket', async () => {
  const target = '5511000000001@s.whatsapp.net';
  const seed = {
    warnings: {
      [target]: [
        { reason: 'um', timestamp: 1, issuer: '5511000000000@s.whatsapp.net' },
        { reason: 'dois', timestamp: 2, issuer: '5511000000000@s.whatsapp.net' },
      ],
    },
  };
  const fx = fixture(seed, { query: '@5511000000001 três' });
  try {
    const domain = new AdminCollectionsDispatchTarget();
    assert.equal(await domain.dispatch('adv', fx.context), true);
    assert.deepEqual(fx.participantUpdates, [{
      jid: fx.context.groupId,
      participants: [target],
      action: 'remove',
    }]);
    assert.equal(fx.read().warnings[target], undefined);
    assert.match(fx.replies.at(-1).text, /3 advertências/i);
  } finally {
    fx.cleanup();
  }
});

test('setname usa porta de grupo e não depende do executor legado', async () => {
  const fx = fixture({}, { query: 'Novo Nome' });
  try {
    const domain = new AdminGroupDispatchTarget();
    assert.equal(await domain.dispatch('setname', fx.context), true);
    assert.deepEqual(fx.subjectUpdates, [{ jid: fx.context.groupId, subject: 'Novo Nome' }]);
    assert.match(fx.replies.at(-1).text, /Novo Nome/);
  } finally {
    fx.cleanup();
  }
});

test('hora é executado pelo domínio tools e comando estranho é recusado', async () => {
  const fx = fixture({}, { query: 'japao' });
  try {
    const domain = new ToolsDomainDispatchTarget();
    assert.equal(await domain.dispatch('desconhecido', fx.context), false);
    assert.equal(await domain.dispatch('hora', fx.context), true);
    assert.match(fx.replies.at(-1).text, /Horário em japao/i);
  } finally {
    fx.cleanup();
  }
});
