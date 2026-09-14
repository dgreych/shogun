import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Jimp from 'jimp';

import {
  ASSET_FILES,
  DEFAULT_ASSET_DIR,
  TavernAssetRegistry
} from '../rendering/TavernAssetRegistry.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(TEST_DIR, '..', 'assets', 'media-manifest.json');

async function sha256(filename) {
  const content = await fs.readFile(filename);
  return crypto.createHash('sha256').update(content).digest('hex');
}

test('todos os ativos registrados existem no pacote de runtime', async () => {
  const missing = [];
  for (const [key, relativePath] of Object.entries(ASSET_FILES)) {
    try {
      await fs.access(path.join(DEFAULT_ASSET_DIR, relativePath));
    } catch {
      missing.push(key);
    }
  }
  assert.deepEqual(missing, []);
});

test('mídias V2 mantêm dimensões e hashes aprovados', async () => {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  assert.equal(manifest.visualVersion, '2.0.0');

  for (const asset of manifest.core) {
    assert.equal(ASSET_FILES[asset.key], asset.path);
    const filename = path.join(DEFAULT_ASSET_DIR, asset.path);
    const [image, digest] = await Promise.all([Jimp.read(filename), sha256(filename)]);
    assert.equal(image.bitmap.width, asset.width, asset.key);
    assert.equal(image.bitmap.height, asset.height, asset.key);
    assert.equal(digest, asset.sha256, asset.key);
  }
});

test('registro devolve clones e preserva o conteúdo do cache', async () => {
  const registry = new TavernAssetRegistry();
  const first = await registry.image('resource.mana');
  const second = await registry.image('resource.mana');
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first, second);
  assert.equal(first.bitmap.width, second.bitmap.width);
  first.setPixelColor(0x00000000, 0, 0);
  const third = await registry.image('resource.mana');
  assert.equal(third.getPixelColor(0, 0), second.getPixelColor(0, 0));
});
