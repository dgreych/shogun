import NodeCache from 'node-cache';
import zlib from 'node:zlib';
import { serialize, deserialize } from 'node:v8';
const CACHE_DEFINITIONS = [
    ['msgRetry', 120, 30, 1000], ['groupMeta', 600, 120, 500],
    ['indexGroupMeta', 10, 30, 500], ['messages', 60, 15, 2000],
    ['userData', 1800, 300, 2000], ['commands', 300, 60, 5000],
    ['media', 30, 10, 100],
];
const NATIVE_LEAF_PROTOTYPES = new Set([
    Buffer.prototype, ArrayBuffer.prototype, Date.prototype, DataView.prototype,
    Uint8Array.prototype, Uint8ClampedArray.prototype, Uint16Array.prototype, Uint32Array.prototype,
    Int8Array.prototype, Int16Array.prototype, Int32Array.prototype,
    Float32Array.prototype, Float64Array.prototype, BigInt64Array.prototype, BigUint64Array.prototype,
]);
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
// V8 conserva os tipos nativos abaixo, mas não o protótipo de classes próprias.
function preservesTypes(value, seen = new Set()) {
    if (typeof value === 'function' || typeof value === 'symbol')
        return false;
    if (value === null || typeof value !== 'object')
        return true;
    if (seen.has(value))
        return true;
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (NATIVE_LEAF_PROTOTYPES.has(prototype))
        return true;
    if (prototype === RegExp.prototype)
        return value.lastIndex === 0;
    if (prototype === Map.prototype) {
        for (const [key, item] of value)
            if (!preservesTypes(key, seen) || !preservesTypes(item, seen))
                return false;
        return true;
    }
    if (prototype === Set.prototype) {
        for (const item of value)
            if (!preservesTypes(item, seen))
                return false;
        return true;
    }
    if (prototype !== Object.prototype && prototype !== Array.prototype)
        return false;
    return Object.values(value).every(item => preservesTypes(item, seen));
}
export default class OptimizedCacheManager {
    caches = new Map();
    memoryThreshold = 0.95;
    cleanupInterval = 5 * 60 * 1000;
    compressionEnabled = true;
    isOptimizing = false;
    lruOrder = new Map();
    accessCounts = new Map();
    memoryMonitorId = null;
    initialMemoryCheckId = null;
    constructor() {
        this.initializeCaches();
        this.startMemoryMonitoring();
    }
    metadataKey(type, key) {
        return `${JSON.stringify(type)}:${String(key)}`;
    }
    touch(type, key) {
        const id = this.metadataKey(type, key);
        this.lruOrder.set(id, Date.now());
        this.accessCounts.set(id, (this.accessCounts.get(id) ?? 0) + 1);
    }
    forget(type, key) {
        const id = this.metadataKey(type, key);
        this.lruOrder.delete(id);
        this.accessCounts.delete(id);
    }
    forgetCache(type) {
        const prefix = `${JSON.stringify(type)}:`;
        for (const id of this.lruOrder.keys())
            if (id.startsWith(prefix)) {
                this.lruOrder.delete(id);
                this.accessCounts.delete(id);
            }
    }
    initializeCaches() {
        for (const [type, stdTTL, checkperiod, maxKeys] of CACHE_DEFINITIONS) {
            const cache = new NodeCache({ stdTTL, checkperiod, maxKeys, useClones: false, deleteOnExpire: true, forceString: false });
            // Também cobre consumidores síncronos que obtêm o NodeCache diretamente.
            cache.on('set', (key) => this.touch(type, key));
            cache.on('del', (key) => this.forget(type, key));
            cache.on('expired', (key) => this.forget(type, key));
            cache.on('flush', () => this.forgetCache(type));
            this.caches.set(type, cache);
        }
    }
    getCache(type) { return this.caches.get(type); }
    async getIndexGroupMeta(groupId) { return this.get('indexGroupMeta', groupId); }
    async setIndexGroupMeta(groupId, value) { return this.set('indexGroupMeta', groupId, value, 10); }
    async set(cacheType, key, value, ttl = null) {
        try {
            const cache = this.caches.get(cacheType);
            if (!cache)
                return false;
            const finalValue = this.compressionEnabled && this.shouldCompress(value) ? await this.compressData(value) : value;
            const accessCount = (this.accessCounts.get(this.metadataKey(cacheType, key)) ?? 0) + 1;
            const dynamicTtl = ttl === null && accessCount > 5 ? Math.min(3600, accessCount * 60) : ttl;
            // TTL zero é a opção explícita de não expirar. Eventos só atualizam metadata após sucesso.
            return dynamicTtl === null ? cache.set(key, finalValue) : cache.set(key, finalValue, dynamicTtl);
        }
        catch (error) {
            console.error(`❌ Erro ao definir cache ${cacheType}:`, errorMessage(error));
            return false;
        }
    }
    async get(cacheType, key) {
        try {
            const cache = this.caches.get(cacheType);
            if (!cache)
                return undefined;
            const value = cache.get(key);
            if (value === undefined)
                return undefined;
            this.touch(cacheType, key);
            // A opção controla novas escritas; entradas existentes continuam legíveis.
            return this.isCompressed(value) ? await this.decompressData(value) : value;
        }
        catch (error) {
            console.error(`❌ Erro ao obter cache ${cacheType}:`, errorMessage(error));
            return undefined;
        }
    }
    del(cacheType, key) {
        try {
            return this.caches.get(cacheType)?.del(key) ?? false;
        }
        catch (error) {
            console.error(`❌ Erro ao remover cache ${cacheType}:`, errorMessage(error));
            return false;
        }
    }
    clear(cacheType) {
        const cache = this.caches.get(cacheType);
        if (!cache)
            return false;
        cache.flushAll();
        return true;
    }
    shouldCompress(data) {
        try {
            return preservesTypes(data) && serialize(data).length > 1024;
        }
        catch {
            return false;
        }
    }
    async compressData(data) {
        try {
            if (!preservesTypes(data))
                return data;
            const bytes = serialize(data);
            const compressed = zlib.gzipSync(bytes);
            return { __compressed: true, encoding: 'v8', data: compressed, originalSize: bytes.length, compressedSize: compressed.length, timestamp: Date.now() };
        }
        catch (error) {
            console.error('❌ Erro na compressão:', errorMessage(error));
            return data;
        }
    }
    isCompressed(data) {
        if (data === null || typeof data !== 'object')
            return false;
        const record = data;
        return record.__compressed === true && record.data instanceof Uint8Array;
    }
    async decompressData(data) {
        try {
            if (!this.isCompressed(data))
                return data;
            const bytes = zlib.gunzipSync(data.data);
            // Compatibilidade com envelopes JSON criados pela implementação anterior.
            return data.encoding === 'v8' ? deserialize(bytes) : JSON.parse(bytes.toString());
        }
        catch (error) {
            console.error('❌ Erro na descompressão:', errorMessage(error));
            return data;
        }
    }
    startMemoryMonitoring() {
        if (this.memoryMonitorId !== null)
            clearInterval(this.memoryMonitorId);
        if (this.initialMemoryCheckId !== null)
            clearTimeout(this.initialMemoryCheckId);
        this.memoryMonitorId = setInterval(async () => { await this.checkMemoryUsage(); }, this.cleanupInterval);
        this.memoryMonitorId.unref?.();
        this.initialMemoryCheckId = setTimeout(() => { void this.checkMemoryUsage(); }, 10000);
        this.initialMemoryCheckId.unref?.();
    }
    async checkMemoryUsage() {
        try {
            const memory = process.memoryUsage();
            if (memory.heapUsed / memory.heapTotal > this.memoryThreshold)
                await this.optimizeMemory('high_memory_usage');
            else if (Math.round(memory.heapUsed / 1024 / 1024) > 300)
                await this.optimizeMemory('moderate_memory_usage');
            if (Date.now() % (30 * 60 * 1000) < this.cleanupInterval)
                this.logCacheStatistics();
        }
        catch (error) {
            console.error('❌ Erro ao verificar uso de memória:', errorMessage(error));
        }
    }
    async optimizeMemory(reason) {
        if (this.isOptimizing)
            return;
        this.isOptimizing = true;
        try {
            for (const type of ['media', 'messages', 'commands', 'userData', 'indexGroupMeta', 'groupMeta', 'msgRetry']) {
                const cache = this.caches.get(type);
                if (cache) {
                    if (reason === 'high_memory_usage' && !['media', 'messages'].includes(type))
                        await this.removeOldCacheItems(cache, 0.5);
                    else
                        cache.flushAll();
                }
                global.gc?.();
            }
            global.gc?.();
        }
        catch (error) {
            console.error('❌ Erro durante otimização de memória:', errorMessage(error));
        }
        finally {
            this.isOptimizing = false;
        }
    }
    async removeOldCacheItems(cache, percentage) {
        try {
            if (!Number.isFinite(percentage) || percentage <= 0)
                return;
            const keys = cache.keys();
            const count = Math.floor(keys.length * Math.min(1, percentage));
            if (count === 0)
                return;
            const type = [...this.caches].find(([, candidate]) => candidate === cache)?.[0];
            const lastAccess = (key) => type === undefined ? 0 : this.lruOrder.get(this.metadataKey(type, key)) ?? 0;
            for (const key of keys.sort((a, b) => lastAccess(a) - lastAccess(b)).slice(0, count))
                cache.del(key);
        }
        catch (error) {
            console.error('❌ Erro ao remover itens antigos do cache:', errorMessage(error));
        }
    }
    logCacheStatistics() {
        for (const cache of this.caches.values()) {
            cache.keys();
            cache.getStats();
        }
    }
    getStatistics() {
        const caches = {};
        for (const [type, cache] of this.caches)
            caches[type] = { keys: cache.keys().length, stats: cache.getStats() };
        return { memory: process.memoryUsage(), caches, isOptimizing: this.isOptimizing, compressionEnabled: this.compressionEnabled };
    }
    configure(options = {}) {
        if (options.memoryThreshold !== undefined)
            this.memoryThreshold = Math.max(0.5, Math.min(0.95, options.memoryThreshold));
        if (options.cleanupInterval !== undefined)
            this.cleanupInterval = Math.max(60000, options.cleanupInterval);
        if (options.compressionEnabled !== undefined)
            this.compressionEnabled = options.compressionEnabled;
    }
    forceCleanup() {
        for (const cache of this.caches.values())
            cache.flushAll();
        global.gc?.();
    }
    stopMonitoring() {
        if (this.memoryMonitorId !== null)
            clearInterval(this.memoryMonitorId);
        if (this.initialMemoryCheckId !== null)
            clearTimeout(this.initialMemoryCheckId);
        this.memoryMonitorId = null;
        this.initialMemoryCheckId = null;
        for (const cache of this.caches.values())
            cache.close();
        this.isOptimizing = false;
    }
}
//# sourceMappingURL=optimized-cache.js.map