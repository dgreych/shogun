import { createDefaultRegistries } from '../domain/registries.js';
import { MatchEngine } from '../domain/MatchEngine.js';
import { createStarterDeck } from '../domain/starterDeck.js';

const MAX_TURNS = 60;
const DEAD_HAND_TURN_LIMIT = 3;
const MULLIGAN_DISCARD_COST_THRESHOLD = 4;

// Cartas que geram vantagem de recurso/tempo (compra, desconto de próxima
// mágica) ganham prioridade sobre o resto da mão no mesmo turno — sem essa
// noção mínima de sequência, o bot guloso ("mais barata primeiro") nunca
// aproveita o próprio desconto que acabou de criar, o que penaliza
// artificialmente arquétipos como Tempestade que dependem de sequência.
function cardPriority(card) {
  const hasEnablerEffect = card.effects.some(effect => (
    effect.trigger === 'ON_PLAY' && ['DISCOUNT_NEXT_SPELL', 'DRAW'].includes(effect.effect)
  ));
  return hasEnablerEffect ? 0 : 1;
}

/**
 * Joga uma partida inteira com um bot heurístico determinístico dos dois
 * lados: descarta cartas caras no mulligan, joga a carta mais barata
 * disponível repetidamente, usa o poder de herói quando cabe no mana e não
 * exige alvo, ataca a Guarda quando existe (senão o herói) com todo
 * atacante disponível, e passa o turno. Não joga perfeitamente — existe
 * para detectar extremos de forma reproduzível, não para maximizar vitória.
 */
function playBotMatch(engine, heroRegistry, { playerOneId, playerTwoId, classIdOne, classIdTwo, seed, startingPlayerId }) {
  let state = engine.createMatch({
    groupId: 'balance-harness@g.us',
    seed,
    startingPlayerId,
    players: [
      { id: playerOneId, classId: classIdOne, deck: createStarterDeck(classIdOne) },
      { id: playerTwoId, classId: classIdTwo, deck: createStarterDeck(classIdTwo) }
    ]
  });

  const stats = {
    turnsPlayed: 0,
    deadHandTurns: 0,
    manaAvailableTotal: 0,
    manaWastedTotal: 0,
    powerEligibleTurns: 0,
    powerUsedTurns: 0,
    finished: false,
    winnerId: null,
    finishReason: null,
    startingPlayerId: state.playerOrder[0],
    reachedTurnCap: false
  };

  for (const playerId of state.playerOrder) {
    const player = state.players[playerId];
    const toDiscard = player.hand
      .filter(card => card.collectible !== false && card.cost > MULLIGAN_DISCARD_COST_THRESHOLD)
      .map(card => card.instanceId);
    state = engine.applyAction(state, { type: 'MULLIGAN', actorId: playerId, cards: toDiscard }).state;
  }

  while (state.status === 'ACTIVE' && state.turn.number <= MAX_TURNS) {
    const actorId = state.turn.activePlayerId;
    const enemyId = state.playerOrder.find(id => id !== actorId);

    if (state.turn.number <= DEAD_HAND_TURN_LIMIT) {
      const player = state.players[actorId];
      const anyPlayable = player.hand.some(card => {
        const cost = card.type === 'SPELL' && player.nextSpellDiscount > 0
          ? Math.max(0, card.cost - player.nextSpellDiscount)
          : card.cost;
        if (cost > player.mana.current) return false;
        if (card.type === 'MINION' && player.board.length >= 7) return false;
        return true;
      });
      if (!anyPlayable) stats.deadHandTurns += 1;
    }

    let keepPlaying = true;
    while (keepPlaying) {
      keepPlaying = false;
      const player = state.players[actorId];
      const playable = player.hand
        .filter(card => {
          const cost = card.type === 'SPELL' && player.nextSpellDiscount > 0
            ? Math.max(0, card.cost - player.nextSpellDiscount)
            : card.cost;
          if (cost > player.mana.current) return false;
          if (card.type === 'MINION' && player.board.length >= 7) return false;
          return true;
        })
        .sort((a, b) => (cardPriority(a) - cardPriority(b)) || (a.cost - b.cost));
      if (!playable.length) break;
      const chosen = playable[0];
      const needsTarget = chosen.effects.some(effect => effect.trigger === 'ON_PLAY' && effect.target === 'TARGET');
      const target = needsTarget ? { kind: 'HERO', playerId: enemyId } : null;
      try {
        state = engine.applyAction(state, { type: 'PLAY_CARD', actorId, card: chosen.instanceId, target }).state;
        keepPlaying = true;
      } catch {
        break;
      }
      if (state.status === 'FINISHED') break;
    }

    if (state.status === 'ACTIVE') {
      const player = state.players[actorId];
      const heroDefinition = heroRegistry.get(player.classId);
      const powerCost = Number(player.hero.powerCost ?? heroDefinition.power.cost);
      if (!player.hero.powerUsed && player.mana.current >= powerCost) {
        stats.powerEligibleTurns += 1;
        if (!heroDefinition.power.requiresTarget) {
          try {
            state = engine.applyAction(state, { type: 'HERO_POWER', actorId }).state;
            stats.powerUsedTurns += 1;
          } catch {
            // segue sem o poder se algo tornar a ação inválida entre a checagem e a execução
          }
        }
      }
    }

    if (state.status === 'ACTIVE') {
      let keepAttacking = true;
      while (keepAttacking) {
        keepAttacking = false;
        const attacker = state.players[actorId].board.find(minion => minion.canAttack && minion.attacksThisTurn < 1);
        if (!attacker) break;
        const enemy = state.players[enemyId];
        const guard = enemy.board.find(minion => minion.keywords?.includes('GUARD'));
        const target = guard
          ? { kind: 'MINION', playerId: enemyId, instanceId: guard.instanceId }
          : { kind: 'HERO', playerId: enemyId };
        try {
          state = engine.applyAction(state, { type: 'ATTACK', actorId, source: attacker.instanceId, target }).state;
          keepAttacking = true;
        } catch {
          break;
        }
        if (state.status === 'FINISHED') break;
      }
    }

    if (state.status === 'FINISHED') break;

    const player = state.players[actorId];
    stats.manaAvailableTotal += player.mana.max;
    stats.manaWastedTotal += player.mana.current;

    state = engine.applyAction(state, { type: 'END_TURN', actorId }).state;
  }

  stats.turnsPlayed = state.turn.number;
  stats.finished = state.status === 'FINISHED';
  stats.winnerId = state.winnerId;
  stats.finishReason = state.finishReason;
  stats.reachedTurnCap = state.status === 'ACTIVE' && state.turn.number > MAX_TURNS;
  return stats;
}

/**
 * Roda o harness completo: para cada par de classes (incluindo espelho),
 * simula `gamesPerMatchup` seeds com cada lado começando, agrega
 * win rate por matchup, vantagem do primeiro jogador, duração média,
 * frequência de mão morta nos turnos 1-3, mana não utilizada e uso de poder.
 * Determinístico: a mesma lista de `classIds` + `gamesPerMatchup` +
 * `seedPrefix` sempre produz o mesmo relatório.
 */
async function runBalanceReport({
  classIds = ['GUARDIAN', 'EXILE', 'STORM'],
  gamesPerMatchup = 40,
  seedPrefix = 'balance'
} = {}) {
  const { cardRegistry, heroRegistry } = await createDefaultRegistries();
  const engine = new MatchEngine({ cardRegistry, heroRegistry });

  const matchups = [];
  for (let i = 0; i < classIds.length; i += 1) {
    for (let j = i; j < classIds.length; j += 1) {
      matchups.push([classIds[i], classIds[j]]);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    gamesPerMatchup,
    totalGames: 0,
    matchups: [],
    firstPlayer: { wins: 0, draws: 0, games: 0 },
    global: {
      deadHandTurns: 0,
      turnsObservedForDeadHand: 0,
      manaAvailableTotal: 0,
      manaWastedTotal: 0,
      powerEligibleTurns: 0,
      powerUsedTurns: 0,
      reachedTurnCap: 0
    }
  };

  for (const [classA, classB] of matchups) {
    const matchupStats = {
      matchup: `${classA} x ${classB}`,
      games: 0,
      winsA: 0,
      winsB: 0,
      draws: 0,
      totalTurns: 0
    };

    for (let gameIndex = 0; gameIndex < gamesPerMatchup; gameIndex += 1) {
      const seed = `${seedPrefix}:${classA}-${classB}:${gameIndex}`;
      for (const startingSide of ['A', 'B']) {
        const startingPlayerId = startingSide === 'A' ? 'p1' : 'p2';
        const stats = playBotMatch(engine, heroRegistry, {
          playerOneId: 'p1',
          playerTwoId: 'p2',
          classIdOne: classA,
          classIdTwo: classB,
          seed: `${seed}:${startingSide}`,
          startingPlayerId
        });

        report.totalGames += 1;
        matchupStats.games += 1;
        matchupStats.totalTurns += stats.turnsPlayed;
        if (!stats.winnerId) matchupStats.draws += 1;
        else if (stats.winnerId === 'p1') matchupStats.winsA += 1;
        else matchupStats.winsB += 1;

        report.firstPlayer.games += 1;
        if (!stats.winnerId) report.firstPlayer.draws += 1;
        else if (stats.winnerId === stats.startingPlayerId) report.firstPlayer.wins += 1;

        report.global.deadHandTurns += stats.deadHandTurns;
        report.global.turnsObservedForDeadHand += Math.min(stats.turnsPlayed, DEAD_HAND_TURN_LIMIT);
        report.global.manaAvailableTotal += stats.manaAvailableTotal;
        report.global.manaWastedTotal += stats.manaWastedTotal;
        report.global.powerEligibleTurns += stats.powerEligibleTurns;
        report.global.powerUsedTurns += stats.powerUsedTurns;
        if (stats.reachedTurnCap) report.global.reachedTurnCap += 1;
      }
    }

    report.matchups.push({
      ...matchupStats,
      winRateA: matchupStats.winsA / matchupStats.games,
      winRateB: matchupStats.winsB / matchupStats.games,
      drawRate: matchupStats.draws / matchupStats.games,
      averageTurns: matchupStats.totalTurns / matchupStats.games
    });
  }

  report.firstPlayerWinRate = report.firstPlayer.wins / report.firstPlayer.games;
  report.deadHandRateTurns1to3 = report.global.deadHandTurns / report.global.turnsObservedForDeadHand;
  report.manaWasteRate = report.global.manaWastedTotal / report.global.manaAvailableTotal;
  report.powerUsageRate = report.global.powerEligibleTurns > 0
    ? report.global.powerUsedTurns / report.global.powerEligibleTurns
    : null;
  report.turnCapRate = report.global.reachedTurnCap / report.totalGames;

  return report;
}

export { MAX_TURNS, playBotMatch, runBalanceReport };
