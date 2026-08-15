import assert from 'node:assert/strict';
import test from 'node:test';

import { CardRegistry } from '../domain/CardRegistry.js';
import { SeededRandom } from '../domain/SeededRandom.js';
import { TavernRuleError, TavernValidationError } from '../errors.js';
import { createMatch, createTestEngine } from './testHelpers.js';

test('CardRegistry rejeita carta inválida e ID duplicado', () => {
  assert.throws(
    () => new CardRegistry([{ id: 'inválido', name: 'Teste', type: 'MINION', rarity: 'COMMON', cost: 1, attack: 1, health: 1 }]),
    TavernValidationError
  );

  const card = {
    id: 'GY-TEST-001',
    name: 'Teste',
    type: 'MINION',
    rarity: 'COMMON',
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    effects: []
  };
  assert.throws(() => new CardRegistry([card, card]), TavernValidationError);

  assert.throws(() => new CardRegistry([{
    ...card,
    id: 'GY-TEST-002',
    effects: [{ trigger: 'ON_PLAY', effect: 'EFEITO_INEXISTENTE', target: 'ENEMY_HERO', value: 1 }]
  }]), /Efeito desconhecido/);
});

test('RNG produz a mesma sequência a partir da mesma seed e snapshot', () => {
  const first = new SeededRandom('gyomei');
  const second = new SeededRandom('gyomei');
  assert.deepEqual(
    [first.next(), first.next(), first.next()],
    [second.next(), second.next(), second.next()]
  );

  const restored = new SeededRandom(first.snapshot());
  assert.equal(first.next(), restored.next());
});

test('partida nasce com mãos privadas, mana válida e vantagem do segundo jogador', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const [firstId, secondId] = state.playerOrder;

  assert.equal(state.status, 'ACTIVE');
  assert.equal(state.players[firstId].hand.length, 3);
  assert.equal(state.players[secondId].hand.length, 5);
  assert.equal(state.players[secondId].hand.at(-1).cardId, 'GY-TOKEN-SPARK-001');
  assert.deepEqual(state.players[firstId].mana, { current: 1, max: 1 });
  assert.ok(state.players[firstId].mana.current >= 0);
});

test('mulligan troca apenas cartas escolhidas e espera os dois jogadores', async () => {
  const { engine } = await createTestEngine({ mulliganEnabled: true });
  let state = createMatch(engine);
  const [firstId, secondId] = state.playerOrder;
  const firstHandSize = state.players[firstId].hand.length;
  const selected = state.players[firstId].hand[0];

  state = engine.applyAction(state, {
    type: 'MULLIGAN',
    actorId: firstId,
    cards: [selected.instanceId]
  }).state;
  assert.equal(state.phase, 'MULLIGAN');
  assert.equal(state.players[firstId].hand.length, firstHandSize);
  assert.equal(state.players[firstId].hand.some(card => card.instanceId === selected.instanceId), false);

  state = engine.applyAction(state, {
    type: 'MULLIGAN',
    actorId: secondId,
    cards: []
  }).state;
  assert.equal(state.phase, 'MAIN');
  assert.equal(state.mulligan.responses[firstId].count, 1);
  assert.equal(state.mulligan.responses[secondId].count, 0);
});

test('mulligan expirado mantém as mãos e inicia a partida', async () => {
  const fixture = await createTestEngine({ mulliganEnabled: true });
  const state = createMatch(fixture.engine);
  fixture.setNow(Date.parse(state.turn.deadlineAt) + 1);

  const result = fixture.engine.applyAction(state, { type: 'TIMEOUT' });
  assert.equal(result.state.phase, 'MAIN');
  assert.ok(result.state.playerOrder.every(playerId => result.state.mulligan.responses[playerId]?.done));
  assert.equal(
    result.event.results.filter(event => event.type === 'MULLIGAN_TIMEOUT').length,
    2
  );
});

test('ação inválida por mana não altera o estado original', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const actorId = state.turn.activePlayerId;
  const player = state.players[actorId];
  const expensive = engine.createCardInstance(state, 'GY-103', actorId);
  player.hand = [expensive];
  player.mana.current = 0;
  const before = JSON.stringify(state);

  assert.throws(
    () => engine.applyAction(state, { type: 'PLAY_CARD', actorId, card: expensive.instanceId }),
    TavernRuleError
  );
  assert.equal(JSON.stringify(state), before);
});

test('estado corrompido com mana negativa ou carta duplicada é recusado', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const actorId = state.turn.activePlayerId;
  const negativeMana = JSON.parse(JSON.stringify(state));
  negativeMana.players[actorId].mana.current = -1;
  assert.throws(() => engine.validateState(negativeMana), /Mana inválida/);

  const duplicatedCard = JSON.parse(JSON.stringify(state));
  duplicatedCard.players[actorId].board.push(duplicatedCard.players[actorId].hand[0]);
  assert.throws(() => engine.validateState(duplicatedCard), /duas zonas/);
});

test('Ímpeto permite atacar ao entrar e Guarda protege o herói', async () => {
  const { engine } = await createTestEngine();
  let state = createMatch(engine);
  const actorId = state.turn.activePlayerId;
  const enemyId = state.playerOrder.find(id => id !== actorId);
  const actor = state.players[actorId];
  const enemy = state.players[enemyId];

  const rush = engine.createCardInstance(state, 'GY-027', actorId);
  actor.hand = [rush];
  actor.mana.current = 10;
  state = engine.applyAction(state, { type: 'PLAY_CARD', actorId, card: rush.instanceId }).state;
  const attacker = state.players[actorId].board[0];
  assert.equal(attacker.canAttack, true);

  const guard = engine.createCardInstance(state, 'GY-001', enemyId);
  guard.canAttack = false;
  state.players[enemyId].board = [guard];

  assert.throws(
    () => engine.applyAction(state, {
      type: 'ATTACK',
      actorId,
      source: attacker.instanceId,
      target: { kind: 'HERO', playerId: enemyId }
    }),
    /Guarda/
  );

  const result = engine.applyAction(state, {
    type: 'ATTACK',
    actorId,
    source: attacker.instanceId,
    target: { kind: 'MINION', playerId: enemyId, instanceId: guard.instanceId }
  });
  assert.ok(result.event.results.some(event => event.type === 'ATTACK_DECLARED'));
});

test('Último Suspiro resolve uma vez e causa dano ao herói adversário', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const actorId = state.turn.activePlayerId;
  const enemyId = state.playerOrder.find(id => id !== actorId);
  const attacker = engine.createCardInstance(state, 'GY-027', actorId);
  attacker.attack = 10;
  attacker.canAttack = true;
  const deathrattle = engine.createCardInstance(state, 'GY-042', enemyId);
  deathrattle.health = 1;
  state.players[actorId].board = [attacker];
  state.players[enemyId].board = [deathrattle];
  const beforeHp = state.players[actorId].hero.hp;

  const result = engine.applyAction(state, {
    type: 'ATTACK',
    actorId,
    source: attacker.instanceId,
    target: { kind: 'MINION', playerId: enemyId, instanceId: deathrattle.instanceId }
  });

  assert.equal(result.state.players[actorId].hero.hp, beforeHp - 2);
  assert.equal(
    result.event.results.filter(event => event.type === 'MINION_DIED' && event.instanceId === deathrattle.instanceId).length,
    1
  );
});

test('mortes simultâneas resolvem todos os Últimos Suspiros antes de decidir empate', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const actorId = state.turn.activePlayerId;
  const enemyId = state.playerOrder.find(id => id !== actorId);
  const attacker = engine.createCardInstance(state, 'GY-042', actorId);
  const defender = engine.createCardInstance(state, 'GY-042', enemyId);
  attacker.attack = 10;
  attacker.health = 1;
  attacker.canAttack = true;
  defender.attack = 10;
  defender.health = 1;
  state.players[actorId].hero.hp = 2;
  state.players[enemyId].hero.hp = 2;
  state.players[actorId].board = [attacker];
  state.players[enemyId].board = [defender];

  const result = engine.applyAction(state, {
    type: 'ATTACK',
    actorId,
    source: attacker.instanceId,
    target: { kind: 'MINION', playerId: enemyId, instanceId: defender.instanceId }
  });

  assert.equal(result.state.status, 'FINISHED');
  assert.equal(result.state.finishReason, 'DRAW');
  assert.equal(result.state.winnerId, null);
  assert.equal(result.state.players[actorId].hero.hp, 0);
  assert.equal(result.state.players[enemyId].hero.hp, 0);
});

test('fadiga cresce progressivamente e HP nunca vira NaN', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const playerId = state.turn.activePlayerId;
  state.players[playerId].deck = [];
  const events = [];

  engine.drawCard(state, playerId, events);
  engine.drawCard(state, playerId, events);

  assert.equal(state.players[playerId].fatigue, 2);
  assert.equal(state.players[playerId].hero.hp, 27);
  assert.equal(Number.isNaN(state.players[playerId].hero.hp), false);
});

test('poder do Guardião custa mana, concede armadura e só pode ser usado uma vez', async () => {
  const { engine } = await createTestEngine();
  const state = createMatch(engine);
  const actorId = state.turn.activePlayerId;
  state.players[actorId].mana.current = 10;

  const result = engine.applyAction(state, { type: 'HERO_POWER', actorId });
  assert.equal(result.state.players[actorId].hero.armor, 2);
  assert.equal(result.state.players[actorId].mana.current, 8);
  assert.throws(
    () => engine.applyAction(result.state, { type: 'HERO_POWER', actorId }),
    /já usado/
  );
});
