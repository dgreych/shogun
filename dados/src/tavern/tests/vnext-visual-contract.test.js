import assert from 'node:assert/strict';
import test from 'node:test';

import Jimp from 'jimp';

import { VNextSceneRenderer } from '../rendering/VNextSceneRenderer.js';
import { TavernAssetRegistry } from '../rendering/TavernAssetRegistry.js';
import { classVisual } from '../rendering/VNextVisualTheme.js';
import { createFallbackArt } from '../rendering/VNextVisualPrimitives.js';

test('classes introdutórias têm identidade visual fechada', () => {
  assert.equal(classVisual('GUARDIAN').archetype, 'BASTIÃO');
  assert.equal(classVisual('EXILE').archetype, 'CAÇADA');
  assert.equal(classVisual('STORM').archetype, 'ARCANO');
  assert.equal(classVisual('ORACLE').archetype, 'TAVERNA');
});

test('fallback visual não usa verso de carta e varia por classe', async () => {
  const assets = new TavernAssetRegistry();
  const guardian = await createFallbackArt(assets, 'GUARDIAN', 210, 196);
  const exile = await createFallbackArt(assets, 'EXILE', 210, 196);
  const storm = await createFallbackArt(assets, 'STORM', 210, 196);

  for (const image of [guardian, exile, storm]) {
    assert.equal(image.bitmap.width, 210);
    assert.equal(image.bitmap.height, 196);
  }

  const buffers = await Promise.all([
    guardian.getBufferAsync(Jimp.MIME_PNG),
    exile.getBufferAsync(Jimp.MIME_PNG),
    storm.getBufferAsync(Jimp.MIME_PNG)
  ]);
  assert.notDeepEqual(buffers[0], buffers[1]);
  assert.notDeepEqual(buffers[1], buffers[2]);
});

test('renderer de momentos gera PNG real para convite, mulligan, turno e vitória', async () => {
  const renderer = new VNextSceneRenderer();
  const outputs = await Promise.all([
    renderer.renderInvite({
      challengerName: 'Jogador A',
      challengedName: 'Jogador B',
      challengerClassId: 'GUARDIAN',
      challengedClassId: 'EXILE'
    }),
    renderer.renderMulligan({ playerName: 'Jogador A', classId: 'STORM', handSize: 4 }),
    renderer.renderTurn({ playerName: 'Jogador A', classId: 'GUARDIAN', turnNumber: 3, deadlineLabel: '2min' }),
    renderer.renderVictory({ winnerName: 'Jogador A', classId: 'EXILE', progressionLabel: '+120 XP' })
  ]);

  for (const buffer of outputs) {
    assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
    const image = await Jimp.read(buffer);
    assert.equal(image.bitmap.width, 1200);
    assert.equal(image.bitmap.height, 675);
  }
});
