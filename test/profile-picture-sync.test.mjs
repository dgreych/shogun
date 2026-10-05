import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { syncProfilePictureIfChanged } from '../dados/src/utils/profilePictureSync.js';

test('sincroniza a foto uma vez por conteúdo e grava o estado só depois do WhatsApp confirmar', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const assetPath = path.join(root, 'profile.png');
  const statePath = path.join(root, 'state.json');
  await fs.writeFile(assetPath, Buffer.from('imagem-v2'));
  const calls = [];
  const socket = { user: { id: 'bot@s.whatsapp.net' }, updateProfilePicture: async (...args) => calls.push(args) };

  assert.equal((await syncProfilePictureIfChanged(socket, { assetPath, statePath })).status, 'updated');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['bot@s.whatsapp.net', Buffer.from('imagem-v2')]);
  assert.equal((await syncProfilePictureIfChanged(socket, { assetPath, statePath })).status, 'unchanged');
  assert.equal(calls.length, 1);
});

test('falha ou timeout não marca uma foto como aplicada e nunca bloqueia indefinidamente', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const assetPath = path.join(root, 'profile.png');
  const statePath = path.join(root, 'state.json');
  await fs.writeFile(assetPath, Buffer.from('imagem-v2'));
  const socket = { user: { id: 'bot@s.whatsapp.net' }, updateProfilePicture: async () => new Promise(() => {}) };

  await assert.rejects(syncProfilePictureIfChanged(socket, { assetPath, statePath, timeoutMs: 10 }), /tempo/i);
  await assert.rejects(fs.readFile(statePath), error => error.code === 'ENOENT');
});

test('asset ausente não chama o WhatsApp', async () => {
  let called = false;
  const result = await syncProfilePictureIfChanged({ user: { id: 'bot@s.whatsapp.net' },
    updateProfilePicture: async () => { called = true; } }, { assetPath: '/arquivo/ausente.png', statePath: '/tmp/ausente.json' });
  assert.equal(result.status, 'missing');
  assert.equal(called, false);
});
