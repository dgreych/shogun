import { TavernValidationError } from '../errors.js';

const TAVERN_RENDER_VIEW_SCHEMA_VERSION = 1;
const RAW_WHATSAPP_ID = /@(s\.whatsapp\.net|g\.us|lid|broadcast|newsletter)/i;
const PHONE_LIKE_NAME = /^\+?\d{8,20}$/;
const PHONE_FORMATTED_NAME = /^[+\d\s().-]+$/;
const VALID_STATUS = new Set(['ACTIVE', 'FINISHED']);
const VALID_PHASE = new Set(['MULLIGAN', 'MAIN']);
const VALID_RARITY = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const VALID_CARD_TYPE = new Set(['MINION', 'SPELL', 'ARTIFACT', 'TERRAIN']);
const COMPACT_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TavernValidationError(`${label} inválido para renderização remota`);
  }
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TavernValidationError(`${label} inválido para renderização remota`);
  }
  return value;
}

function requiredString(value, label, maxLength = 191) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new TavernValidationError(`${label} inválido para renderização remota`);
  }
  return value.trim();
}

function finiteNumber(value, label, { min = 0, max = 99_999 } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TavernValidationError(`${label} inválido para renderização remota`);
  }
  return value;
}

function requiredCompactId(value, label) {
  const compactId = requiredString(value, label, 64);
  if (!COMPACT_ID.test(compactId)) {
    throw new TavernValidationError(`${label} inválido para renderização remota`);
  }
  return compactId;
}

function requiredEnum(value, allowed, label) {
  const normalized = requiredString(value, label, 32);
  if (!allowed.has(normalized)) {
    throw new TavernValidationError(`${label} inválido para renderização remota`);
  }
  return normalized;
}

function optionalNumber(value, label) {
  if (value === null || value === undefined) return null;
  return finiteNumber(value, label);
}

function safeDisplayText(candidate, fallback, maxLength = 64) {
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  const digits = value.replace(/\D/g, '');
  if (
    !value
    || RAW_WHATSAPP_ID.test(value)
    || PHONE_LIKE_NAME.test(value)
    || (digits.length >= 8 && PHONE_FORMATTED_NAME.test(value))
  ) {
    return fallback;
  }
  return value.slice(0, maxLength);
}

function safePersonName(candidate, fallback, maxLength = 64) {
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  if (value.replace(/\D/g, '').length >= 7) return fallback;
  return safeDisplayText(value, fallback, maxLength);
}

function visibleName(playerId, candidate, fallback) {
  const rawId = String(playerId || '').trim();
  const localPart = rawId.split('@')[0];
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  if (value === rawId || value === localPart) return fallback;
  return safePersonName(value, fallback);
}

function keywordsOf(card) {
  const keywords = requiredArray(card.keywords || [], 'Palavras-chave da carta');
  if (keywords.length > 8) {
    throw new TavernValidationError('Palavras-chave demais para renderização remota');
  }
  return keywords.map((keyword, index) => requiredCompactId(keyword, `Palavra-chave ${index + 1}`));
}

function boardCardView(card, ownerClassId) {
  const source = requiredObject(card, 'Carta pública');
  return {
    cardId: requiredCompactId(source.cardId, 'ID público da carta'),
    name: requiredString(source.name, 'Nome da carta', 120),
    rarity: requiredEnum(source.rarity, VALID_RARITY, 'Raridade da carta'),
    classId: requiredCompactId(source.classId || ownerClassId, 'Classe visual da carta'),
    attack: finiteNumber(source.attack, 'Ataque da carta'),
    health: finiteNumber(source.health, 'Vida da carta'),
    keywords: keywordsOf(source),
    canAttack: source.canAttack === true,
    attacksThisTurn: finiteNumber(source.attacksThisTurn ?? 0, 'Ataques da carta no turno', { max: 16 })
  };
}

function handCardView(card, ownerClassId) {
  const source = requiredObject(card, 'Carta da mão');
  const view = {
    cardId: requiredCompactId(source.cardId, 'ID público da carta'),
    name: requiredString(source.name, 'Nome da carta', 120),
    type: requiredEnum(source.type, VALID_CARD_TYPE, 'Tipo da carta'),
    rarity: requiredEnum(source.rarity, VALID_RARITY, 'Raridade da carta'),
    cost: finiteNumber(source.cost, 'Custo da carta', { max: 100 }),
    keywords: keywordsOf(source),
    classId: requiredCompactId(source.classId || ownerClassId, 'Classe visual da carta')
  };
  const attack = optionalNumber(source.attack, 'Ataque da carta');
  const health = optionalNumber(source.health, 'Vida da carta');
  if (attack !== null) view.attack = attack;
  if (health !== null) view.health = health;
  if (typeof source.text === 'string' && source.text.trim()) view.text = source.text.trim().slice(0, 500);
  return view;
}

function validateBaseState(state) {
  const source = requiredObject(state, 'Estado da partida');
  const playerOrder = requiredArray(source.playerOrder, 'Ordem dos jogadores');
  if (playerOrder.length !== 2 || new Set(playerOrder).size !== 2) {
    throw new TavernValidationError('A renderização remota exige exatamente dois jogadores');
  }
  const players = requiredObject(source.players, 'Jogadores da partida');
  for (const playerId of playerOrder) requiredObject(players[playerId], 'Jogador da partida');
  return { source, playerOrder, players };
}

function publicPlayerView(player, playerId, slot, playerNames, fallbackName) {
  const hero = requiredObject(player.hero, 'Herói do jogador');
  const mana = requiredObject(player.mana, 'Mana do jogador');
  const classId = requiredCompactId(player.classId, 'Classe do jogador');
  const hand = requiredArray(player.hand, 'Mão do jogador');
  const deck = requiredArray(player.deck, 'Deck do jogador');
  const board = requiredArray(player.board, 'Campo do jogador');
  const currentMana = finiteNumber(mana.current, 'Mana atual', { max: 100 });
  const maxMana = finiteNumber(mana.max, 'Mana máxima', { max: 100 });
  if (hand.length > 10 || deck.length > 100 || board.length > 7) {
    throw new TavernValidationError('Limite de cartas inválido para renderização remota');
  }
  if (currentMana > maxMana) {
    throw new TavernValidationError('Mana inválida para renderização remota');
  }
  return {
    slot,
    displayName: visibleName(playerId, playerNames?.[playerId], fallbackName),
    classId,
    hero: {
      hp: finiteNumber(hero.hp, 'Vida do herói'),
      armor: finiteNumber(hero.armor, 'Armadura do herói')
    },
    mana: {
      current: currentMana,
      max: maxMana
    },
    handCount: hand.length,
    deckCount: deck.length,
    board: board.map(card => boardCardView(card, classId))
  };
}

function buildTavernBoardRenderView(state, playerNames = {}) {
  const { source, playerOrder, players } = validateBaseState(state);
  const turn = requiredObject(source.turn, 'Turno da partida');
  const [bottomId, topId] = playerOrder;
  const activeSlot = turn.activePlayerId === bottomId
    ? 'bottom'
    : turn.activePlayerId === topId
      ? 'top'
      : null;
  if (!activeSlot) throw new TavernValidationError('Jogador ativo inválido para renderização remota');

  const status = requiredString(source.status, 'Status da partida', 16);
  const phase = requiredString(source.phase, 'Fase da partida', 16);
  if (!VALID_STATUS.has(status) || !VALID_PHASE.has(phase)) {
    throw new TavernValidationError('Status ou fase inválidos para renderização remota');
  }
  if (turn.deadlineAt !== null && turn.deadlineAt !== undefined) {
    requiredString(turn.deadlineAt, 'Prazo do turno', 64);
    if (!Number.isFinite(Date.parse(turn.deadlineAt))) {
      throw new TavernValidationError('Prazo do turno inválido para renderização remota');
    }
  }

  return {
    schemaVersion: TAVERN_RENDER_VIEW_SCHEMA_VERSION,
    kind: 'board',
    status,
    phase,
    turn: {
      number: finiteNumber(turn.number, 'Número do turno', { min: 1 }),
      activeSlot,
      deadlineAt: typeof turn.deadlineAt === 'string' ? turn.deadlineAt : null
    },
    terrain: source.terrain?.card
      ? { name: requiredString(source.terrain.card.name, 'Nome do terreno', 120) }
      : null,
    players: [
      publicPlayerView(players[bottomId], bottomId, 'bottom', playerNames, 'Jogador 1'),
      publicPlayerView(players[topId], topId, 'top', playerNames, 'Jogador 2')
    ]
  };
}

function buildTavernHandRenderView(state, playerId) {
  const { source, playerOrder, players } = validateBaseState(state);
  if (!playerOrder.includes(playerId)) {
    throw new TavernValidationError('Jogador não participa da mão solicitada');
  }
  const player = players[playerId];
  const mana = requiredObject(player.mana, 'Mana do jogador');
  const classId = requiredCompactId(player.classId, 'Classe do jogador');
  const status = requiredString(source.status, 'Status da partida', 16);
  const phase = requiredString(source.phase, 'Fase da partida', 16);
  if (!VALID_STATUS.has(status) || !VALID_PHASE.has(phase)) {
    throw new TavernValidationError('Status ou fase inválidos para renderização remota');
  }
  const hand = requiredArray(player.hand, 'Mão do jogador');
  const board = requiredArray(player.board, 'Campo do jogador');
  const currentMana = finiteNumber(mana.current, 'Mana atual', { max: 100 });
  const maxMana = finiteNumber(mana.max, 'Mana máxima', { max: 100 });
  if (hand.length > 10 || board.length > 7) {
    throw new TavernValidationError('Limite de cartas inválido para renderização remota');
  }
  if (currentMana > maxMana) {
    throw new TavernValidationError('Mana inválida para renderização remota');
  }

  return {
    schemaVersion: TAVERN_RENDER_VIEW_SCHEMA_VERSION,
    kind: 'hand',
    status,
    phase,
    isActive: status === 'ACTIVE'
      && phase === 'MAIN'
      && source.turn?.activePlayerId === playerId,
    viewer: {
      classId,
      mana: {
        current: currentMana,
        max: maxMana
      },
      nextSpellDiscount: finiteNumber(player.nextSpellDiscount ?? 0, 'Desconto de feitiço', { max: 100 }),
      boardCount: board.length
    },
    cards: hand.map(card => handCardView(card, classId))
  };
}

function buildTavernSceneRenderView(sceneKind, payload = {}) {
  const source = requiredObject(payload, 'Cena da Tavern');
  let sanitized;
  switch (sceneKind) {
    case 'invite':
      sanitized = {
        challengerName: safePersonName(source.challengerName, 'DESAFIANTE'),
        challengedName: safePersonName(source.challengedName, 'OPONENTE'),
        challengerClassId: requiredCompactId(source.challengerClassId || 'GUARDIAN', 'Classe do desafiante'),
        challengedClassId: requiredCompactId(source.challengedClassId || 'EXILE', 'Classe do oponente'),
        modeLabel: safeDisplayText(source.modeLabel, 'NORMAL', 40),
        expiresLabel: safeDisplayText(source.expiresLabel, '5 MIN', 40)
      };
      break;
    case 'mulligan':
      sanitized = {
        playerName: safePersonName(source.playerName, 'AVENTUREIRO'),
        classId: requiredCompactId(source.classId || 'GUARDIAN', 'Classe do jogador'),
        handSize: finiteNumber(source.handSize ?? 4, 'Tamanho da mão', { max: 10 })
      };
      break;
    case 'turn':
      sanitized = {
        playerName: safePersonName(source.playerName, 'AVENTUREIRO'),
        classId: requiredCompactId(source.classId || 'GUARDIAN', 'Classe do jogador'),
        turnNumber: finiteNumber(source.turnNumber ?? 1, 'Número do turno', { min: 1 }),
        deadlineLabel: source.deadlineLabel == null
          ? null
          : safeDisplayText(source.deadlineLabel, '', 40) || null
      };
      break;
    case 'victory':
      sanitized = {
        winnerName: safePersonName(source.winnerName, 'VENCEDOR'),
        classId: requiredCompactId(source.classId || 'GUARDIAN', 'Classe do vencedor'),
        reasonLabel: safeDisplayText(source.reasonLabel, 'VITÓRIA', 64),
        progressionLabel: source.progressionLabel == null
          ? null
          : safeDisplayText(source.progressionLabel, '', 120) || null
      };
      break;
    default:
      throw new TavernValidationError('Tipo de cena inválido para renderização remota');
  }

  return {
    schemaVersion: TAVERN_RENDER_VIEW_SCHEMA_VERSION,
    kind: 'scene',
    sceneKind,
    payload: sanitized
  };
}

export {
  TAVERN_RENDER_VIEW_SCHEMA_VERSION,
  buildTavernBoardRenderView,
  buildTavernHandRenderView,
  buildTavernSceneRenderView
};
