import crypto from 'node:crypto';

import {
  TavernConflictError,
  TavernNotFoundError,
  TavernRuleError,
  TavernValidationError
} from './errors.js';
import { createStarterDeck } from './domain/starterDeck.js';
import { TAVERN_BOT_DISPLAY_NAME, TAVERN_BOT_PLAYER_ID, pickRandomIntroClass } from './domain/TavernBotPlayer.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CLASS_ID = 'GUARDIAN';
const MAX_CONCURRENT_BOT_MATCHES_PER_GROUP = 3;
const TURN_MODE_ALIASES = Object.freeze({
  BLITZ: 'BLITZ',
  RAPIDO: 'BLITZ',
  RÁPIDO: 'BLITZ',
  NORMAL: 'NORMAL',
  ASYNC: 'ASYNC',
  ASSINCRONO: 'ASYNC',
  ASSÍNCRONO: 'ASYNC',
  CORRESPONDENCE: 'CORRESPONDENCE',
  CORRESPONDENCIA: 'CORRESPONDENCE',
  CORRESPONDÊNCIA: 'CORRESPONDENCE'
});

function normalizeTurnMode(value, fallback = 'NORMAL') {
  const normalized = String(value || fallback).trim().toUpperCase();
  const mode = TURN_MODE_ALIASES[normalized];
  if (!mode) {
    throw new TavernValidationError('Modo inválido. Use blitz, normal, assincrono ou correspondencia.');
  }
  return mode;
}

class TavernGameService {
  constructor({
    tavern,
    now = () => Date.now(),
    idFactory = () => crypto.randomUUID(),
    challengeTtlMs = CHALLENGE_TTL_MS
  }) {
    if (!tavern) throw new TavernValidationError('Serviço Tavern é obrigatório');
    this.tavern = tavern;
    this.now = now;
    this.idFactory = idFactory;
    this.challengeTtlMs = challengeTtlMs;
    this.operationLocks = new Map();
  }

  withLock(key, operation) {
    const previous = this.operationLocks.get(key) || Promise.resolve();
    const run = previous.then(operation, operation);
    const tracked = run.finally(() => {
      if (this.operationLocks.get(key) === tracked) this.operationLocks.delete(key);
    });
    this.operationLocks.set(key, tracked);
    return tracked;
  }

  async getGroup(groupId) {
    return this.tavern.repository.getGroup(groupId);
  }

  async setGroupEnabled(groupId, enabled) {
    return this.tavern.repository.setGroupEnabled(groupId, enabled);
  }

  async setTurnMode(groupId, mode) {
    const normalizedMode = normalizeTurnMode(mode);
    return this.tavern.repository.updateGroupSettings(groupId, { turnMode: normalizedMode });
  }

  async assertGroupEnabled(groupId) {
    const group = await this.tavern.repository.getGroup(groupId);
    if (!group?.enabled) {
      throw new TavernRuleError('A Gyomei Tavern não está ativa neste grupo. Um admin precisa ativá-la com tavern on.');
    }
    return group;
  }

  async createChallenge({
    groupId,
    challengerId,
    challengedId,
    challengerName = null,
    challengedName = null,
    mode = null
  }) {
    const group = await this.assertGroupEnabled(groupId);
    const turnMode = normalizeTurnMode(mode, group.settings?.turnMode || this.tavern.config.defaults.turnMode);
    const challengeId = this.idFactory();
    const expiresAt = new Date(this.now() + this.challengeTtlMs).toISOString();
    return this.withLock(`group:${groupId}`, () => this.tavern.repository.createChallenge({
      challengeId,
      groupId,
      challengerId,
      challengedId,
      challengerName,
      challengedName,
      mode: turnMode,
      expiresAt
    }));
  }

  async getPendingChallenge(groupId, challengedId) {
    return this.tavern.repository.findOpenChallengeForPlayer(groupId, challengedId);
  }

  async declineChallenge(groupId, challengedId, messageId = null) {
    return this.withLock(`group:${groupId}`, async () => {
      if (messageId) {
        const previous = await this.tavern.repository.getChallengeByResponseMessageId(
          groupId,
          challengedId,
          messageId
        );
        if (previous?.status === 'DECLINED') return { ...previous, duplicate: true };
      }
      const challenge = await this.getPendingChallenge(groupId, challengedId);
      if (!challenge) throw new TavernNotFoundError('Você não possui desafio pendente neste grupo');
      return this.tavern.repository.declineChallenge(challenge.challengeId, challengedId, messageId);
    });
  }

  async acceptChallenge(groupId, challengedId, messageId = null) {
    await this.assertGroupEnabled(groupId);
    return this.withLock(`group:${groupId}`, async () => {
      if (messageId) {
        const previous = await this.tavern.repository.getChallengeByResponseMessageId(
          groupId,
          challengedId,
          messageId
        );
        if (previous?.status === 'ACCEPTED' && previous.matchId) {
          const match = await this.tavern.repository.getMatch(previous.matchId);
          if (match) return { challenge: previous, match: match.state, duplicate: true };
        }
      }
      const challenge = await this.getPendingChallenge(groupId, challengedId);
      if (!challenge) throw new TavernNotFoundError('Você não possui desafio pendente neste grupo');

      const [challenger, challenged] = await Promise.all([
        this.tavern.repository.getPlayer(challenge.challengerId),
        this.tavern.repository.getPlayer(challenge.challengedId)
      ]);
      const challengerClass = challenger?.activeClassId || DEFAULT_CLASS_ID;
      const challengedClass = challenged?.activeClassId || DEFAULT_CLASS_ID;
      this.tavern.heroRegistry.get(challengerClass);
      this.tavern.heroRegistry.get(challengedClass);

      const state = this.tavern.engine.createMatch({
        groupId,
        mode: challenge.mode,
        players: [
          { id: challenge.challengerId, classId: challengerClass, deck: createStarterDeck(challengerClass) },
          { id: challenge.challengedId, classId: challengedClass, deck: createStarterDeck(challengedClass) }
        ]
      });
      return this.tavern.repository.acceptChallengeWithMatch(
        challenge.challengeId,
        challengedId,
        state,
        messageId
      );
    });
  }

  /**
   * Cria uma partida direto contra o oponente PvE, sem passar pelo par
   * desafio/aceite (que existe pra dois humanos confirmarem — não faz
   * sentido pedir a um bot pra "aceitar"). Humano sempre começa (evita a
   * confusão de "o bot já jogou antes de eu fazer algo"); classe do bot é
   * sorteada a cada partida. Limite de partidas simultâneas contra o bot
   * por grupo evita que uma pessoa (ou várias) prendam a fila de
   * renderização com treino solo.
   */
  async createBotMatch({ groupId, playerId }) {
    const group = await this.assertGroupEnabled(groupId);
    return this.withLock(`group:${groupId}`, async () => {
      const existingMatch = await this.tavern.repository.findActiveMatchForPlayer(groupId, playerId);
      if (existingMatch) throw new TavernConflictError('Você já está em uma partida ativa neste grupo.');

      const activeMatches = await this.tavern.repository.listActiveMatches(groupId);
      const botMatches = activeMatches.filter(match => match.state.playerOrder.includes(TAVERN_BOT_PLAYER_ID));
      if (botMatches.length >= MAX_CONCURRENT_BOT_MATCHES_PER_GROUP) {
        throw new TavernRuleError(
          `Já existem ${MAX_CONCURRENT_BOT_MATCHES_PER_GROUP} partidas contra o bot em andamento neste grupo. Aguarde uma terminar.`
        );
      }

      const human = await this.tavern.repository.getPlayer(playerId);
      const humanClass = human?.activeClassId || DEFAULT_CLASS_ID;
      const botClass = pickRandomIntroClass();
      this.tavern.heroRegistry.get(humanClass);
      this.tavern.heroRegistry.get(botClass);

      const state = this.tavern.engine.createMatch({
        groupId,
        mode: group.settings?.turnMode || this.tavern.config.defaults.turnMode,
        startingPlayerId: playerId,
        players: [
          { id: playerId, classId: humanClass, deck: createStarterDeck(humanClass) },
          { id: TAVERN_BOT_PLAYER_ID, classId: botClass, deck: createStarterDeck(botClass) }
        ]
      });
      await this.tavern.repository.ensurePlayer(TAVERN_BOT_PLAYER_ID, TAVERN_BOT_DISPLAY_NAME);
      return this.tavern.repository.createMatch(state);
    });
  }

  async getActiveMatch(groupId, playerId) {
    const match = await this.tavern.repository.findActiveMatchForPlayer(groupId, playerId);
    if (!match) throw new TavernNotFoundError('Você não participa de uma partida ativa neste grupo');
    return match;
  }

  async dispatchForPlayer(groupId, playerId, action, { messageId = null } = {}) {
    const match = await this.getActiveMatch(groupId, playerId);
    if (!match.state.players[playerId]) {
      throw new TavernConflictError('O identificador do jogador não corresponde à partida');
    }
    return this.tavern.matches.dispatch(
      match.matchId,
      { ...action, actorId: playerId },
      { messageId }
    );
  }

  async getPlayerNames(state) {
    const entries = await Promise.all(state.playerOrder.map(async playerId => {
      const player = await this.tavern.repository.getPlayer(playerId);
      return [playerId, player?.displayName || playerId.split('@')[0]];
    }));
    return Object.fromEntries(entries);
  }

  async processExpiredMatches() {
    return this.tavern.matches.processExpiredMatches(this.now());
  }
}

export {
  CHALLENGE_TTL_MS,
  DEFAULT_CLASS_ID,
  TURN_MODE_ALIASES,
  TavernGameService,
  normalizeTurnMode
};
