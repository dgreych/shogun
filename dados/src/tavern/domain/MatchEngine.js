import crypto from 'node:crypto';

import { createTavernConfig } from '../config.js';
import { TavernRuleError, TavernValidationError } from '../errors.js';
import { EffectEngine, opponentId } from './EffectEngine.js';
import { SeededRandom } from './SeededRandom.js';

const MATCH_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  FINISHED: 'FINISHED'
});

const ACTION_TYPES = new Set([
  'MULLIGAN',
  'PLAY_CARD',
  'ATTACK',
  'HERO_POWER',
  'END_TURN',
  'CONCEDE',
  'TIMEOUT'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertId(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 191) {
    throw new TavernValidationError(`${label} inválido`);
  }
  return value.trim();
}

function asIso(timestamp) {
  return new Date(timestamp).toISOString();
}

class MatchEngine {
  constructor({
    cardRegistry,
    heroRegistry,
    effectEngine,
    config,
    now = () => Date.now(),
    idFactory = () => crypto.randomUUID(),
    seedFactory = () => crypto.randomBytes(16).toString('hex')
  }) {
    if (!cardRegistry || !heroRegistry) {
      throw new TavernValidationError('Registries de cartas e classes são obrigatórios');
    }
    this.cardRegistry = cardRegistry;
    this.heroRegistry = heroRegistry;
    this.config = createTavernConfig(config);
    this.effectEngine = effectEngine || new EffectEngine({ maxChain: this.config.limits.maxEffectChain });
    this.now = now;
    this.idFactory = idFactory;
    this.seedFactory = seedFactory;
  }

  validateDeck(cardIds, classId) {
    if (!Array.isArray(cardIds) || cardIds.length !== this.config.limits.deckSize) {
      throw new TavernValidationError(`Deck precisa ter ${this.config.limits.deckSize} cartas`);
    }

    this.heroRegistry.get(classId);
    const quantities = new Map();
    for (const cardId of cardIds) {
      const card = this.cardRegistry.get(cardId);
      if (!card.collectible) {
        throw new TavernValidationError(`Carta não colecionável no deck: ${cardId}`);
      }
      if (card.classId && card.classId !== classId) {
        throw new TavernValidationError(`Carta ${cardId} não pertence à classe ${classId}`);
      }
      const quantity = (quantities.get(cardId) || 0) + 1;
      const limit = card.rarity === 'LEGENDARY'
        ? this.config.limits.legendaryCopies
        : this.config.limits.normalCopies;
      if (quantity > limit) {
        throw new TavernValidationError(`Limite de cópias excedido para ${cardId}`);
      }
      quantities.set(cardId, quantity);
    }
    return true;
  }

  createMatch({ matchId, groupId, mode = 'NORMAL', seed, players, startingPlayerId }) {
    if (!Array.isArray(players) || players.length !== 2) {
      throw new TavernValidationError('A partida precisa de dois jogadores');
    }
    if (!this.config.turnSeconds[mode]) {
      throw new TavernValidationError('Modo de turno inválido', { mode });
    }

    const normalizedPlayers = players.map(player => ({
      id: assertId(player.id, 'playerId'),
      classId: assertId(player.classId, 'classId'),
      deck: [...player.deck]
    }));
    if (normalizedPlayers[0].id === normalizedPlayers[1].id) {
      throw new TavernValidationError('Os jogadores precisam ser diferentes');
    }
    for (const player of normalizedPlayers) this.validateDeck(player.deck, player.classId);

    const matchSeed = String(seed || this.seedFactory());
    const random = new SeededRandom(matchSeed);
    let playerOrder = normalizedPlayers.map(player => player.id);
    if (startingPlayerId) {
      assertId(startingPlayerId, 'startingPlayerId');
      if (!playerOrder.includes(startingPlayerId)) {
        throw new TavernValidationError('Jogador inicial não participa da partida');
      }
      playerOrder = [startingPlayerId, ...playerOrder.filter(id => id !== startingPlayerId)];
    } else if (random.int(2) === 1) {
      playerOrder.reverse();
    }

    const timestamp = this.now();
    const state = {
      schemaVersion: 1,
      version: 0,
      matchId: matchId ? assertId(matchId, 'matchId') : this.idFactory(),
      groupId: assertId(groupId, 'groupId'),
      mode,
      status: MATCH_STATUS.ACTIVE,
      phase: this.config.defaults.mulliganEnabled ? 'MULLIGAN' : 'MAIN',
      seed: matchSeed,
      rng: random.snapshot(),
      nextInstanceNumber: 1,
      playerOrder,
      players: {},
      turn: {
        number: 1,
        activePlayerId: playerOrder[0],
        deadlineAt: asIso(timestamp + this.config.turnSeconds[mode] * 1000),
        consecutiveTimeouts: Object.fromEntries(playerOrder.map(id => [id, 0]))
      },
      terrain: null,
      mulligan: {
        enabled: this.config.defaults.mulliganEnabled,
        responses: {}
      },
      winnerId: null,
      finishReason: null,
      createdAt: asIso(timestamp),
      finishedAt: null
    };

    for (const playerId of playerOrder) {
      const input = normalizedPlayers.find(player => player.id === playerId);
      const heroDefinition = this.heroRegistry.get(input.classId);
      const deck = input.deck.map(cardId => this.createCardInstance(state, cardId, playerId));
      state.players[playerId] = {
        id: playerId,
        classId: input.classId,
        hero: {
          hp: this.config.limits.heroHp,
          maxHp: this.config.limits.heroHp,
          armor: 0,
          powerUsed: false,
          statuses: {},
          powerCost: heroDefinition.power.cost
        },
        mana: { current: playerId === playerOrder[0] ? 1 : 0, max: playerId === playerOrder[0] ? 1 : 0 },
        deck: random.shuffle(deck),
        hand: [],
        board: [],
        graveyard: [],
        artifact: null,
        fatigue: 0,
        nextSpellDiscount: 0
      };
    }
    state.rng = random.snapshot();

    const setupEvents = [];
    for (let count = 0; count < 3; count += 1) this.drawCard(state, playerOrder[0], setupEvents);
    this.ensureAffordableOpeningHand(state, playerOrder[0], setupEvents);
    for (let count = 0; count < 4; count += 1) this.drawCard(state, playerOrder[1], setupEvents);
    this.createCardInHand(state, playerOrder[1], 'GY-TOKEN-SPARK-001', setupEvents);

    this.validateState(state);
    return state;
  }

  // O segundo jogador já recebe uma carta extra e a Centelha de Iniciativa
  // (0 de custo, protegida contra troca no mulligan) como compensação por
  // começar com menos mana. O primeiro jogador não tinha nenhuma garantia
  // equivalente: a mão inicial de 3 cartas podia sair inteira com custo
  // acima de 1, deixando o primeiro turno sem nenhuma jogada possível.
  ensureAffordableOpeningHand(state, playerId, events = [], affordableCost = 1) {
    const player = state.players[playerId];
    const costOf = card => this.cardRegistry.get(card.cardId).cost;
    const hasAffordable = () => player.hand.some(card => costOf(card) <= affordableCost);

    // A troca pode redesenhar outra carta cara — repete até garantir uma
    // jogada possível ou o baralho acabar. O teto é só uma trava de
    // segurança bem acima do tamanho real do baralho (30 cartas).
    for (let attempt = 0; attempt < 100 && !hasAffordable() && player.deck.length > 0; attempt += 1) {
      let highestIndex = 0;
      for (let index = 1; index < player.hand.length; index += 1) {
        if (costOf(player.hand[index]) > costOf(player.hand[highestIndex])) highestIndex = index;
      }
      const [swappedOut] = player.hand.splice(highestIndex, 1);
      player.deck.push(swappedOut);
      player.deck = this.shuffleValues(state, player.deck);
      this.drawCard(state, playerId, events);
    }
  }

  validateState(state) {
    if (!state || !Array.isArray(state.playerOrder) || state.playerOrder.length !== 2) {
      throw new TavernValidationError('Estado da partida inválido');
    }
    if (!state.playerOrder.includes(state.turn?.activePlayerId)) {
      throw new TavernValidationError('Jogador ativo inválido');
    }

    const instanceZones = new Map();
    const registerInstance = (playerId, zone, card) => {
      if (!card?.instanceId) throw new TavernValidationError(`Carta sem instanceId em ${zone}`);
      if (card.ownerId && card.ownerId !== playerId) {
        throw new TavernValidationError('Carta na zona de outro jogador', {
          instanceId: card.instanceId,
          ownerId: card.ownerId,
          playerId,
          zone
        });
      }
      if (instanceZones.has(card.instanceId)) {
        throw new TavernValidationError('Carta presente em duas zonas', {
          instanceId: card.instanceId,
          firstZone: instanceZones.get(card.instanceId),
          secondZone: zone
        });
      }
      instanceZones.set(card.instanceId, zone);
    };

    for (const playerId of state.playerOrder) {
      const player = state.players?.[playerId];
      if (!player) throw new TavernValidationError('Jogador ausente no estado', { playerId });
      const numericFields = [
        player.hero?.hp,
        player.hero?.maxHp,
        player.hero?.armor,
        player.mana?.current,
        player.mana?.max,
        player.fatigue
      ];
      if (numericFields.some(value => !Number.isFinite(value))) {
        throw new TavernValidationError('Estado numérico inválido', { playerId });
      }
      if (player.hero.hp < 0 || player.hero.maxHp <= 0 || player.hero.armor < 0) {
        throw new TavernValidationError('Vida ou armadura inválida', { playerId });
      }
      if (player.mana.current < 0 || player.mana.max < 0 || player.mana.current > this.config.limits.maxMana) {
        throw new TavernValidationError('Mana inválida', { playerId });
      }
      if (player.hand.length > this.config.limits.handSize || player.board.length > this.config.limits.boardSize) {
        throw new TavernValidationError('Limite de zona excedido', { playerId });
      }

      for (const [zone, cards] of [
        ['deck', player.deck],
        ['hand', player.hand],
        ['board', player.board],
        ['graveyard', player.graveyard]
      ]) {
        if (!Array.isArray(cards)) throw new TavernValidationError(`Zona ${zone} inválida`, { playerId });
        for (const card of cards) registerInstance(playerId, `${playerId}:${zone}`, card);
      }
      if (player.artifact) registerInstance(playerId, `${playerId}:artifact`, player.artifact);
    }

    if (state.terrain?.card) {
      registerInstance(state.terrain.ownerId, `${state.terrain.ownerId}:terrain`, state.terrain.card);
    }
    return true;
  }

  submitMulligan(state, actorId, action, events) {
    if (state.phase !== 'MULLIGAN' || !state.mulligan?.enabled) {
      throw new TavernRuleError('O mulligan não está ativo');
    }
    if (state.mulligan.responses[actorId]) {
      throw new TavernRuleError('Mulligan já confirmado por este jogador');
    }

    const references = action.cards || [];
    if (!Array.isArray(references)) {
      throw new TavernValidationError('Seleção de mulligan inválida');
    }
    const uniqueReferences = new Set(references);
    if (uniqueReferences.size !== references.length) {
      throw new TavernValidationError('A mesma carta foi selecionada mais de uma vez');
    }

    const player = state.players[actorId];
    const selected = references.map(reference => {
      const card = this.findHandCard(player, reference);
      if (!card) throw new TavernRuleError('Carta do mulligan não está na mão');
      if (!this.cardRegistry.get(card.cardId).collectible) {
        throw new TavernRuleError('Carta de iniciativa não pode ser trocada no mulligan');
      }
      return card;
    });

    const selectedIds = new Set(selected.map(card => card.instanceId));
    player.hand = player.hand.filter(card => !selectedIds.has(card.instanceId));
    for (let count = 0; count < selected.length; count += 1) {
      this.drawCard(state, actorId, events);
    }
    player.deck.push(...selected);
    player.deck = this.shuffleValues(state, player.deck);
    state.mulligan.responses[actorId] = { done: true, count: selected.length };
    events.push({ type: 'MULLIGAN_CONFIRMED', playerId: actorId, count: selected.length, private: true });

    if (state.playerOrder.every(playerId => state.mulligan.responses[playerId]?.done)) {
      state.phase = 'MAIN';
      events.push({ type: 'MULLIGAN_FINISHED' });
    }
  }

  createCardInstance(state, cardId, ownerId) {
    const definition = this.cardRegistry.get(cardId);
    const instance = {
      instanceId: `${state.matchId}:${state.nextInstanceNumber}`,
      cardId: definition.id,
      ownerId,
      name: definition.name,
      type: definition.type,
      rarity: definition.rarity,
      cost: definition.cost,
      baseCost: definition.cost,
      text: definition.text,
      attack: definition.attack ?? null,
      baseAttack: definition.attack ?? null,
      health: definition.health ?? null,
      maxHealth: definition.health ?? null,
      keywords: [...definition.keywords],
      effects: clone(definition.effects),
      statuses: {},
      attacksThisTurn: 0,
      canAttack: false,
      summonedOnTurn: null,
      temporaryAttack: 0,
      silenced: false
    };
    state.nextInstanceNumber += 1;
    return instance;
  }

  pickRandom(state, values) {
    const random = new SeededRandom(state.rng);
    const picked = random.pick(values);
    state.rng = random.snapshot();
    return picked;
  }

  shuffleValues(state, values) {
    const random = new SeededRandom(state.rng);
    const shuffled = random.shuffle(values);
    state.rng = random.snapshot();
    return shuffled;
  }

  drawCard(state, playerId, events = [], tracker) {
    const player = state.players[playerId];
    if (!player) throw new TavernValidationError('Jogador inválido', { playerId });

    if (player.deck.length === 0) {
      player.fatigue += 1;
      this.dealDamage(state, { kind: 'HERO', playerId, hero: player.hero }, player.fatigue, {
        actorId: playerId,
        source: null,
        events
      });
      events.push({ type: 'FATIGUE', playerId, value: player.fatigue });
      return null;
    }

    const card = player.deck.shift();
    if (player.hand.length >= this.config.limits.handSize) {
      player.graveyard.push({ cardId: card.cardId, instanceId: card.instanceId, reason: 'BURNED' });
      events.push({ type: 'CARD_BURNED', playerId, cardId: card.cardId });
      return null;
    }

    player.hand.push(card);
    events.push({ type: 'CARD_DRAWN', playerId, private: true, cardId: card.cardId });
    this.effectEngine.executeTrigger({
      state,
      trigger: 'ON_DRAW',
      actorId: playerId,
      source: card,
      engine: this,
      events,
      tracker
    });
    return card;
  }

  createCardInHand(state, playerId, cardId, events = []) {
    const player = state.players[playerId];
    if (!player) throw new TavernValidationError('Jogador inválido', { playerId });
    const card = this.createCardInstance(state, cardId, playerId);
    if (player.hand.length >= this.config.limits.handSize) {
      player.graveyard.push({ cardId, instanceId: card.instanceId, reason: 'BURNED' });
      events.push({ type: 'CARD_BURNED', playerId, cardId });
      return null;
    }
    player.hand.push(card);
    events.push({ type: 'CARD_CREATED', playerId, private: true, cardId });
    return card;
  }

  summonCard(state, playerId, cardId, events = [], tracker) {
    const player = state.players[playerId];
    if (player.board.length >= this.config.limits.boardSize) {
      events.push({ type: 'SUMMON_FAILED_BOARD_FULL', playerId, cardId });
      return null;
    }
    const card = this.createCardInstance(state, cardId, playerId);
    if (card.type !== 'MINION') {
      throw new TavernRuleError('Somente criaturas podem ser invocadas');
    }
    card.summonedOnTurn = state.turn.number;
    card.canAttack = card.keywords.includes('RUSH');
    player.board.push(card);
    events.push({ type: 'MINION_SUMMONED', playerId, cardId, instanceId: card.instanceId });
    this.effectEngine.executeTrigger({
      state,
      trigger: 'ON_SUMMON',
      actorId: playerId,
      source: card,
      engine: this,
      events,
      tracker
    });
    return card;
  }

  triggerBoard(state, playerId, trigger, { target = null, events = [], tracker } = {}) {
    for (const minion of [...state.players[playerId].board]) {
      this.effectEngine.executeTrigger({
        state,
        trigger,
        actorId: playerId,
        source: minion,
        target,
        engine: this,
        events,
        tracker
      });
    }
  }

  returnToHand(state, playerId, instanceId, events = []) {
    const player = state.players[playerId];
    const index = player.board.findIndex(minion => minion.instanceId === instanceId);
    if (index < 0) return false;
    const [removed] = player.board.splice(index, 1);
    if (player.hand.length >= this.config.limits.handSize) {
      player.graveyard.push({ cardId: removed.cardId, instanceId: removed.instanceId, reason: 'HAND_FULL' });
    } else {
      player.hand.push(this.createCardInstance(state, removed.cardId, playerId));
    }
    events.push({ type: 'RETURN_TO_HAND', playerId, cardId: removed.cardId });
    return true;
  }

  shuffleIntoDeck(state, playerId, instanceId, events = []) {
    const player = state.players[playerId];
    const index = player.board.findIndex(minion => minion.instanceId === instanceId);
    if (index < 0) return false;
    const [removed] = player.board.splice(index, 1);
    player.deck.push(this.createCardInstance(state, removed.cardId, playerId));
    player.deck = this.shuffleValues(state, player.deck);
    events.push({ type: 'SHUFFLE_INTO_DECK', playerId, cardId: removed.cardId });
    return true;
  }

  discardCards(state, playerId, quantity, events = []) {
    const player = state.players[playerId];
    for (let count = 0; count < quantity && player.hand.length; count += 1) {
      const card = this.pickRandom(state, player.hand);
      const index = player.hand.findIndex(item => item.instanceId === card.instanceId);
      player.hand.splice(index, 1);
      player.graveyard.push({ cardId: card.cardId, instanceId: card.instanceId, reason: 'DISCARDED' });
      events.push({ type: 'CARD_DISCARDED', playerId, private: true, cardId: card.cardId });
    }
  }

  dealDamage(state, target, amount, { source = null, actorId = null, events = [], tracker } = {}) {
    const value = Math.max(0, Math.floor(Number(amount)));
    if (!Number.isFinite(value)) throw new TavernValidationError('Dano inválido');

    if (target.kind === 'HERO') {
      const absorbed = Math.min(target.hero.armor, value);
      target.hero.armor -= absorbed;
      const healthDamage = value - absorbed;
      target.hero.hp = Math.max(0, target.hero.hp - healthDamage);
      events.push({ type: 'HERO_DAMAGED', playerId: target.playerId, value: healthDamage, absorbed });
      return;
    }

    if (target.kind !== 'MINION' || !target.minion) {
      throw new TavernValidationError('Alvo de dano inválido');
    }
    target.minion.health -= value;
    events.push({ type: 'MINION_DAMAGED', instanceId: target.minion.instanceId, value });

    if (target.minion.health > 0) {
      const chain = tracker || { count: 0 };
      this.effectEngine.executeTrigger({
        state,
        trigger: 'ON_DAMAGE',
        actorId: target.playerId,
        source: target.minion,
        target: source?.instanceId
          ? { kind: 'MINION', playerId: actorId, instanceId: source.instanceId }
          : null,
        engine: this,
        events,
        tracker: chain
      });
      this.effectEngine.executeTrigger({
        state,
        trigger: 'AFTER_DAMAGE',
        actorId: target.playerId,
        source: target.minion,
        target: source?.instanceId
          ? { kind: 'MINION', playerId: actorId, instanceId: source.instanceId }
          : null,
        engine: this,
        events,
        tracker: chain
      });
    }
  }

  resolveDeaths(state, { events = [], tracker = { count: 0 } } = {}) {
    if (tracker.resolvingDeaths) return;
    tracker.resolvingDeaths = true;
    try {
      while (true) {
        const dead = [];
        for (const playerId of state.playerOrder) {
          const player = state.players[playerId];
          for (const minion of player.board) {
            if (minion.health <= 0) dead.push({ playerId, minion });
          }
        }
        if (!dead.length) break;

        for (const { playerId, minion } of dead) {
          const board = state.players[playerId].board;
          const index = board.findIndex(item => item.instanceId === minion.instanceId);
          if (index < 0) continue;
          board.splice(index, 1);
          state.players[playerId].graveyard.push({
            cardId: minion.cardId,
            instanceId: minion.instanceId,
            reason: 'DESTROYED'
          });
          events.push({ type: 'MINION_DIED', playerId, cardId: minion.cardId, instanceId: minion.instanceId });
        }

        for (const { playerId, minion } of dead) {
          this.effectEngine.executeTrigger({
            state,
            trigger: 'ON_DEATH',
            actorId: playerId,
            source: minion,
            engine: this,
            events,
            tracker
          });
        }
      }
    } finally {
      tracker.resolvingDeaths = false;
    }
    this.checkWinner(state, events);
  }

  checkWinner(state, events = []) {
    if (state.status === MATCH_STATUS.FINISHED) return state.winnerId;
    const defeated = state.playerOrder.filter(playerId => state.players[playerId].hero.hp <= 0);
    if (!defeated.length) return null;

    state.status = MATCH_STATUS.FINISHED;
    state.turn.deadlineAt = null;
    state.finishedAt = asIso(this.now());
    if (defeated.length === 2) {
      state.winnerId = null;
      state.finishReason = 'DRAW';
    } else {
      state.winnerId = opponentId(state, defeated[0]);
      state.finishReason = 'HERO_DEFEATED';
    }
    events.push({ type: 'MATCH_FINISHED', winnerId: state.winnerId, reason: state.finishReason });
    return state.winnerId;
  }

  findHandCard(player, reference) {
    if (Number.isInteger(reference)) return player.hand[reference - 1] || null;
    if (typeof reference !== 'string') return null;
    return player.hand.find(card => card.instanceId === reference || card.cardId === reference) || null;
  }

  playCard(state, actorId, action, events) {
    const player = state.players[actorId];
    const tracker = { count: 0 };
    const card = this.findHandCard(player, action.card);
    if (!card) throw new TavernRuleError('Carta não encontrada na mão');

    let cost = card.cost;
    if (card.type === 'SPELL' && player.nextSpellDiscount > 0) {
      cost = Math.max(0, cost - player.nextSpellDiscount);
    }
    if (player.mana.current < cost) throw new TavernRuleError('Mana insuficiente');
    if (card.type === 'MINION' && player.board.length >= this.config.limits.boardSize) {
      throw new TavernRuleError('Campo cheio');
    }
    if (card.effects.some(effect => effect.trigger === 'ON_PLAY' && effect.target === 'TARGET') && !action.target) {
      throw new TavernRuleError('Esta carta precisa de um alvo');
    }

    player.mana.current -= cost;
    player.hand.splice(player.hand.findIndex(item => item.instanceId === card.instanceId), 1);
    if (card.type === 'SPELL' && player.nextSpellDiscount > 0) player.nextSpellDiscount = 0;

    if (card.type === 'MINION') {
      card.summonedOnTurn = state.turn.number;
      card.canAttack = card.keywords.includes('RUSH');
      player.board.push(card);
    } else if (card.type === 'ARTIFACT') {
      if (player.artifact) player.graveyard.push({ cardId: player.artifact.cardId, reason: 'REPLACED' });
      player.artifact = card;
    } else if (card.type === 'TERRAIN') {
      state.terrain = { ownerId: actorId, card };
    }

    events.push({ type: 'CARD_PLAYED', playerId: actorId, cardId: card.cardId, instanceId: card.instanceId, cost });
    this.effectEngine.executeTrigger({
      state,
      trigger: 'ON_PLAY',
      actorId,
      source: card,
      target: action.target || action.options || null,
      engine: this,
      events,
      tracker
    });

    if (card.type === 'MINION') {
      this.effectEngine.executeTrigger({
        state,
        trigger: 'ON_SUMMON',
        actorId,
        source: card,
        engine: this,
        events,
        tracker
      });
    }

    if (card.type === 'SPELL') {
      this.triggerBoard(state, actorId, 'ON_SPELL_CAST', {
        target: action.target || null,
        events,
        tracker
      });
      player.graveyard.push({ cardId: card.cardId, instanceId: card.instanceId, reason: 'CAST' });
    }
  }

  attack(state, actorId, action, events) {
    const player = state.players[actorId];
    const enemyId = opponentId(state, actorId);
    const enemy = state.players[enemyId];
    const tracker = { count: 0 };
    const source = player.board.find(minion => minion.instanceId === action.source);
    if (!source) throw new TavernRuleError('Criatura atacante não encontrada');
    if (!source.canAttack || source.attacksThisTurn >= 1) {
      throw new TavernRuleError('Esta criatura não pode atacar agora');
    }

    const guards = enemy.board.filter(minion => minion.keywords.includes('GUARD'));
    let target;
    if (action.target?.kind === 'HERO' && action.target.playerId === enemyId) {
      if (guards.length) throw new TavernRuleError('Uma criatura com Guarda precisa ser atacada primeiro');
      target = { kind: 'HERO', playerId: enemyId, hero: enemy.hero };
    } else if (action.target?.kind === 'MINION' && action.target.playerId === enemyId) {
      const minion = enemy.board.find(item => item.instanceId === action.target.instanceId);
      if (!minion) throw new TavernRuleError('Alvo não encontrado');
      if (guards.length && !minion.keywords.includes('GUARD')) {
        throw new TavernRuleError('Uma criatura com Guarda precisa ser atacada primeiro');
      }
      target = { kind: 'MINION', playerId: enemyId, minion };
    } else {
      throw new TavernRuleError('Alvo de ataque inválido');
    }

    source.attacksThisTurn += 1;
    source.canAttack = false;
    events.push({
      type: 'ATTACK_DECLARED',
      playerId: actorId,
      source: source.instanceId,
      target: target.kind === 'HERO' ? enemyId : target.minion.instanceId
    });

    this.effectEngine.executeTrigger({
      state,
      trigger: 'ON_ATTACK',
      actorId,
      source,
      target: action.target,
      engine: this,
      events,
      tracker
    });
    if (state.status === MATCH_STATUS.FINISHED) return;

    const sourceStillPresent = player.board.some(minion => minion.instanceId === source.instanceId);
    const targetStillPresent = target.kind === 'HERO'
      ? target.hero.hp > 0
      : enemy.board.some(minion => minion.instanceId === target.minion.instanceId);
    if (sourceStillPresent && targetStillPresent) {
      const sourceAttack = source.attack;
      const targetAttack = target.kind === 'MINION' ? target.minion.attack : 0;
      this.dealDamage(state, target, sourceAttack, { source, actorId, events, tracker });
      if (target.kind === 'MINION') {
        this.dealDamage(
          state,
          { kind: 'MINION', playerId: actorId, minion: source },
          targetAttack,
          { source: target.minion, actorId: enemyId, events, tracker }
        );
      }
      this.resolveDeaths(state, { events, tracker });
      this.checkWinner(state, events);
    }

    this.effectEngine.executeTrigger({
      state,
      trigger: 'AFTER_ATTACK',
      actorId,
      source,
      target: action.target,
      engine: this,
      events,
      tracker
    });
  }

  useHeroPower(state, actorId, action, events) {
    const player = state.players[actorId];
    const hero = this.heroRegistry.get(player.classId);
    if (player.hero.powerUsed) throw new TavernRuleError('Poder de herói já usado neste turno');
    if (player.mana.current < hero.power.cost) throw new TavernRuleError('Mana insuficiente');
    if (hero.power.requiresTarget && !action.target) throw new TavernRuleError('O poder precisa de um alvo');

    player.mana.current -= hero.power.cost;
    player.hero.powerUsed = true;
    events.push({ type: 'HERO_POWER_USED', playerId: actorId, classId: player.classId });
    const tracker = { count: 0 };
    this.effectEngine.executeEffects({
      state,
      effects: hero.power.effects,
      actorId,
      target: action.target || action.options || null,
      engine: this,
      events,
      tracker
    });
    this.triggerBoard(state, actorId, 'HERO_POWER_USED', {
      target: action.target || null,
      events,
      tracker
    });
  }

  cleanupTurn(player) {
    for (const minion of player.board) {
      if (minion.temporaryAttack) {
        minion.attack = Math.max(0, minion.attack - minion.temporaryAttack);
        minion.temporaryAttack = 0;
      }
      for (const [status, data] of Object.entries(minion.statuses || {})) {
        if (data.duration === 'TURN') delete minion.statuses[status];
      }
    }
    for (const [status, data] of Object.entries(player.hero.statuses || {})) {
      if (data.duration === 'TURN') delete player.hero.statuses[status];
    }
  }

  endTurn(state, actorId, events) {
    const player = state.players[actorId];
    const tracker = { count: 0 };
    for (const minion of [...player.board]) {
      this.effectEngine.executeTrigger({
        state,
        trigger: 'ON_TURN_END',
        actorId,
        source: minion,
        engine: this,
        events,
        tracker
      });
    }
    if (state.status === MATCH_STATUS.FINISHED) return;

    this.cleanupTurn(player);
    const nextPlayerId = opponentId(state, actorId);
    const nextPlayer = state.players[nextPlayerId];
    state.turn.number += 1;
    state.turn.activePlayerId = nextPlayerId;
    state.turn.deadlineAt = asIso(this.now() + this.config.turnSeconds[state.mode] * 1000);
    nextPlayer.mana.max = Math.min(this.config.limits.maxMana, nextPlayer.mana.max + 1);
    nextPlayer.mana.current = nextPlayer.mana.max;
    nextPlayer.hero.powerUsed = false;
    for (const minion of nextPlayer.board) {
      minion.attacksThisTurn = 0;
      minion.canAttack = true;
    }
    this.drawCard(state, nextPlayerId, events, tracker);
    this.checkWinner(state, events);
    if (state.status === MATCH_STATUS.FINISHED) return;
    for (const minion of [...nextPlayer.board]) {
      this.effectEngine.executeTrigger({
        state,
        trigger: 'ON_TURN_START',
        actorId: nextPlayerId,
        source: minion,
        engine: this,
        events,
        tracker
      });
    }
    events.push({ type: 'TURN_STARTED', playerId: nextPlayerId, turn: state.turn.number });
  }

  finishByConcede(state, actorId, events) {
    state.status = MATCH_STATUS.FINISHED;
    state.winnerId = opponentId(state, actorId);
    state.finishReason = 'CONCEDE';
    state.finishedAt = asIso(this.now());
    state.turn.deadlineAt = null;
    events.push({ type: 'MATCH_FINISHED', winnerId: state.winnerId, reason: state.finishReason });
  }

  handleTimeout(state, events) {
    const deadline = Date.parse(state.turn.deadlineAt);
    if (!Number.isFinite(deadline) || this.now() < deadline) {
      throw new TavernRuleError('O turno ainda não expirou');
    }
    const absentPlayerId = state.turn.activePlayerId;
    const count = (state.turn.consecutiveTimeouts[absentPlayerId] || 0) + 1;
    state.turn.consecutiveTimeouts[absentPlayerId] = count;
    events.push({ type: 'TURN_TIMEOUT', playerId: absentPlayerId, consecutive: count });
    if (count >= 2) {
      state.status = MATCH_STATUS.FINISHED;
      state.winnerId = opponentId(state, absentPlayerId);
      state.finishReason = 'ABSENCE';
      state.finishedAt = asIso(this.now());
      state.turn.deadlineAt = null;
      events.push({ type: 'MATCH_FINISHED', winnerId: state.winnerId, reason: state.finishReason });
      return;
    }
    this.endTurn(state, absentPlayerId, events);
  }

  handleMulliganTimeout(state, events) {
    const deadline = Date.parse(state.turn.deadlineAt);
    if (!Number.isFinite(deadline) || this.now() < deadline) {
      throw new TavernRuleError('A preparação ainda não expirou');
    }
    const pendingPlayers = state.playerOrder.filter(playerId => !state.mulligan.responses[playerId]?.done);
    for (const playerId of pendingPlayers) {
      this.submitMulligan(state, playerId, { cards: [] }, events);
      events.push({ type: 'MULLIGAN_TIMEOUT', playerId });
    }
    state.turn.deadlineAt = asIso(this.now() + this.config.turnSeconds[state.mode] * 1000);
  }

  applyAction(currentState, action) {
    if (!currentState || currentState.status !== MATCH_STATUS.ACTIVE) {
      throw new TavernRuleError('A partida não está ativa');
    }
    this.validateState(currentState);
    if (!action || !ACTION_TYPES.has(action.type)) {
      throw new TavernValidationError('Ação inválida');
    }

    const state = clone(currentState);
    const events = [];
    const actorId = action.type === 'TIMEOUT'
      ? state.turn.activePlayerId
      : assertId(action.actorId, 'actorId');
    if (!state.players[actorId]) throw new TavernRuleError('Usuário não participa da partida');

    if (state.phase === 'MULLIGAN' && !['MULLIGAN', 'CONCEDE', 'TIMEOUT'].includes(action.type)) {
      throw new TavernRuleError('Os jogadores precisam concluir o mulligan');
    }
    if (state.phase !== 'MULLIGAN' && action.type === 'MULLIGAN') {
      throw new TavernRuleError('O mulligan já terminou');
    }
    if (!['CONCEDE', 'TIMEOUT', 'MULLIGAN'].includes(action.type) && state.turn.activePlayerId !== actorId) {
      throw new TavernRuleError('Não é o turno deste jogador');
    }

    switch (action.type) {
      case 'MULLIGAN':
        this.submitMulligan(state, actorId, action, events);
        break;
      case 'PLAY_CARD':
        this.playCard(state, actorId, action, events);
        break;
      case 'ATTACK':
        this.attack(state, actorId, action, events);
        break;
      case 'HERO_POWER':
        this.useHeroPower(state, actorId, action, events);
        break;
      case 'END_TURN':
        this.endTurn(state, actorId, events);
        break;
      case 'CONCEDE':
        this.finishByConcede(state, actorId, events);
        break;
      case 'TIMEOUT':
        if (state.phase === 'MULLIGAN') this.handleMulliganTimeout(state, events);
        else this.handleTimeout(state, events);
        break;
      default:
        throw new TavernValidationError('Ação não suportada');
    }

    if (action.type !== 'TIMEOUT') state.turn.consecutiveTimeouts[actorId] = 0;
    this.resolveDeaths(state, { events });
    this.checkWinner(state, events);
    this.validateState(state);
    return {
      state,
      event: {
        type: action.type,
        actorId,
        details: clone(action),
        results: events
      }
    };
  }
}

export { ACTION_TYPES, MATCH_STATUS, MatchEngine };
