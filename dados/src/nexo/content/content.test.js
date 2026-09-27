import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTENT_ID_PATTERN, NexoContractValidationError, TONES, validateContentPack } from '../contracts/index.js';
import { NEXO_MVP_CONTENT, RAW_NEXO_MVP_CONTENT, getContentRef } from './index.js';

const cloneRaw = () => JSON.parse(JSON.stringify(RAW_NEXO_MVP_CONTENT));

test('conteúdo MVP preserva os quatro Impulsos da especificação', () => {
  assert.deepEqual(
    NEXO_MVP_CONTENT.impulses.map(({ name, signature, favoredAttributes, fantasy }) => ({ name, signature, favoredAttributes, fantasy })),
    [
      { name: 'Romper o impossível', signature: ['FLAME', 'ROOT'], favoredAttributes: ['IMPACT', 'SUSTAIN'], fantasy: 'Vanguarda resistente, intensidade e proteção.' },
      { name: 'Entender o oculto', signature: ['VEIL', 'ECHO'], favoredAttributes: ['READING', 'CONNECTION'], fantasy: 'Investigador, estrategista e revelador de padrões.' },
      { name: 'Manter pessoas de pé', signature: ['ROOT', 'ECHO'], favoredAttributes: ['SUSTAIN', 'CONNECTION'], fantasy: 'Guardião, curador e centro do grupo.' },
      { name: 'Dobrar as regras', signature: ['VEIL', 'FLAME'], favoredAttributes: ['BEND', 'IMPACT'], fantasy: 'Improvisador, trapaceiro e catalisador de risco.' }
    ]
  );
});

test('conteúdo MVP preserva as quatro Cicatrizes da especificação', () => {
  assert.deepEqual(
    NEXO_MVP_CONTENT.scars.map(({ name, riskRule, futureTransformation }) => ({ name, riskRule, futureTransformation })),
    [
      { name: 'Pressa', riskRule: 'Primeira postura Ruptura do Ciclo gera +1 Tensão.', futureTransformation: 'Uma vez por Ciclo, agir antes da intenção inimiga.' },
      { name: 'Eco estranho', riskRule: 'Ao falhar em análise, recebe uma pista falsa marcada.', futureTransformation: 'Pode converter uma pista falsa em atalho verdadeiro.' },
      { name: 'Peso dos outros', riskRule: 'Ao aliado cair, recebe 1 Tensão.', futureTransformation: 'Ao salvar aliado, remove Tensão de todos.' },
      { name: 'Fome de resposta', riskRule: 'Abandonar investigação custa Memória de combo.', futureTransformation: 'Descobertas completas geram Vestígio raro.' }
    ]
  );
});

test('catálogo tem quantidades, ids e versões esperados', () => {
  assert.equal(NEXO_MVP_CONTENT.impulses.length, 4);
  assert.equal(NEXO_MVP_CONTENT.scars.length, 4);
  assert.equal(NEXO_MVP_CONTENT.origins.length, 8);
  assert.equal(NEXO_MVP_CONTENT.techniques.length, 16);

  for (const collection of [
    NEXO_MVP_CONTENT.impulses,
    NEXO_MVP_CONTENT.scars,
    NEXO_MVP_CONTENT.origins,
    NEXO_MVP_CONTENT.techniques
  ]) {
    assert.equal(new Set(collection.map(item => item.id)).size, collection.length);
    assert.equal(new Set(collection.map(getContentRef)).size, collection.length);
    for (const item of collection) {
      assert.match(item.id, CONTENT_ID_PATTERN);
      assert.equal(item.version, 1);
      assert.equal(getContentRef(item), `${item.id}@1`);
    }
  }
});

test('dezesseis técnicas ficam distribuídas igualmente pelos quatro tons', () => {
  for (const tone of TONES) {
    assert.equal(NEXO_MVP_CONTENT.techniques.filter(technique => technique.tone === tone).length, 4, tone);
  }
});

test('quatro técnicas canônicas da especificação estão presentes com os efeitos declarados', () => {
  const byId = Object.fromEntries(NEXO_MVP_CONTENT.techniques.map(item => [item.id, item]));
  assert.equal(byId.solar_strike.name, 'Golpe Solar');
  assert.match(byId.solar_strike.description, /Dano alto/);
  assert.equal(byId.veil_mark.name, 'Marca Velada');
  assert.match(byId.veil_mark.description, /Reduz Guarda/);
  assert.equal(byId.fix_ground.name, 'Fixar o Chão');
  assert.match(byId.fix_ground.description, /Escudo coletivo pequeno/);
  assert.equal(byId.echo_thread.name, 'Fio de Retorno');
  assert.deepEqual(byId.echo_thread.baseEffect, { shield: 3, resonance: 12 });
});

test('tutorial A Porta no Ruído preserva duração, sequência e referências válidas', () => {
  const tutorial = NEXO_MVP_CONTENT.tutorial;
  assert.equal(tutorial.name, 'A Porta no Ruído');
  assert.equal(tutorial.durationHours, 24);
  assert.deepEqual(tutorial.stages.map(stage => stage.kind), ['CHOICE', 'ANALYSIS', 'ACTION', 'RESONANCE']);
  assert.equal(tutorial.canDestroyCircle, false);
  assert.equal(tutorial.collectiveRewardOnce, true);
  assert.equal(tutorial.lateJoinReplay, 'INDIVIDUAL_NO_DUPLICATE_COLLECTIVE_REWARD');
  assert.equal(tutorial.outcomeVariation, 'REWARD_AND_RUMOR_ONLY');
  assert.equal(tutorial.stages.at(-1).requiresDistinctPlayers, true);

  const techniqueIds = new Set(NEXO_MVP_CONTENT.techniques.map(item => item.id));
  for (const stage of tutorial.stages) {
    for (const techniqueId of stage.recommendedTechniqueIds) assert.equal(techniqueIds.has(techniqueId), true, techniqueId);
  }
});

test('dados publicados ficam imutáveis em runtime', () => {
  assert.equal(Object.isFrozen(NEXO_MVP_CONTENT), true);
  assert.equal(Object.isFrozen(NEXO_MVP_CONTENT.techniques), true);
  assert.equal(Object.isFrozen(NEXO_MVP_CONTENT.techniques[0]), true);
  assert.equal(Object.isFrozen(NEXO_MVP_CONTENT.techniques[0].baseEffect), true);
  assert.throws(() => {
    NEXO_MVP_CONTENT.techniques[0].name = 'Mutação indevida';
  }, TypeError);
});

test('pack rejeita ids duplicados e referências quebradas', () => {
  const duplicate = cloneRaw();
  duplicate.techniques[1].id = duplicate.techniques[0].id;
  assert.throws(() => validateContentPack(duplicate), /ids duplicados/);

  const brokenReference = cloneRaw();
  brokenReference.tutorial.stages[2].recommendedTechniqueIds = ['missing_technique'];
  assert.throws(() => validateContentPack(brokenReference), /técnica inexistente/);
});

test('pack rejeita limites, distribuição e campos extras', () => {
  const tooManyTechniques = cloneRaw();
  tooManyTechniques.techniques.push({ ...tooManyTechniques.techniques[0], id: 'extra_flame' });
  assert.throws(() => validateContentPack(tooManyTechniques), NexoContractValidationError);

  const wrongDistribution = cloneRaw();
  wrongDistribution.techniques[0].tone = 'ECHO';
  assert.throws(() => validateContentPack(wrongDistribution), /4 técnicas do tom/);

  const extraNestedField = cloneRaw();
  extraNestedField.origins[0].modifier.permanent = true;
  assert.throws(() => validateContentPack(extraNestedField), /campos não permitidos/);

  const oversizedText = cloneRaw();
  oversizedText.origins[0].description = 'x'.repeat(221);
  assert.throws(() => validateContentPack(oversizedText), NexoContractValidationError);
});
