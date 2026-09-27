import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { createOnboardingContentProvider } from '../domain/onboardingContentAdapter.js';
import { startOnboarding, answerOnboardingStep } from '../domain/onboarding.js';
import { getCharacterSheet } from '../domain/characterSheet.js';
import { NEXO_MVP_CONTENT } from '../content/index.js';

async function fixture(t) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-realcontent-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = new NexoRepository(store);
  await repository.upsertGroup({ transportChatId: 'grupo@g.us', name: 'Estação Zero' });
  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  await repository.setGroupStatus(group.id, 'ACTIVE');
  return repository;
}

function makeContext({ userId = 'user-1', chatId = 'grupo@g.us', messageId = 'wamid-1' } = {}) {
  return {
    incoming: { chatId, groupId: chatId, messageId },
    actor: { canonicalUserId: userId }
  };
}

test('adaptador expõe exatamente os quatro Impulsos e as quatro Cicatrizes reais do PDF', () => {
  const contentProvider = createOnboardingContentProvider();
  const impulses = contentProvider.listImpulses();
  const scars = contentProvider.listScars();

  assert.equal(impulses.length, 4);
  assert.equal(scars.length, 4);
  assert.ok(impulses.some(impulse => impulse.label === 'Romper o impossível'));
  assert.ok(impulses.some(impulse => impulse.label === 'Entender o oculto'));
  assert.ok(scars.some(scar => scar.label === 'Pressa'));
  assert.ok(scars.some(scar => scar.label === 'Eco estranho'));
});

test('fluxo completo de onboarding com conteúdo real cria personagem com nomes corretos na ficha', async t => {
  const repository = await fixture(t);
  const contentProvider = createOnboardingContentProvider();

  await startOnboarding({ repository, context: makeContext({ messageId: 'wamid-1' }), contentProvider });
  await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-2' }),
    contentProvider,
    optionIndex: 1
  });
  await answerOnboardingStep({
    repository,
    context: makeContext({ messageId: 'wamid-3' }),
    contentProvider,
    optionIndex: 1
  });

  const sheet = await getCharacterSheet({
    repository,
    context: makeContext({ messageId: 'wamid-4' }),
    contentProvider
  });
  assert.equal(sheet.kind, 'CARD');
  const text = sheet.sections[0].lines.join('\n');
  assert.match(text, /Romper o impossível/);
  assert.match(text, /Pressa/);
});

test('conteúdo publicado tem 8 origens e 16 técnicas, 4 por tom', () => {
  assert.equal(NEXO_MVP_CONTENT.origins.length, 8);
  assert.equal(NEXO_MVP_CONTENT.techniques.length, 16);
  const byTone = NEXO_MVP_CONTENT.techniques.reduce((acc, technique) => {
    acc[technique.tone] = (acc[technique.tone] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byTone, { FLAME: 4, VEIL: 4, ROOT: 4, ECHO: 4 });
});
