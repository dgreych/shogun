import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.resolve(fileURLToPath(import.meta.url));
const banned = [
  /VEX_API_KEY/i,
  /VEX_SITE/i,
  /apikey_vex/i,
  /site_vex/i,
  /vexapi\.com/i,
  /\bvex\b/i
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist-vnext'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

test('snapshot público não contém integração com o provedor legado removido', () => {
  const hits = [];
  for (const file of walk(ROOT)) {
    if (path.resolve(file) === SELF) continue;
    if (!/\.(?:js|mjs|cjs|ts|json|md|env|example)$/i.test(file) && !file.endsWith('.env.example')) continue;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const rx of banned) {
      if (rx.test(text)) {
        hits.push(`${path.relative(ROOT, file)} :: ${rx}`);
        break;
      }
    }
  }
  assert.deepEqual(hits, []);
});

test('BunnyFy pública começa desligada e sem token', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.match(env, /^BUNNYFY_ENABLED=false$/m);
  assert.match(env, /^BUNNYFY_API_TOKEN=$/m);
});

test('YouTube não exporta adapter de download legado', () => {
  const source = fs.readFileSync(path.join(ROOT, 'dados/src/funcs/downloads/youtube.js'), 'utf8');
  assert.ok(source.includes('youtubeMetadataAdapter'));
  assert.ok(!source.includes('legacyYoutubeAdapter'));
  assert.ok(!source.includes('baixarVia'));
});
