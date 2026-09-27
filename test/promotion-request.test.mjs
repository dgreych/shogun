import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { consumePromotionRequest } from '../dados/src/utils/promotionRuntime.js';
test('pedido local inicia a promoção uma vez e registra o resultado sem repetir após reinício', async t => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-request-'));
 t.after(() => fs.rmSync(root, { recursive: true, force: true }));
 const file = path.join(root, 'request.json'); let calls = 0;
 fs.writeFileSync(file, JSON.stringify({ messageId: 1, createdAt: 100 }));
 const options = { file, now: () => 100, start: async id => { calls++; assert.equal(id, 1); return { total: 3 }; } };
 assert.equal(await consumePromotionRequest(options), true);
 assert.equal(await consumePromotionRequest(options), false);
 assert.equal(calls, 1);
 assert.equal(JSON.parse(fs.readFileSync(file + '.consumed')).status, 'started');
 fs.writeFileSync(file, JSON.stringify({ messageId: 1, createdAt: -3600_001 }));
 await assert.rejects(consumePromotionRequest(options), /vencido/);
 assert.equal(calls, 1);
});

test('pedido de foto envia ao telefone autorizado uma única vez e recusa destino inválido', async t => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-profile-'));
 t.after(() => fs.rmSync(root, { recursive: true, force: true }));
 const file = path.join(root, 'request.json'); const recipients = [];
 const options = { file, now: () => 100, start: () => assert.fail('Não deve iniciar campanha'),
  sendProfile: async recipient => { recipients.push(recipient); return { total: 1, sent: 1 }; } };
 fs.writeFileSync(file, JSON.stringify({ type: 'profile', recipient: '5522997028553', createdAt: 100 }));
 assert.equal(await consumePromotionRequest(options), true);
 assert.equal(await consumePromotionRequest(options), false);
 assert.deepEqual(recipients, ['5522997028553']);
 fs.writeFileSync(file, JSON.stringify({ type: 'profile', recipient: '../../file', createdAt: 100 }));
 await assert.rejects(consumePromotionRequest(options), /inválido/);
 assert.equal(recipients.length, 1);
});
