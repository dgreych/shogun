import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OptimizedCacheManager from './optimizedCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sistema de otimização de performance
 * Cacheia dados estáticos e otimiza operações frequentes
 * NÃO cacheia dados críticos (economy, leveling)
 */
class PerformanceOptimizer {
  constructor() {
    this.cache = new OptimizedCacheManager();
    
    // Cache de dados estáticos (sem TTL, só limpa manualmente)
    this.staticCache = new Map();
    
    // Regex pré-compiladas
    this.compiledRegex = new Map();
    
    // Cache de arquivos estáticos com TTL
    this.fileCache = new Map(); // { path: { data, timestamp, ttl } }
    
    // Estatísticas
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      regexCompiled: 0,
      filesCached: 0
    };
    
    // Inicialização básica (síncrona)
    this.precompileCommonRegex();
    
    // Limpa cache de arquivos periodicamente
    this.cleanupIntervalId = setInterval(() => this.cleanupFileCache(), 5 * 60 * 1000); // 5 minutos
  }

  async initialize() {
    // Já inicializado no constructor, mas mantém para compatibilidade
    // Pode ser usado para inicializações assíncronas adicionais no futuro
    return Promise.resolve();
  }

  /**
   * Compatibilidade com código existente
   */
  get modules() {
    return {
      cacheManager: this.cache
    };
  }

  /**
   * Pré-compila regex comuns
   */
  precompileCommonRegex() {
    const commonPatterns = {
      // Comandos
      commandSplit: /\s+/,
      commandPrefix: /^[!\.\/#\$\%\&\*\+\-\.\:\;\<\=\>\?\@\[\]\^\_\{\}\|\\]/,
      mentionRegex: /@(\d+)/g,
      urlRegex: /https?:\/\/[^\s]+/g,
      phoneRegex: /\d{10,15}/g,
      
      // Normalização
      whitespace: /\s+/g,
      specialChars: /[^\w\s]/g,
      numbers: /\d+/g,
      
      // Validação
      jidRegex: /^\d+@[sgl]\.whatsapp\.net$/,
      groupIdRegex: /\d+@g\.us$/,
      userIdRegex: /\d+@[sl]\.whatsapp\.net$/,
      
      // Parsing
      jsonParse: /^[\s\S]*$/,
      base64: /^[A-Za-z0-9+/=]+$/,
      
      // Strings
      trim: /^\s+|\s+$/g,
      multipleSpaces: /\s{2,}/g
    };

    for (const [name, pattern] of Object.entries(commonPatterns)) {
      this.compiledRegex.set(name, pattern);
      this.stats.regexCompiled++;
    }
  }

  /**
   * Obtém regex compilada
   */
  getRegex(name) {
    return this.compiledRegex.get(name);
  }

  /**
   * Compila e cacheia regex
   */
  compileRegex(name, pattern, flags = '') {
    if (this.compiledRegex.has(name)) {
      return this.compiledRegex.get(name);
    }
    
    try {
      const regex = new RegExp(pattern, flags);
      this.compiledRegex.set(name, regex);
      this.stats.regexCompiled++;
      return regex;
    } catch (error) {
      console.error(`❌ Erro ao compilar regex ${name}:`, error.message);
      return null;
    }
  }

  /**
   * Cacheia dados estáticos (configurações, menus, etc.)
   */
  setStatic(key, value) {
    this.staticCache.set(key, value);
    return true;
  }

  /**
   * Obtém dados estáticos
   */
  getStatic(key) {
    return this.staticCache.get(key);
  }

  /**
   * Limpa cache estático
   */
  clearStatic(key = null) {
    if (key) {
      return this.staticCache.delete(key);
    }
    this.staticCache.clear();
    return true;
  }

  /**
   * Cacheia arquivo JSON com TTL
   * Usado para arquivos que mudam raramente (config, premium, etc.)
   */
  async getCachedFile(filePath, ttl = 60000, loader = null) {
    const cacheKey = `file:${filePath}`;
    const cached = this.fileCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.stats.cacheHits++;
      return cached.data;
    }

    this.stats.cacheMisses++;
    
    try {
      let data;
      if (loader) {
        data = await loader(filePath);
      } else {
        // Loader padrão para JSON
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          data = JSON.parse(content);
        } else {
          data = {};
        }
      }
      
      this.fileCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl
      });
      
      this.stats.filesCached++;
      return data;
    } catch (error) {
      console.error(`❌ Erro ao carregar arquivo ${filePath}:`, error.message);
      return cached?.data || {};
    }
  }

  /**
   * Invalida cache de arquivo
   */
  invalidateFile(filePath) {
    const cacheKey = `file:${filePath}`;
    return this.fileCache.delete(cacheKey);
  }

  /**
   * Limpa cache de arquivos expirados
   */
  cleanupFileCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of this.fileCache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.fileCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      // console.log(`🧹 Limpeza de cache: ${cleaned} arquivos expirados`);
    }
  }

  /**
   * Cacheia resultado de função com TTL
   */
  async memoize(key, fn, ttl = 60000) {
    const cached = await this.cache.get('memoize', key);
    if (cached !== undefined) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    const result = await fn();
    await this.cache.set('memoize', key, result, ttl);
    return result;
  }

  /**
   * Otimiza string operations
   */
  optimizeString(str) {
    if (typeof str !== 'string') return str;
    
    // Remove espaços múltiplos
    const multipleSpaces = this.getRegex('multipleSpaces');
    if (multipleSpaces) {
      str = str.replace(multipleSpaces, ' ');
    }
    
    return str.trim();
  }

  /**
   * Normaliza comando (otimizado)
   */
  normalizeCommand(cmd) {
    if (!cmd || typeof cmd !== 'string') return '';
    
    // Remove prefixo se existir
    const prefixRegex = this.getRegex('commandPrefix');
    if (prefixRegex && prefixRegex.test(cmd)) {
      cmd = cmd.substring(1);
    }
    
    return cmd.toLowerCase().trim();
  }

  /**
   * Split otimizado de comandos
   */
  splitCommand(text) {
    const splitRegex = this.getRegex('commandSplit');
    if (splitRegex) {
      return text.split(splitRegex);
    }
    return text.split(/\s+/);
  }

  /**
   * Cacheia dados de grupo com TTL curto (5-10 segundos)
   * NÃO cacheia economy/leveling
   */
  async getGroupDataCached(groupId, loader, ttl = 5000) {
    const cacheKey = `group:${groupId}`;
    
    const cached = await this.cache.get('indexGroupMeta', cacheKey);
    if (cached !== undefined) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    const data = await loader();
    
    // Só cacheia se não for dados críticos
    if (data && !data.economy && !data.leveling) {
      await this.cache.set('indexGroupMeta', cacheKey, data, ttl);
    }
    
    return data;
  }

  /**
   * Invalida cache de grupo
   */
  invalidateGroup(groupId) {
    const cacheKey = `group:${groupId}`;
    this.cache.del('indexGroupMeta', cacheKey);
  }

  /**
   * Batch operations para múltiplos grupos
   */
  async batchGetGroupData(groupIds, loader, ttl = 5000) {
    const results = {};
    const toLoad = [];
    
    // Verifica cache primeiro
    for (const groupId of groupIds) {
      const cacheKey = `group:${groupId}`;
      const cached = await this.cache.get('indexGroupMeta', cacheKey);
      if (cached !== undefined) {
        results[groupId] = cached;
        this.stats.cacheHits++;
      } else {
        toLoad.push(groupId);
      }
    }
    
    // Carrega os que não estão em cache
    if (toLoad.length > 0) {
      const loaded = await loader(toLoad);
      for (const groupId of toLoad) {
        const data = loaded[groupId];
        if (data) {
          results[groupId] = data;
          
          // Cacheia se não for crítico
          if (!data.economy && !data.leveling) {
            const cacheKey = `group:${groupId}`;
            await this.cache.set('indexGroupMeta', cacheKey, data, ttl);
          }
        }
      }
      this.stats.cacheMisses += toLoad.length;
    }
    
    return results;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      staticCacheSize: this.staticCache.size,
      fileCacheSize: this.fileCache.size,
      regexCacheSize: this.compiledRegex.size,
      cacheStats: this.cache.getStatistics()
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      regexCompiled: this.compiledRegex.size,
      filesCached: 0
    };
  }

  /**
   * Cacheia verificação de existência de arquivo
   */
  async fileExists(filePath) {
    const cacheKey = `exists:${filePath}`;
    const cached = this.fileCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5000) { // 5 segundos
      return cached.data;
    }
    
    const exists = fs.existsSync(filePath);
    this.fileCache.set(cacheKey, {
      data: exists,
      timestamp: Date.now(),
      ttl: 5000
    });
    return exists;
  }

  /**
   * Carrega JSON com cache otimizado (padrão comum: existsSync + readFileSync)
   */
  async loadJsonWithCache(filePath, defaultValue = {}) {
    const cacheKey = `json:${filePath}`;
    const cached = this.fileCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.stats.cacheHits++;
      return cached.data;
    }

    this.stats.cacheMisses++;
    
    try {
      let data;
      if (await this.fileExists(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(content);
      } else {
        data = defaultValue;
      }
      
      this.fileCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: 10000 // 10 segundos para JSONs
      });
      
      this.stats.filesCached++;
      return data;
    } catch (error) {
      console.error(`❌ Erro ao carregar JSON ${filePath}:`, error.message);
      return cached?.data || defaultValue;
    }
  }

  /**
   * Invalida cache de JSON específico
   */
  invalidateJson(filePath) {
    const cacheKey = `json:${filePath}`;
    const existsKey = `exists:${filePath}`;
    this.fileCache.delete(cacheKey);
    this.fileCache.delete(existsKey);
  }

  /**
   * Métodos de compatibilidade para connect.js (síncronos)
   */
  cacheGet(cacheType, key) {
    try {
      const cache = this.cache.getCache(cacheType);
      if (!cache) {
        return undefined;
      }
      return cache.get(key);
    } catch (error) {
      console.error(`❌ Erro ao obter cache ${cacheType}:`, error.message);
      return undefined;
    }
  }

  cacheSet(cacheType, key, value, ttl = null) {
    try {
      const cache = this.cache.getCache(cacheType);
      if (!cache) {
        return false;
      }
      if (ttl) {
        return cache.set(key, value, ttl);
      } else {
        return cache.set(key, value);
      }
    } catch (error) {
      console.error(`❌ Erro ao definir cache ${cacheType}:`, error.message);
      return false;
    }
  }

  async emergencyCleanup() {
    try {
      // Limpa caches menos críticos primeiro
      this.cache.clear('media');
      this.cache.clear('messages');
      // Força garbage collection se disponível
      if (global.gc) {
        global.gc();
      }
      return true;
    } catch (error) {
      console.error('❌ Erro em emergencyCleanup:', error.message);
      return false;
    }
  }

  async shutdown() {
    try {
      // Salva dados importantes antes de fechar
      this.clearAll();
      this.stopMonitoring();
      return true;
    } catch (error) {
      console.error('❌ Erro em shutdown:', error.message);
      return false;
    }
  }

  /**
   * Limpa todos os caches
   */
  clearAll() {
    this.staticCache.clear();
    this.fileCache.clear();
    this.cache.forceCleanup();
  }

  /**
   * Para monitoramento (para shutdown gracioso)
   */
  stopMonitoring() {
    // Limpa intervalos se houver
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.cache.stopMonitoring();
  }
}

// Exporta a classe como default para uso com 'new'
export default PerformanceOptimizer;

// Exporta também como named export
export { PerformanceOptimizer };

// Singleton para uso direto
let optimizerInstance = null;

export function getPerformanceOptimizer() {
  if (!optimizerInstance) {
    optimizerInstance = new PerformanceOptimizer();
  }
  return optimizerInstance;
}
