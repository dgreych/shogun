import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NexoSqliteStore } from '../persistence/NexoSqliteStore.js';
import { NexoRepository } from '../persistence/NexoRepository.js';
import { NexoConflictError, NexoValidationError } from '../errors.js';
import {
  ensureTutorialEncounter,
  previewTutorialStage,
  submitTutorialAction,
  submitTutorialAnalysis,
  submitTutorialChoice
} from '../domain/tutorialEncounter.js';

async function fixture(t, { idFactory } = {}) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shogun-nexo-tutorial-'));
  t.after(() => fs.rm(tempDirectory, { recursive: true, force: true }));
  const store = await NexoSqliteStore.open({ filename: path.join(tempDirectory, 'nexo.sqlite') });
  t.after(() => store.close());
  const repository = idFactory ? new NexoRepository(store, { idFactory }) : new NexoRepository(store);

  const group = await repository.upsertGroup({ transportChatId: 'grupo@g.us', name: 'Estação Zero' });
  const season = await repository.createDraftSeason({ groupId: group.id, templateId: 'estacao-zero', seed: 'season-seed-1' });
  await repository.activateSeason(season.id);

  const player = await repository.getOrCreatePlayer({ userId: 'user-1', groupId: group.id });
  await repository.createCharacterIfAbsent({ playerId: player.id, impulse: 'break_impossible', scar: 'haste' });

  await ensureTutorialEncounter({ repository, seasonId: season.id, groupId: group.id });

  return { repository, group, season, player };
}

async function addSecondPlayer(repository, { userId, impulse, scar }) {
  const group = await repository.getGroupByTransportChatId('grupo@g.us');
  const player = await repository.getOrCreatePlayer({ userId, groupId: group.id });
  await repository.createCharacterIfAbsent({ playerId: player.id, impulse, scar });
  return player;
}

function makeContext({ userId = 'user-1', chatId = 'grupo@g.us' } = {}) {
  return {
    incoming: { chatId, groupId: chatId },
    actor: { canonicalUserId: userId }
  };
}

async function completeUpTo(repository, context, { choiceIndex, doAnalysis = true }) {
  await submitTutorialChoice({ repository, context, optionIndex: choiceIndex });
  if (doAnalysis) await submitTutorialAnalysis({ repository, context });
}

test('ensureTutorialEncounter é idempotente por temporada', async t => {
  const { repository, season, group } = await fixture(t);
  const first = await ensureTutorialEncounter({ repository, seasonId: season.id, groupId: group.id });
  const second = await ensureTutorialEncounter({ repository, seasonId: season.id, groupId: group.id });
  assert.equal(first.id, second.id);
});

test('preview mostra a primeira etapa (escolha de postura)', async t => {
  const { repository } = await fixture(t);
  const preview = await previewTutorialStage({ repository, context: makeContext() });
  assert.equal(preview.kind, 'LIST');
  assert.match(preview.title, /A porta responde/);
});

test('quem não tem personagem não consegue ver o tutorial', async t => {
  const { repository } = await fixture(t);
  await assert.rejects(
    previewTutorialStage({ repository, context: makeContext({ userId: 'sem-personagem' }) }),
    NexoValidationError
  );
});

test('escolha inválida na etapa 1 é rejeitada sem avançar', async t => {
  const { repository } = await fixture(t);
  await assert.rejects(
    submitTutorialChoice({ repository, context: makeContext(), optionIndex: 9 }),
    NexoValidationError
  );
  const preview = await previewTutorialStage({ repository, context: makeContext() });
  assert.equal(preview.kind, 'LIST');
  assert.match(preview.title, /A porta responde/);
});

test('analisar antes de escolher postura é rejeitado', async t => {
  const { repository } = await fixture(t);
  await assert.rejects(
    submitTutorialAnalysis({ repository, context: makeContext() }),
    NexoConflictError
  );
});

test('fluxo completo: escolha -> análise -> ação conclui o tutorial (primeira pessoa)', async t => {
  const { repository } = await fixture(t);
  const context = makeContext();

  const choice = await submitTutorialChoice({ repository, context, optionIndex: 3 }); // RUPTURE
  assert.equal(choice.kind, 'CONFIRMATION');
  assert.match(choice.sections[0].lines[0], /Ruptura/);

  const analysis = await submitTutorialAnalysis({ repository, context });
  assert.equal(analysis.kind, 'CARD');

  const action = await submitTutorialAction({ repository, context, optionIndex: 1 }); // solar_strike
  assert.equal(action.kind, 'CARD');
  assert.match(action.sections[0].lines[0], /Golpe Solar/);
  assert.match(action.sections[0].lines[0], /Ruptura/); // usou a postura escolhida na etapa 1
  assert.match(action.sections[0].lines.at(-1), /primeira passagem coletiva/);

  const finalPreview = await previewTutorialStage({ repository, context });
  assert.match(finalPreview.sections[0].lines[0], /já concluiu/);
});

test('agir com a mesma seed é determinístico entre duas fixtures equivalentes', async t => {
  function makeSequentialIdFactory() {
    let counter = 0;
    return () => `fixed-tutorial-id-${counter++}`;
  }

  const { repository: repoA } = await fixture(t, { idFactory: makeSequentialIdFactory() });
  const contextA = makeContext();
  await completeUpTo(repoA, contextA, { choiceIndex: 2 });
  const actionA = await submitTutorialAction({ repository: repoA, context: contextA, optionIndex: 1 });

  const { repository: repoB } = await fixture(t, { idFactory: makeSequentialIdFactory() });
  const contextB = makeContext();
  await completeUpTo(repoB, contextB, { choiceIndex: 2 });
  const actionB = await submitTutorialAction({ repository: repoB, context: contextB, optionIndex: 1 });

  assert.equal(actionA.sections[0].lines[0], actionB.sections[0].lines[0]);
});

test('agir antes de analisar é rejeitado', async t => {
  const { repository } = await fixture(t);
  const context = makeContext();
  await submitTutorialChoice({ repository, context, optionIndex: 1 });
  await assert.rejects(
    submitTutorialAction({ repository, context, optionIndex: 1 }),
    NexoConflictError
  );
});

test('agir de novo depois de concluído é rejeitado', async t => {
  const { repository } = await fixture(t);
  const context = makeContext();
  await completeUpTo(repository, context, { choiceIndex: 1 });
  await submitTutorialAction({ repository, context, optionIndex: 1 });

  await assert.rejects(
    submitTutorialAction({ repository, context, optionIndex: 1 }),
    NexoConflictError
  );
});

test('duas pessoas distintas geram Ressonância real; a segunda faz replay individual sem duplicar a recompensa coletiva', async t => {
  // idFactory fixo: a rolagem de cada jogador é seedada por
  // seasonSeed+encounterId+... -- com encounterId aleatório (padrão), a
  // rolagem de user-2 poderia ocasionalmente sair SETBACK ("sem efeito
  // real"), o que excluiria a entrada da cadeia e tornaria este teste
  // instável (mesmo bug de fundo dos outros dois testes de
  // determinismo). Fixando o id, o resultado é sempre o mesmo.
  function makeSequentialIdFactory() {
    let counter = 0;
    return () => `fixed-resonance-id-${counter++}`;
  }

  const { repository } = await fixture(t, { idFactory: makeSequentialIdFactory() });
  await addSecondPlayer(repository, { userId: 'user-2', impulse: 'understand_hidden', scar: 'strange_echo' });

  const contextA = makeContext({ userId: 'user-1' });
  await completeUpTo(repository, contextA, { choiceIndex: 2 }); // PULSE
  const actionA = await submitTutorialAction({ repository, context: contextA, optionIndex: 1 }); // solar_strike (FLAME)
  assert.match(actionA.sections[0].lines.at(-1), /primeira passagem coletiva/);
  assert.equal(actionA.title, 'NEXO // Responda à Ruptura'); // sozinha, sem combo ainda

  const contextB = makeContext({ userId: 'user-2' });
  await completeUpTo(repository, contextB, { choiceIndex: 2 }); // PULSE
  const actionB = await submitTutorialAction({ repository, context: contextB, optionIndex: 2 }); // veil_mark (VEIL)

  assert.equal(actionB.title, 'NEXO // Ressonância!');
  assert.ok(actionB.sections[0].lines.some(line => line.includes('Ressonância: Emboscada')));
  assert.match(actionB.sections[0].lines.at(-1), /versão individual/);
  assert.match(actionB.sections[0].lines.at(-1), /já foi registrada por outra pessoa/);
});


test('cada jogador tem seu próprio progresso -- um não trava o outro', async t => {
  const { repository } = await fixture(t);
  await addSecondPlayer(repository, { userId: 'user-2', impulse: 'keep_people_standing', scar: 'others_weight' });

  const contextA = makeContext({ userId: 'user-1' });
  await submitTutorialChoice({ repository, context: contextA, optionIndex: 1 });

  // user-2 ainda está na etapa 1 mesmo com user-1 avançado -- não deve dar erro
  const previewB = await previewTutorialStage({ repository, context: makeContext({ userId: 'user-2' }) });
  assert.equal(previewB.kind, 'LIST');
  assert.match(previewB.title, /A porta responde/);
});
