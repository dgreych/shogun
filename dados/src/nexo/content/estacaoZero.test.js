import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTRIBUTES,
  CONTENT_ID_PATTERN,
  NexoContractValidationError,
  OUTCOMES,
  QUEST_NODE_TYPES,
  QUEST_TYPES,
  validateEstacaoZeroContentPack
} from '../contracts/index.js';
import {
  ESTACAO_ZERO_CONTENT,
  ESTACAO_ZERO_ENEMIES_BY_ID,
  ESTACAO_ZERO_LOCATIONS_BY_ID,
  ESTACAO_ZERO_MISSIONS_BY_ID,
  RAW_ESTACAO_ZERO_CONTENT,
  getContentRef
} from './index.js';

const cloneRaw = () => JSON.parse(JSON.stringify(RAW_ESTACAO_ZERO_CONTENT));

function allDefinitionCollections() {
  return [
    ESTACAO_ZERO_CONTENT.map.locations,
    ESTACAO_ZERO_CONTENT.enemies,
    [ESTACAO_ZERO_CONTENT.boss],
    ESTACAO_ZERO_CONTENT.missions
  ];
}

test('Estação Zero publica mapa mínimo, seis inimigos, um boss e seis missões', () => {
  assert.equal(ESTACAO_ZERO_CONTENT.map.name, 'Estação Zero');
  assert.equal(ESTACAO_ZERO_CONTENT.map.locations.length, 5);
  assert.equal(ESTACAO_ZERO_CONTENT.enemies.length, 6);
  assert.equal(ESTACAO_ZERO_CONTENT.boss.name, 'Vigia Sem Rosto');
  assert.equal(ESTACAO_ZERO_CONTENT.missions.length, 6);

  const locationNames = new Set(ESTACAO_ZERO_CONTENT.map.locations.map(location => location.name));
  assert.equal(locationNames.has('Refúgio'), true);
  assert.equal(locationNames.has('Plataforma sem Relógio'), true);
  assert.equal(locationNames.has('Plataforma do Vidro'), true);
  assert.equal(locationNames.has('Plataforma da Linha Morta'), true);
  assert.equal(locationNames.has('Mercado Invertido'), true);
});

test('IDs e versões do conteúdo Estação Zero são estáveis e únicos', () => {
  for (const collection of allDefinitionCollections()) {
    assert.equal(new Set(collection.map(item => item.id)).size, collection.length);
    assert.equal(new Set(collection.map(getContentRef)).size, collection.length);
    for (const item of collection) {
      assert.match(item.id, CONTENT_ID_PATTERN);
      assert.equal(item.version, 1);
      assert.equal(getContentRef(item), `${item.id}@1`);
    }
  }

  assert.equal(ESTACAO_ZERO_LOCATIONS_BY_ID.refugio.name, 'Refúgio');
  assert.equal(ESTACAO_ZERO_ENEMIES_BY_ID.vigia_sem_rosto.name, 'Vigia Sem Rosto');
  assert.equal(ESTACAO_ZERO_MISSIONS_BY_ID.vozes_sob_a_ponte.type, 'INVESTIGATION');
});

test('stat blocks usam atributos canônicos e intenções estáticas sanitizadas', () => {
  for (const enemy of [...ESTACAO_ZERO_CONTENT.enemies, ESTACAO_ZERO_CONTENT.boss]) {
    assert.equal(ATTRIBUTES.includes(enemy.atributoPrincipal), true, enemy.id);
    assert.ok(enemy.hpBase > 0, enemy.id);
    assert.ok(enemy.guarda >= 0, enemy.id);
    assert.ok(enemy.intentLabels.length >= 2 && enemy.intentLabels.length <= 4, enemy.id);
    for (const intent of enemy.intentLabels) {
      assert.doesNotMatch(intent, /\{\{?|}}?|<[^>]+>|%[sdif]|@[a-z0-9_]+/i);
    }
  }
});

test('Vigia Sem Rosto preserva Guarda, Fraturas e Âncora declarativas', () => {
  const boss = ESTACAO_ZERO_CONTENT.boss;
  assert.equal(boss.hpBase, 120);
  assert.equal(boss.guarda, 3);
  assert.equal(boss.fraturas.length, 3);
  assert.equal(new Set(boss.fraturas.map(fratura => fratura.id)).size, 3);
  assert.match(boss.fraturas[0].hint, /Eco -> Chama/);
  assert.match(boss.fraturas[1].hint, /troca de alvo/);
  assert.match(boss.ancora, /sino de partida/);
});

test('seis missões cobrem os quatro tipos e referenciam apenas locais e inimigos publicados', () => {
  const locationIds = new Set(ESTACAO_ZERO_CONTENT.map.locations.map(location => location.id));
  const enemyIds = new Set([...ESTACAO_ZERO_CONTENT.enemies.map(enemy => enemy.id), ESTACAO_ZERO_CONTENT.boss.id]);
  const missionTypes = new Set(ESTACAO_ZERO_CONTENT.missions.map(mission => mission.type));

  assert.deepEqual([...QUEST_TYPES].sort(), [...missionTypes].sort());
  for (const mission of ESTACAO_ZERO_CONTENT.missions) {
    assert.ok(mission.locationIds.length >= 1, mission.id);
    assert.ok(mission.enemyIds.length >= 1, mission.id);
    for (const locationId of mission.locationIds) assert.equal(locationIds.has(locationId), true, `${mission.id}:${locationId}`);
    for (const enemyId of mission.enemyIds) assert.equal(enemyIds.has(enemyId), true, `${mission.id}:${enemyId}`);
  }
});

test('grafos de missão têm início válido, nós alcançáveis, terminais e testes canônicos', () => {
  for (const mission of ESTACAO_ZERO_CONTENT.missions) {
    const byId = new Map(mission.nodes.map(node => [node.id, node]));
    assert.equal(byId.has(mission.startNodeId), true, mission.id);
    assert.equal(new Set(mission.nodes.map(node => node.id)).size, mission.nodes.length, mission.id);
    let terminalRoutes = 0;

    for (const node of mission.nodes) {
      assert.equal(QUEST_NODE_TYPES.includes(node.type), true, `${mission.id}:${node.id}`);
      for (const option of node.options) {
        if ('next' in option) {
          if (option.next === null) terminalRoutes += 1;
          else assert.equal(byId.has(option.next), true, `${mission.id}:${option.next}`);
        }
        if ('test' in option) {
          assert.equal(ATTRIBUTES.includes(option.test.attribute), true, `${mission.id}:${node.id}`);
          assert.ok(option.test.difficulty >= 4 && option.test.difficulty <= 24);
          for (const outcome of OUTCOMES) {
            const target = option.test.nextByOutcome[outcome];
            if (target === null) terminalRoutes += 1;
            else assert.equal(byId.has(target), true, `${mission.id}:${target}`);
          }
        }
      }
    }
    assert.ok(terminalRoutes > 0, mission.id);
  }
});

test('conteúdo Estação Zero publicado é profundamente imutável', () => {
  assert.equal(Object.isFrozen(ESTACAO_ZERO_CONTENT), true);
  assert.equal(Object.isFrozen(ESTACAO_ZERO_CONTENT.map), true);
  assert.equal(Object.isFrozen(ESTACAO_ZERO_CONTENT.map.locations), true);
  assert.equal(Object.isFrozen(ESTACAO_ZERO_CONTENT.enemies[0]), true);
  assert.equal(Object.isFrozen(ESTACAO_ZERO_CONTENT.boss.fraturas), true);
  assert.equal(Object.isFrozen(ESTACAO_ZERO_CONTENT.missions[0].nodes[0].options), true);
  assert.throws(() => {
    ESTACAO_ZERO_CONTENT.boss.name = 'Mutação indevida';
  }, TypeError);
});

test('contrato Estação Zero rejeita campos extras e atributos inválidos', () => {
  const extraEnemyField = cloneRaw();
  extraEnemyField.enemies[0].runtimeScale = 2;
  assert.throws(() => validateEstacaoZeroContentPack(extraEnemyField), /campos não permitidos/);

  const invalidAttribute = cloneRaw();
  invalidAttribute.enemies[0].atributoPrincipal = 'LUCK';
  assert.throws(() => validateEstacaoZeroContentPack(invalidAttribute), NexoContractValidationError);

  const extraNodeField = cloneRaw();
  extraNodeField.missions[0].nodes[0].stateMutation = true;
  assert.throws(() => validateEstacaoZeroContentPack(extraNodeField), /campos não permitidos/);
});

test('contrato Estação Zero rejeita duplicações, referências quebradas e placeholders de runtime', () => {
  const duplicateEnemy = cloneRaw();
  duplicateEnemy.enemies[1].id = duplicateEnemy.enemies[0].id;
  assert.throws(() => validateEstacaoZeroContentPack(duplicateEnemy), /ids duplicados/);

  const missingEnemy = cloneRaw();
  missingEnemy.missions[0].enemyIds = ['inimigo_inexistente'];
  assert.throws(() => validateEstacaoZeroContentPack(missingEnemy), /inimigo inexistente/);

  const missingLocation = cloneRaw();
  missingLocation.missions[0].locationIds = ['local_inexistente'];
  assert.throws(() => validateEstacaoZeroContentPack(missingLocation), /local inexistente/);

  const brokenNode = cloneRaw();
  brokenNode.missions[0].nodes[0].options[0].next = 'no_inexistente';
  assert.throws(() => validateEstacaoZeroContentPack(brokenNode), /nó inexistente/);

  const placeholder = cloneRaw();
  placeholder.enemies[0].intentLabels[0] = 'Atacar {player}';
  assert.throws(() => validateEstacaoZeroContentPack(placeholder), /placeholder de runtime/);
});

test('contrato Estação Zero exige exatamente o recorte da Fase 1', () => {
  const fewerEnemies = cloneRaw();
  fewerEnemies.enemies.pop();
  assert.throws(() => validateEstacaoZeroContentPack(fewerEnemies), NexoContractValidationError);

  const moreMissions = cloneRaw();
  moreMissions.missions.push({ ...moreMissions.missions[0], id: 'missao_extra' });
  assert.throws(() => validateEstacaoZeroContentPack(moreMissions), NexoContractValidationError);
});
