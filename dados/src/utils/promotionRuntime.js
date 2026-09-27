import path from 'node:path';
import fs from 'node:fs';
import { DATABASE_DIR } from './paths.js';
import { PromotionQueue } from './promotionQueue.js';
import { FIRST_PROMOTION, sendPromotionalMessage } from './promotionMessage.js';

let queue;
let socket;
let connected = false;
let draining = false;
let polling;
const requestFile = path.join(DATABASE_DIR, 'dono', 'promotions-request.json');
const sleep = ms => new Promise(resolve => { const timer = setTimeout(resolve, ms); timer.unref?.(); });

export function getPromotionQueue() {
  if (!queue) {
    queue = new PromotionQueue({ file: path.join(DATABASE_DIR, 'dono', 'promotions-v1.json') });
    if (!queue.list().length) queue.define(FIRST_PROMOTION);
  }
  return queue;
}

async function drain() {
  if (draining || !connected) return;
  draining = true;
  try {
    while (connected && getPromotionQueue().progress()?.status === 'running') {
      const currentSocket = socket;
      const result = await getPromotionQueue().step((group, text) => sendPromotionalMessage(currentSocket, group, text));
      if (result.waitMs) await sleep(Math.min(result.waitMs, 30_000));
      else if (result.idle) break;
    }
  } catch (error) {
    console.error('[PROMO] Não foi possível continuar a fila:', error.message);
  } finally { draining = false; }
}

export function setPromotionConnection(currentSocket, isConnected) {
  socket = currentSocket;
  connected = isConnected;
  if (connected) {
    void drain();
    if (!polling) {
      polling = setInterval(() => {
        if (connected) void consumePromotionRequest({ file: requestFile, start: id => startPromotion(socket, id) })
          .catch(() => console.error('[PROMO] Pedido de envio recusado. Confira o registro local.'));
      }, 10_000);
      polling.unref?.();
    }
  }
}

export async function consumePromotionRequest({ file, start, now = Date.now }) {
  if (!fs.existsSync(file)) return false;
  const request = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isSafeInteger(request.messageId) || request.messageId < 1 ||
      !Number.isFinite(request.createdAt) || now() - request.createdAt < 0 || now() - request.createdAt > 3600_000)
    throw new Error('Pedido de promoção inválido ou vencido.');
  const consumed = file + '.consumed';
  fs.renameSync(file, consumed);
  try {
    const progress = await start(request.messageId);
    fs.writeFileSync(consumed, JSON.stringify({ ...request, status: 'started', progress }), { mode: 0o600 });
    console.log('[PROMO] Envio autorizado iniciado: mensagem ' + request.messageId + ', ' + progress.total + ' grupos.');
    return true;
  } catch (error) {
    fs.writeFileSync(consumed, JSON.stringify({ ...request, status: 'failed' }), { mode: 0o600 });
    throw error;
  }
}

export async function startPromotion(socket, messageId) {
  const groups = await socket.groupFetchAllParticipating();
  const result = getPromotionQueue().start(messageId, Object.keys(groups || {}));
  setPromotionConnection(socket, true);
  return result;
}
