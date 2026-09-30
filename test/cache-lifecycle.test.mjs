import test from 'node:test';
import assert from 'node:assert/strict';
import OptimizedCacheManager from '../dados/src/utils/optimizedCache.js';
import PerformanceOptimizer from '../dados/src/utils/performanceOptimizer.js';

class TestCacheManager extends OptimizedCacheManager {
  initializeCaches() {
    this.caches.set('media', { close() {}, flushAll() {}, keys: () => [], getStats: () => ({}) });
  }
}

test('pressão de memória usa o limiar configurado, inclusive com heap pequeno', async t => {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  t.mock.method(process, 'memoryUsage', () => ({heapUsed:80*1024**2, heapTotal:100*1024**2, rss:100*1024**2,external:0,arrayBuffers:0}));
  const cache = new TestCacheManager();
  t.after(() => cache.stopMonitoring());
  cache.configure({memoryThreshold:0.75});
  const optimize = t.mock.method(cache, 'optimizeMemory', async () => {});
  await cache.checkMemoryUsage();
  assert.equal(optimize.mock.callCount(), 1);
  assert.equal(optimize.mock.calls[0].arguments[0], 'high_memory_usage');
});

test('encerrar caches chama close e cancela verificação inicial e monitor periódico', t => {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const cache = new TestCacheManager();
  const check = t.mock.method(cache, 'checkMemoryUsage', async () => {});
  const close = t.mock.method(cache.caches.get('media'), 'close');
  cache.stopMonitoring();
  t.mock.timers.tick(11*60*1000);
  assert.equal(check.mock.callCount(), 0);
  assert.equal(close.mock.callCount(), 1);
});

test('shutdown do otimizador encerra também os monitores dos caches', async () => {
  let stopped = 0;
  const optimizer = Object.create(PerformanceOptimizer.prototype);
  optimizer.cache = {forceCleanup() {},stopMonitoring() {stopped++;}};
  optimizer.staticCache = new Map();
  optimizer.fileCache = new Map();
  assert.equal(await optimizer.shutdown(), true);
  assert.equal(stopped, 1);
});
