import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATABASE_DIR } from '../../utils/paths.js';
import { BunnyFyError } from './BunnyFyError.js';

export const BUNNYFY_SERVICE_ORIGIN = 'http://node1.vexhost.com.br:20056';
const DEFAULT_IDENTITY_FILE = path.join(DATABASE_DIR, 'auth', 'bunnyfy-installation.json');

function installationIdentity(file) {
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new BunnyFyError('BUNNYFY_CONFIG_INVALID');
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const pair = generateKeyPairSync('ed25519');
    const temporary = `${file}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) }), { mode: 0o600, flag: 'wx' });
    try { fs.linkSync(temporary, file); }
    catch (failure) { if (failure.code !== 'EEXIST') throw failure; }
    finally { fs.unlinkSync(temporary); }
    record = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  try {
    const privateKey = createPrivateKey(record.privateKey);
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('invalid');
    const publicBytes = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
    return { privateKey, publicKey: publicBytes.toString('base64url'), id: createHash('sha256').update(publicBytes).digest('hex') };
  } catch { throw new BunnyFyError('BUNNYFY_CONFIG_INVALID'); }
}

export function createInstanceTokenProvider({ identityFile = DEFAULT_IDENTITY_FILE, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const pending = new Map();
  return async baseUrl => {
    if (!pending.has(baseUrl)) {
      const access = (async () => {
        const identity = installationIdentity(identityFile);
        const timestamp = now();
        const proof = sign(null, Buffer.from(`BUNNYFY_INSTALL_V1\n${identity.publicKey}\n${timestamp}`), identity.privateKey).toString('base64url');
        let response;
        try {
          response = await fetchImpl(`${baseUrl}/v1/instances/trial`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ publicKey: identity.publicKey, timestamp, proof }), signal: AbortSignal.timeout(15_000), redirect: 'error' });
        } catch { throw new BunnyFyError('BUNNYFY_NETWORK_ERROR', { retryable: true }); }
        if (!response.ok) throw BunnyFyError.fromStatus(response.status);
        let envelope;
        try {
          const reader = response.body.getReader();
          const chunks = [];
          let size = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > 64 * 1024) { await reader.cancel(); throw new Error('large'); }
              chunks.push(Buffer.from(value));
            }
          } finally { reader.releaseLock(); }
          envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch { throw new BunnyFyError('BUNNYFY_BAD_RESPONSE'); }
        const token = envelope?.data?.token;
        if (envelope?.ok !== true || envelope?.data?.instanceId !== identity.id || typeof token !== 'string'
          || !new RegExp(`^bf_trial_${identity.id}\\.[A-Za-z0-9_-]{43}$`).test(token)) throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
        return token;
      })();
      pending.set(baseUrl, access);
      access.catch(() => pending.delete(baseUrl));
    }
    return pending.get(baseUrl);
  };
}

export const automaticInstanceToken = createInstanceTokenProvider();
