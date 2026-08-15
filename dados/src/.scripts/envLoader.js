import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);
export const ROOT_DIR = path.resolve(SCRIPTS_DIR, '..', '..', '..');
export const LOCAL_ENV_FILE = path.join(ROOT_DIR, '.env.local');

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const separator = trimmed.indexOf('=');
  if (separator <= 0) return null;

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadLocalEnv(file = LOCAL_ENV_FILE) {
  if (!fs.existsSync(file)) {
    return { file, loaded: [], exists: false };
  }

  const loaded = [];
  const content = fs.readFileSync(file, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const entry = parseLine(line);
    if (!entry) continue;

    if (process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
      loaded.push(entry.key);
    }
  }

  return { file, loaded, exists: true };
}
