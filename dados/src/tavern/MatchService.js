import { TavernNotFoundError, TavernValidationError } from './errors.js';

class MatchService {
  constructor({ engine, repository }) {
    if (!engine || !repository) {
      throw new TavernValidationError('Engine e repositório são obrigatórios');
    }
    this.engine = engine;
    this.repository = repository;
    this.matchLocks = new Map();
  }

  withMatchLock(matchId, operation) {
    const previous = this.matchLocks.get(matchId) || Promise.resolve();
    const run = previous.then(operation, operation);
    const tracked = run.finally(() => {
      if (this.matchLocks.get(matchId) === tracked) this.matchLocks.delete(matchId);
    });
    this.matchLocks.set(matchId, tracked);
    return tracked;
  }

  async createMatch(input) {
    const state = this.engine.createMatch(input);
    await this.repository.createMatch(state);
    return state;
  }

  dispatch(matchId, action, { messageId = null } = {}) {
    return this.withMatchLock(matchId, async () => {
      if (messageId) {
        const processed = await this.repository.getMatchEventByMessageId(matchId, messageId);
        if (processed) {
          const current = await this.repository.getMatch(matchId);
          if (!current) throw new TavernNotFoundError('Partida não encontrada', { matchId });
          return { duplicate: true, state: current.state, event: processed };
        }
      }

      const current = await this.repository.getMatch(matchId);
      if (!current) throw new TavernNotFoundError('Partida não encontrada', { matchId });
      const transition = this.engine.applyAction(current.state, action);
      const saved = await this.repository.transitionMatch({
        matchId,
        expectedVersion: current.version,
        messageId,
        actorId: transition.event.actorId,
        eventType: transition.event.type,
        payload: transition.event,
        nextState: transition.state
      });

      return {
        duplicate: saved.duplicate,
        state: saved.match.state,
        event: transition.event
      };
    });
  }

  async processExpiredMatches(now = this.engine.now()) {
    const expired = await this.repository.listExpiredMatches(new Date(now).toISOString());
    const results = [];
    for (const match of expired) {
      const result = await this.dispatch(
        match.matchId,
        { type: 'TIMEOUT' },
        { messageId: `timeout:${match.matchId}:${match.deadlineAt}` }
      );
      results.push({
        matchId: match.matchId,
        groupId: match.groupId,
        previousState: match.state,
        ...result
      });
    }
    return results;
  }
}

export { MatchService };
