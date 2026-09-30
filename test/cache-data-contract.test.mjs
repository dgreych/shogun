import test from 'node:test';
import assert from 'node:assert/strict';
import OptimizedCacheManager from '../dados/src/utils/optimizedCache.js';

function manager(t) {
  const cache = new OptimizedCacheManager();
  t.after(() => cache.stopMonitoring());
  return cache;
}

test('expiração e limpeza liberam também metadados, sem crescimento entre ciclos', async t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const cache = manager(t);
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let i = 0; i < 10; i++) await cache.set('commands', `${cycle}:${i}`, 'data', 1);
    now += 2000;
    cache.getCache('commands')._checkData(false);
    assert.equal(cache.getCache('commands').keys().length, 0);
    assert.equal(cache.lruOrder.size, 0);
    assert.equal(cache.accessCounts.size, 0);
  }
  await cache.set('commands', 'clear', 'data');
  cache.clear('commands');
  assert.equal(cache.lruOrder.size, 0);
  assert.equal(cache.accessCounts.size, 0);
  await cache.set('commands', 'force', 'data');
  cache.forceCleanup();
  assert.equal(cache.lruOrder.size, 0);
  assert.equal(cache.accessCounts.size, 0);
});

test('mesma chave em caches distintos conserva TTL e metadados independentes', async t => {
  t.mock.method(Date, 'now', () => 1_000_000);
  const cache = manager(t);
  await cache.set('commands', 'same', 'command');
  for (let i = 0; i < 7; i++) await cache.get('commands', 'same');
  await cache.set('media', 'same', 'media');
  assert.equal(cache.getCache('media').getTtl('same'), 1_030_000);
  cache.del('commands', 'same');
  assert.equal(cache.lruOrder.size, 1);
  assert.equal(cache.accessCounts.size, 1);
  assert.equal(await cache.get('media', 'same'), 'media');
});

test('escrita recusada por cache cheio não cria metadados órfãos', async t => {
  t.mock.method(console, 'error', () => {});
  const cache = manager(t);
  for (let i = 0; i < 100; i++) assert.equal(await cache.set('media', `${i}`, i), true);
  assert.equal(await cache.set('media', 'overflow', 'data'), false);
  assert.equal(cache.getCache('media').keys().length, 100);
  assert.equal(cache.lruOrder.size, 100);
  assert.equal(cache.accessCounts.size, 100);
});

test('TTL zero explícito não ganha expiração dinâmica depois de acessos repetidos', async t => {
  const cache = manager(t);
  await cache.set('commands', 'permanent', 'data');
  for (let i = 0; i < 7; i++) await cache.get('commands', 'permanent');
  assert.equal(await cache.set('commands', 'permanent', 'new', 0), true);
  assert.equal(cache.getCache('commands').getTtl('permanent'), 0);
});

test('compressão conserva Buffer e tipos dos valores aninhados', async t => {
  const cache = manager(t);
  const buffer = Buffer.alloc(2048, 42);
  await cache.set('media', 'buffer', buffer);
  const actual = await cache.get('media', 'buffer');
  assert.equal(Buffer.isBuffer(actual), true);
  assert.deepEqual(actual, buffer);
  const value = {buffer, date: new Date('2026-09-30T00:00:00Z'), map: new Map([['x', 1]])};
  await cache.set('media', 'nested', value);
  assert.deepEqual(await cache.get('media', 'nested'), value);
});

test('desativar novas compressões não expõe envelope de entradas já comprimidas', async t => {
  const cache = manager(t);
  const value = {text: 'x'.repeat(4096)};
  await cache.set('commands', 'compressed', value);
  cache.configure({compressionEnabled: false});
  assert.deepEqual(await cache.get('commands', 'compressed'), value);
});

test('valores de classes customizadas mantêm protótipo e métodos', async t => {
  class Item {
    text = 'x'.repeat(4096);
    label() { return 'custom'; }
  }
  const cache = manager(t);
  const item = new Item();
  await cache.set('commands', 'custom', item);
  const actual = await cache.get('commands', 'custom');
  assert.equal(actual instanceof Item, true);
  assert.equal(actual.label(), 'custom');
});

test('subclasses próprias de typed arrays também mantêm métodos e protótipo', async t => {
  class Packet extends Uint8Array { label() { return 'packet'; } }
  const cache = manager(t);
  const packet = new Packet(2048).fill(42);
  await cache.set('media', 'packet', packet);
  const actual = await cache.get('media', 'packet');
  assert.equal(actual instanceof Packet, true);
  assert.equal(actual.label(), 'packet');
  assert.deepEqual(actual, packet);
});
