import assert from 'node:assert/strict';
import test from 'node:test';

import { CommandDispatchHarness } from '../../dist-vnext/commands/dispatch-harness.js';
import { CommandRegistry } from '../../dist-vnext/commands/registry.js';

function message(overrides = {}) {
  return {
    chatId: 'grupo@g.us',
    senderId: 'usuario@s.whatsapp.net',
    kind: 'group',
    text: '!teste',
    ...overrides,
  };
}

function handler(name, aliases = [], options = {}) {
  const calls = [];
  return {
    calls,
    value: {
      name,
      aliases,
      canHandle: options.canHandle ?? (() => true),
      async handle(envelope, context) {
        calls.push({ envelope, context });
      },
    },
  };
}

test('harness resolve alias customizado antes do router', async () => {
  const menu = handler('menu');
  const registry = new CommandRegistry([menu.value]);
  const harness = new CommandDispatchHarness(registry);
  const context = { marker: 'ctx-custom' };

  const result = await harness.dispatch({
    rawCommand: ' ÓI ',
    rawAliases: [{ alias: 'oi', command: 'menu', fixedParams: 'ignorado-aqui' }],
    message: message(),
    context,
  });

  assert.equal(result.dispatched, true);
  assert.equal(result.command, 'menu');
  assert.equal(result.source, 'custom');
  assert.equal(result.matchedAlias?.alias, 'oi');
  assert.equal(menu.calls.length, 1);
  assert.equal(menu.calls[0].envelope.command, 'menu');
  assert.equal(menu.calls[0].context, context);
});

test('harness preserva alias builtin de delete', async () => {
  const deletion = handler('delete');
  const registry = new CommandRegistry([deletion.value]);
  const harness = new CommandDispatchHarness(registry);

  const result = await harness.dispatch({
    rawCommand: ' DÉLÉTAR ',
    rawAliases: [{ alias: 'deletar', command: 'perigoso' }],
    message: message(),
    context: {},
  });

  assert.equal(result.dispatched, true);
  assert.equal(result.command, 'delete');
  assert.equal(result.source, 'builtin');
  assert.equal(result.matchedAlias, null);
  assert.equal(deletion.calls.length, 1);
});

test('harness normaliza comando direto antes do registry', async () => {
  const menu = handler('menu');
  const harness = new CommandDispatchHarness(new CommandRegistry([menu.value]));

  const result = await harness.dispatch({
    rawCommand: ' MÉNU ',
    message: message(),
    context: {},
  });

  assert.deepEqual(
    { dispatched: result.dispatched, command: result.command, source: result.source },
    { dispatched: true, command: 'menu', source: 'direct' },
  );
  assert.equal(menu.calls.length, 1);
});

test('harness respeita canHandle do router', async () => {
  const guarded = handler('admin', [], { canHandle: () => false });
  const harness = new CommandDispatchHarness(new CommandRegistry([guarded.value]));

  const result = await harness.dispatch({
    rawCommand: 'admin',
    message: message(),
    context: {},
  });

  assert.equal(result.dispatched, false);
  assert.equal(result.command, 'admin');
  assert.equal(guarded.calls.length, 0);
});

test('harness retorna false para comando desconhecido sem efeitos colaterais', async () => {
  const known = handler('menu');
  const harness = new CommandDispatchHarness(new CommandRegistry([known.value]));

  const result = await harness.dispatch({
    rawCommand: ' inexistente ',
    message: message(),
    context: {},
  });

  assert.equal(result.dispatched, false);
  assert.equal(result.command, 'inexistente');
  assert.equal(result.source, 'direct');
  assert.equal(known.calls.length, 0);
});

test('registry continua recusando tokens duplicados no harness', () => {
  const first = handler('menu', ['m']);
  const second = handler('m');
  assert.throws(
    () => new CommandRegistry([first.value, second.value]),
    /Duplicate vNext command token: m/,
  );
});
