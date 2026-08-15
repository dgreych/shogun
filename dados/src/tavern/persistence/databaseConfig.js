import fs from 'node:fs/promises';
import path from 'node:path';

import { DATABASE_DIR } from '../../utils/paths.js';
import { TavernValidationError } from '../errors.js';

const DEFAULT_MYSQL_CONFIG_PATH = path.join(DATABASE_DIR, 'tavern.mysql.json');
const DATABASE_DRIVERS = new Set(['sqlite', 'mysql']);

function normalizeDriver(value, fallback = 'sqlite') {
  const driver = String(value || fallback).trim().toLowerCase();
  if (!DATABASE_DRIVERS.has(driver)) {
    throw new TavernValidationError('Driver da Tavern inválido. Use sqlite ou mysql.');
  }
  return driver;
}

function positiveInteger(value, fallback, { min = 1, max = 100 } = {}) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return fallback;
  return numeric;
}

async function readPrivateDatabaseConfig(filename) {
  try {
    const raw = await fs.readFile(filename, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('o conteúdo precisa ser um objeto JSON');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new TavernValidationError(`Configuração privada do banco inválida: ${error.message}`);
  }
}

async function resolveTavernDatabaseConfig({
  databaseDriver,
  databaseUrl,
  databaseConfigPath = process.env.TAVERN_DATABASE_CONFIG_PATH || DEFAULT_MYSQL_CONFIG_PATH,
  mysql = {}
} = {}) {
  const privateConfig = await readPrivateDatabaseConfig(databaseConfigPath);
  const connectionString = databaseUrl || process.env.TAVERN_MYSQL_URL || privateConfig?.connectionString || null;
  const driver = normalizeDriver(
    databaseDriver || process.env.TAVERN_DATABASE_DRIVER || privateConfig?.driver || (connectionString ? 'mysql' : 'sqlite')
  );

  if (driver === 'sqlite') {
    return { driver, databaseConfigPath };
  }

  const merged = { ...(privateConfig || {}), ...mysql };
  if (!connectionString && !(merged.host && merged.user && merged.database)) {
    throw new TavernValidationError(
      'MySQL da Tavern sem conexão configurada. Use o arquivo privado ou TAVERN_MYSQL_URL.'
    );
  }

  return {
    driver,
    databaseConfigPath,
    mysql: {
      ...merged,
      connectionString,
      connectionLimit: positiveInteger(merged.connectionLimit, 4, { max: 16 }),
      connectTimeoutMs: positiveInteger(merged.connectTimeoutMs, 10_000, { min: 1_000, max: 60_000 })
    }
  };
}

export {
  DATABASE_DRIVERS,
  DEFAULT_MYSQL_CONFIG_PATH,
  normalizeDriver,
  readPrivateDatabaseConfig,
  resolveTavernDatabaseConfig
};
