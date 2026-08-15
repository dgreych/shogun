import { isTavernCommand } from './commands/index.js';
import { TavernVNextRhythmController } from './experience/TavernVNextRhythmController.js';
import { TavernGameService } from './TavernGameService.js';
import { TavernAssetRegistry } from './rendering/index.js';
import { BunnyFyBoardRenderer } from './rendering/BunnyFyBoardRenderer.js';
import { BunnyFyHandRenderer } from './rendering/BunnyFyHandRenderer.js';
import { BunnyFySceneRenderer } from './rendering/BunnyFySceneRenderer.js';
import { TavernService } from './TavernService.js';
import { WhatsAppTavernTransport } from './transport/index.js';

const TIMEOUT_CHECK_INTERVAL_MS = 15_000;

let runtimePromise = null;
let latestSocket = null;
let timeoutTimer = null;
let checkingTimeouts = false;

async function createTavernRuntime(options = {}) {
  const tavern = await TavernService.create(options);
  const game = new TavernGameService({
    tavern,
    now: options.now,
    idFactory: options.challengeIdFactory
  });
  const assets = new TavernAssetRegistry(options.assets);
  // Renderização de imagem é 100% JavaScript (Jimp, sem aceleração nativa)
  // e o host da Tavern tem muito menos CPU que o servidor da BunnyFy — os
  // três renderers tentam a BunnyFy primeiro e caem pro Jimp local
  // automaticamente (BUNNYFY_TAVERN_RENDER_MODE controla isso, mesmo
  // padrão on/off/primary/exclusive já usado nas outras capacidades).
  const boardRenderer = new BunnyFyBoardRenderer({ assets, now: options.now });
  const handRenderer = new BunnyFyHandRenderer({ assets });
  const sceneRenderer = new BunnyFySceneRenderer({ assets });
  const controller = new TavernVNextRhythmController({
    game,
    boardRenderer,
    handRenderer,
    sceneRenderer,
    rateLimiter: options.rateLimiter
  });
  return { tavern, game, assets, boardRenderer, handRenderer, sceneRenderer, controller };
}

function getTavernRuntime() {
  if (!runtimePromise) {
    runtimePromise = createTavernRuntime().catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

async function checkTimeouts(runtime) {
  if (checkingTimeouts || !latestSocket) return [];
  checkingTimeouts = true;
  try {
    const makeTransport = groupId => new WhatsAppTavernTransport({
      socket: latestSocket,
      chatId: groupId
    });
    // Retoma o bot ANTES de checar prazo expirado, de propósito: se o
    // turno do bot ficou preso, o prazo dele já está vencido há muito
    // tempo. Rodar processTimeouts primeiro faria o mecanismo de ausência
    // (pensado pra humano que não responde) devolver o turno pro humano
    // silenciosamente — e se ele não perceber a tempo, o timeout seguinte
    // pune ele por uma ausência que começou como bug do bot, não dele.
    if (typeof runtime.controller.resumeStuckBotMatches === 'function') {
      await runtime.controller.resumeStuckBotMatches(makeTransport);
    }
    const results = await runtime.controller.processTimeouts(makeTransport);
    return results;
  } catch (error) {
    console.error('[TAVERN] Falha ao processar prazos:', error?.message || error);
    return [];
  } finally {
    checkingTimeouts = false;
  }
}

function startTimeoutLoop(runtime) {
  if (timeoutTimer) return;
  timeoutTimer = setInterval(() => {
    void checkTimeouts(runtime);
  }, TIMEOUT_CHECK_INTERVAL_MS);
  timeoutTimer.unref?.();
  void checkTimeouts(runtime);
}

async function warmupTavernRuntime(socket) {
  if (socket) latestSocket = socket;
  const runtime = await getTavernRuntime();
  startTimeoutLoop(runtime);
  return runtime;
}

async function handleTavernCommand({ socket, info, ...context }) {
  const runtime = await warmupTavernRuntime(socket);
  const transport = new WhatsAppTavernTransport({
    socket,
    chatId: context.chatId,
    quoted: info
  });
  return runtime.controller.handle(context.command, { ...context, transport });
}

async function shouldHandleTavernCommand({ command, chatId, playerId, isGroup, messageId = null }) {
  if (!isTavernCommand(command)) return false;
  const normalized = String(command || '').toLowerCase();
  const conflicting = new Set(['duelo', 'aceitar', 'recusar', 'mao', 'jogar']);
  if (!conflicting.has(normalized)) return true;
  if (!isGroup) return false;

  const runtime = await getTavernRuntime();
  const group = await runtime.game.getGroup(chatId);
  if (!group?.enabled) return false;
  if (normalized === 'duelo') return true;
  if (normalized === 'aceitar' || normalized === 'recusar') {
    const pending = await runtime.game.getPendingChallenge(chatId, playerId);
    if (pending) return true;
    if (!messageId) return false;
    return Boolean(await runtime.tavern.repository.getChallengeByResponseMessageId(
      chatId,
      playerId,
      messageId
    ));
  }
  const activeMatch = await runtime.tavern.repository.findActiveMatchForPlayer(chatId, playerId);
  if (activeMatch) return true;
  if (normalized !== 'jogar' || !messageId) return false;
  return Boolean(await runtime.tavern.repository.findMatchEventForPlayerByMessageId(
    chatId,
    playerId,
    messageId
  ));
}

export {
  TIMEOUT_CHECK_INTERVAL_MS,
  createTavernRuntime,
  handleTavernCommand,
  isTavernCommand,
  shouldHandleTavernCommand,
  warmupTavernRuntime
};
