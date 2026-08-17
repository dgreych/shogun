import { randomUUID } from 'node:crypto';

import {
  NexoConflictError,
  NexoNotFoundError,
  NexoValidationError
} from '../errors.js';

function stringify(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function parse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 191) {
    throw new NexoValidationError(`${label} inválido`);
  }
  return value.trim();
}

function requireEnumLocal(value, label, allowed) {
  if (!allowed.includes(value)) {
    throw new NexoValidationError(`${label} precisa ser um de: ${allowed.join(', ')}`);
  }
  return value;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    locale: row.locale,
    createdAt: row.created_at
  };
}

function mapGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    transportChatId: row.transport_chat_id,
    name: row.name,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSeason(row) {
  if (!row) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    templateId: row.template_id,
    seed: row.seed,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at
  };
}

function mapWorldState(row) {
  if (!row) return null;
  return {
    seasonId: row.season_id,
    pulse: Number(row.pulse),
    cohesion: Number(row.cohesion),
    lucidity: Number(row.lucidity),
    entropy: Number(row.entropy),
    version: Number(row.version),
    updatedAt: row.updated_at
  };
}

function mapPlayer(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    status: row.status,
    renown: Number(row.renown),
    privateOptIn: Boolean(row.private_opt_in),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCharacter(row) {
  if (!row) return null;
  return {
    id: row.id,
    playerId: row.player_id,
    name: row.name,
    tier: Number(row.tier),
    memory: Number(row.memory),
    impulse: row.impulse,
    scar: row.scar,
    origin: row.origin,
    oath: row.oath,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEncounter(row) {
  if (!row) return null;
  return {
    id: row.id,
    seasonId: row.season_id,
    groupId: row.group_id,
    type: row.type,
    questId: row.quest_id,
    state: row.state,
    round: Number(row.round),
    seed: row.seed,
    deadlineAt: row.deadline_at,
    stateData: parse(row.state_json, {}),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapActionSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    encounterId: row.encounter_id,
    round: Number(row.round),
    playerId: row.player_id,
    payload: parse(row.payload_json, {}),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPendingInteraction(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    type: row.type,
    state: parse(row.state_json, {}),
    quotedMessageId: row.quoted_message_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

function mapOutboxEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: parse(row.payload_json, {}),
    dedupeKey: row.dedupe_key,
    status: row.status,
    createdAt: row.created_at,
    sentAt: row.sent_at
  };
}

// ---- Helpers de nível de sessão -------------------------------------------
//
// Cada função abaixo opera diretamente numa `session` já aberta por outra
// transação, em vez de abrir a própria. Existem pra permitir compor a
// checagem de idempotência (processed_messages/game_events) com a mutação
// de estado real NA MESMA TRANSAÇÃO -- achado real de revisão (GPT-NEXO-004,
// quebra de atomicidade quando idempotência e mutação eram transações
// separadas: uma queda entre as duas deixava o evento marcado como
// processado sem a mutação ter acontecido, e o retry via idempotência
// nunca mais tentava de novo). Os métodos públicos que abrem sua própria
// transação (ex.: activateSeason) continuam existindo e chamam os mesmos
// helpers -- não duplicam lógica.

async function recordIdempotentEventInSession(session, {
  messageId,
  aggregateType,
  aggregateId,
  eventType,
  payload = {},
  outboxPayload = null,
  outboxDedupeKey = null,
  now
}) {
  const already = await session.get(
    'SELECT result_ref FROM nexo_processed_messages WHERE message_id = ?',
    [messageId]
  );
  if (already) {
    return { duplicate: true, resultRef: already.result_ref };
  }

  session.run(
    'INSERT INTO nexo_processed_messages (message_id, result_ref, processed_at) VALUES (?, ?, ?)',
    [messageId, eventType, now]
  );
  session.run(
    `INSERT INTO nexo_game_events
       (aggregate_type, aggregate_id, event_type, payload_json, message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [aggregateType, aggregateId, eventType, stringify(payload), messageId, now]
  );
  if (outboxPayload) {
    const dedupeKey = outboxDedupeKey || `${messageId}:${eventType}`;
    session.run(
      `INSERT INTO nexo_outbox (aggregate_type, aggregate_id, payload_json, dedupe_key, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [aggregateType, aggregateId, stringify(outboxPayload), dedupeKey, now]
    );
  }
  return { duplicate: false, resultRef: eventType };
}

async function activateSeasonInSession(session, seasonId, now) {
  const season = mapSeason(await session.get('SELECT * FROM nexo_seasons WHERE id = ?', [seasonId]));
  if (!season) throw new NexoNotFoundError('Temporada não encontrada', { seasonId });
  if (season.status !== 'DRAFT') {
    throw new NexoConflictError('Temporada não está em rascunho', { seasonId, status: season.status });
  }
  session.run(
    "UPDATE nexo_seasons SET status = 'ACTIVE', starts_at = ? WHERE id = ?",
    [now, seasonId]
  );
  const worldStateExists = await session.get(
    'SELECT season_id FROM nexo_world_state WHERE season_id = ?',
    [seasonId]
  );
  if (!worldStateExists) {
    session.run(
      `INSERT INTO nexo_world_state (season_id, pulse, cohesion, lucidity, entropy, version, updated_at)
       VALUES (?, 0, 0, 0, 0, 0, ?)`,
      [seasonId, now]
    );
  }
  session.run(
    "UPDATE nexo_groups SET status = 'ACTIVE', updated_at = ? WHERE id = ?",
    [now, season.groupId]
  );
  return mapSeason(await session.get('SELECT * FROM nexo_seasons WHERE id = ?', [seasonId]));
}

async function setGroupStatusInSession(session, groupId, status, now) {
  requireEnumLocal(status, 'status de grupo', ['INACTIVE', 'ACTIVE', 'PAUSED']);
  session.run(
    'UPDATE nexo_groups SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, groupId]
  );
  return mapGroup(await session.get('SELECT * FROM nexo_groups WHERE id = ?', [groupId]));
}

async function createCharacterIfAbsentInSession(session, { playerId, name, impulse, scar, origin = null, now, idFactory }) {
  const existing = await session.get('SELECT * FROM nexo_characters WHERE player_id = ?', [playerId]);
  if (existing) return { created: false, character: mapCharacter(existing) };
  const id = idFactory();
  session.run(
    `INSERT INTO nexo_characters
       (id, player_id, name, tier, memory, impulse, scar, origin, oath, version, created_at, updated_at)
     VALUES (?, ?, ?, 1, 0, ?, ?, ?, NULL, 0, ?, ?)`,
    [id, playerId, name, impulse, scar, origin, now, now]
  );
  return { created: true, character: mapCharacter(await session.get('SELECT * FROM nexo_characters WHERE id = ?', [id])) };
}

function deletePendingInteractionInSession(session, id) {
  session.run('DELETE FROM nexo_pending_interactions WHERE id = ?', [id]);
}

/**
 * Repositório de persistência do NEXO (fundação do alfa). Identidade nunca
 * usa telefone como PK -- users.id é um UUID interno, e aliases (LID/PN/
 * username) apontam para ele em nexo_user_address_aliases.
 */
class NexoRepository {
  constructor(store, { now = () => new Date().toISOString(), idFactory = randomUUID } = {}) {
    this.store = store;
    this.now = now;
    this.idFactory = idFactory;
  }

  // ---- Identidade ----------------------------------------------------

  async resolveUserIdByAlias(type, value) {
    assertNonEmptyString(type, 'Tipo de alias');
    assertNonEmptyString(value, 'Valor de alias');
    return this.store.read(async session => {
      const row = await session.get(
        'SELECT user_id FROM nexo_user_address_aliases WHERE type = ? AND value = ?',
        [type, value]
      );
      return row?.user_id || null;
    });
  }

  async createUser({ displayName = null, locale = 'pt-BR' } = {}) {
    const id = this.idFactory();
    const timestamp = this.now();
    await this.store.transaction(async session => {
      session.run(
        'INSERT INTO nexo_users (id, display_name, locale, created_at) VALUES (?, ?, ?, ?)',
        [id, displayName, locale, timestamp]
      );
    });
    return this.getUserById(id);
  }

  async getUserById(userId) {
    assertNonEmptyString(userId, 'ID de usuário');
    return this.store.read(async session => mapUser(
      await session.get('SELECT * FROM nexo_users WHERE id = ?', [userId])
    ));
  }

  async addAddressAlias(userId, type, value) {
    assertNonEmptyString(userId, 'ID de usuário');
    assertNonEmptyString(type, 'Tipo de alias');
    assertNonEmptyString(value, 'Valor de alias');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT user_id FROM nexo_user_address_aliases WHERE type = ? AND value = ?',
        [type, value]
      );
      if (existing) {
        if (existing.user_id !== userId) {
          throw new NexoConflictError('Alias já pertence a outro usuário', { type, value });
        }
        session.run(
          'UPDATE nexo_user_address_aliases SET last_seen = ? WHERE type = ? AND value = ?',
          [timestamp, type, value]
        );
        return { created: false };
      }
      session.run(
        `INSERT INTO nexo_user_address_aliases (user_id, type, value, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, value, timestamp, timestamp]
      );
      return { created: true };
    });
  }

  /**
   * Ponto único de resolução de identidade canônica. Nunca cria um segundo
   * usuário para um alias já conhecido; nunca usa telefone como chave.
   */
  async resolveOrCreateUserByAliases(aliases, { displayName = null, locale = 'pt-BR' } = {}) {
    if (!Array.isArray(aliases) || !aliases.length) {
      throw new NexoValidationError('É preciso ao menos um alias para resolver identidade');
    }
    for (const alias of aliases) {
      const existingUserId = await this.resolveUserIdByAlias(alias.type, alias.value);
      if (existingUserId) {
        for (const other of aliases) {
          await this.addAddressAlias(existingUserId, other.type, other.value);
        }
        return this.getUserById(existingUserId);
      }
    }
    const user = await this.createUser({ displayName, locale });
    for (const alias of aliases) {
      await this.addAddressAlias(user.id, alias.type, alias.value);
    }
    return user;
  }

  // ---- Grupos ----------------------------------------------------------

  async upsertGroup({ transportChatId, name = null, timezone = 'America/Sao_Paulo' }) {
    assertNonEmptyString(transportChatId, 'ID de chat do transporte');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT * FROM nexo_groups WHERE transport_chat_id = ?',
        [transportChatId]
      );
      if (existing) {
        session.run(
          'UPDATE nexo_groups SET name = COALESCE(?, name), updated_at = ? WHERE id = ?',
          [name, timestamp, existing.id]
        );
        return mapGroup(await session.get('SELECT * FROM nexo_groups WHERE id = ?', [existing.id]));
      }
      const id = this.idFactory();
      session.run(
        `INSERT INTO nexo_groups (id, transport_chat_id, name, timezone, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'INACTIVE', ?, ?)`,
        [id, transportChatId, name, timezone, timestamp, timestamp]
      );
      return mapGroup(await session.get('SELECT * FROM nexo_groups WHERE id = ?', [id]));
    });
  }

  async getGroupByTransportChatId(transportChatId) {
    assertNonEmptyString(transportChatId, 'ID de chat do transporte');
    return this.store.read(async session => mapGroup(
      await session.get('SELECT * FROM nexo_groups WHERE transport_chat_id = ?', [transportChatId])
    ));
  }

  async getGroupById(groupId) {
    assertNonEmptyString(groupId, 'ID de grupo');
    return this.store.read(async session => mapGroup(
      await session.get('SELECT * FROM nexo_groups WHERE id = ?', [groupId])
    ));
  }

  async setGroupStatus(groupId, status) {
    assertNonEmptyString(groupId, 'ID de grupo');
    return this.store.transaction(session => setGroupStatusInSession(session, groupId, status, this.now()));
  }

  /**
   * Versão atômica de desativação -- mesma correção de GPT-NEXO-004
   * aplicada a `!nexo desativar`.
   */
  async deactivateGroupAtomic({ messageId, groupId, aggregateId, payload = {} }) {
    assertNonEmptyString(messageId, 'ID de mensagem');
    assertNonEmptyString(groupId, 'ID de grupo');
    assertNonEmptyString(aggregateId, 'ID de agregado');
    const now = this.now();
    return this.store.transaction(async session => {
      const idempotency = await recordIdempotentEventInSession(session, {
        messageId,
        aggregateType: 'GROUP',
        aggregateId,
        eventType: 'GroupDeactivated',
        payload,
        now
      });
      if (idempotency.duplicate) return { duplicate: true };
      const group = await setGroupStatusInSession(session, groupId, 'PAUSED', now);
      return { duplicate: false, group };
    });
  }

  // ---- Temporadas (fundação de ativação, CL-NEXO-002) --------------------

  async createDraftSeason({ groupId, templateId = null, seed }) {
    assertNonEmptyString(groupId, 'ID de grupo');
    assertNonEmptyString(seed, 'Seed da temporada');
    const id = this.idFactory();
    const timestamp = this.now();
    await this.store.transaction(async session => {
      session.run(
        `INSERT INTO nexo_seasons (id, group_id, template_id, seed, status, created_at)
         VALUES (?, ?, ?, ?, 'DRAFT', ?)`,
        [id, groupId, templateId, seed, timestamp]
      );
    });
    return this.getSeasonById(id);
  }

  async getSeasonById(seasonId) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    return this.store.read(async session => mapSeason(
      await session.get('SELECT * FROM nexo_seasons WHERE id = ?', [seasonId])
    ));
  }

  async getActiveSeasonForGroup(groupId) {
    assertNonEmptyString(groupId, 'ID de grupo');
    return this.store.read(async session => mapSeason(
      await session.get(
        "SELECT * FROM nexo_seasons WHERE group_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1",
        [groupId]
      )
    ));
  }

  /**
   * Confirma a ativação: temporada DRAFT -> ACTIVE, cria o world_state
   * inicial e marca o grupo como ACTIVE. Tudo na mesma transação.
   */
  async activateSeason(seasonId) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    return this.store.transaction(session => activateSeasonInSession(session, seasonId, this.now()));
  }

  /**
   * Versão atômica: idempotência (processed_messages/game_events) e a
   * ativação de verdade na MESMA transação -- corrige achado de revisão
   * (GPT-NEXO-004): antes, uma queda entre marcar o evento como
   * processado e ativar a temporada deixava o sistema preso (retry
   * tratado como duplicado, mutação nunca aplicada).
   */
  async confirmGroupActivationAtomic({ messageId, seasonId, aggregateId, payload = {} }) {
    assertNonEmptyString(messageId, 'ID de mensagem');
    assertNonEmptyString(seasonId, 'ID de temporada');
    assertNonEmptyString(aggregateId, 'ID de agregado');
    const now = this.now();
    return this.store.transaction(async session => {
      const idempotency = await recordIdempotentEventInSession(session, {
        messageId,
        aggregateType: 'GROUP',
        aggregateId,
        eventType: 'GroupActivated',
        payload,
        now
      });
      if (idempotency.duplicate) return { duplicate: true };
      const season = await activateSeasonInSession(session, seasonId, now);
      return { duplicate: false, season };
    });
  }

  // ---- Estado do mundo (concorrência otimista) --------------------------

  async getWorldStateBySeasonId(seasonId) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    return this.store.read(async session => mapWorldState(
      await session.get('SELECT * FROM nexo_world_state WHERE season_id = ?', [seasonId])
    ));
  }

  async ensureWorldState(seasonId) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT * FROM nexo_world_state WHERE season_id = ?',
        [seasonId]
      );
      if (existing) return mapWorldState(existing);
      session.run(
        `INSERT INTO nexo_world_state (season_id, pulse, cohesion, lucidity, entropy, version, updated_at)
         VALUES (?, 0, 0, 0, 0, 0, ?)`,
        [seasonId, timestamp]
      );
      return mapWorldState(await session.get('SELECT * FROM nexo_world_state WHERE season_id = ?', [seasonId]));
    });
  }

  /**
   * Atualização otimista: falha com NexoConflictError se `expectedVersion`
   * não bater com a versão atual em banco (outra ação já avançou o estado).
   */
  async applyWorldMeterDelta(seasonId, expectedVersion, delta) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const current = mapWorldState(await session.get(
        'SELECT * FROM nexo_world_state WHERE season_id = ?',
        [seasonId]
      ));
      if (!current) throw new NexoNotFoundError('Estado do mundo não encontrado', { seasonId });
      if (current.version !== expectedVersion) {
        throw new NexoConflictError('O estado do mundo foi alterado por outra ação', {
          seasonId,
          expectedVersion,
          actualVersion: current.version
        });
      }
      const clamp = value => Math.max(0, Math.min(100, value));
      const next = {
        pulse: clamp(current.pulse + (delta.pulse || 0)),
        cohesion: clamp(current.cohesion + (delta.cohesion || 0)),
        lucidity: clamp(current.lucidity + (delta.lucidity || 0)),
        entropy: clamp(current.entropy + (delta.entropy || 0))
      };
      const nextVersion = expectedVersion + 1;
      const update = session.run(
        `UPDATE nexo_world_state SET
           pulse = ?, cohesion = ?, lucidity = ?, entropy = ?, version = ?, updated_at = ?
         WHERE season_id = ? AND version = ?`,
        [next.pulse, next.cohesion, next.lucidity, next.entropy, nextVersion, timestamp, seasonId, expectedVersion]
      );
      if (update.changes === 0) {
        throw new NexoConflictError('O estado do mundo foi alterado por outra ação', { seasonId });
      }
      return mapWorldState(await session.get('SELECT * FROM nexo_world_state WHERE season_id = ?', [seasonId]));
    });
  }

  // ---- Jogadores e personagens (fundação de onboarding, CL-NEXO-003) -----

  async getOrCreatePlayer({ userId, groupId }) {
    assertNonEmptyString(userId, 'ID de usuário');
    assertNonEmptyString(groupId, 'ID de grupo');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT * FROM nexo_players WHERE user_id = ? AND group_id = ?',
        [userId, groupId]
      );
      if (existing) return mapPlayer(existing);
      const id = this.idFactory();
      session.run(
        `INSERT INTO nexo_players (id, user_id, group_id, status, renown, private_opt_in, created_at, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', 0, 0, ?, ?)`,
        [id, userId, groupId, timestamp, timestamp]
      );
      return mapPlayer(await session.get('SELECT * FROM nexo_players WHERE id = ?', [id]));
    });
  }

  async getPlayerByUserAndGroup(userId, groupId) {
    assertNonEmptyString(userId, 'ID de usuário');
    assertNonEmptyString(groupId, 'ID de grupo');
    return this.store.read(async session => mapPlayer(
      await session.get('SELECT * FROM nexo_players WHERE user_id = ? AND group_id = ?', [userId, groupId])
    ));
  }

  async getPlayerById(playerId) {
    assertNonEmptyString(playerId, 'ID de jogador');
    return this.store.read(async session => mapPlayer(
      await session.get('SELECT * FROM nexo_players WHERE id = ?', [playerId])
    ));
  }

  async setPlayerPrivateOptIn(playerId, enabled) {
    assertNonEmptyString(playerId, 'ID de jogador');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      session.run(
        'UPDATE nexo_players SET private_opt_in = ?, updated_at = ? WHERE id = ?',
        [enabled ? 1 : 0, timestamp, playerId]
      );
      return mapPlayer(await session.get('SELECT * FROM nexo_players WHERE id = ?', [playerId]));
    });
  }

  async createCharacterIfAbsent({ playerId, name = null, impulse, scar, origin = null }) {
    assertNonEmptyString(playerId, 'ID de jogador');
    assertNonEmptyString(impulse, 'Impulso');
    assertNonEmptyString(scar, 'Cicatriz');
    const now = this.now();
    return this.store.transaction(session => createCharacterIfAbsentInSession(
      session,
      { playerId, name, impulse, scar, origin, now, idFactory: this.idFactory }
    ));
  }

  /**
   * Versão atômica: idempotência + criação do personagem + remoção da
   * interação pendente na MESMA transação -- mesma correção de
   * GPT-NEXO-004 aplicada ao fechamento do onboarding.
   */
  async completeOnboardingAtomic({
    messageId,
    playerId,
    name = null,
    impulse,
    scar,
    origin = null,
    pendingInteractionId,
    aggregateId,
    payload = {}
  }) {
    assertNonEmptyString(messageId, 'ID de mensagem');
    assertNonEmptyString(playerId, 'ID de jogador');
    assertNonEmptyString(impulse, 'Impulso');
    assertNonEmptyString(scar, 'Cicatriz');
    assertNonEmptyString(pendingInteractionId, 'ID de interação pendente');
    assertNonEmptyString(aggregateId, 'ID de agregado');
    const now = this.now();
    return this.store.transaction(async session => {
      const idempotency = await recordIdempotentEventInSession(session, {
        messageId,
        aggregateType: 'PLAYER',
        aggregateId,
        eventType: 'PlayerJoined',
        payload,
        now
      });
      if (idempotency.duplicate) return { duplicate: true };
      const { character } = await createCharacterIfAbsentInSession(
        session,
        { playerId, name, impulse, scar, origin, now, idFactory: this.idFactory }
      );
      deletePendingInteractionInSession(session, pendingInteractionId);
      return { duplicate: false, character };
    });
  }

  async getCharacterByPlayerId(playerId) {
    assertNonEmptyString(playerId, 'ID de jogador');
    return this.store.read(async session => mapCharacter(
      await session.get('SELECT * FROM nexo_characters WHERE player_id = ?', [playerId])
    ));
  }

  // ---- Encontros (CL-NEXO-004) --------------------------------------------

  async createEncounter({ seasonId, groupId, type, questId = null, seed }) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    assertNonEmptyString(groupId, 'ID de grupo');
    assertNonEmptyString(type, 'Tipo de encontro');
    assertNonEmptyString(seed, 'Seed do encontro');
    const id = this.idFactory();
    const timestamp = this.now();
    await this.store.transaction(async session => {
      session.run(
        `INSERT INTO nexo_encounters
           (id, season_id, group_id, type, quest_id, state, round, seed, state_json, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'CREATED', 0, ?, '{}', 0, ?, ?)`,
        [id, seasonId, groupId, type, questId, seed, timestamp, timestamp]
      );
    });
    return this.getEncounterById(id);
  }

  async getEncounterById(id) {
    assertNonEmptyString(id, 'ID de encontro');
    return this.store.read(async session => mapEncounter(
      await session.get('SELECT * FROM nexo_encounters WHERE id = ?', [id])
    ));
  }

  async getEncounterBySeasonAndType(seasonId, type) {
    assertNonEmptyString(seasonId, 'ID de temporada');
    assertNonEmptyString(type, 'Tipo de encontro');
    return this.store.read(async session => mapEncounter(
      await session.get(
        'SELECT * FROM nexo_encounters WHERE season_id = ? AND type = ? ORDER BY created_at ASC LIMIT 1',
        [seasonId, type]
      )
    ));
  }

  /**
   * Transição genérica e otimista de estado do encontro. O repositório
   * não conhece regra de combate -- só aplica o que o motor de domínio
   * decidiu, com concorrência otimista por versão (o mesmo padrão de
   * applyWorldMeterDelta).
   */
  async transitionEncounter(id, expectedVersion, { state, round, deadlineAt, stateDataPatch = {} }) {
    assertNonEmptyString(id, 'ID de encontro');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const current = mapEncounter(await session.get('SELECT * FROM nexo_encounters WHERE id = ?', [id]));
      if (!current) throw new NexoNotFoundError('Encontro não encontrado', { id });
      if (current.version !== expectedVersion) {
        throw new NexoConflictError('O encontro foi alterado por outra ação', {
          id,
          expectedVersion,
          actualVersion: current.version
        });
      }
      const nextVersion = expectedVersion + 1;
      const nextStateData = { ...current.stateData, ...stateDataPatch };
      const update = session.run(
        `UPDATE nexo_encounters SET
           state = ?, round = ?, deadline_at = ?, state_json = ?, version = ?, updated_at = ?
         WHERE id = ? AND version = ?`,
        [
          state ?? current.state,
          round ?? current.round,
          deadlineAt !== undefined ? deadlineAt : current.deadlineAt,
          stringify(nextStateData),
          nextVersion,
          timestamp,
          id,
          expectedVersion
        ]
      );
      if (update.changes === 0) {
        throw new NexoConflictError('O encontro foi alterado por outra ação', { id });
      }
      return mapEncounter(await session.get('SELECT * FROM nexo_encounters WHERE id = ?', [id]));
    });
  }

  /**
   * `!agir` -- upsert por (encounterId, round, playerId): reenviar
   * substitui a submissão anterior enquanto a rodada não travou (seção
   * 16 do PDF, nota de implementação de `!agir`: "update substitui versão
   * anterior").
   */
  async upsertActionSubmission({ encounterId, round, playerId, payload }) {
    assertNonEmptyString(encounterId, 'ID de encontro');
    assertNonEmptyString(playerId, 'ID de jogador');
    if (!Number.isInteger(round) || round < 1) {
      throw new NexoValidationError('Rodada de encontro inválida');
    }
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT * FROM nexo_action_submissions WHERE encounter_id = ? AND round = ? AND player_id = ?',
        [encounterId, round, playerId]
      );
      if (existing) {
        session.run(
          `UPDATE nexo_action_submissions
             SET payload_json = ?, version = ?, updated_at = ?
           WHERE id = ?`,
          [stringify(payload), existing.version + 1, timestamp, existing.id]
        );
        return mapActionSubmission(await session.get('SELECT * FROM nexo_action_submissions WHERE id = ?', [existing.id]));
      }
      const id = this.idFactory();
      session.run(
        `INSERT INTO nexo_action_submissions
           (id, encounter_id, round, player_id, payload_json, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, encounterId, round, playerId, stringify(payload), timestamp, timestamp]
      );
      return mapActionSubmission(await session.get('SELECT * FROM nexo_action_submissions WHERE id = ?', [id]));
    });
  }

  /**
   * Ordena por `id` (opaco, sem relação com o momento de chegada), não
   * por `created_at` -- achado de revisão (GPT-NEXO-004): resolução por
   * ordem de chegada contraria a seção 8.1 ("sem corrida por
   * velocidade... prioridade vem de categoria e técnica"). A prioridade
   * de verdade é decidida por quem chama (encounterEngine.resolveRound
   * aceita `priorityFor`); isto aqui só garante que o desempate nunca
   * seja por velocidade de mensagem.
   */
  async listActionSubmissions(encounterId, round) {
    assertNonEmptyString(encounterId, 'ID de encontro');
    return this.store.read(async session => (
      await session.all(
        'SELECT * FROM nexo_action_submissions WHERE encounter_id = ? AND round = ? ORDER BY id ASC',
        [encounterId, round]
      )
    ).map(mapActionSubmission));
  }

  // ---- Idempotência: processed_messages + game_events + outbox ----------

  /**
   * Backbone de idempotência do NEXO. Reprocessar o mesmo `messageId` nunca
   * duplica evento nem entrada de outbox -- a segunda chamada retorna
   * `{ duplicate: true }` sem mutar nada. Quando fornecido, `outboxPayload`
   * é gravado na MESMA transação do evento (padrão outbox).
   */
  async appendGameEventIfNew({
    messageId,
    aggregateType,
    aggregateId,
    eventType,
    payload = {},
    outboxPayload = null,
    outboxDedupeKey = null
  }) {
    assertNonEmptyString(messageId, 'ID de mensagem');
    assertNonEmptyString(aggregateType, 'Tipo de agregado');
    assertNonEmptyString(aggregateId, 'ID de agregado');
    assertNonEmptyString(eventType, 'Tipo de evento');
    return this.store.transaction(session => recordIdempotentEventInSession(session, {
      messageId,
      aggregateType,
      aggregateId,
      eventType,
      payload,
      outboxPayload,
      outboxDedupeKey,
      now: this.now()
    }));
  }

  /**
   * Grava um evento de auditoria sem checagem de idempotência por
   * messageId -- usado por rolagens de RNG (seção 17.6: "o valor
   * sorteado deve ser persistido no GameEvent"), que não são disparadas
   * por uma única mensagem recebida e já têm sua própria proteção contra
   * reprocessamento (ex.: concorrência otimista do encontro).
   */
  async recordGameEvent({ aggregateType, aggregateId, eventType, payload = {}, messageId = null }) {
    assertNonEmptyString(aggregateType, 'Tipo de agregado');
    assertNonEmptyString(aggregateId, 'ID de agregado');
    assertNonEmptyString(eventType, 'Tipo de evento');
    const now = this.now();
    return this.store.transaction(async session => {
      session.run(
        `INSERT INTO nexo_game_events
           (aggregate_type, aggregate_id, event_type, payload_json, message_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [aggregateType, aggregateId, eventType, stringify(payload), messageId, now]
      );
    });
  }

  async listPendingOutbox(limit = 50) {
    return this.store.read(async session => (
      await session.all(
        'SELECT * FROM nexo_outbox WHERE status = ? ORDER BY created_at ASC LIMIT ?',
        ['PENDING', limit]
      )
    ).map(mapOutboxEntry));
  }

  async markOutboxSent(id) {
    const timestamp = this.now();
    return this.store.transaction(async session => {
      session.run(
        "UPDATE nexo_outbox SET status = 'SENT', sent_at = ? WHERE id = ?",
        [timestamp, id]
      );
    });
  }

  // ---- Interações pendentes (base para onboarding em CL-NEXO-003) -------

  async createPendingInteraction({ userId, chatId, type, state = {}, quotedMessageId = null, ttlMs }) {
    assertNonEmptyString(userId, 'ID de usuário');
    assertNonEmptyString(chatId, 'ID de chat');
    assertNonEmptyString(type, 'Tipo de interação');
    if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
      throw new NexoValidationError('TTL da interação pendente precisa ser um inteiro positivo em ms');
    }
    const id = this.idFactory();
    const timestamp = this.now();
    const expiresAt = new Date(new Date(timestamp).getTime() + ttlMs).toISOString();
    await this.store.transaction(async session => {
      session.run(
        `INSERT INTO nexo_pending_interactions
           (id, user_id, chat_id, type, state_json, quoted_message_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, chatId, type, stringify(state), quotedMessageId, expiresAt, timestamp]
      );
    });
    return this.getPendingInteraction(id);
  }

  async getPendingInteraction(id) {
    assertNonEmptyString(id, 'ID de interação pendente');
    return this.store.read(async session => mapPendingInteraction(
      await session.get('SELECT * FROM nexo_pending_interactions WHERE id = ?', [id])
    ));
  }

  async findActivePendingInteraction(userId, chatId) {
    assertNonEmptyString(userId, 'ID de usuário');
    assertNonEmptyString(chatId, 'ID de chat');
    const nowIso = this.now();
    return this.store.read(async session => mapPendingInteraction(
      await session.get(
        `SELECT * FROM nexo_pending_interactions
         WHERE user_id = ? AND chat_id = ? AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`,
        [userId, chatId, nowIso]
      )
    ));
  }

  async expirePendingInteractions(beforeIso = this.now()) {
    return this.store.transaction(async session => {
      const expired = await session.all(
        'SELECT id FROM nexo_pending_interactions WHERE expires_at <= ?',
        [beforeIso]
      );
      if (!expired.length) return 0;
      session.run(
        'DELETE FROM nexo_pending_interactions WHERE expires_at <= ?',
        [beforeIso]
      );
      return expired.length;
    });
  }

  /**
   * Mescla `patchState` no estado de uma interação pendente já existente,
   * para avançar uma máquina de estado (ex.: onboarding) sem criar uma
   * nova linha a cada passo.
   */
  async updatePendingInteractionState(id, patchState) {
    assertNonEmptyString(id, 'ID de interação pendente');
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT * FROM nexo_pending_interactions WHERE id = ?',
        [id]
      );
      if (!existing) throw new NexoNotFoundError('Interação pendente não encontrada', { id });
      const nextState = { ...parse(existing.state_json, {}), ...patchState };
      session.run(
        'UPDATE nexo_pending_interactions SET state_json = ? WHERE id = ?',
        [stringify(nextState), id]
      );
      return mapPendingInteraction(await session.get('SELECT * FROM nexo_pending_interactions WHERE id = ?', [id]));
    });
  }

  async deletePendingInteraction(id) {
    assertNonEmptyString(id, 'ID de interação pendente');
    return this.store.transaction(async session => {
      deletePendingInteractionInSession(session, id);
    });
  }

  // ---- Jobs agendados (fundação para o scheduler) ------------------------

  async scheduleJobIfAbsent({ type, aggregateId = null, logicalKey, runAt }) {
    assertNonEmptyString(type, 'Tipo de job');
    assertNonEmptyString(logicalKey, 'Chave lógica do job');
    assertNonEmptyString(runAt, 'Horário de execução do job');
    const timestamp = this.now();
    return this.store.transaction(async session => {
      const existing = await session.get(
        'SELECT id FROM nexo_scheduled_jobs WHERE logical_key = ?',
        [logicalKey]
      );
      if (existing) return { created: false, id: existing.id };
      const insert = session.run(
        `INSERT INTO nexo_scheduled_jobs (type, aggregate_id, logical_key, run_at, state, attempts, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
        [type, aggregateId, logicalKey, runAt, timestamp, timestamp]
      );
      return { created: true, changes: insert.changes };
    });
  }
}

export { NexoRepository };
