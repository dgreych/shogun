import { MODE_LABELS, TavernCommandController } from '../commands/TavernCommandController.js';
import { TAVERN_BOT_PLAYER_ID } from '../domain/TavernBotPlayer.js';
import { TavernValidationError } from '../errors.js';
import { VNextSceneRenderer } from '../rendering/VNextSceneRenderer.js';
import { classVisual } from '../rendering/VNextVisualTheme.js';
import { DEFAULT_CLASS_ID } from '../TavernGameService.js';
import { TavernExperienceAdvisor } from './TavernExperienceAdvisor.js';

const INTRO_ARCHETYPES = Object.freeze({
  bastiao: 'GUARDIAN',
  cacada: 'EXILE',
  arcano: 'STORM'
});

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

function deadlineLabel(seconds) {
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} h`;
}

function compactActions(analysis, limit = 4) {
  return analysis.nextActions
    .filter(action => action.command)
    .slice(0, limit)
    .map(action => `• ${action.command} — ${action.label}`);
}

function privateHandFallback(state, playerId) {
  const player = state.players[playerId];
  return player.hand.map((card, index) => {
    const stats = card.type === 'MINION' ? ` · ${card.attack}/${card.health}` : '';
    return `${index + 1}. ${card.name} · ${card.cost} mana${stats}`;
  });
}

class TavernVNextCommandController extends TavernCommandController {
  constructor(options) {
    super(options);
    const game = options.game;
    this.experienceAdvisor = options.experienceAdvisor || new TavernExperienceAdvisor({
      heroRegistry: game?.tavern?.heroRegistry,
      now: game?.now || (() => Date.now()),
      limits: game?.tavern?.config?.limits
    });
    this.sceneRenderer = options.sceneRenderer || new VNextSceneRenderer();
  }

  async playerClassId(playerId) {
    const player = await this.game.tavern.repository.getPlayer(playerId);
    return player?.activeClassId || DEFAULT_CLASS_ID;
  }

  async handleTavern(context) {
    const operation = normalizeToken(context.args?.[0] || 'inicio');

    if (['on', 'off', 'config', 'comandos', 'commands'].includes(operation)) {
      return super.handleTavern(context);
    }

    if (operation === 'tutorial') {
      return this.sendVNextTutorial(context);
    }

    if (operation === 'estilo') {
      return this.handleStyleSelection(context);
    }

    if (['inicio', 'home', 'status', 'ajuda', 'help'].includes(operation)) {
      return this.sendTavernHome(context);
    }

    return super.handleTavern(context);
  }

  buildStyleMenu(prefix) {
    const lines = ['🎭 *ESCOLHA SEU ESTILO*', 'Isso define suas cartas próprias no baralho inicial.', ''];
    for (const [token, classId] of Object.entries(INTRO_ARCHETYPES)) {
      const visual = classVisual(classId);
      lines.push(`• ${prefix}tavern estilo ${token} — ${visual.archetype} (${visual.label})`);
    }
    lines.push('', 'Oráculo, Xamã e Profano continuam disponíveis como classes avançadas em breve.');
    return lines.join('\n');
  }

  async handleStyleSelection(context) {
    const { args, playerId, prefix, transport, pushName } = context;
    const token = normalizeToken(args?.[1]);
    if (!token) {
      await transport.sendGroupText(this.buildStyleMenu(prefix));
      return;
    }
    const classId = INTRO_ARCHETYPES[token];
    if (!classId) {
      throw new TavernValidationError(
        `Estilo desconhecido. Use ${prefix}tavern estilo bastiao, ${prefix}tavern estilo cacada ou ${prefix}tavern estilo arcano.`
      );
    }
    await this.game.tavern.repository.ensurePlayer(playerId, pushName);
    await this.game.tavern.repository.setPlayerClass(playerId, classId);
    const visual = classVisual(classId);
    await transport.sendGroupText(
      `✅ ${mention(playerId)} escolheu o estilo *${visual.archetype}* (${visual.label}).\n\n` +
      `Isso já vale para o próximo duelo. Use ${prefix}duelo @usuario quando quiser desafiar alguém.`,
      { mentions: [playerId] }
    );
  }

  async sendTavernHome(context) {
    const { chatId, playerId, prefix, transport, isAdmin } = context;
    const group = await this.game.getGroup(chatId);

    if (!group?.enabled) {
      const lines = [
        '🍺 *GYOMEI TAVERN*',
        'Uma mesa de duelo por cartas feita para acontecer dentro do grupo.',
        '',
        'A mesa ainda está fechada neste grupo.'
      ];
      if (isAdmin) lines.push(`• ${prefix}tavern on — abrir a mesa`);
      else lines.push('Peça a um administrador para abrir a mesa quando o grupo quiser jogar.');
      lines.push(`• ${prefix}tavern tutorial — entender o jogo em menos de um minuto`);
      await transport.sendGroupText(lines.join('\n'));
      return;
    }

    const activeMatch = await this.game.tavern.repository.findActiveMatchForPlayer(chatId, playerId);
    if (activeMatch) {
      const state = activeMatch.state;
      const analysis = this.experienceAdvisor.analyze(state, playerId, { prefix });
      const lines = ['🍺 *SUA MESA NA TAVERN*', ''];

      if (state.phase === 'MULLIGAN') {
        lines.push(
          analysis.mulligan?.alreadyConfirmed
            ? '✅ Sua abertura está confirmada. Aguarde a preparação do adversário.'
            : '🃏 A partida está na preparação. Sua mão e as decisões estão no privado.',
          `• ${prefix}mao — reenviar sua mão privada`
        );
      } else if (analysis.isActivePlayer) {
        const deadline = deadlineLabel(analysis.secondsRemaining);
        lines.push(
          `🔥 *É sua vez*${deadline ? ` · ${deadline} restantes` : ''}.`,
          'Sua mão privada mostra somente as jogadas que fazem sentido agora.',
          `• ${prefix}mao — atualizar suas opções`,
          `• ${prefix}campo — rever a mesa`
        );
      } else {
        lines.push(
          `⏳ Turno de ${mention(state.turn.activePlayerId)}.`,
          `• ${prefix}campo — rever a mesa`,
          `• ${prefix}mao — consultar sua mão sem expor cartas no grupo`
        );
      }

      await transport.sendGroupText(lines.join('\n'), {
        mentions: state.turn?.activePlayerId ? [state.turn.activePlayerId] : []
      });
      return;
    }

    const challenge = await this.game.getPendingChallenge(chatId, playerId);
    if (challenge) {
      await transport.sendGroupText(
        `⚔️ *Você tem um desafio pendente.*\n\n` +
        `${mention(challenge.challengerId)} chamou você para a mesa.\n` +
        `• ${prefix}aceitar — começar\n` +
        `• ${prefix}recusar — encerrar o convite`,
        { mentions: [challenge.challengerId, playerId] }
      );
      return;
    }

    const turnMode = group.settings?.turnMode || this.game.tavern.config.defaults.turnMode;
    const player = await this.game.tavern.repository.getPlayer(playerId);
    if (!player?.activeClassId) {
      await transport.sendGroupText(
        `🍺 *GYOMEI TAVERN — MESA LIVRE*\n\n` +
        `⚔️ *${prefix}duelo bot* te bota numa partida agora, sozinho, sem precisar de mais ninguém no grupo.\n\n` +
        `Quando quiser fixar suas cartas próprias (não é obrigatório pra jogar):\n\n` +
        this.buildStyleMenu(prefix) +
        `\n\nPrefere desafiar uma pessoa? ${prefix}duelo @usuario`
      );
      return;
    }

    const visual = classVisual(player.activeClassId);
    await transport.sendGroupText(
      `🍺 *GYOMEI TAVERN — MESA LIVRE*\n\n` +
      `Não há duelo seu em andamento. Seu estilo: *${visual.archetype}* (${visual.label}). Modo padrão: *${turnMode.toLowerCase()}*.\n\n` +
      `🤖 ${prefix}duelo bot — treinar agora, sozinho\n` +
      `⚔️ ${prefix}duelo @usuario — desafiar uma pessoa\n` +
      `🎭 ${prefix}tavern estilo — trocar de estilo\n` +
      `📚 ${prefix}tavern tutorial — aprender enquanto joga\n\n` +
      `Você não precisa decorar a lista de comandos: durante a partida, sua mão privada mostra as opções válidas.`
    );
  }

  async sendVNextTutorial(context) {
    const { prefix, transport } = context;
    await transport.sendGroupText(
      `📖 *TAVERN EM 60 SEGUNDOS*\n\n` +
      `*Objetivo*\n` +
      `Leve a vida do herói adversário de 30 a 0 antes que ele faça o mesmo com você.\n\n` +
      `*1 · Entre na mesa*\n` +
      `${prefix}duelo bot te bota numa partida na hora, sozinho — melhor jeito de ver o jogo funcionando agora mesmo. Pra desafiar uma pessoa: ${prefix}duelo @usuario, e ela usa ${prefix}aceitar.\n\n` +
      `*2 · Sua mão é secreta*\n` +
      `As cartas chegam no privado. No começo, você só escolhe se mantém a abertura ou troca algumas cartas.\n\n` +
      `*3 · No seu turno*\n` +
      `Você recebe mana. A mão destaca o que pode ser jogado e a mensagem privada sugere comandos válidos para aquele estado.\n\n` +
      `*4 · Ganhe espaço e pressione*\n` +
      `Criaturas atacam quando estão prontas. Guarda protege os outros alvos. Poderes de herói oferecem uma opção extra por turno.\n\n` +
      `*5 · Quando terminar*\n` +
      `${prefix}fim entrega o turno.\n\n` +
      `Você pode aprender o restante durante a partida. Use ${prefix}tavern comandos apenas quando quiser a referência completa.`
    );
  }

  buildPrivateHandCaption(state, playerId, prefix) {
    const player = state.players[playerId];
    const analysis = this.experienceAdvisor.analyze(state, playerId, { prefix });
    const lines = [
      '🕯️ *SUA MÃO — GYOMEI TAVERN*',
      `Mana: *${player.mana.current}/${player.mana.max}* · Cartas: *${player.hand.length}*`
    ];
    const deadline = deadlineLabel(analysis.secondsRemaining);
    if (deadline) lines.push(`Prazo atual: *${deadline}*`);
    lines.push('');

    if (analysis.phase === 'MULLIGAN') {
      if (analysis.mulligan?.alreadyConfirmed) {
        lines.push('✅ Sua preparação está confirmada. Aguarde o adversário.');
      } else {
        lines.push('Escolha sua abertura. Você não precisa decorar nenhuma regra agora:');
        lines.push(`• ${prefix}mulligan manter — ficar com esta mão`);
        if (analysis.mulligan?.exchangeable?.length) {
          lines.push(`• ${prefix}mulligan 1 3 — trocar as cartas marcadas`);
        }
        lines.push('As cartas escolhidas voltam ao deck e são substituídas.');
      }
      return lines.join('\n');
    }

    if (!analysis.isActivePlayer) {
      lines.push('⏳ Ainda não é sua vez. A mesa pública mostra o andamento da partida.');
      lines.push(`Use ${prefix}campo se precisar atualizar o estado.`);
      return lines.join('\n');
    }

    lines.push(`🔥 *Sua vez.* ${analysis.summary}`);
    const actions = compactActions(analysis);
    if (actions.length) {
      lines.push('', '*Você pode fazer agora:*', ...actions);
    }
    lines.push('', 'Dica: o número da carta está na própria mão. O jogo só sugere ações compatíveis com o estado atual.');
    return lines.join('\n');
  }

  async sendPrivateHand(state, playerId, transport, prefix, { confirmDelivery = false } = {}) {
    // O bot não tem pra onde entregar nada no privado — sair antes de
    // renderizar evita gastar o custo de imagem numa mão que sempre seria
    // descartada (o transporte já bloqueia o envio, mas isso sozinho não
    // evita o render em si).
    if (playerId === TAVERN_BOT_PLAYER_ID) return true;
    const caption = this.buildPrivateHandCaption(state, playerId, prefix);
    let pages = [];
    try {
      pages = await this.renderPrivateHandPages(state, playerId);
    } catch (error) {
      console.warn('[TAVERN] Render privado indisponível; usando fallback textual:', error?.message || error);
    }

    try {
      if (pages.length) {
        for (let index = 0; index < pages.length; index += 1) {
          await transport.sendPrivateImage(playerId, pages[index], {
            caption: this.handPageCaption(caption, index + 1, pages.length)
          });
        }
      } else {
        const cards = privateHandFallback(state, playerId);
        await transport.sendPrivateText(playerId, `${caption}\n\n*Cartas:*\n${cards.join('\n')}`);
      }
      if (confirmDelivery) {
        await transport.sendGroupText(`📬 Orientação de jogo enviada no privado para ${mention(playerId)}.`, {
          mentions: [playerId]
        });
      }
      return true;
    } catch (error) {
      console.warn('[TAVERN] Não foi possível entregar a mão no privado:', error?.message || error);
      await transport.sendGroupText(
        `⚠️ Não consegui entregar sua mão privada para ${mention(playerId)}. Abra uma conversa com o bot e tente ${prefix}mao novamente no grupo.`,
        { mentions: [playerId] }
      );
      return false;
    }
  }

  async announceChallenge(challenge, context) {
    await super.announceChallenge(challenge, context);
    const { playerId, transport } = context;
    try {
      const [challengerClassId, challengedClassId, challengerName, challengedName] = await Promise.all([
        this.playerClassId(playerId),
        this.playerClassId(challenge.challengedId),
        context.pushName ? Promise.resolve(context.pushName) : transport.getDisplayName(playerId),
        transport.getDisplayName(challenge.challengedId)
      ]);
      const minutesLeft = Math.max(1, Math.round(
        (Date.parse(challenge.expiresAt) - this.game.now()) / 60000
      ));
      const buffer = await this.renderQueue.run(() => this.sceneRenderer.renderInvite({
        challengerName,
        challengedName,
        challengerClassId,
        challengedClassId,
        modeLabel: MODE_LABELS[challenge.mode] || challenge.mode,
        expiresLabel: `${minutesLeft} MIN`
      }));
      await transport.sendGroupImage(buffer, {
        caption: `${mention(playerId)} desafiou ${mention(challenge.challengedId)}.`,
        mentions: [playerId, challenge.challengedId]
      });
    } catch (error) {
      console.warn('[TAVERN] Cena de convite indisponível:', error?.message || error);
    }
  }

  async reportTavernError(error, context) {
    await super.reportTavernError(error, context);
    await this.sendErrorGuidance(context);
  }

  async sendErrorGuidance(context) {
    try {
      const match = await this.game.tavern.repository.findActiveMatchForPlayer(context.chatId, context.playerId);
      if (!match) return;
      const analysis = this.experienceAdvisor.analyze(match.state, context.playerId, { prefix: context.prefix });
      if (!analysis.isActivePlayer) return;
      const actions = compactActions(analysis, 3);
      if (!actions.length) return;
      await context.transport.sendPrivateText(
        context.playerId,
        ['🧭 *Pra te ajudar agora:*', ...actions].join('\n')
      );
    } catch (error) {
      console.warn('[TAVERN] Orientação de erro indisponível:', error?.message || error);
    }
  }

  async announceMulligan(state, playerId, context) {
    if (playerId === TAVERN_BOT_PLAYER_ID) return;
    const { transport } = context;
    try {
      const player = state.players[playerId];
      const displayName = await transport.getDisplayName(playerId);
      const buffer = await this.renderQueue.run(() => this.sceneRenderer.renderMulligan({
        playerName: displayName,
        classId: player.classId,
        handSize: player.hand.length
      }));
      await transport.sendPrivateImage(playerId, buffer, {
        caption: '🃏 Sua abertura chegou. A mão real está logo abaixo, no privado.'
      });
    } catch (error) {
      console.warn('[TAVERN] Cena de mulligan indisponível:', error?.message || error);
    }
  }
}

export {
  TavernVNextCommandController,
  compactActions,
  deadlineLabel,
  privateHandFallback
};
