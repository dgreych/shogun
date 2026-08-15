const STRUCTURAL_EVENT_TYPES = new Set([
  'MINION_SUMMONED',
  'MINION_DIED',
  'RETURN_TO_HAND',
  'SHUFFLE_INTO_DECK',
  'MODIFY_TERRAIN',
  'MATCH_FINISHED',
  'TURN_STARTED',
  'MULLIGAN_FINISHED'
]);

const PUBLIC_EVENT_LABELS = Object.freeze({
  HERO_DAMAGED: 'dano ao herói',
  MINION_DAMAGED: 'dano em criatura',
  HEAL: 'cura',
  GAIN_ARMOR: 'armadura',
  MINION_DIED: 'criatura derrotada',
  MINION_SUMMONED: 'criatura invocada',
  CARD_BURNED: 'carta queimada',
  TURN_TIMEOUT: 'tempo esgotado'
});

function mention(playerId) {
  return `@${String(playerId || '').split('@')[0]}`;
}

function publicResults(event) {
  return (event?.results || []).filter(result => result && result.private !== true);
}

function cardName(cardRegistry, cardId) {
  if (!cardId) return null;
  try {
    return cardRegistry?.get?.(cardId)?.name || cardId;
  } catch {
    return cardId;
  }
}

function instanceName(state, instanceId, cardRegistry) {
  if (!instanceId) return null;
  for (const playerId of state.playerOrder || []) {
    const player = state.players?.[playerId];
    for (const card of player?.board || []) {
      if (card.instanceId === instanceId) return card.name || cardName(cardRegistry, card.cardId);
    }
    for (const entry of player?.graveyard || []) {
      if (entry.instanceId === instanceId) return cardName(cardRegistry, entry.cardId);
    }
  }
  return null;
}

function summarizeDamage(results, state, cardRegistry) {
  const lines = [];
  for (const item of results) {
    if (item.type === 'HERO_DAMAGED' && Number(item.value) > 0) {
      const armor = Number(item.absorbed) > 0 ? ` (${item.absorbed} absorvido pela armadura)` : '';
      lines.push(`${mention(item.playerId)} sofreu *${item.value}* de dano${armor}.`);
    }
    if (item.type === 'MINION_DAMAGED' && Number(item.value) > 0) {
      const name = instanceName(state, item.instanceId, cardRegistry) || 'Uma criatura';
      lines.push(`*${name}* sofreu *${item.value}* de dano.`);
    }
  }
  return lines;
}

class TavernEventNarrator {
  constructor({ cardRegistry = null } = {}) {
    this.cardRegistry = cardRegistry;
  }

  narrate(event, state, { prefix = '!' } = {}) {
    const results = publicResults(event);
    const lines = [];
    const mentions = new Set();
    let renderBoard = false;
    let refreshActiveHand = false;

    if (!event) {
      return { lines, text: '', mentions: [], renderBoard: true, refreshActiveHand: false };
    }

    switch (event.type) {
      case 'PLAY_CARD': {
        const played = results.find(item => item.type === 'CARD_PLAYED');
        const name = cardName(this.cardRegistry, played?.cardId) || 'uma carta';
        lines.push(`🃏 ${mention(event.actorId)} jogou *${name}*.`);
        mentions.add(event.actorId);
        renderBoard = results.some(item => STRUCTURAL_EVENT_TYPES.has(item.type)) ||
          results.some(item => ['GAIN_ARMOR', 'HEAL', 'MODIFY_TERRAIN'].includes(item.type));
        break;
      }
      case 'ATTACK': {
        const declared = results.find(item => item.type === 'ATTACK_DECLARED');
        const source = instanceName(state, declared?.source, this.cardRegistry) || 'Uma criatura';
        lines.push(`⚔️ *${source}* atacou.`);
        renderBoard = results.some(item => ['MINION_DIED', 'MATCH_FINISHED'].includes(item.type));
        break;
      }
      case 'HERO_POWER':
        lines.push(`✨ ${mention(event.actorId)} usou o poder do herói.`);
        mentions.add(event.actorId);
        renderBoard = results.some(item => STRUCTURAL_EVENT_TYPES.has(item.type));
        break;
      case 'END_TURN': {
        const started = results.find(item => item.type === 'TURN_STARTED');
        if (started?.playerId) {
          lines.push(`🔥 Turno de ${mention(started.playerId)}.`);
          mentions.add(started.playerId);
          refreshActiveHand = true;
        }
        renderBoard = true;
        break;
      }
      case 'CONCEDE':
      case 'TIMEOUT':
        renderBoard = true;
        break;
      case 'MULLIGAN':
        renderBoard = results.some(item => item.type === 'MULLIGAN_FINISHED');
        break;
      default:
        renderBoard = results.some(item => STRUCTURAL_EVENT_TYPES.has(item.type));
    }

    lines.push(...summarizeDamage(results, state, this.cardRegistry));

    for (const item of results) {
      if (item.type === 'MINION_DIED') {
        const name = cardName(this.cardRegistry, item.cardId) || 'Uma criatura';
        lines.push(`☠️ *${name}* deixou a mesa.`);
      }
      if (item.type === 'MINION_SUMMONED') {
        const name = cardName(this.cardRegistry, item.cardId) || 'Uma criatura';
        lines.push(`✦ *${name}* entrou em campo.`);
      }
      if (item.type === 'GAIN_ARMOR' && Number(item.value) > 0) {
        lines.push(`🛡️ ${mention(item.playerId)} ganhou *${item.value}* de armadura.`);
        mentions.add(item.playerId);
      }
      if (item.type === 'HEAL' && Number(item.value) > 0) {
        lines.push(`✚ Cura de *${item.value}*.`);
      }
      if (item.type === 'TURN_TIMEOUT') {
        lines.push(`⏳ ${mention(item.playerId)} perdeu o prazo do turno.`);
        mentions.add(item.playerId);
      }
      if (item.type === 'MATCH_FINISHED') renderBoard = true;
    }

    if (state?.status === 'ACTIVE' && event.type !== 'END_TURN' && lines.length) {
      const activeId = state.turn?.activePlayerId;
      if (activeId) {
        lines.push(`${mention(activeId)} continua com a vez · ${prefix}campo para rever a mesa.`);
        mentions.add(activeId);
      }
    }

    return {
      lines,
      text: lines.join('\n'),
      mentions: [...mentions],
      renderBoard,
      refreshActiveHand
    };
  }
}

export {
  PUBLIC_EVENT_LABELS,
  STRUCTURAL_EVENT_TYPES,
  TavernEventNarrator,
  publicResults
};
