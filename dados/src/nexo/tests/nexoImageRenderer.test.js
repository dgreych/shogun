import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCharacterImage, renderCircleImage } from '../rendering/nexoImageRenderer.js';

const BASE_ENV = { BUNNYFY_ENABLED: 'true', BUNNYFY_NEXO_RENDER_MODE: 'exclusive' };

function fakeRepository({ season = { id: 'season-1', status: 'ACTIVE' }, world = { pulse: 10, cohesion: 20, lucidity: 30, entropy: 40 } } = {}) {
  return {
    async getActiveSeasonForGroup() { return season; },
    async getWorldStateBySeasonId() { return world; }
  };
}

test('renderCircleImage devolve o Buffer PNG quando a BunnyFy responde', async () => {
  const calls = [];
  const clientFactory = () => ({
    async renderNexoCircle(view) {
      calls.push(view);
      return { width: 1200, height: 675, media: { mediaId: 'circle-abcdefghij' } };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('png-circle'), mime: 'image/png' };
    }
  });

  const buffer = await renderCircleImage({
    repository: fakeRepository(),
    group: { id: 'g1', name: 'Círculo dos Ecos', status: 'ACTIVE' },
    env: BASE_ENV,
    clientFactory
  });

  assert.equal(buffer.toString(), 'png-circle');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].titleLabel, 'Círculo dos Ecos');
});

test('renderCircleImage devolve null (nunca lança) quando o modo está off', async () => {
  const buffer = await renderCircleImage({
    repository: fakeRepository(),
    group: { id: 'g1', name: 'Círculo dos Ecos', status: 'ACTIVE' },
    env: { BUNNYFY_ENABLED: 'false' }
  });
  assert.equal(buffer, null);
});

test('renderCircleImage devolve null quando o render remoto falha, mesmo em modo exclusive', async () => {
  const buffer = await renderCircleImage({
    repository: fakeRepository(),
    group: { id: 'g1', name: 'Círculo dos Ecos', status: 'ACTIVE' },
    env: BASE_ENV,
    clientFactory: () => ({
      async renderNexoCircle() { throw new Error('rede fora'); }
    })
  });
  assert.equal(buffer, null);
});

test('renderCircleImage devolve null quando o próprio mapeamento de domínio é inválido, sem lançar', async () => {
  const buffer = await renderCircleImage({
    repository: fakeRepository(),
    group: { id: 'g1', name: 'seed abc123', status: 'ACTIVE' },
    env: BASE_ENV,
    clientFactory: () => ({ async renderNexoCircle() { throw new Error('não deveria chegar aqui'); } })
  });
  assert.equal(buffer, null);
});

const REAL_CHARACTER = {
  name: 'Lume',
  tier: 3,
  memory: 5,
  impulse: 'understand_hidden',
  scar: 'strange_echo',
  origin: 'archive_runaway'
};

test('renderCharacterImage devolve o Buffer PNG quando a BunnyFy responde', async () => {
  const calls = [];
  const clientFactory = () => ({
    async renderNexoCharacter(view) {
      calls.push(view);
      return { width: 1200, height: 675, media: { mediaId: 'character-abcdefghij' } };
    },
    async downloadMedia() {
      return { buffer: Buffer.from('png-character'), mime: 'image/png' };
    }
  });

  const buffer = await renderCharacterImage({ character: REAL_CHARACTER, env: BASE_ENV, clientFactory });

  assert.equal(buffer.toString(), 'png-character');
  assert.equal(calls[0].titleLabel, 'Lume');
  assert.equal(calls[0].originLabel, 'Fugitivo do Arquivo');
});

test('renderCharacterImage devolve null sem Origem reconhecida, sem chamar a BunnyFy', async () => {
  let calls = 0;
  const buffer = await renderCharacterImage({
    character: { ...REAL_CHARACTER, origin: null },
    env: BASE_ENV,
    clientFactory: () => ({ async renderNexoCharacter() { calls += 1; return { media: {} }; } })
  });
  assert.equal(buffer, null);
  assert.equal(calls, 0);
});

test('renderCharacterImage devolve null (nunca lança) quando o modo está off', async () => {
  const buffer = await renderCharacterImage({
    character: REAL_CHARACTER,
    env: { BUNNYFY_ENABLED: 'false' }
  });
  assert.equal(buffer, null);
});
