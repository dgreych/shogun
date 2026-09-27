import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createInstanceTokenProvider } from './instanceAccess.js';
import { BunnyFyClient } from './BunnyFyClient.js';

test('acesso automático conserva a identidade após reiniciar e compartilha o vínculo entre chamadas simultâneas', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shogun-access-'));
  const identityFile = path.join(dir, 'installation.json');
  let registrations = 0;
  const ids = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8080/v1/instances/trial');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    const bytes = Buffer.from(body.publicKey, 'base64url');
    const key = createPublicKey({ key: bytes, type: 'spki', format: 'der' });
    assert.ok(verify(null, Buffer.from(`BUNNYFY_INSTALL_V1\n${body.publicKey}\n${body.timestamp}`), key, Buffer.from(body.proof, 'base64url')));
    const instanceId = createHash('sha256').update(bytes).digest('hex');
    ids.push(instanceId);
    registrations++;
    return new Response(JSON.stringify({ ok: true, data: { instanceId, token: `bf_trial_${instanceId}.${'a'.repeat(43)}` } }), { status: 200 });
  };
  try {
    const provider = createInstanceTokenProvider({ identityFile, fetchImpl });
    const tokens = await Promise.all(Array.from({ length: 12 }, () => provider('http://127.0.0.1:8080')));
    assert.equal(new Set(tokens).size, 1);
    assert.equal(registrations, 1);
    const restarted = createInstanceTokenProvider({ identityFile, fetchImpl });
    await restarted('http://127.0.0.1:8080');
    assert.deepEqual(ids, [ids[0], ids[0]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('chave paga dispensa o vínculo gratuito e a cota diária não dispara repetição automática', async () => {
  let enrollments = 0;
  let requests = 0;
  const client = new BunnyFyClient({ baseUrl: 'http://127.0.0.1:8080', token: 'paid-test-token', tokenProvider: async () => { enrollments++; return 'never'; }, retries: 3,
    fetchImpl: async (_url, options) => {
      requests++;
      assert.equal(options.headers.Authorization, 'Bearer paid-test-token');
      return new Response(JSON.stringify({ ok: false, error: { code: 'BUNNYFY_TRIAL_DAILY_LIMIT', message: 'Limite diário', retryable: false }, meta: {} }), { status: 429 });
    } });
  await assert.rejects(client.request('/v1/downloads/example', { method: 'POST', json: {}, idempotencyKey: 'one-operation' }), { code: 'BUNNYFY_TRIAL_DAILY_LIMIT' });
  assert.equal(requests, 1);
  assert.equal(enrollments, 0);
});
