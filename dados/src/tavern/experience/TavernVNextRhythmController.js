import { TAVERN_BOT_PLAYER_ID, chooseAction } from '../domain/TavernBotPlayer.js';
import { TavernEventNarrator } from './TavernEventNarrator.js';
import { TavernVNextCommandController, compactActions, deadlineLabel } from './TavernVNextCommandController.js';

const VICTORY_REASON_LABELS = Object.freeze({
  HERO_DEFEATED: 'VITÓRIA EM COMBATE',
  CONCEDE: 'VITÓRIA POR DESISTÊNCIA',
  ABSENCE: 'VITÓRIA POR AUSÊNCIA'
});

function playerTag(playerId) {
  return `@${String(playerId || '').split('@')[0]}`;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

class TavernVNextRhythmController extends TavernVNextCommandController {
  constructor(options) {
    super(options);
    this.eventNarrator = options.eventNarrator || new TavernEventNarrator({
      cardRegistry: options.game?.tavern?.cardRegistry
    });
  }

  buildPublicStateCaption(state, prefix, intro = null) {
    const lines = [];
    if (intro) lines.push(intro, '');

    if (state.status === 'FINISHED') {
      lines.push(state.winnerId
        ? `🏆 Mesa encerrada. Vitória de ${playerTag(state.winnerId)}.`
        : '⚖️ Mesa encerrada em empate.');
      return lines.join('\n');
    }

    if (state.phase === 'MULLIGAN') {
      const ready = state.playerOrder.filter(id => state.mulligan?.responses?.[id]?.done).length;
      lines.push(
        `🃏 *Preparação · ${ready}/${state.playerOrder.length} prontos*`,
        'As escolhas de abertura ficam no privado.'
      );
      return lines.join('\n');
    }

    const activeId = state.turn?.activePlayerId;
    lines.push(
      `🔥 *Turno ${state.turn?.number || '?'} · ${playerTag(activeId)}*`,
      `A orientação fica no privado do jogador ativo. · ${prefix}campo atualiza a mesa.`
    );
    return lines.join('\n');
  }

  async announceState(state, transport, { prefix = '!', intro = null, mentions: extraMentions = [] } = {}) {
    const publicCaption = this.buildPublicStateCaption(state, prefix, intro);
    const mentions = unique([
      state.turn?.activePlayerId,
      state.status === 'FINISHED' ? state.winnerId : null,
      ...extraMentions
    ]);

    let buffer = null;
    try {
      if (state.status === 'FINISHED' && state.winnerId) {
        const [playerNames, classId] = await Promise.all([
          this.game.getPlayerNames(state),
          this.playerClassId(state.winnerId)
        ]);
        buffer = await this.renderQueue.run(() => this.sceneRenderer.renderVictory({
          winnerName: playerNames[state.winnerId] || state.winnerId,
          classId,
          reasonLabel: VICTORY_REASON_LABELS[state.finishReason] || 'VITÓRIA'
        }));
      } else {
        const playerNames = await this.game.getPlayerNames(state);
        buffer = await this.renderQueue.run(() => this.boardRenderer.render(state, { playerNames }));
      }
    } catch (error) {
      console.warn('[TAVERN] Render público vNext indisponível:', error?.message || error);
    }

    if (buffer) await transport.sendGroupImage(buffer, { caption: publicCaption, mentions });
    else await transport.sendGroupText(publicCaption, { mentions });
  }

  async sendPrivateGuidance(state, playerId, transport, prefix) {
    if (playerId === TAVERN_BOT_PLAYER_ID) return false;
    if (!state?.players?.[playerId] || state.status !== 'ACTIVE') return false;
    const analysis = this.experienceAdvisor.analyze(state, playerId, { prefix });
    if (!analysis.isActivePlayer) return false;
    const actions = compactActions(analysis, 4);
    const deadline = deadlineLabel(analysis.secondsRemaining);
    const lines = [
      `🕯️ *OPÇÕES RESTANTES${deadline ? ` · ${deadline}` : ''}*`,
      analysis.summary
    ];
    if (actions.length) lines.push('', ...actions);
    await transport.sendPrivateText(playerId, lines.join('\n'));
    return true;
  }

  async afterAction(result, context, { privateHands = [] } = {}) {
    if (result.duplicate) {
      await context.transport.sendGroupText('Essa ação já tinha sido processada. O estado da mesa não mudou.');
      return;
    }

    const state = result.state;
    const narration = this.eventNarrator.narrate(result.event, state, { prefix: context.prefix });

    // Board/texto público, cena de turno e mãos privadas vão a canais
    // diferentes e nenhum depende do resultado do outro — disparar tudo de
    // uma vez deixa a fila de renderização (que já limita concorrência)
    // trabalhar em paralelo em vez de empilhar o custo de cada imagem.
    const tasks = [];
    if (narration.renderBoard || state.status === 'FINISHED') {
      tasks.push(this.announceState(state, context.transport, {
        prefix: context.prefix,
        intro: narration.text || null,
        mentions: narration.mentions
      }));
    } else if (narration.text) {
      tasks.push(context.transport.sendGroupText(narration.text, { mentions: narration.mentions }));
    }

    if (state.status !== 'FINISHED') {
      if (narration.refreshActiveHand && state.turn?.activePlayerId) {
        tasks.push(this.announceTurn(state, state.turn.activePlayerId, context));
      }

      const fullHands = unique([
        ...privateHands,
        narration.refreshActiveHand ? state.turn?.activePlayerId : null
      ]);
      for (const playerId of fullHands) {
        tasks.push(this.sendPrivateHand(state, playerId, context.transport, context.prefix));
      }

      if (result.event?.type === 'ATTACK' || result.event?.type === 'HERO_POWER') {
        tasks.push(this.sendPrivateGuidance(state, result.event.actorId, context.transport, context.prefix));
      }
    }

    await Promise.all(tasks);
  }

  /**
   * O bot só entra em ação quando um turno passa pra ele — mão inicial e
   * MULLIGAN dele são resolvidos uma vez só, na criação da partida
   * (TavernCommandController.handleBotDuel). Deixa handleEndTurn do
   * jogador humano exatamente como já era (super.handleEndTurn, sem
   * tocar em afterAction nem em nenhum outro método compartilhado) e só
   * depois disso, separadamente, conduz o turno do bot até ele devolver a
   * vez — cada ação do bot passa pelas mesmas dispatchForPlayer/
   * afterAction que uma ação humana usaria, então a narração, o board e a
   * mão privada do humano saem exatamente como em qualquer outro turno.
   */
  async handleEndTurn(context) {
    await super.handleEndTurn(context);
    await this.runBotTurnIfNeeded(context);
  }

  async runBotTurnIfNeeded(context) {
    let match;
    try {
      match = await this.game.getActiveMatch(context.chatId, context.playerId);
    } catch {
      return;
    }
    let state = match.state;
    const matchId = match.matchId;
    let guard = 0;
    while (state.status === 'ACTIVE' && state.turn?.activePlayerId === TAVERN_BOT_PLAYER_ID && guard < 200) {
      guard += 1;
      const action = chooseAction(state, TAVERN_BOT_PLAYER_ID);
      const result = await this.game.dispatchForPlayer(
        context.chatId,
        TAVERN_BOT_PLAYER_ID,
        action,
        { matchId }
      );
      const nextActive = result.state.status === 'ACTIVE' ? result.state.turn?.activePlayerId : null;
      await this.afterAction(result, context, {
        privateHands: nextActive && nextActive !== TAVERN_BOT_PLAYER_ID ? [nextActive] : []
      });
      state = result.state;
    }
  }

  /**
   * O turno do bot só é conduzido de dentro do handleEndTurn do humano —
   * se o processo reiniciar (deploy, crash) no meio desse laço, a partida
   * fica salva com o bot como jogador ativo pra sempre, sem ninguém mais
   * pra retomá-la (o humano não tem comando nenhum a rodar: não é a vez
   * dele). Rodado pelo mesmo timer periódico que já verifica prazo
   * expirado, então qualquer travamento assim se autocorrige em até
   * TIMEOUT_CHECK_INTERVAL_MS, sem precisar de intervenção manual.
   */
  async resumeStuckBotMatches(createTransport, defaultPrefix = '!') {
    let matches;
    try {
      matches = await this.game.tavern.repository.listActiveMatches(null);
    } catch (error) {
      console.warn('[TAVERN] Falha ao listar partidas pra checar travamento do bot:', error?.message || error);
      return;
    }
    for (const match of matches) {
      const state = match.state;
      if (state?.status !== 'ACTIVE' || state.turn?.activePlayerId !== TAVERN_BOT_PLAYER_ID) continue;
      const humanId = state.playerOrder.find(id => id !== TAVERN_BOT_PLAYER_ID);
      if (!humanId) continue;
      try {
        await this.runBotTurnIfNeeded({
          chatId: state.groupId,
          playerId: humanId,
          transport: createTransport(state.groupId),
          prefix: defaultPrefix
        });
      } catch (error) {
        console.warn('[TAVERN] Falha ao retomar turno travado do bot:', error?.message || error);
      }
    }
  }

  async announceMainPhaseStart(state, context) {
    if (!state.turn?.activePlayerId) return;
    await this.announceTurn(state, state.turn.activePlayerId, context);
  }

  async announceTurn(state, playerId, context) {
    if (playerId === TAVERN_BOT_PLAYER_ID) return;
    try {
      const player = state.players[playerId];
      const displayName = await context.transport.getDisplayName(playerId);
      const analysis = this.experienceAdvisor.analyze(state, playerId, { prefix: context.prefix });
      const buffer = await this.renderQueue.run(() => this.sceneRenderer.renderTurn({
        playerName: displayName,
        classId: player.classId,
        turnNumber: state.turn.number,
        deadlineLabel: deadlineLabel(analysis.secondsRemaining)
      }));
      await context.transport.sendPrivateImage(playerId, buffer, {
        caption: `🔥 Turno ${state.turn.number}. As ações disponíveis chegam a seguir.`
      });
    } catch (error) {
      console.warn('[TAVERN] Cena de turno indisponível:', error?.message || error);
    }
  }
}

export { TavernVNextRhythmController };
