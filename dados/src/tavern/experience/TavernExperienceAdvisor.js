import { TavernValidationError } from '../errors.js';

const FINISH_REASON_LABELS = Object.freeze({
  HERO_DEFEATED: 'o herói foi derrotado',
  CONCEDE: 'houve desistência',
  TIMEOUT: 'o jogador perdeu por ausência',
  DRAW: 'a partida terminou empatada'
});

function clampSeconds(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.ceil(value));
}

function effectiveCardCost(player, card) {
  const base = Math.max(0, Number(card?.cost) || 0);
  if (card?.type !== 'SPELL') return base;
  return Math.max(0, base - Math.max(0, Number(player?.nextSpellDiscount) || 0));
}

function requiresExplicitTarget(card) {
  return Boolean(card?.effects?.some(effect => effect?.trigger === 'ON_PLAY' && effect?.target === 'TARGET'));
}

function targetDescriptor(kind, playerId, index = null, instanceId = null, label = null) {
  return {
    kind,
    playerId,
    index,
    instanceId,
    label
  };
}

class TavernExperienceAdvisor {
  constructor({ heroRegistry = null, now = () => Date.now(), limits = null } = {}) {
    this.heroRegistry = heroRegistry;
    this.now = now;
    this.limits = limits;
  }

  analyze(state, playerId, { prefix = '!', now = this.now() } = {}) {
    if (!state?.players || !Array.isArray(state.playerOrder)) {
      throw new TavernValidationError('Estado inválido para orientar a experiência da Tavern');
    }
    const player = state.players[playerId];
    if (!player) throw new TavernValidationError('Jogador não pertence à partida');
    const enemyId = state.playerOrder.find(id => id !== playerId);
    const enemy = state.players[enemyId];
    if (!enemy) throw new TavernValidationError('Adversário ausente na partida');

    const deadlineMs = state.turn?.deadlineAt ? Date.parse(state.turn.deadlineAt) - Number(now) : null;
    const secondsRemaining = deadlineMs === null ? null : clampSeconds(deadlineMs / 1000);
    const isActivePlayer = state.status === 'ACTIVE' && state.phase === 'MAIN' && state.turn?.activePlayerId === playerId;

    const analysis = {
      matchId: state.matchId,
      version: state.version,
      status: state.status,
      phase: state.phase,
      playerId,
      enemyId,
      isActivePlayer,
      turnNumber: state.turn?.number ?? null,
      secondsRemaining,
      playableCards: [],
      attackers: [],
      heroPower: this.describeHeroPower(state, playerId),
      mulligan: null,
      nextActions: [],
      summary: null
    };

    if (state.status === 'FINISHED') {
      const won = state.winnerId === playerId;
      const draw = !state.winnerId;
      analysis.summary = draw
        ? 'A partida terminou empatada.'
        : won
          ? 'Você venceu a partida.'
          : 'A partida terminou com a vitória do adversário.';
      analysis.nextActions.push({
        type: 'INFO',
        label: FINISH_REASON_LABELS[state.finishReason] || 'a partida foi encerrada'
      });
      return analysis;
    }

    if (state.phase === 'MULLIGAN') {
      const alreadyConfirmed = Boolean(state.mulligan?.responses?.[playerId]?.done);
      const exchangeable = player.hand
        .map((card, index) => ({ index: index + 1, card }))
        .filter(({ card }) => card.collectible !== false)
        .map(({ index, card }) => ({
          index,
          cardId: card.cardId,
          instanceId: card.instanceId,
          name: card.name,
          cost: effectiveCardCost(player, card)
        }));
      analysis.mulligan = { alreadyConfirmed, exchangeable };
      analysis.summary = alreadyConfirmed
        ? 'Sua preparação está confirmada. Falta o outro jogador.'
        : 'Escolha quais cartas quer trocar ou mantenha sua mão.';
      if (!alreadyConfirmed) {
        analysis.nextActions.push({
          type: 'MULLIGAN_KEEP',
          command: `${prefix}mulligan manter`,
          label: 'Manter a mão'
        });
        if (exchangeable.length) {
          analysis.nextActions.push({
            type: 'MULLIGAN_SWAP',
            command: `${prefix}mulligan <números>`,
            label: 'Trocar cartas pelos números mostrados'
          });
        }
      }
      return analysis;
    }

    if (!isActivePlayer) {
      analysis.summary = 'Aguarde o turno do adversário.';
      analysis.nextActions.push({
        type: 'VIEW_BOARD',
        command: `${prefix}campo`,
        label: 'Ver o estado atual da mesa'
      });
      return analysis;
    }

    analysis.playableCards = this.describePlayableCards(state, playerId);
    analysis.attackers = this.describeAttackers(state, playerId);
    analysis.heroPower = this.describeHeroPower(state, playerId);

    for (const card of analysis.playableCards.slice(0, 3)) {
      analysis.nextActions.push({
        type: 'PLAY_CARD',
        command: card.requiresTarget
          ? `${prefix}jogar ${card.index} <alvo>`
          : `${prefix}jogar ${card.index}`,
        label: `Jogar ${card.name}`,
        cardIndex: card.index
      });
    }

    for (const attacker of analysis.attackers.slice(0, 2)) {
      const target = attacker.targets[0];
      if (!target) continue;
      const targetToken = target.kind === 'HERO' ? 'heroi' : String(target.index);
      analysis.nextActions.push({
        type: 'ATTACK',
        command: `${prefix}atacar ${attacker.index} ${targetToken}`,
        label: `Atacar com ${attacker.name}`,
        sourceIndex: attacker.index
      });
    }

    if (analysis.heroPower.available) {
      analysis.nextActions.push({
        type: 'HERO_POWER',
        command: analysis.heroPower.requiresTarget ? `${prefix}poder <alvo>` : `${prefix}poder`,
        label: 'Usar poder do herói'
      });
    }

    analysis.nextActions.push({
      type: 'END_TURN',
      command: `${prefix}fim`,
      label: 'Encerrar o turno'
    });

    const availableKinds = [
      analysis.playableCards.length ? `${analysis.playableCards.length} carta(s) jogável(is)` : null,
      analysis.attackers.length ? `${analysis.attackers.length} criatura(s) pronta(s) para atacar` : null,
      analysis.heroPower.available ? 'poder disponível' : null
    ].filter(Boolean);
    analysis.summary = availableKinds.length
      ? `Sua vez: ${availableKinds.join(', ')}.`
      : 'Sua vez: não há ação ofensiva disponível; você pode encerrar o turno.';
    return analysis;
  }

  describePlayableCards(state, playerId) {
    const player = state.players[playerId];
    if (state.status !== 'ACTIVE' || state.phase !== 'MAIN' || state.turn.activePlayerId !== playerId) return [];
    const boardLimit = Number(this.limits?.boardSize) || 7;

    return player.hand.flatMap((card, index) => {
      const cost = effectiveCardCost(player, card);
      if (cost > player.mana.current) return [];
      if (card.type === 'MINION' && player.board.length >= boardLimit) return [];
      return [{
        index: index + 1,
        cardId: card.cardId,
        instanceId: card.instanceId,
        name: card.name,
        type: card.type,
        cost,
        requiresTarget: requiresExplicitTarget(card)
      }];
    });
  }

  describeAttackers(state, playerId) {
    const player = state.players[playerId];
    if (state.status !== 'ACTIVE' || state.phase !== 'MAIN' || state.turn.activePlayerId !== playerId) return [];
    const enemyId = state.playerOrder.find(id => id !== playerId);
    const enemy = state.players[enemyId];
    const guards = enemy.board
      .map((card, index) => ({ card, index: index + 1 }))
      .filter(({ card }) => card.keywords?.includes('GUARD'));

    const targets = guards.length
      ? guards.map(({ card, index }) => targetDescriptor('MINION', enemyId, index, card.instanceId, card.name))
      : [
          ...enemy.board.map((card, index) => targetDescriptor('MINION', enemyId, index + 1, card.instanceId, card.name)),
          targetDescriptor('HERO', enemyId, null, null, 'Herói inimigo')
        ];

    return player.board.flatMap((card, index) => {
      if (!card.canAttack || Number(card.attacksThisTurn) >= 1) return [];
      return [{
        index: index + 1,
        instanceId: card.instanceId,
        cardId: card.cardId,
        name: card.name,
        attack: card.attack,
        targets
      }];
    });
  }

  describeHeroPower(state, playerId) {
    const player = state.players[playerId];
    if (!player) return { available: false, reason: 'Jogador ausente' };
    const definition = this.heroRegistry?.get?.(player.classId) || null;
    const power = definition?.power || {};
    const cost = Number(player.hero?.powerCost ?? power.cost ?? 0);
    const requiresTarget = Boolean(power.requiresTarget);
    const active = state.status === 'ACTIVE' && state.phase === 'MAIN' && state.turn?.activePlayerId === playerId;
    let reason = null;
    if (!active) reason = 'Aguarde seu turno';
    else if (player.hero?.powerUsed) reason = 'Poder já usado neste turno';
    else if (player.mana.current < cost) reason = 'Mana insuficiente';
    else if (power.effects?.some(effect => ['SUMMON', 'SUMMON_RANDOM'].includes(effect.effect)) && player.board.length >= (Number(this.limits?.boardSize) || 7)) {
      reason = 'Campo cheio';
    }
    return {
      available: reason === null,
      cost,
      requiresTarget,
      reason,
      name: definition?.name || player.classId
    };
  }
}

export {
  TavernExperienceAdvisor,
  effectiveCardCost,
  requiresExplicitTarget
};
