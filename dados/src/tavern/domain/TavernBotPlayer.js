// Oponente PvE da Taverna: raciocina direto sobre o `state` do MatchEngine
// e devolve ações no mesmo formato que um jogador real despacharia via
// dispatchForPlayer — não depende do TavernExperienceAdvisor (orientação
// textual) nem do balanceSimulator (laço de simulação offline), pra não
// acoplar a inteligência de jogo a sistemas pensados pra outra finalidade.

// Identidade estável do oponente PvE — nunca é um JID real do WhatsApp, só
// existe dentro do MatchEngine. Centralizado aqui e checado em um único
// lugar no transporte (WhatsAppTavernTransport), em vez de espalhar "if
// for o bot, pula" pelos vários pontos de envio privado do controlador.
const TAVERN_BOT_PLAYER_ID = 'tavern-bot@bot.tavern';
const TAVERN_BOT_DISPLAY_NAME = 'Golem da Taverna';

const BOT_INTRO_CLASSES = Object.freeze(['GUARDIAN', 'EXILE', 'STORM']);
const MULLIGAN_DISCARD_COST_THRESHOLD = 4;
const TRADE_CHANCE = 0.7;

function pickRandomIntroClass(randomFn = Math.random) {
  const index = Math.floor(randomFn() * BOT_INTRO_CLASSES.length);
  return BOT_INTRO_CLASSES[Math.min(index, BOT_INTRO_CLASSES.length - 1)];
}

function effectiveCost(player, card) {
  if (card.type !== 'SPELL') return card.cost;
  return Math.max(0, card.cost - Math.max(0, Number(player.nextSpellDiscount) || 0));
}

function affordablePlayableCards(player) {
  return player.hand.filter(card => (
    effectiveCost(player, card) <= player.mana.current
    && (card.type !== 'MINION' || player.board.length < 7)
  ));
}

function requiresTargetOnPlay(card) {
  return Boolean(card.effects?.some(effect => effect.trigger === 'ON_PLAY' && effect.target === 'TARGET'));
}

function directDamageValue(card) {
  if (!card.effects) return 0;
  return card.effects
    .filter(effect => effect.trigger === 'ON_PLAY' && ['DAMAGE', 'DAMAGE_HERO'].includes(effect.effect))
    .reduce((sum, effect) => sum + (Number(effect.value) || 0), 0);
}

function readyAttackers(player) {
  return player.board.filter(minion => minion.canAttack && Number(minion.attacksThisTurn) < 1);
}

/**
 * Cartas de custo alto atrapalham mais do que ajudam numa mão de abertura
 * pequena — descartar acima do limiar é a mesma convenção do gênero
 * (Hearthstone, Runeterra) e já era usada no harness de balanceamento.
 */
function chooseMulliganDiscards(hand) {
  return hand
    .filter(card => card.collectible !== false && card.cost > MULLIGAN_DISCARD_COST_THRESHOLD)
    .map(card => card.instanceId);
}

/**
 * Decide UMA ação por chamada — quem chama aplica via dispatchForPlayer e
 * chama de novo com o estado atualizado, até vir END_TURN ou a partida
 * acabar. Prioridade: fechar a partida se houver lethal na mesa; senão
 * desenvolver o campo com a carta mais impactante disponível (removendo
 * uma ameaça quando a carta exige alvo); senão atacar (respeitando Guarda,
 * fazendo troca favorável quando vale a pena, indo na cara quando não);
 * senão usar o poder de herói; senão passar o turno.
 */
function chooseAction(state, botId, randomFn = Math.random) {
  const bot = state.players[botId];
  const enemyId = state.playerOrder.find(id => id !== botId);
  const enemy = state.players[enemyId];
  const enemyGuards = enemy.board.filter(minion => minion.keywords?.includes('GUARD'));

  if (enemyGuards.length === 0) {
    const attackers = readyAttackers(bot);
    const attackDamage = attackers.reduce((sum, minion) => sum + minion.attack, 0);
    const playable = affordablePlayableCards(bot);
    const burnCard = playable.find(card => card.type === 'SPELL' && directDamageValue(card) > 0);
    const burnDamage = playable
      .filter(card => card.type === 'SPELL')
      .reduce((sum, card) => sum + directDamageValue(card), 0);
    const enemyEffectiveHp = enemy.hero.hp + enemy.hero.armor;
    if (attackDamage + burnDamage >= enemyEffectiveHp && (attackDamage > 0 || burnDamage > 0)) {
      if (burnCard) {
        return {
          type: 'PLAY_CARD',
          card: burnCard.instanceId,
          target: requiresTargetOnPlay(burnCard) ? { kind: 'HERO', playerId: enemyId } : null
        };
      }
      if (attackers.length > 0) {
        return { type: 'ATTACK', source: attackers[0].instanceId, target: { kind: 'HERO', playerId: enemyId } };
      }
    }
  }

  const playable = affordablePlayableCards(bot);
  if (playable.length > 0) {
    const scored = playable.map(card => ({
      card,
      score: effectiveCost(bot, card) + randomFn() * 0.5
    }));
    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].card;
    let target = null;
    if (requiresTargetOnPlay(chosen)) {
      const damage = directDamageValue(chosen);
      const killableTargets = enemy.board
        .filter(minion => damage > 0 && minion.health <= damage)
        .sort((a, b) => b.attack - a.attack);
      target = killableTargets[0]
        ? { kind: 'MINION', playerId: enemyId, instanceId: killableTargets[0].instanceId }
        : { kind: 'HERO', playerId: enemyId };
    }
    return { type: 'PLAY_CARD', card: chosen.instanceId, target };
  }

  const attackers = readyAttackers(bot);
  if (attackers.length > 0) {
    const attacker = attackers[0];
    if (enemyGuards.length > 0) {
      const weakestGuard = [...enemyGuards].sort((a, b) => a.health - b.health)[0];
      return { type: 'ATTACK', source: attacker.instanceId, target: { kind: 'MINION', playerId: enemyId, instanceId: weakestGuard.instanceId } };
    }
    const favorableTrade = enemy.board
      .filter(minion => minion.health <= attacker.attack && minion.attack < attacker.health)
      .sort((a, b) => b.attack - a.attack)[0];
    if (favorableTrade && randomFn() < TRADE_CHANCE) {
      return { type: 'ATTACK', source: attacker.instanceId, target: { kind: 'MINION', playerId: enemyId, instanceId: favorableTrade.instanceId } };
    }
    return { type: 'ATTACK', source: attacker.instanceId, target: { kind: 'HERO', playerId: enemyId } };
  }

  if (!bot.hero.powerUsed && bot.mana.current >= bot.hero.powerCost) {
    return { type: 'HERO_POWER', target: null };
  }

  return { type: 'END_TURN' };
}

export {
  BOT_INTRO_CLASSES,
  TAVERN_BOT_DISPLAY_NAME,
  TAVERN_BOT_PLAYER_ID,
  chooseAction,
  chooseMulliganDiscards,
  pickRandomIntroClass
};
