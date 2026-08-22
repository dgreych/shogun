import assert from 'node:assert/strict';
import test from 'node:test';

import { AtomicDomainDispatchTarget } from '../../dist-vnext/runtime/atomic-domain.js';

test('domínio staged nunca reclama tokens e preserva o bridge inteiro', async () => {
  const calls = [];
  const domain = new AtomicDomainDispatchTarget({
    name: 'members',
    state: 'staged',
    tokens: ['perfil', 'ping'],
    target: {
      async dispatch(command) {
        calls.push(command);
        return true;
      },
    },
  });

  assert.equal(await domain.dispatch('perfil', {}), false);
  assert.equal(await domain.dispatch(' PING ', {}), false);
  assert.deepEqual(calls, []);
});

test('domínio active exige que todo token owned seja tratado', async () => {
  const calls = [];
  const domain = new AtomicDomainDispatchTarget({
    name: 'members',
    state: 'active',
    tokens: ['perfil', 'ping'],
    target: {
      async dispatch(command) {
        calls.push(command);
        return command === 'perfil';
      },
    },
  });

  assert.equal(await domain.dispatch('perfil', {}), true);
  assert.deepEqual(calls, ['perfil']);

  await assert.rejects(
    () => domain.dispatch('ping', {}),
    /está ativo, mas recusou o token owned ping/,
  );
});

test('token fora do domínio nunca é interceptado', async () => {
  const domain = new AtomicDomainDispatchTarget({
    name: 'members',
    state: 'active',
    tokens: ['perfil'],
    target: {
      async dispatch() {
        throw new Error('não deveria executar');
      },
    },
  });

  assert.equal(await domain.dispatch('ban', {}), false);
});
