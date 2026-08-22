import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MembersDomainDispatchTarget,
  MEMBERS_GENERATED_COMMAND_TOKENS,
} from '../../dist-vnext/members/domain.js';

test('catálogo Members fecha 29 famílias-base com duplicatas no mesmo cutover', () => {
  assert.equal(MEMBERS_GENERATED_COMMAND_TOKENS.length, 152);
  assert.equal(new Set(MEMBERS_GENERATED_COMMAND_TOKENS).size, 152);
  for (const token of ['perfil', 'roles', 'perfilrpg', 'slotmachine', 'sell', 'inventory']) {
    assert.ok(MEMBERS_GENERATED_COMMAND_TOKENS.includes(token), `token ${token} precisa pertencer ao cutover Members`);
  }
});

test('Members staged não intercepta nenhum token nem monta scope', async () => {
  let builds = 0;
  const target = new MembersDomainDispatchTarget({ state: 'staged' });
  const handled = await target.dispatch('perfil', {
    buildMembersScope() {
      builds += 1;
      throw new Error('não deveria montar');
    },
  });

  assert.equal(handled, false);
  assert.equal(builds, 0);
});

test('Members active monta scope somente para token owned e executa handler extraído', async () => {
  const replies = [];
  let builds = 0;
  const target = new MembersDomainDispatchTarget({ state: 'active' });
  const context = {
    buildMembersScope() {
      builds += 1;
      return {
        command: '',
        ROLE_GOING_BASE: '✅',
        ROLE_NOT_GOING_BASE: '❌',
        args: [],
        formatRoleSummary: () => '',
        from: 'grupo@g.us',
        groupData: { roles: {} },
        groupPrefix: '!',
        isGroup: true,
        isGroupAdmin: true,
        nazu: { sendMessage: async () => ({}) },
        normalizar: (value) => String(value || '').toLowerCase(),
        reply: async (text) => { replies.push(text); },
        sender: '5511999999999@s.whatsapp.net',
      };
    },
  };

  assert.equal(await target.dispatch('comando-fora', context), false);
  assert.equal(builds, 0);

  assert.equal(await target.dispatch('roles', context), true);
  assert.equal(builds, 1);
  assert.deepEqual(replies, ['🪩 Nenhum rolê ativo no momento.']);
});

test('falha estrutural de scope abre circuit breaker apenas de Members e preserva legado', async () => {
  const reports = [];
  let builds = 0;
  const target = new MembersDomainDispatchTarget({
    state: 'active',
    reportError(message, error) {
      reports.push({ message, error });
    },
  });
  const context = {
    buildMembersScope() {
      builds += 1;
      throw new ReferenceError('binding ausente');
    },
  };

  assert.equal(await target.dispatch('perfil', context), false);
  assert.equal(await target.dispatch('ping', context), false);
  assert.equal(builds, 1, 'circuit breaker deve impedir novas montagens quebradas');
  assert.equal(reports.length, 1);
  assert.match(reports[0].message, /circuit breaker de Members aberto/);
});
