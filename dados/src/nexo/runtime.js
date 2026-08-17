import { NexoSqliteStore } from './persistence/NexoSqliteStore.js';
import { NexoRepository } from './persistence/NexoRepository.js';
import { IdentityService } from './identity/IdentityService.js';
import { normalizeIncomingMessage } from './transport/normalizeIncomingMessage.js';
import { NexoWhatsAppTransport } from './transport/NexoWhatsAppTransport.js';
import { createCommandContext } from './domain/messageContracts.js';
import { createOnboardingContentProvider } from './domain/onboardingContentAdapter.js';
import { handleNexoAction, isNexoCommand } from './commands/NexoCommandController.js';
import {
  handleNexoNumericReply,
  handleNexoPlayerAction,
  isNexoPlayerCommand
} from './commands/NexoPlayerCommandController.js';
import { renderNexoViewModel } from './rendering/renderNexoViewModel.js';
import { renderCharacterImage, renderCircleImage } from './rendering/nexoImageRenderer.js';

let runtimePromise = null;

async function createNexoRuntime(options = {}) {
  const store = await NexoSqliteStore.open(options.storeOptions);
  const repository = new NexoRepository(store);
  const identityService = new IdentityService(repository);
  const contentProvider = createOnboardingContentProvider();
  return { store, repository, identityService, contentProvider };
}

function getNexoRuntime() {
  if (!runtimePromise) {
    runtimePromise = createNexoRuntime().catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

async function warmupNexoRuntime() {
  return getNexoRuntime();
}

function shouldHandleNexoCommand(command) {
  return isNexoCommand(command);
}

function shouldHandleNexoPlayerCommand(command) {
  return isNexoPlayerCommand(command);
}

/**
 * Só intercepta um número puro quando já existe uma pendingInteraction
 * ativa do NEXO para esse remetente+chat -- fora disso, `command` numérico
 * segue intocado para o resto do bot (outros menus também usam "responda
 * 1/2/3").
 */
async function shouldHandleNexoNumericReply({ command, chatId, senderAddress }) {
  if (!/^\d+$/.test(String(command || '').trim())) return false;
  if (!senderAddress) return false;
  const runtime = await getNexoRuntime();
  const canonicalUserId = await runtime.identityService.resolveExistingUserId(senderAddress).catch(() => null);
  if (!canonicalUserId) return false;
  const pending = await runtime.repository.findActivePendingInteraction(canonicalUserId, chatId);
  return Boolean(pending);
}

async function buildContextAndTransport({ socket, raw, runtime, actorExtras = {} }) {
  const incoming = await normalizeIncomingMessage({ raw, identityService: runtime.identityService });
  const context = createCommandContext({
    correlationId: incoming.messageId,
    incoming,
    actor: { canonicalUserId: incoming.sender.canonicalId, ...actorExtras },
    idempotencyKey: incoming.messageId,
    now: new Date(incoming.timestamp)
  });
  const transport = new NexoWhatsAppTransport({
    socket,
    chatId: incoming.chatId,
    privateChatId: incoming.sender.addressingId
  });
  return { incoming, context, transport };
}

async function sendViewModel({ transport, viewModel, repository, incoming, imageBuffer = null }) {
  let player = null;
  let group = null;
  try {
    group = await repository.getGroupByTransportChatId(incoming.groupId || incoming.chatId);
    if (group) player = await repository.getPlayerByUserAndGroup(incoming.sender.canonicalId, group.id);
  } catch {}

  const rendered = renderNexoViewModel(viewModel);
  const preferPrivate = viewModel.privacy !== 'GROUP' && Boolean(player?.privateOptIn);
  if (imageBuffer) {
    // Achado real de GPT-NEXO-007 (severidade ALTA): o render podia ter
    // sucesso e ainda assim a mensagem nunca chegar, se o próprio envio
    // da mídia pelo WhatsApp falhasse depois -- o texto pronto era
    // descartado junto. Texto é sempre a capacidade mínima garantida
    // (seção 17 do PDF: "capacidades ricas são opcionais"); agora uma
    // falha aqui cai no mesmo sendText que já funcionava sem imagem.
    try {
      await transport.sendImage(imageBuffer, { caption: rendered.text, mentions: rendered.mentions, preferPrivate });
      return;
    } catch {}
  }
  await transport.sendText(rendered.text, { mentions: rendered.mentions, preferPrivate });
}

/**
 * `!painel` e `!ficha` tentam imagem; qualquer outro comando não tenta
 * (evita busca de grupo/personagem à toa). Melhor esforço sempre: uma
 * falha aqui nunca impede o texto de sair (render*Image já devolve
 * null em qualquer erro, inclusive personagem sem Origem/Impulso/
 * Cicatriz reconhecidos).
 */
async function renderOptionalImage({ command, repository, incoming, actor, env, clientFactory }) {
  const normalized = String(command || '').toLowerCase();
  if (!['painel', 'ficha'].includes(normalized)) return null;
  const bunnyfyOptions = { ...(env ? { env } : {}), ...(clientFactory ? { clientFactory } : {}) };
  try {
    const group = await repository.getGroupByTransportChatId(incoming.groupId || incoming.chatId);
    if (!group || group.status !== 'ACTIVE') return null;
    if (normalized === 'painel') {
      return await renderCircleImage({ repository, group, ...bunnyfyOptions });
    }
    const player = await repository.getPlayerByUserAndGroup(actor.canonicalUserId, group.id);
    const character = player ? await repository.getCharacterByPlayerId(player.id) : null;
    if (!character) return null;
    return await renderCharacterImage({ character, ...bunnyfyOptions });
  } catch {
    return null;
  }
}

/**
 * Ponto único de integração com dados/src/index.js, no mesmo espírito de
 * handleTavernCommand: recebe o contexto que o bot já normalizou (mesmo
 * antes do switch principal) e devolve depois de enviar a resposta.
 *
 * `isGroupAdmin` precisa vir resolvido pelo chamador. Para as ações que
 * mutam estado (`ativar`, `confirmar`, `desativar`), o chamador deve
 * verificar admin por metadata FRESCA, não pelo cache padrão da mensagem
 * (seção 16 do PDF, nota de implementação de `!nexo ativar`).
 */
async function handleNexoCommand({ socket, raw, args = [], isGroupAdmin = false }) {
  const runtime = await getNexoRuntime();
  const { incoming, context, transport } = await buildContextAndTransport({
    socket,
    raw,
    runtime,
    actorExtras: { isGroupAdmin }
  });

  const [action, ...subArgs] = args;
  const viewModel = await handleNexoAction({
    repository: runtime.repository,
    context,
    action,
    args: subArgs
  });

  await sendViewModel({ transport, viewModel, repository: runtime.repository, incoming });
  return viewModel;
}

/**
 * Ponto de integração para os comandos de jogador (`!entrar`, `!painel`,
 * `!ficha`, `!privado`, `!tutorial`, `!continuar`, `!cancelar`) e para
 * respostas numéricas contextuais de onboarding.
 */
async function handleNexoPlayerCommand({ socket, raw, command, args = [], bunnyfyEnv, bunnyfyClientFactory }) {
  const runtime = await getNexoRuntime();
  const { incoming, context, transport } = await buildContextAndTransport({ socket, raw, runtime });

  const isNumericReply = /^\d+$/.test(String(command || '').trim());
  const viewModel = isNumericReply
    ? await handleNexoNumericReply({
      repository: runtime.repository,
      context,
      contentProvider: runtime.contentProvider,
      optionIndex: command
    })
    : await handleNexoPlayerAction({
      repository: runtime.repository,
      context,
      contentProvider: runtime.contentProvider,
      command,
      args
    });

  const imageBuffer = isNumericReply
    ? null
    : await renderOptionalImage({
      command,
      repository: runtime.repository,
      incoming,
      actor: context.actor,
      env: bunnyfyEnv,
      clientFactory: bunnyfyClientFactory
    });

  await sendViewModel({ transport, viewModel, repository: runtime.repository, incoming, imageBuffer });
  return viewModel;
}

export {
  createNexoRuntime,
  getNexoRuntime,
  handleNexoCommand,
  handleNexoPlayerCommand,
  shouldHandleNexoCommand,
  shouldHandleNexoNumericReply,
  shouldHandleNexoPlayerCommand,
  warmupNexoRuntime
};
