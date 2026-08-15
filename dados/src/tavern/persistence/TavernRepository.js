import {
  TavernConflictError,
  TavernNotFoundError,
  TavernValidationError
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

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 191) {
    throw new TavernValidationError(`${label} inválido`);
  }
  return value.trim();
}

function normalizeDisplayName(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 80) : null;
}

function mapGroup(row) {
  if (!row) return null;
  return {
    groupId: row.group_id,
    enabled: Boolean(row.enabled),
    tavernLevel: Number(row.tavern_level),
    tavernXp: Number(row.tavern_xp),
    seasonId: row.season_id,
    settings: parse(row.settings_json, {}),
    bossProgress: parse(row.boss_progress_json, {}),
    collectiveQuests: parse(row.collective_quests_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlayer(row) {
  if (!row) return null;
  return {
    playerId: row.player_id,
    displayName: row.display_name,
    xp: Number(row.xp),
    activeClassId: row.active_class_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapChallenge(row) {
  if (!row) return null;
  return {
    challengeId: row.challenge_id,
    groupId: row.group_id,
    challengerId: row.challenger_id,
    challengedId: row.challenged_id,
    mode: row.mode,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
    responseMessageId: row.response_message_id,
    matchId: row.match_id
  };
}

function mapMatch(row) {
  if (!row) return null;
  return {
    matchId: row.match_id,
    groupId: row.group_id,
    playerOneId: row.player_one_id,
    playerTwoId: row.player_two_id,
    mode: row.mode,
    status: row.status,
    seed: row.seed,
    activePlayerId: row.active_player_id,
    turnNumber: Number(row.turn_number),
    deadlineAt: row.deadline_at,
    state: parse(row.state_json, null),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at
  };
}

async function insertMatch(session, state, timestamp) {
  const matchId = assertIdentifier(state?.matchId, 'matchId');
  const groupId = assertIdentifier(state?.groupId, 'groupId');
  const [playerOneId, playerTwoId] = state?.playerOrder || [];
  assertIdentifier(playerOneId, 'playerOneId');
  assertIdentifier(playerTwoId, 'playerTwoId');

  if (await session.get('SELECT match_id FROM tavern_matches WHERE match_id = ?', [matchId])) {
    throw new TavernConflictError('Partida já existe', { matchId });
  }

  await session.run(
    `INSERT INTO tavern_groups (group_id, enabled, tavern_level, tavern_xp, settings_json,
      boss_progress_json, collective_quests_json, created_at, updated_at)
     VALUES (?, 0, 1, 0, '{}', '{}', '[]', ?, ?)
     ON CONFLICT(group_id) DO NOTHING`,
    [groupId, timestamp, timestamp]
  );
  for (const playerId of [playerOneId, playerTwoId]) {
    await session.run(
      `INSERT INTO tavern_players (player_id, created_at, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(player_id) DO NOTHING`,
      [playerId, timestamp, timestamp]
    );
    await session.run(
      `INSERT INTO tavern_group_members (group_id, player_id, joined_at)
       VALUES (?, ?, ?)
       ON CONFLICT(group_id, player_id) DO NOTHING`,
      [groupId, playerId, timestamp]
    );
  }

  const version = Number(state.version || 0);
  await session.run(
    `INSERT INTO tavern_matches (
      match_id, group_id, player_one_id, player_two_id, mode, status, seed,
      active_player_id, turn_number, deadline_at, state_json, version,
      created_at, updated_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      matchId,
      groupId,
      playerOneId,
      playerTwoId,
      state.mode,
      state.status,
      String(state.seed),
      state.turn?.activePlayerId || null,
      state.turn?.number || 0,
      state.turn?.deadlineAt || null,
      stringify(state),
      version,
      timestamp,
      timestamp,
      state.finishedAt || null
    ]
  );
  await session.run(
    `INSERT INTO tavern_match_events (
      match_id, sequence, actor_id, event_type, payload_json, created_at
    ) VALUES (?, 0, NULL, 'MATCH_CREATED', ?, ?)`,
    [matchId, stringify({ seed: state.seed, mode: state.mode }), timestamp]
  );
  await session.run(
    `INSERT INTO tavern_match_snapshots (match_id, version, state_json, created_at)
     VALUES (?, ?, ?, ?)`,
    [matchId, version, stringify(state), timestamp]
  );
  return state;
}

class TavernRepository {
  constructor(store, { now = () => new Date().toISOString() } = {}) {
    this.store = store;
    this.now = now;
  }

  async ensureGroup(groupId, settings = {}) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    return this.store.transaction(async session => {
      const timestamp = this.now();
      await session.run(
        `INSERT INTO tavern_groups (
          group_id, enabled, tavern_level, tavern_xp, settings_json,
          boss_progress_json, collective_quests_json, created_at, updated_at
        ) VALUES (?, 0, 1, 0, ?, '{}', '[]', ?, ?)
        ON CONFLICT(group_id) DO NOTHING`,
        [normalizedGroupId, stringify(settings), timestamp, timestamp]
      );
      return mapGroup(await session.get('SELECT * FROM tavern_groups WHERE group_id = ?', [normalizedGroupId]));
    });
  }

  async getGroup(groupId) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    return this.store.read(async session => mapGroup(
      await session.get('SELECT * FROM tavern_groups WHERE group_id = ?', [normalizedGroupId])
    ));
  }

  async updateGroupSettings(groupId, settingsPatch) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    if (!settingsPatch || typeof settingsPatch !== 'object' || Array.isArray(settingsPatch)) {
      throw new TavernValidationError('Configuração da Taverna inválida');
    }
    await this.ensureGroup(normalizedGroupId);
    return this.store.transaction(async session => {
      const current = mapGroup(await session.get(
        'SELECT * FROM tavern_groups WHERE group_id = ?',
        [normalizedGroupId]
      ));
      const settings = { ...current.settings, ...settingsPatch };
      await session.run(
        'UPDATE tavern_groups SET settings_json = ?, updated_at = ? WHERE group_id = ?',
        [stringify(settings), this.now(), normalizedGroupId]
      );
      return mapGroup(await session.get('SELECT * FROM tavern_groups WHERE group_id = ?', [normalizedGroupId]));
    });
  }

  async setGroupEnabled(groupId, enabled) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    await this.ensureGroup(normalizedGroupId);
    return this.store.transaction(async session => {
      await session.run(
        'UPDATE tavern_groups SET enabled = ?, updated_at = ? WHERE group_id = ?',
        [Boolean(enabled), this.now(), normalizedGroupId]
      );
      return mapGroup(await session.get('SELECT * FROM tavern_groups WHERE group_id = ?', [normalizedGroupId]));
    });
  }

  async ensurePlayer(playerId, displayName = null) {
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    return this.store.transaction(async session => {
      const timestamp = this.now();
      await session.run(
        `INSERT INTO tavern_players (player_id, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           display_name = COALESCE(excluded.display_name, tavern_players.display_name),
           updated_at = excluded.updated_at`,
        [normalizedPlayerId, normalizeDisplayName(displayName), timestamp, timestamp]
      );
      return session.get('SELECT * FROM tavern_players WHERE player_id = ?', [normalizedPlayerId]);
    });
  }

  async getPlayer(playerId) {
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    return this.store.read(async session => mapPlayer(
      await session.get('SELECT * FROM tavern_players WHERE player_id = ?', [normalizedPlayerId])
    ));
  }

  async setPlayerClass(playerId, classId) {
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    const normalizedClassId = assertIdentifier(classId, 'classId');
    await this.ensurePlayer(normalizedPlayerId);
    return this.store.transaction(async session => {
      await session.run(
        'UPDATE tavern_players SET active_class_id = ?, updated_at = ? WHERE player_id = ?',
        [normalizedClassId, this.now(), normalizedPlayerId]
      );
      return mapPlayer(await session.get('SELECT * FROM tavern_players WHERE player_id = ?', [normalizedPlayerId]));
    });
  }

  async seedCards(cards) {
    if (!Array.isArray(cards)) {
      throw new TavernValidationError('cards precisa ser uma lista');
    }

    return this.store.transaction(async session => {
      const timestamp = this.now();
      for (const card of cards) {
        await session.run(
          `INSERT INTO tavern_cards (
            card_id, name, type, rarity, class_id, cost, attack, health,
            definition_json, schema_version, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(card_id) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            rarity = excluded.rarity,
            class_id = excluded.class_id,
            cost = excluded.cost,
            attack = excluded.attack,
            health = excluded.health,
            definition_json = excluded.definition_json,
            schema_version = excluded.schema_version,
            enabled = 1,
            updated_at = excluded.updated_at`,
          [
            card.id,
            card.name,
            card.type,
            card.rarity,
            card.classId || null,
            card.cost,
            card.attack ?? null,
            card.health ?? null,
            stringify(card),
            card.schemaVersion || 1,
            timestamp,
            timestamp
          ]
        );
      }
      return cards.length;
    });
  }

  async getCard(cardId) {
    const normalizedCardId = assertIdentifier(cardId, 'cardId');
    return this.store.read(async session => {
      const row = await session.get(
        'SELECT definition_json FROM tavern_cards WHERE card_id = ? AND enabled = 1',
        [normalizedCardId]
      );
      return row ? parse(row.definition_json, null) : null;
    });
  }

  async grantCard(playerId, cardId, quantity = 1) {
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    const normalizedCardId = assertIdentifier(cardId, 'cardId');
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new TavernValidationError('quantity precisa ser um inteiro positivo');
    }

    return this.store.transaction(async session => {
      const card = await session.get('SELECT card_id FROM tavern_cards WHERE card_id = ? AND enabled = 1', [normalizedCardId]);
      if (!card) throw new TavernNotFoundError('Carta não encontrada', { cardId: normalizedCardId });

      const timestamp = this.now();
      await session.run(
        `INSERT INTO tavern_players (player_id, created_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(player_id) DO NOTHING`,
        [normalizedPlayerId, timestamp, timestamp]
      );
      await session.run(
        `INSERT INTO tavern_collections (player_id, card_id, quantity, locked_quantity, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(player_id, card_id) DO UPDATE SET
           quantity = tavern_collections.quantity + excluded.quantity,
           updated_at = excluded.updated_at`,
        [normalizedPlayerId, normalizedCardId, quantity, timestamp]
      );
      const row = await session.get(
        'SELECT quantity, locked_quantity FROM tavern_collections WHERE player_id = ? AND card_id = ?',
        [normalizedPlayerId, normalizedCardId]
      );
      return { quantity: Number(row.quantity), lockedQuantity: Number(row.locked_quantity) };
    });
  }

  async createMatch(state) {
    return this.store.transaction(async session => {
      const timestamp = this.now();
      return insertMatch(session, state, timestamp);
    });
  }

  async findActiveMatchForPlayer(groupId, playerId) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    return this.store.read(async session => mapMatch(await session.get(
      `SELECT * FROM tavern_matches
       WHERE group_id = ? AND status = 'ACTIVE'
         AND (player_one_id = ? OR player_two_id = ?)
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedGroupId, normalizedPlayerId, normalizedPlayerId]
    )));
  }

  async listActiveMatches(groupId = null) {
    const normalizedGroupId = groupId === null ? null : assertIdentifier(groupId, 'groupId');
    return this.store.read(async session => {
      const rows = normalizedGroupId
        ? await session.all(
          `SELECT * FROM tavern_matches WHERE group_id = ? AND status = 'ACTIVE' ORDER BY created_at`,
          [normalizedGroupId]
        )
        : await session.all(`SELECT * FROM tavern_matches WHERE status = 'ACTIVE' ORDER BY created_at`);
      return rows.map(mapMatch);
    });
  }

  async createChallenge({
    challengeId,
    groupId,
    challengerId,
    challengedId,
    challengerName = null,
    challengedName = null,
    mode,
    expiresAt
  }) {
    const normalizedChallengeId = assertIdentifier(challengeId, 'challengeId');
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    const normalizedChallengerId = assertIdentifier(challengerId, 'challengerId');
    const normalizedChallengedId = assertIdentifier(challengedId, 'challengedId');
    const normalizedMode = assertIdentifier(mode, 'mode');
    if (normalizedChallengerId === normalizedChallengedId) {
      throw new TavernValidationError('Você não pode desafiar a si mesmo');
    }
    if (!Number.isFinite(Date.parse(expiresAt))) {
      throw new TavernValidationError('Expiração do desafio inválida');
    }

    return this.store.transaction(async session => {
      const timestamp = this.now();
      await session.run(
        `UPDATE tavern_challenges SET status = 'EXPIRED', updated_at = ?
         WHERE status = 'OPEN' AND expires_at <= ?`,
        [timestamp, timestamp]
      );
      const group = mapGroup(await session.getForUpdate(
        'SELECT * FROM tavern_groups WHERE group_id = ?',
        [normalizedGroupId]
      ));
      if (!group?.enabled) throw new TavernConflictError('A Taverna não está ativa neste grupo');

      const activeMatch = await session.get(
        `SELECT match_id FROM tavern_matches
         WHERE group_id = ? AND status = 'ACTIVE'
           AND (player_one_id IN (?, ?) OR player_two_id IN (?, ?)) LIMIT 1`,
        [
          normalizedGroupId,
          normalizedChallengerId,
          normalizedChallengedId,
          normalizedChallengerId,
          normalizedChallengedId
        ]
      );
      if (activeMatch) throw new TavernConflictError('Um dos jogadores já está em uma partida neste grupo');

      const pending = await session.get(
        `SELECT challenge_id FROM tavern_challenges
         WHERE group_id = ? AND status = 'OPEN'
           AND (challenger_id IN (?, ?) OR challenged_id IN (?, ?)) LIMIT 1`,
        [
          normalizedGroupId,
          normalizedChallengerId,
          normalizedChallengedId,
          normalizedChallengerId,
          normalizedChallengedId
        ]
      );
      if (pending) throw new TavernConflictError('Um dos jogadores já possui um desafio pendente neste grupo');

      for (const [playerId, displayName] of [
        [normalizedChallengerId, challengerName],
        [normalizedChallengedId, challengedName]
      ]) {
        await session.run(
          `INSERT INTO tavern_players (player_id, display_name, created_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(player_id) DO UPDATE SET
             display_name = COALESCE(excluded.display_name, tavern_players.display_name),
             updated_at = excluded.updated_at`,
          [playerId, normalizeDisplayName(displayName), timestamp, timestamp]
        );
        await session.run(
          `INSERT INTO tavern_group_members (group_id, player_id, joined_at)
           VALUES (?, ?, ?) ON CONFLICT(group_id, player_id) DO NOTHING`,
          [normalizedGroupId, playerId, timestamp]
        );
      }

      await session.run(
        `INSERT INTO tavern_challenges (
          challenge_id, group_id, challenger_id, challenged_id, mode, status,
          expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`,
        [
          normalizedChallengeId,
          normalizedGroupId,
          normalizedChallengerId,
          normalizedChallengedId,
          normalizedMode,
          expiresAt,
          timestamp,
          timestamp
        ]
      );
      return mapChallenge(await session.get(
        'SELECT * FROM tavern_challenges WHERE challenge_id = ?',
        [normalizedChallengeId]
      ));
    });
  }

  async findOpenChallengeForPlayer(groupId, playerId) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    return this.store.transaction(async session => {
      const timestamp = this.now();
      await session.run(
        `UPDATE tavern_challenges SET status = 'EXPIRED', updated_at = ?
         WHERE status = 'OPEN' AND expires_at <= ?`,
        [timestamp, timestamp]
      );
      return mapChallenge(await session.get(
        `SELECT * FROM tavern_challenges
         WHERE group_id = ? AND challenged_id = ? AND status = 'OPEN'
         ORDER BY created_at DESC LIMIT 1`,
        [normalizedGroupId, normalizedPlayerId]
      ));
    });
  }

  async getChallengeByResponseMessageId(groupId, challengedId, messageId) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    const normalizedChallengedId = assertIdentifier(challengedId, 'challengedId');
    const normalizedMessageId = assertIdentifier(messageId, 'messageId');
    return this.store.read(async session => mapChallenge(await session.get(
      `SELECT * FROM tavern_challenges
       WHERE group_id = ? AND challenged_id = ? AND response_message_id = ? LIMIT 1`,
      [normalizedGroupId, normalizedChallengedId, normalizedMessageId]
    )));
  }

  async declineChallenge(challengeId, challengedId, messageId = null) {
    const normalizedChallengeId = assertIdentifier(challengeId, 'challengeId');
    const normalizedChallengedId = assertIdentifier(challengedId, 'challengedId');
    const normalizedMessageId = messageId ? assertIdentifier(messageId, 'messageId') : null;
    return this.store.transaction(async session => {
      const challenge = mapChallenge(await session.getForUpdate(
        'SELECT * FROM tavern_challenges WHERE challenge_id = ?',
        [normalizedChallengeId]
      ));
      if (!challenge) throw new TavernNotFoundError('Desafio não encontrado');
      if (challenge.challengedId !== normalizedChallengedId) {
        throw new TavernConflictError('Somente a pessoa desafiada pode responder');
      }
      if (challenge.status !== 'OPEN') throw new TavernConflictError('Este desafio não está mais aberto');
      const timestamp = this.now();
      const status = Date.parse(challenge.expiresAt) <= Date.parse(timestamp) ? 'EXPIRED' : 'DECLINED';
      await session.run(
        `UPDATE tavern_challenges SET
          status = ?, responded_at = ?, response_message_id = ?, updated_at = ?
         WHERE challenge_id = ? AND status = 'OPEN'`,
        [status, timestamp, normalizedMessageId, timestamp, normalizedChallengeId]
      );
      return {
        ...mapChallenge(await session.get(
        'SELECT * FROM tavern_challenges WHERE challenge_id = ?',
        [normalizedChallengeId]
        )),
        duplicate: false
      };
    });
  }

  async acceptChallengeWithMatch(challengeId, challengedId, state, messageId = null) {
    const normalizedChallengeId = assertIdentifier(challengeId, 'challengeId');
    const normalizedChallengedId = assertIdentifier(challengedId, 'challengedId');
    const normalizedMessageId = messageId ? assertIdentifier(messageId, 'messageId') : null;
    return this.store.transaction(async session => {
      const challenge = mapChallenge(await session.getForUpdate(
        'SELECT * FROM tavern_challenges WHERE challenge_id = ?',
        [normalizedChallengeId]
      ));
      if (!challenge) throw new TavernNotFoundError('Desafio não encontrado');
      if (challenge.challengedId !== normalizedChallengedId) {
        throw new TavernConflictError('Somente a pessoa desafiada pode aceitar');
      }
      if (challenge.status !== 'OPEN') throw new TavernConflictError('Este desafio não está mais aberto');
      const timestamp = this.now();
      if (Date.parse(challenge.expiresAt) <= Date.parse(timestamp)) {
        await session.run(
          `UPDATE tavern_challenges SET status = 'EXPIRED', updated_at = ? WHERE challenge_id = ?`,
          [timestamp, normalizedChallengeId]
        );
        throw new TavernConflictError('O desafio expirou');
      }
      await session.getForUpdate(
        'SELECT group_id FROM tavern_groups WHERE group_id = ?',
        [challenge.groupId]
      );

      const statePlayers = new Set(state?.playerOrder || []);
      if (
        state?.groupId !== challenge.groupId ||
        state?.mode !== challenge.mode ||
        !statePlayers.has(challenge.challengerId) ||
        !statePlayers.has(challenge.challengedId) ||
        statePlayers.size !== 2
      ) {
        throw new TavernValidationError('A partida não corresponde ao desafio aceito');
      }
      const activeMatch = await session.get(
        `SELECT match_id FROM tavern_matches
         WHERE group_id = ? AND status = 'ACTIVE'
           AND (player_one_id IN (?, ?) OR player_two_id IN (?, ?)) LIMIT 1`,
        [
          challenge.groupId,
          challenge.challengerId,
          challenge.challengedId,
          challenge.challengerId,
          challenge.challengedId
        ]
      );
      if (activeMatch) {
        throw new TavernConflictError('Um dos jogadores já está em uma partida neste grupo');
      }

      await insertMatch(session, state, timestamp);
      await session.run(
        `UPDATE tavern_challenges SET
          status = 'ACCEPTED', responded_at = ?, response_message_id = ?, updated_at = ?, match_id = ?
         WHERE challenge_id = ? AND status = 'OPEN'`,
        [timestamp, normalizedMessageId, timestamp, state.matchId, normalizedChallengeId]
      );
      await session.run(
        `UPDATE tavern_challenges SET status = 'CANCELLED', updated_at = ?
         WHERE group_id = ? AND status = 'OPEN' AND challenge_id <> ?
           AND (challenger_id IN (?, ?) OR challenged_id IN (?, ?))`,
        [
          timestamp,
          challenge.groupId,
          normalizedChallengeId,
          challenge.challengerId,
          challenge.challengedId,
          challenge.challengerId,
          challenge.challengedId
        ]
      );
      return {
        challenge: mapChallenge(await session.get(
          'SELECT * FROM tavern_challenges WHERE challenge_id = ?',
          [normalizedChallengeId]
        )),
        match: state,
        duplicate: false
      };
    });
  }

  async getMatch(matchId) {
    const normalizedMatchId = assertIdentifier(matchId, 'matchId');
    return this.store.read(async session => mapMatch(
      await session.get('SELECT * FROM tavern_matches WHERE match_id = ?', [normalizedMatchId])
    ));
  }

  async getMatchEventByMessageId(matchId, messageId) {
    const normalizedMatchId = assertIdentifier(matchId, 'matchId');
    const normalizedMessageId = assertIdentifier(messageId, 'messageId');
    return this.store.read(async session => {
      const row = await session.get(
        `SELECT sequence, message_id, actor_id, event_type, payload_json, created_at
         FROM tavern_match_events WHERE match_id = ? AND message_id = ?`,
        [normalizedMatchId, normalizedMessageId]
      );
      if (!row) return null;
      return {
        sequence: Number(row.sequence),
        messageId: row.message_id,
        actorId: row.actor_id,
        eventType: row.event_type,
        payload: parse(row.payload_json, {}),
        createdAt: row.created_at
      };
    });
  }

  async findMatchEventForPlayerByMessageId(groupId, playerId, messageId) {
    const normalizedGroupId = assertIdentifier(groupId, 'groupId');
    const normalizedPlayerId = assertIdentifier(playerId, 'playerId');
    const normalizedMessageId = assertIdentifier(messageId, 'messageId');
    return this.store.read(async session => {
      const row = await session.get(
        `SELECT e.match_id, e.sequence, e.message_id, e.actor_id, e.event_type,
                e.payload_json, e.created_at
         FROM tavern_match_events e
         INNER JOIN tavern_matches m ON m.match_id = e.match_id
         WHERE m.group_id = ? AND (m.player_one_id = ? OR m.player_two_id = ?)
           AND e.message_id = ?
         LIMIT 1`,
        [normalizedGroupId, normalizedPlayerId, normalizedPlayerId, normalizedMessageId]
      );
      if (!row) return null;
      return {
        matchId: row.match_id,
        sequence: Number(row.sequence),
        messageId: row.message_id,
        actorId: row.actor_id,
        eventType: row.event_type,
        payload: parse(row.payload_json, {}),
        createdAt: row.created_at
      };
    });
  }

  async listExpiredMatches(now = this.now()) {
    return this.store.read(async session => (await session.all(
      `SELECT * FROM tavern_matches
       WHERE status = 'ACTIVE' AND deadline_at IS NOT NULL AND deadline_at <= ?
       ORDER BY deadline_at`,
      [now]
    )).map(mapMatch));
  }

  async transitionMatch({
    matchId,
    expectedVersion,
    messageId = null,
    actorId = null,
    eventType,
    payload = {},
    nextState
  }) {
    const normalizedMatchId = assertIdentifier(matchId, 'matchId');
    assertIdentifier(eventType, 'eventType');
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new TavernValidationError('expectedVersion inválido');
    }

    return this.store.transaction(async session => {
      const current = mapMatch(await session.getForUpdate(
        'SELECT * FROM tavern_matches WHERE match_id = ?',
        [normalizedMatchId]
      ));
      if (!current) throw new TavernNotFoundError('Partida não encontrada', { matchId: normalizedMatchId });

      if (messageId) {
        const duplicate = await session.get(
          'SELECT sequence FROM tavern_match_events WHERE match_id = ? AND message_id = ?',
          [normalizedMatchId, messageId]
        );
        if (duplicate) {
          const current = mapMatch(await session.get('SELECT * FROM tavern_matches WHERE match_id = ?', [normalizedMatchId]));
          return { duplicate: true, match: current };
        }
      }
      if (current.version !== expectedVersion) {
        throw new TavernConflictError('A partida foi alterada por outra ação', {
          matchId: normalizedMatchId,
          expectedVersion,
          actualVersion: current.version
        });
      }

      const nextVersion = expectedVersion + 1;
      const stateToSave = { ...nextState, version: nextVersion };
      const timestamp = this.now();
      const update = await session.run(
        `UPDATE tavern_matches SET
          status = ?, active_player_id = ?, turn_number = ?, deadline_at = ?,
          state_json = ?, version = ?, updated_at = ?, finished_at = ?
         WHERE match_id = ? AND version = ?`,
        [
          stateToSave.status,
          stateToSave.turn?.activePlayerId || null,
          stateToSave.turn?.number || 0,
          stateToSave.turn?.deadlineAt || null,
          stringify(stateToSave),
          nextVersion,
          timestamp,
          stateToSave.finishedAt || null,
          normalizedMatchId,
          expectedVersion
        ]
      );

      if (update.changes !== 1) {
        throw new TavernConflictError('Falha ao atualizar a versão da partida', { matchId: normalizedMatchId });
      }

      await session.run(
        `INSERT INTO tavern_match_events (
          match_id, sequence, message_id, actor_id, event_type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [normalizedMatchId, nextVersion, messageId, actorId, eventType, stringify(payload), timestamp]
      );
      await session.run(
        `INSERT INTO tavern_match_snapshots (match_id, version, state_json, created_at)
         VALUES (?, ?, ?, ?)`,
        [normalizedMatchId, nextVersion, stringify(stateToSave), timestamp]
      );

      return {
        duplicate: false,
        match: {
          ...current,
          status: stateToSave.status,
          activePlayerId: stateToSave.turn?.activePlayerId || null,
          turnNumber: stateToSave.turn?.number || 0,
          deadlineAt: stateToSave.turn?.deadlineAt || null,
          state: stateToSave,
          version: nextVersion,
          updatedAt: timestamp,
          finishedAt: stateToSave.finishedAt || null
        }
      };
    });
  }

  async listMatchEvents(matchId) {
    const normalizedMatchId = assertIdentifier(matchId, 'matchId');
    return this.store.read(async session => (await session.all(
      `SELECT sequence, message_id, actor_id, event_type, payload_json, created_at
       FROM tavern_match_events WHERE match_id = ? ORDER BY sequence`,
      [normalizedMatchId]
    )).map(row => ({
      sequence: Number(row.sequence),
      messageId: row.message_id,
      actorId: row.actor_id,
      eventType: row.event_type,
      payload: parse(row.payload_json, {}),
      createdAt: row.created_at
    })));
  }
}

export { TavernRepository };
