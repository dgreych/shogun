import { TAVERN_BOT_DISPLAY_NAME, TAVERN_BOT_PLAYER_ID, chooseMulliganDiscards } from '../domain/TavernBotPlayer.js';
import { TavernError, TavernRuleError, TavernValidationError } from '../errors.js';
import { TavernRenderQueue } from '../rendering/TavernRenderQueue.js';
import { TavernRateLimiter } from './TavernRateLimiter.js';

const TAVERN_COMMANDS = new Set([
  'tavern',
  'duelo',
  'aceitar',
  'recusar',
  'mao',
  'mão',
  'campo',
  'render',
  'renderizar',
  'partida',
  'mulligan',
  'jogar',
  'atacar',
  'poder',
  'fim',
  'desistir'
]);

const MODE_LABELS = Object.freeze({
  BLITZ: 'Blitz (60 s)',
  NORMAL: 'Normal (3 min)',
  ASYNC: 'Assíncrono (30 min)',
  CORRESPONDENCE: 'Correspondência (12 h)'
});

function isTavernCommand(command) {
  return TAVERN_COMMANDS.has(String(command || '').toLowerCase());
}

function mention(playerId) {
  return `@${String(playerId || '').split('@')[0]}`;
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function parseCardReference(value) {
  const text = String(value || '').trim();
  if (!text) throw new TavernValidationError('Informe o número ou ID da carta.');
  if (/^\d+$/.test(text)) return Number(text);
  return text.toUpperCase();
}

function findBoardCard(player, reference, label) {
  const text = String(reference || '').trim();
  if (!text) throw new TavernValidationError(`Informe ${label}.`);
  if (/^\d+$/.test(text)) {
    const card = player.board[Number(text) - 1];
    if (!card) throw new TavernRuleError(`${label} não encontrado no campo.`);
    return card;
  }
  const card = player.board.find(item => item.instanceId === text);
  if (!card) throw new TavernRuleError(`${label} não encontrado no campo.`);
  return card;
}

function resolveTarget(state, actorId, rawTarget) {
  if (!rawTarget) return null;
  const token = normalizeToken(rawTarget);
  const enemyId = state.playerOrder.find(playerId => playerId !== actorId);
  if (['hero', 'heroi', 'herói'].includes(token)) {
    return { kind: 'HERO', playerId: enemyId };
  }

  const friendly = token.match(/^(?:aliado|amigo):?(\d+)$/);
  const enemy = token.match(/^(?:inimigo|enemy):?(\d+)$/) || token.match(/^(\d+)$/);
  const targetPlayerId = friendly ? actorId : enemyId;
  const index = Number((friendly || enemy)?.[1]);
  if (!index) {
    throw new TavernValidationError('Alvo inválido. Use heroi, um número ou aliado:N.');
  }
  const minion = state.players[targetPlayerId].board[index - 1];
  if (!minion) throw new TavernRuleError('Alvo não encontrado no campo.');
  return { kind: 'MINION', playerId: targetPlayerId, instanceId: minion.instanceId };
}

function formatHandCaption(state, playerId, prefix) {
  const player = state.players[playerId];
  const lines = player.hand.map((card, index) => {
    const stats = card.type === 'MINION' ? ` — ${card.attack}/${card.health}` : '';
    const keywords = card.keywords?.length ? ` — ${card.keywords.join(', ')}` : '';
    return `${index + 1}. ${card.name} — ${card.cost} mana${stats}${keywords}`;
  });
  const instruction = state.phase === 'MULLIGAN'
    ? `Use ${prefix}mulligan 1 3 ou ${prefix}mulligan manter.`
    : `Use ${prefix}jogar <número> [alvo].`;
  return `Sua mão é privada.\nMana: ${player.mana.current}/${player.mana.max}\n\n${lines.join('\n')}\n\n${instruction}`;
}

function buildCommandReference(prefix) {
  return `📜 *COMANDOS DA GYOMEI TAVERN*\n\n` +
    `*Administração*\n` +
    `${prefix}tavern on|off|status\n` +
    `${prefix}tavern config\n` +
    `${prefix}tavern config turno <blitz|normal|assincrono|correspondencia>\n\n` +
    `*Duelo*\n` +
    `${prefix}duelo @usuario [modo]\n` +
    `${prefix}aceitar • ${prefix}recusar\n` +
    `${prefix}mao • ${prefix}mulligan <numeros|manter>\n` +
    `${prefix}campo • ${prefix}partida\n` +
    `${prefix}jogar <carta> [alvo]\n` +
    `${prefix}atacar <criatura> <alvo|heroi>\n` +
    `${prefix}poder [alvo] • ${prefix}fim • ${prefix}desistir\n\n` +
    `Use ${prefix}tavern tutorial para aprender a jogar.`;
}

function buildTutorial(prefix) {
  return `📚 *TUTORIAL DA GYOMEI TAVERN*\n\n` +
    `*1. Ativação*\n` +
    `Um administrador usa ${prefix}tavern on no grupo.\n\n` +
    `*2. Desafio*\n` +
    `Use ${prefix}duelo @usuario. A pessoa marcada responde ${prefix}aceitar ou ${prefix}recusar em até 5 minutos.\n\n` +
    `*3. Mão privada e mulligan*\n` +
    `Cada jogador recebe sua mão somente no privado. Para trocar cartas, use ${prefix}mulligan 1 3; para manter, use ${prefix}mulligan manter.\n\n` +
    `*4. Seu turno*\n` +
    `Veja a mesa com ${prefix}campo e recupere sua mão com ${prefix}mao. Jogue com ${prefix}jogar 2, ataque com ${prefix}atacar 1 heroi e use o poder com ${prefix}poder.\n\n` +
    `*5. Alvos*\n` +
    `Use heroi para o herói adversário, um número para criatura inimiga e aliado:N para sua criatura. Guarda precisa ser atacada primeiro.\n\n` +
    `*6. Encerramento*\n` +
    `Use ${prefix}fim para passar o turno ou ${prefix}desistir para abandonar a partida. Dois turnos consecutivos perdidos encerram o duelo por ausência.\n\n` +
    `🔒 A mão nunca é publicada no grupo. Se a entrega falhar, abra o privado do bot e tente ${prefix}mao novamente no grupo.\n\n` +
    `Use ${prefix}tavern comandos para consultar a lista completa.`;
}

class TavernCommandController {
  constructor({
    game,
    boardRenderer,
    handRenderer,
    rateLimiter = new TavernRateLimiter(),
    renderQueue = new TavernRenderQueue()
  }) {
    this.game = game;
    this.boardRenderer = boardRenderer;
    this.handRenderer = handRenderer;
    this.rateLimiter = rateLimiter;
    this.renderQueue = renderQueue;
  }

  async handle(command, context) {
    const normalizedCommand = String(command || '').toLowerCase();
    if (!isTavernCommand(normalizedCommand)) return false;
    const { transport, playerId, chatId, pushName } = context;
    try {
      this.rateLimiter.consume(`${chatId}:${playerId}`);
      // Registro do nome real acontecia só em !tavern estilo — qualquer
      // jogador que nunca passou por lá (classes avançadas legadas,
      // segundo jogador que só aceita duelo) continuava com o número de
      // telefone cru no lugar do nome nos renders. COALESCE no repositório
      // garante que isso nunca apaga um nome já salvo com um valor vazio.
      if (playerId) await this.game.tavern.repository.ensurePlayer(playerId, pushName ?? null);
      if (!context.isGroup) {
        await transport.sendCurrentText('A Gyomei Tavern é controlada pela mesa do grupo. Use este comando no grupo da partida.');
        return true;
      }
      if (normalizedCommand !== 'tavern') {
        await this.game.assertGroupEnabled(context.chatId);
      }

      switch (normalizedCommand) {
        case 'tavern':
          await this.handleTavern(context);
          break;
        case 'duelo':
          await this.handleDuel(context);
          break;
        case 'aceitar':
          await this.handleAccept(context);
          break;
        case 'recusar':
          await this.handleDecline(context);
          break;
        case 'mao':
        case 'mão':
          await this.sendHandForCurrentMatch(context);
          break;
        case 'campo':
        case 'render':
        case 'partida':
          await this.sendCurrentBoard(context);
          break;
        case 'renderizar':
          if (!context.isAdmin) throw new TavernRuleError('Somente administradores podem forçar uma renderização.');
          await this.sendCurrentBoard(context);
          break;
        case 'mulligan':
          await this.handleMulligan(context);
          break;
        case 'jogar':
          await this.handlePlay(context);
          break;
        case 'atacar':
          await this.handleAttack(context);
          break;
        case 'poder':
          await this.handleHeroPower(context);
          break;
        case 'fim':
          await this.handleEndTurn(context);
          break;
        case 'desistir':
          await this.handleConcede(context);
          break;
        default:
          return false;
      }
      return true;
    } catch (error) {
      if (error instanceof TavernError) {
        await this.reportTavernError(error, context);
        return true;
      }
      console.error('[TAVERN] Falha ao processar comando:', error?.message || error);
      await transport.sendCurrentText('❌ A Taverna encontrou um erro inesperado. Tente novamente em instantes.');
      return true;
    }
  }

  async reportTavernError(error, context) {
    await context.transport.sendCurrentText(`⚠️ ${error.message}`);
  }

  async handleTavern(context) {
    const { args, chatId, isAdmin, prefix, transport } = context;
    const operation = normalizeToken(args[0] || 'status');
    if (operation === 'on' || operation === 'off') {
      if (!isAdmin) throw new TavernRuleError('Somente administradores podem ativar ou desativar a Taverna.');
      if (operation === 'off') {
        const activeMatches = await this.game.tavern.repository.listActiveMatches(chatId);
        if (activeMatches.length) {
          throw new TavernRuleError('Há uma partida ativa. Finalize ou encerre o duelo antes de desativar a Taverna.');
        }
      }
      const group = await this.game.setGroupEnabled(chatId, operation === 'on');
      await transport.sendGroupText(
        group.enabled
          ? `🍺 *Gyomei Tavern ativada neste grupo.*\n\nDesafie alguém com ${prefix}duelo @usuario.`
          : '🔒 *Gyomei Tavern desativada neste grupo.*\nColeções e histórico foram preservados.'
      );
      return;
    }

    if (operation === 'config') {
      const section = normalizeToken(args[1]);
      if (section === 'turno' && args[2]) {
        if (!isAdmin) throw new TavernRuleError('Somente administradores podem alterar a configuração da Taverna.');
        const group = await this.game.setTurnMode(chatId, args[2]);
        const turnMode = group.settings?.turnMode || this.game.tavern.config.defaults.turnMode;
        await transport.sendGroupText(`⚙️ Modo padrão atualizado para *${MODE_LABELS[turnMode]}*.`);
        return;
      }
      const group = await this.game.getGroup(chatId);
      const turnMode = group?.settings?.turnMode || this.game.tavern.config.defaults.turnMode;
      await transport.sendGroupText(
        `⚙️ *Configuração da Taverna*\n\n` +
        `Estado: ${group?.enabled ? 'ativa' : 'desativada'}\n` +
        `Turno padrão: ${MODE_LABELS[turnMode]}\n\n` +
        `Para alterar: ${prefix}tavern config turno <blitz|normal|assincrono|correspondencia>`
      );
      return;
    }

    if (operation === 'tutorial') {
      await transport.sendGroupText(buildTutorial(prefix));
      return;
    }

    if (['comandos', 'commands', 'ajuda', 'help'].includes(operation)) {
      await transport.sendGroupText(buildCommandReference(prefix));
      return;
    }

    if (operation !== 'status') {
      throw new TavernValidationError(`Uso: ${prefix}tavern <on|off|status|config|tutorial|comandos>`);
    }
    const group = await this.game.getGroup(chatId);
    const activeMatches = await this.game.tavern.repository.listActiveMatches(chatId);
    const turnMode = group?.settings?.turnMode || this.game.tavern.config.defaults.turnMode;
    await transport.sendGroupText(
      `🍺 *GYOMEI TAVERN*\n\n` +
      `Estado: ${group?.enabled ? 'ativa' : 'desativada'}\n` +
      `Nível da Taverna: ${group?.tavernLevel || 1}\n` +
      `Partidas ativas: ${activeMatches.length}\n` +
      `Turno padrão: ${MODE_LABELS[turnMode]}\n\n` +
      `${prefix}duelo @usuario [modo]\n` +
      `${prefix}aceitar ou ${prefix}recusar\n` +
      `${prefix}mao • ${prefix}campo • ${prefix}partida`
    );
  }

  async handleDuel(context) {
    const { chatId, playerId, pushName, mentionedJids, args, transport } = context;
    // "bot" digitado ou @ no contato real do bot do WhatsApp são a mesma
    // intenção — @mencionar quem está na sua frente é o jeito mais óbvio
    // de "desafiar o bot" numa conversa, então os dois caminhos precisam
    // cair no mesmo lugar em vez de um deles esbarrar num erro confuso.
    const wantsBotDuel = (!mentionedJids?.length && normalizeToken(args[0]) === 'bot')
      || (context.botId && mentionedJids?.[0] === context.botId);
    if (wantsBotDuel) {
      return this.handleBotDuel(context);
    }
    const challengedId = mentionedJids?.[0];
    if (!challengedId) {
      throw new TavernValidationError(`Marque uma pessoa ou use "bot" pra treinar contra a máquina. Exemplo: ${context.prefix}duelo @usuario normal`);
    }
    if (challengedId === playerId) throw new TavernRuleError('Você não pode desafiar a si mesmo.');
    const challengedName = await transport.getDisplayName(challengedId);
    const modeArgument = args.find(argument => !String(argument).startsWith('@')) || null;
    const challenge = await this.game.createChallenge({
      groupId: chatId,
      challengerId: playerId,
      challengedId,
      challengerName: pushName || await transport.getDisplayName(playerId),
      challengedName,
      mode: modeArgument
    });
    await this.announceChallenge(challenge, context);
  }

  async announceChallenge(challenge, context) {
    const { playerId, transport } = context;
    await transport.sendGroupText(
      `⚔️ ${mention(playerId)} desafiou ${mention(challenge.challengedId)}!\n` +
      `Modo: *${MODE_LABELS[challenge.mode]}*\n` +
      `O convite expira em 5 minutos.\n\n` +
      `${mention(challenge.challengedId)}, use ${context.prefix}aceitar ou ${context.prefix}recusar.`,
      { mentions: [playerId, challenge.challengedId] }
    );
  }

  /**
   * Contra o bot não existe um segundo humano pra confirmar — a partida
   * começa na hora. O mulligan do bot é submetido aqui mesmo, antes de
   * qualquer narração, pra quando o jogador ver a mensagem a mesa já
   * estar pronta (sem um "aguardando o bot" artificial no meio do fluxo).
   */
  async handleBotDuel(context) {
    const { chatId, playerId, transport } = context;
    const created = await this.game.createBotMatch({ groupId: chatId, playerId });
    const botHand = created.players[TAVERN_BOT_PLAYER_ID].hand;
    await this.game.dispatchForPlayer(chatId, TAVERN_BOT_PLAYER_ID, {
      type: 'MULLIGAN',
      cards: chooseMulliganDiscards(botHand)
    });
    const refreshed = await this.game.getActiveMatch(chatId, playerId);
    const state = refreshed.state;
    await Promise.all([
      this.announceState(state, transport, {
        intro: `⚔️ ${mention(playerId)} entrou em treino contra o *${TAVERN_BOT_DISPLAY_NAME}*!`,
        mentions: [playerId],
        prefix: context.prefix
      }),
      (async () => {
        await this.announceMulligan(state, playerId, context);
        await this.sendPrivateHand(state, playerId, transport, context.prefix);
      })()
    ]);
  }

  async handleAccept(context) {
    const accepted = await this.game.acceptChallenge(
      context.chatId,
      context.playerId,
      context.messageId
    );
    if (accepted.duplicate) {
      await context.transport.sendCurrentText('Este aceite já foi processado.');
      return;
    }
    const state = accepted.match;
    // As imagens do board público e das mãos privadas de cada jogador são
    // independentes entre si (canais diferentes, mesmo estado só de
    // leitura) — rodar em paralelo evita empilhar o custo de renderização
    // de cada imagem uma atrás da outra.
    await Promise.all([
      this.announceState(state, context.transport, {
        intro: `⚔️ Duelo aceito por ${mention(context.playerId)}. As mãos foram enviadas no privado.`,
        mentions: [...state.playerOrder],
        prefix: context.prefix
      }),
      ...state.playerOrder.map(async playerId => {
        await this.announceMulligan(state, playerId, context);
        await this.sendPrivateHand(state, playerId, context.transport, context.prefix);
      })
    ]);
  }

  async announceMulligan() {
    // Sem peça cerimonial no controlador legado; a mão privada já basta.
  }

  async announceMainPhaseStart() {
    // Sem peça cerimonial no controlador legado; a mão privada já basta.
  }

  async handleDecline(context) {
    const challenge = await this.game.declineChallenge(
      context.chatId,
      context.playerId,
      context.messageId
    );
    if (challenge.duplicate) {
      await context.transport.sendCurrentText('Esta recusa já foi processada.');
      return;
    }
    await context.transport.sendGroupText(
      `${mention(context.playerId)} recusou o duelo de ${mention(challenge.challengerId)}.`,
      { mentions: [context.playerId, challenge.challengerId] }
    );
  }

  async sendHandForCurrentMatch(context) {
    await this.game.assertGroupEnabled(context.chatId);
    const match = await this.game.getActiveMatch(context.chatId, context.playerId);
    await this.sendPrivateHand(match.state, context.playerId, context.transport, context.prefix, {
      confirmDelivery: true
    });
  }

  async sendPrivateHand(state, playerId, transport, prefix, { confirmDelivery = false } = {}) {
    try {
      const buffer = await this.renderQueue.run(() => this.handRenderer.render(state, playerId));
      await transport.sendPrivateImage(playerId, buffer, {
        caption: formatHandCaption(state, playerId, prefix)
      });
      if (confirmDelivery) {
        await transport.sendGroupText(`📬 Mão enviada no privado para ${mention(playerId)}.`, {
          mentions: [playerId]
        });
      }
      return true;
    } catch (error) {
      console.warn('[TAVERN] Não foi possível enviar a mão no privado:', error?.message || error);
      await transport.sendGroupText(
        `⚠️ Não consegui enviar a mão no privado para ${mention(playerId)}. Abra uma conversa com o bot e tente ${prefix}mao novamente no grupo.`,
        { mentions: [playerId] }
      );
      return false;
    }
  }

  async sendCurrentBoard(context) {
    await this.game.assertGroupEnabled(context.chatId);
    const match = await this.game.getActiveMatch(context.chatId, context.playerId);
    await this.announceState(match.state, context.transport, { prefix: context.prefix });
  }

  async handleMulligan(context) {
    const tokens = context.args.flatMap(argument => String(argument).split(',')).filter(Boolean);
    const references = tokens.length === 0 || ['manter', 'keep'].includes(normalizeToken(tokens[0]))
      ? []
      : tokens.map(token => {
        if (!/^\d+$/.test(token)) throw new TavernValidationError('Use apenas os números das cartas no mulligan.');
        return Number(token);
      });
    const result = await this.game.dispatchForPlayer(
      context.chatId,
      context.playerId,
      { type: 'MULLIGAN', cards: references },
      { messageId: context.messageId }
    );
    if (result.duplicate) return context.transport.sendCurrentText('Esta ação já foi processada.');
    const handTask = this.sendPrivateHand(result.state, context.playerId, context.transport, context.prefix);
    if (result.state.phase === 'MAIN') {
      // Mão do jogador que confirmou, board público e cena de turno vão a
      // canais diferentes e não dependem uma da outra — renderizam em
      // paralelo em vez de empilhar o custo de cada imagem.
      await Promise.all([
        handTask,
        this.announceState(result.state, context.transport, {
          intro: '✅ Preparação concluída. A partida começou.',
          prefix: context.prefix
        }),
        this.announceMainPhaseStart(result.state, context)
      ]);
    } else {
      await handTask;
      await context.transport.sendGroupText(`${mention(context.playerId)} confirmou a preparação.`, {
        mentions: [context.playerId]
      });
    }
  }

  async handlePlay(context) {
    const match = await this.game.getActiveMatch(context.chatId, context.playerId);
    const action = {
      type: 'PLAY_CARD',
      card: parseCardReference(context.args[0]),
      target: resolveTarget(match.state, context.playerId, context.args[1])
    };
    const result = await this.game.dispatchForPlayer(context.chatId, context.playerId, action, {
      messageId: context.messageId
    });
    await this.afterAction(result, context, { privateHands: [context.playerId] });
  }

  async handleAttack(context) {
    const match = await this.game.getActiveMatch(context.chatId, context.playerId);
    const player = match.state.players[context.playerId];
    const source = findBoardCard(player, context.args[0], 'a criatura atacante');
    const target = resolveTarget(match.state, context.playerId, context.args[1]);
    if (!target) throw new TavernValidationError(`Uso: ${context.prefix}atacar <origem> <alvo|heroi>`);
    const result = await this.game.dispatchForPlayer(context.chatId, context.playerId, {
      type: 'ATTACK',
      source: source.instanceId,
      target
    }, { messageId: context.messageId });
    await this.afterAction(result, context);
  }

  async handleHeroPower(context) {
    const match = await this.game.getActiveMatch(context.chatId, context.playerId);
    const result = await this.game.dispatchForPlayer(context.chatId, context.playerId, {
      type: 'HERO_POWER',
      target: resolveTarget(match.state, context.playerId, context.args[0])
    }, { messageId: context.messageId });
    await this.afterAction(result, context);
  }

  async handleEndTurn(context) {
    const result = await this.game.dispatchForPlayer(context.chatId, context.playerId, {
      type: 'END_TURN'
    }, { messageId: context.messageId });
    const nextPlayerId = result.state.status === 'ACTIVE' ? result.state.turn.activePlayerId : null;
    await this.afterAction(result, context, {
      privateHands: nextPlayerId ? [nextPlayerId] : []
    });
  }

  async handleConcede(context) {
    const result = await this.game.dispatchForPlayer(context.chatId, context.playerId, {
      type: 'CONCEDE'
    }, { messageId: context.messageId });
    await this.afterAction(result, context);
  }

  async afterAction(result, context, { privateHands = [] } = {}) {
    if (result.duplicate) {
      await context.transport.sendCurrentText('Esta ação já foi processada.');
      return;
    }
    await this.announceState(result.state, context.transport);
    if (result.state.status === 'ACTIVE') {
      for (const playerId of [...new Set(privateHands)]) {
        await this.sendPrivateHand(result.state, playerId, context.transport, context.prefix);
      }
    }
  }

  async announceState(state, transport, { intro = '', mentions = [] } = {}) {
    const playerNames = await this.game.getPlayerNames(state);
    let caption = intro ? `${intro}\n\n` : '';
    const captionMentions = new Set(mentions);
    if (state.status === 'FINISHED') {
      if (state.winnerId) {
        caption += `🏆 Vitória de ${mention(state.winnerId)} — motivo: ${state.finishReason}.`;
        captionMentions.add(state.winnerId);
      } else {
        caption += `🤝 A partida terminou empatada — motivo: ${state.finishReason}.`;
      }
    } else if (state.phase === 'MULLIGAN') {
      const ready = state.playerOrder.filter(playerId => state.mulligan.responses[playerId]?.done).length;
      caption += `Preparação: ${ready}/2 jogadores confirmaram o mulligan.`;
    } else {
      caption += `Turno de ${mention(state.turn.activePlayerId)}. Use os números mostrados no campo para agir.`;
      captionMentions.add(state.turn.activePlayerId);
    }

    try {
      const buffer = await this.renderQueue.run(() => this.boardRenderer.render(state, { playerNames }));
      await transport.sendGroupImage(buffer, {
        caption,
        mentions: [...captionMentions]
      });
    } catch (error) {
      console.warn('[TAVERN] Falha ao renderizar campo:', error?.message || error);
      await transport.sendGroupText(caption, { mentions: [...captionMentions] });
    }
  }

  async processTimeouts(createTransport, defaultPrefix = '!') {
    const results = await this.game.processExpiredMatches();
    for (const result of results) {
      if (result.duplicate) continue;
      const absentPlayerId = result.previousState.turn.activePlayerId;
      const intro = result.previousState.phase === 'MULLIGAN'
        ? '⏳ O tempo de preparação terminou. As cartas foram mantidas e a partida começou.'
        : result.state.status === 'FINISHED'
        ? `${mention(absentPlayerId)} perdeu por duas ausências consecutivas.`
        : `⏳ O turno de ${mention(absentPlayerId)} expirou e foi passado automaticamente.`;
      await this.announceState(result.state, createTransport(result.groupId), {
        intro,
        mentions: [absentPlayerId],
        prefix: defaultPrefix
      });
    }
    return results;
  }
}

export { MODE_LABELS, TAVERN_COMMANDS, TavernCommandController, isTavernCommand };
