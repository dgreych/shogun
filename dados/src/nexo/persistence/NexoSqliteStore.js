import fs from 'node:fs/promises';
import path from 'node:path';

import initSqlJs from 'sql.js';

import { DATABASE_DIR } from '../../utils/paths.js';
import { MIGRATIONS } from './migrations.js';

const DEFAULT_NEXO_DATABASE_PATH = path.join(DATABASE_DIR, 'nexo.sqlite');
const DEFAULT_MAX_DATABASE_BYTES = 256 * 1024 * 1024;

let sqlJsPromise;

function loadSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

function normalizeBinding(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function normalizeParams(params) {
  if (Array.isArray(params)) return params.map(normalizeBinding);
  if (!params || typeof params !== 'object') return params;
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, normalizeBinding(value)])
  );
}

class NexoSqliteSession {
  constructor(database) {
    this.database = database;
  }

  exec(sql) {
    this.database.exec(sql);
  }

  run(sql, params = []) {
    this.database.run(sql, normalizeParams(params));
    return { changes: this.database.getRowsModified() };
  }

  all(sql, params = []) {
    const statement = this.database.prepare(sql);
    try {
      statement.bind(normalizeParams(params));
      const rows = [];
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  get(sql, params = []) {
    return this.all(sql, params)[0] || null;
  }
}

class NexoSqliteStore {
  static async open(options = {}) {
    const store = new NexoSqliteStore(options);
    await store.initialize();
    return store;
  }

  constructor({
    filename = process.env.NEXO_DATABASE_PATH || DEFAULT_NEXO_DATABASE_PATH,
    maxDatabaseBytes = DEFAULT_MAX_DATABASE_BYTES,
    now = () => new Date().toISOString()
  } = {}) {
    this.filename = filename;
    this.maxDatabaseBytes = maxDatabaseBytes;
    this.now = now;
    this.database = null;
    this.closed = false;
    this.queue = Promise.resolve();
  }

  async initialize() {
    if (this.database) return this;

    const SQL = await loadSqlJs();
    let bytes;

    if (this.filename !== ':memory:') {
      try {
        const stats = await fs.stat(this.filename);
        if (stats.size > this.maxDatabaseBytes) {
          throw new Error(`Banco NEXO excede o limite de ${this.maxDatabaseBytes} bytes`);
        }
        bytes = await fs.readFile(this.filename);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    this.database = bytes?.length
      ? new SQL.Database(new Uint8Array(bytes))
      : new SQL.Database();

    this.database.run('PRAGMA foreign_keys = ON');
    await this.applyMigrations();
    return this;
  }

  assertOpen() {
    if (this.closed || !this.database) {
      throw new Error('Banco NEXO fechado');
    }
  }

  enqueue(operation) {
    const run = this.queue.then(operation, operation);
    this.queue = run.catch(() => {});
    return run;
  }

  async applyMigrations() {
    this.assertOpen();
    const session = new NexoSqliteSession(this.database);

    session.exec(`
      CREATE TABLE IF NOT EXISTS nexo_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const applied = new Set(
      session.all('SELECT version FROM nexo_schema_migrations').map(row => Number(row.version))
    );
    const pending = MIGRATIONS.filter(migration => !applied.has(migration.version));

    if (!pending.length) return;

    session.exec('BEGIN IMMEDIATE');
    try {
      for (const migration of pending) {
        session.exec(migration.sql);
        session.run(
          'INSERT INTO nexo_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, this.now()]
        );
      }
      session.exec('COMMIT');
      await this.persist();
    } catch (error) {
      try {
        session.exec('ROLLBACK');
      } catch {}
      throw error;
    }
  }

  read(operation) {
    return this.enqueue(() => {
      this.assertOpen();
      return operation(new NexoSqliteSession(this.database));
    });
  }

  transaction(operation) {
    return this.enqueue(async () => {
      this.assertOpen();
      const session = new NexoSqliteSession(this.database);
      session.exec('BEGIN IMMEDIATE');
      try {
        const result = await operation(session);
        session.exec('COMMIT');
        await this.persist();
        return result;
      } catch (error) {
        try {
          session.exec('ROLLBACK');
        } catch {}
        throw error;
      }
    });
  }

  async persist() {
    if (this.filename === ':memory:') return;

    const directory = path.dirname(this.filename);
    await fs.mkdir(directory, { recursive: true });

    const temporaryPath = `${this.filename}.${process.pid}.${Date.now()}.tmp`;
    const bytes = Buffer.from(this.database.export());

    if (bytes.length > this.maxDatabaseBytes) {
      throw new Error(`Banco NEXO excede o limite de ${this.maxDatabaseBytes} bytes`);
    }

    try {
      await fs.writeFile(temporaryPath, bytes, { mode: 0o600 });
      const handle = await fs.open(temporaryPath, 'r');
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporaryPath, this.filename);
    } catch (error) {
      await fs.unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }

  close() {
    return this.enqueue(async () => {
      if (this.closed) return;
      this.assertOpen();
      await this.persist();
      this.database.close();
      this.closed = true;
      this.database = null;
    });
  }
}

export {
  DEFAULT_MAX_DATABASE_BYTES,
  DEFAULT_NEXO_DATABASE_PATH,
  NexoSqliteSession,
  NexoSqliteStore
};
