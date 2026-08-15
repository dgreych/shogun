import { TavernRuleError, TavernValidationError } from '../errors.js';

function opponentId(state, actorId) {
  return state.playerOrder.find(playerId => playerId !== actorId) || null;
}

function getPlayer(state, playerId) {
  const player = state.players[playerId];
  if (!player) throw new TavernValidationError('Jogador inválido', { playerId });
  return player;
}

function minionTarget(playerId, minion) {
  return { kind: 'MINION', playerId, minion };
}

function heroTarget(playerId, player) {
  return { kind: 'HERO', playerId, hero: player.hero };
}

function normalizeExplicitTarget(state, target) {
  if (!target || typeof target !== 'object') return [];
  const player = state.players[target.playerId];
  if (!player) return [];
  if (target.kind === 'HERO') return [heroTarget(target.playerId, player)];
  if (target.kind === 'MINION') {
    const minion = player.board.find(item => item.instanceId === target.instanceId);
    return minion ? [minionTarget(target.playerId, minion)] : [];
  }
  return [];
}

function resolveTargets(context, effect) {
  const { state, actorId, source, target, engine } = context;
  const friendly = getPlayer(state, actorId);
  const enemyId = opponentId(state, actorId);
  const enemy = getPlayer(state, enemyId);

  switch (effect.target) {
    case 'SELF':
      return source?.instanceId ? [minionTarget(actorId, source)] : [];
    case 'TARGET':
      return normalizeExplicitTarget(state, target);
    case 'FRIENDLY_HERO':
      return [heroTarget(actorId, friendly)];
    case 'ENEMY_HERO':
      return [heroTarget(enemyId, enemy)];
    case 'ALL_FRIENDLY_MINIONS':
      return friendly.board.map(minion => minionTarget(actorId, minion));
    case 'ALL_ENEMY_MINIONS':
      return enemy.board.map(minion => minionTarget(enemyId, minion));
    case 'ALL_OTHER_ENEMIES':
      return [
        heroTarget(enemyId, enemy),
        ...enemy.board.map(minion => minionTarget(enemyId, minion))
      ];
    case 'RANDOM_ENEMY_MINION': {
      const chosen = engine.pickRandom(state, enemy.board);
      return chosen ? [minionTarget(enemyId, chosen)] : [];
    }
    default:
      return normalizeExplicitTarget(state, target);
  }
}

function numericValue(effect, fallback = 0) {
  const value = Number(effect.value ?? fallback);
  if (!Number.isFinite(value)) throw new TavernValidationError('Valor de efeito inválido');
  return value;
}

class EffectRegistry {
  constructor() {
    this.handlers = new Map();
  }

  register(effectName, handler) {
    if (typeof effectName !== 'string' || typeof handler !== 'function') {
      throw new TavernValidationError('Registro de efeito inválido');
    }
    if (this.handlers.has(effectName)) {
      throw new TavernValidationError(`Efeito duplicado: ${effectName}`);
    }
    this.handlers.set(effectName, handler);
    return this;
  }

  has(effectName) {
    return this.handlers.has(effectName);
  }

  execute(effectName, context, effect) {
    const handler = this.handlers.get(effectName);
    if (!handler) throw new TavernRuleError(`Efeito não implementado: ${effectName}`);
    return handler(context, effect);
  }
}

class EffectEngine {
  constructor({ registry = createDefaultEffectRegistry(), maxChain = 64 } = {}) {
    this.registry = registry;
    this.maxChain = maxChain;
  }

  executeEffects({ state, effects, trigger = null, actorId, source = null, target = null, engine, events = [], tracker }) {
    const chain = tracker || { count: 0 };
    for (const effect of effects || []) {
      if (trigger && effect.trigger !== trigger) continue;
      if (!trigger && effect.trigger) continue;

      chain.count += 1;
      if (chain.count > this.maxChain) {
        throw new TavernRuleError('Limite de efeitos em cadeia excedido');
      }

      const context = { state, actorId, source, target, engine, events, tracker: chain };
      this.registry.execute(effect.effect, context, effect);
      engine.resolveDeaths(state, { events, tracker: chain });
      if (!chain.resolvingDeaths) engine.checkWinner(state, events);
      if (state.status === 'FINISHED') break;
    }
    return events;
  }

  executeTrigger({ state, trigger, actorId, source, target = null, engine, events = [], tracker }) {
    return this.executeEffects({
      state,
      effects: source?.effects || [],
      trigger,
      actorId,
      source,
      target,
      engine,
      events,
      tracker
    });
  }
}

function createDefaultEffectRegistry() {
  const registry = new EffectRegistry();

  registry.register('DAMAGE', (context, effect) => {
    for (const target of resolveTargets(context, effect)) {
      context.engine.dealDamage(context.state, target, numericValue(effect), {
        source: context.source,
        actorId: context.actorId,
        events: context.events,
        tracker: context.tracker
      });
    }
  });

  registry.register('DAMAGE_HERO', (context, effect) => {
    const targets = resolveTargets(context, effect).filter(target => target.kind === 'HERO');
    for (const target of targets) {
      context.engine.dealDamage(context.state, target, numericValue(effect), {
        source: context.source,
        actorId: context.actorId,
        events: context.events,
        tracker: context.tracker
      });
    }
  });

  registry.register('HEAL', (context, effect) => {
    for (const target of resolveTargets(context, effect)) {
      const value = numericValue(effect);
      if (target.kind === 'HERO') {
        const before = target.hero.hp;
        target.hero.hp = Math.min(target.hero.maxHp, target.hero.hp + value);
        context.events.push({ type: 'HEAL', target: target.playerId, value: target.hero.hp - before });
      } else {
        const before = target.minion.health;
        target.minion.health = Math.min(target.minion.maxHealth, target.minion.health + value);
        context.events.push({ type: 'HEAL', target: target.minion.instanceId, value: target.minion.health - before });
      }
    }
  });

  registry.register('GAIN_ARMOR', (context, effect) => {
    const player = getPlayer(context.state, context.actorId);
    const value = numericValue(effect);
    player.hero.armor += value;
    context.events.push({ type: 'GAIN_ARMOR', playerId: context.actorId, value });
  });

  registry.register('DRAW', (context, effect) => {
    const value = numericValue(effect, 1);
    for (let count = 0; count < value; count += 1) {
      context.engine.drawCard(context.state, context.actorId, context.events, context.tracker);
    }
  });

  registry.register('SUMMON', (context, effect) => {
    const value = numericValue(effect, 1);
    for (let count = 0; count < value; count += 1) {
      context.engine.summonCard(context.state, context.actorId, effect.cardId, context.events, context.tracker);
    }
  });

  registry.register('SUMMON_RANDOM', (context, effect) => {
    if (!Array.isArray(effect.pool) || effect.pool.length === 0) {
      throw new TavernValidationError('Pool de invocação vazio');
    }
    const value = numericValue(effect, 1);
    for (let count = 0; count < value; count += 1) {
      const cardId = context.engine.pickRandom(context.state, effect.pool);
      context.engine.summonCard(context.state, context.actorId, cardId, context.events, context.tracker);
    }
  });

  registry.register('BUFF_ATTACK', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      const value = numericValue(effect);
      target.minion.attack += value;
      if (effect.duration === 'TURN') {
        target.minion.temporaryAttack = (target.minion.temporaryAttack || 0) + value;
      }
      context.events.push({ type: 'BUFF_ATTACK', target: target.minion.instanceId, value });
    }
  });

  registry.register('BUFF_HEALTH', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      const value = numericValue(effect);
      target.minion.maxHealth += value;
      target.minion.health += value;
      context.events.push({ type: 'BUFF_HEALTH', target: target.minion.instanceId, value });
    }
  });

  registry.register('BUFF_STATS', (context, effect) => {
    const attack = Number(effect.attack ?? effect.value ?? 0);
    const health = Number(effect.health ?? effect.value ?? 0);
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      target.minion.attack += attack;
      target.minion.maxHealth += health;
      target.minion.health += health;
      context.events.push({ type: 'BUFF_STATS', target: target.minion.instanceId, attack, health });
    }
  });

  registry.register('SET_STATS', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      if (Number.isInteger(effect.attack)) target.minion.attack = effect.attack;
      if (Number.isInteger(effect.health)) {
        target.minion.maxHealth = effect.health;
        target.minion.health = Math.min(target.minion.health, effect.health);
      }
      context.events.push({ type: 'SET_STATS', target: target.minion.instanceId });
    }
  });

  registry.register('DESTROY', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      target.minion.health = 0;
      context.events.push({ type: 'DESTROY', target: target.minion.instanceId });
    }
  });

  registry.register('SILENCE', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      target.minion.keywords = [];
      target.minion.effects = [];
      target.minion.statuses = {};
      target.minion.silenced = true;
      context.events.push({ type: 'SILENCE', target: target.minion.instanceId });
    }
  });

  registry.register('RETURN_TO_HAND', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      context.engine.returnToHand(context.state, target.playerId, target.minion.instanceId, context.events);
    }
  });

  registry.register('SHUFFLE_INTO_DECK', (context, effect) => {
    for (const target of resolveTargets(context, effect).filter(item => item.kind === 'MINION')) {
      context.engine.shuffleIntoDeck(context.state, target.playerId, target.minion.instanceId, context.events);
    }
  });

  registry.register('DISCOUNT', (context, effect) => {
    for (const target of resolveTargets(context, effect)) {
      if (target.kind !== 'CARD') continue;
      target.card.cost = Math.max(0, target.card.cost - numericValue(effect));
    }
  });

  registry.register('INCREASE_COST', (context, effect) => {
    for (const target of resolveTargets(context, effect)) {
      if (target.kind !== 'CARD') continue;
      target.card.cost += numericValue(effect);
    }
  });

  registry.register('COPY', (context, effect) => {
    const targets = resolveTargets(context, effect);
    for (const target of targets) {
      const cardId = target.minion?.cardId || target.card?.cardId;
      if (cardId) context.engine.createCardInHand(context.state, context.actorId, cardId, context.events);
    }
  });

  registry.register('RANDOM_TARGET', (context, effect) => {
    const candidates = resolveTargets(context, { ...effect, target: effect.poolTarget || 'ALL_ENEMY_MINIONS' });
    const chosen = context.engine.pickRandom(context.state, candidates);
    if (!chosen || !Array.isArray(effect.effects)) return;
    context.engine.effectEngine.executeEffects({
      ...context,
      effects: effect.effects,
      trigger: null,
      target: chosen.kind === 'HERO'
        ? { kind: 'HERO', playerId: chosen.playerId }
        : { kind: 'MINION', playerId: chosen.playerId, instanceId: chosen.minion.instanceId }
    });
  });

  registry.register('APPLY_STATUS', (context, effect) => {
    const targets = resolveTargets(context, effect);
    for (const target of targets) {
      const entity = target.kind === 'HERO' ? target.hero : target.minion;
      entity.statuses = entity.statuses || {};
      entity.statuses[effect.status] = {
        value: numericValue(effect, 1),
        duration: effect.duration || null,
        appliedOnTurn: context.state.turn.number
      };
      context.events.push({ type: 'APPLY_STATUS', target: target.playerId, status: effect.status });
    }
  });

  registry.register('CREATE_CARD', (context, effect) => {
    const value = numericValue(effect, 1);
    for (let count = 0; count < value; count += 1) {
      context.engine.createCardInHand(context.state, context.actorId, effect.cardId, context.events);
    }
  });

  registry.register('MODIFY_TERRAIN', (context, effect) => {
    context.state.terrain = effect.terrain || null;
    context.events.push({ type: 'MODIFY_TERRAIN', terrain: context.state.terrain });
  });

  registry.register('GAIN_MANA', (context, effect) => {
    const player = getPlayer(context.state, context.actorId);
    const value = numericValue(effect);
    player.mana.current = Math.min(context.engine.config.limits.maxMana, player.mana.current + value);
    context.events.push({ type: 'GAIN_MANA', playerId: context.actorId, value });
  });

  registry.register('PEEK_TOP', (context, effect) => {
    const player = getPlayer(context.state, context.actorId);
    const card = player.deck[0] || null;
    context.events.push({
      type: 'PEEK_TOP',
      playerId: context.actorId,
      private: true,
      cardId: card?.cardId || null
    });
    if (card && context.target?.moveToBottom === true) {
      player.deck.push(player.deck.shift());
      context.events.push({ type: 'MOVE_TO_BOTTOM', playerId: context.actorId, private: true });
    }
  });

  registry.register('DISCOUNT_NEXT_SPELL', (context, effect) => {
    const player = getPlayer(context.state, context.actorId);
    player.nextSpellDiscount = Math.max(player.nextSpellDiscount || 0, numericValue(effect));
    context.events.push({ type: 'DISCOUNT_NEXT_SPELL', playerId: context.actorId, value: player.nextSpellDiscount });
  });

  registry.register('DISCARD', (context, effect) => {
    context.engine.discardCards(context.state, context.actorId, numericValue(effect, 1), context.events);
  });

  return registry;
}

export {
  EffectEngine,
  EffectRegistry,
  createDefaultEffectRegistry,
  normalizeExplicitTarget,
  opponentId,
  resolveTargets
};
