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
const MIME_BY_EXTENSION = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png']
]);

async function listImageAssets(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return listImageAssets(filename);
    return MIME_BY_EXTENSION.has(path.extname(entry.name).toLowerCase()) ? [filename] : [];
  }));
  return nested.flat();
}

async function sniffImageMime(filename) {
  const handle = await fs.open(filename, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]))) return 'image/png';
    if (bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'image/jpeg';
    }
    return null;
  } finally {
    await handle.close();
  }
}

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

test('extensão e MIME real coincidem em todas as imagens da Tavern', async () => {
  const images = await listImageAssets(DEFAULT_ASSET_DIR);
  assert.ok(images.length > 0);

  const mismatches = [];
  for (const filename of images) {
    const relativePath = path.relative(DEFAULT_ASSET_DIR, filename);
    const expectedMime = MIME_BY_EXTENSION.get(path.extname(filename).toLowerCase());
    const actualMime = await sniffImageMime(filename);
    if (actualMime !== expectedMime) mismatches.push({ relativePath, expectedMime, actualMime });
  }
  assert.deepEqual(mismatches, []);
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
