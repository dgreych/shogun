import mysql from 'mysql2/promise';

import { TavernValidationError } from '../errors.js';
import { MYSQL_MIGRATIONS } from './mysqlMigrations.js';

function parseMysqlConnectionString(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TavernValidationError('String de conexão MySQL ausente');
  }
  let parsed;
  try {
    parsed = new URL(value.trim().replace(/^jdbc:/i, ''));
  } catch {
    throw new TavernValidationError('String de conexão MySQL inválida');
  }
  if (parsed.protocol !== 'mysql:') {
    throw new TavernValidationError('A conexão da Tavern precisa usar MySQL');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!parsed.hostname || !parsed.username || !database) {
    throw new TavernValidationError('String de conexão MySQL incompleta');
  }
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database
  };
}

function normalizeParams(params) {
  return (params || []).map(value => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

function translateSqliteQuery(sql) {
  return String(sql)
    .replace(/ON\s+CONFLICT\s*\(([^)]+)\)\s+DO\s+NOTHING/gi, (_match, columns) => {
      const firstColumn = columns.split(',')[0].trim();
      return `ON DUPLICATE KEY UPDATE ${firstColumn} = ${firstColumn}`;
    })
    .replace(/ON\s+CONFLICT\s*\([^)]+\)\s+DO\s+UPDATE\s+SET/gi, 'ON DUPLICATE KEY UPDATE')
    .replace(/\bexcluded\.([a-z_][a-z0-9_]*)/gi, 'VALUES($1)')
    .replace(/\btavern_players\.([a-z_][a-z0-9_]*)/gi, '$1')
    .replace(/\btavern_collections\.([a-z_][a-z0-9_]*)/gi, '$1');
}

class MySqlSession {
  constructor(connection) {
    this.connection = connection;
  }

  async exec(sql) {
    await this.connection.query(sql);
  }

  async run(sql, params = []) {
    const [result] = await this.connection.execute(
      translateSqliteQuery(sql),
      normalizeParams(params)
    );
    return {
      changes: Number(result.affectedRows || 0),
      insertId: result.insertId || null
    };
  }

  async all(sql, params = []) {
    const [rows] = await this.connection.execute(
      translateSqliteQuery(sql),
      normalizeParams(params)
    );
    return rows;
  }

  async get(sql, params = []) {
    return (await this.all(sql, params))[0] || null;
  }

  async getForUpdate(sql, params = []) {
    return this.get(`${String(sql).trim().replace(/;$/, '')} FOR UPDATE`, params);
  }
}

class MySqlStore {
  static async open(options = {}) {
    const store = new MySqlStore(options);
    await store.initialize();
    return store;
  }

  constructor({
    connectionString,
    host,
    port,
    user,
    password,
    database,
    connectionLimit = 4,
    connectTimeoutMs = 10_000,
    ssl,
    now = () => new Date().toISOString()
  } = {}) {
    const parsed = connectionString ? parseMysqlConnectionString(connectionString) : {};
    this.options = {
      ...parsed,
      ...(host ? { host } : {}),
      ...(port ? { port: Number(port) } : {}),
      ...(user ? { user } : {}),
      ...(password !== undefined ? { password } : {}),
      ...(database ? { database } : {}),
      ...(ssl ? { ssl } : {}),
      connectionLimit,
      connectTimeout: connectTimeoutMs,
      waitForConnections: true,
      queueLimit: 40,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true,
      decimalNumbers: true,
      multipleStatements: false
    };
    this.options.port = Number(this.options.port || 3306);
    if (!this.options.host || !this.options.user || !this.options.database) {
      throw new TavernValidationError('Configuração MySQL da Tavern incompleta');
    }
    this.now = now;
    this.pool = null;
    this.closed = false;
    this.dialect = 'mysql';
  }

  async initialize() {
    if (this.pool) return this;
    this.pool = mysql.createPool(this.options);
    try {
      await this.pool.query('SELECT 1 AS health');
      await this.applyMigrations();
    } catch (error) {
      await this.pool.end().catch(() => {});
      this.pool = null;
      throw error;
    }
    return this;
  }

  assertOpen() {
    if (this.closed || !this.pool) throw new Error('Banco MySQL da Tavern fechado');
  }

  async applyMigrations() {
    this.assertOpen();
    await this.pool.query(`CREATE TABLE IF NOT EXISTS tavern_schema_migrations (
      version INT UNSIGNED PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      applied_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    const [rows] = await this.pool.query('SELECT version FROM tavern_schema_migrations');
    const applied = new Set(rows.map(row => Number(row.version)));

    for (const migration of MYSQL_MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      for (const statement of migration.statements) {
        await this.pool.query(statement);
      }
      await this.pool.execute(
        'INSERT INTO tavern_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, this.now()]
      );
    }
  }

  async read(operation) {
    this.assertOpen();
    const connection = await this.pool.getConnection();
    try {
      return await operation(new MySqlSession(connection));
    } finally {
      connection.release();
    }
  }

  async transaction(operation) {
    this.assertOpen();
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(new MySqlSession(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async healthCheck() {
    this.assertOpen();
    const [rows] = await this.pool.query('SELECT 1 AS health');
    return rows[0]?.health === 1;
  }

  async close() {
    if (this.closed) return;
    this.assertOpen();
    await this.pool.end();
    this.closed = true;
    this.pool = null;
  }
}

export {
  MySqlSession,
  MySqlStore,
  normalizeParams,
  parseMysqlConnectionString,
  translateSqliteQuery
};
