import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRST_PROMOTION, promotionalPayload, sendPromotionalMessage } from '../dados/src/utils/promotionMessage.js';

test('promoção menciona todos os participantes sem inserir números no texto', () => {
  const payload = promotionalPayload('Mensagem da comunidade', { participants: [{ id: '5511999999999@s.whatsapp.net' }, { id: '123456789@lid' }, { id: '5511999999999@s.whatsapp.net' }, { id: 'invalid' }] });
  assert.equal(payload.text, 'Mensagem da comunidade');
  assert.deepEqual(payload.mentions, ['5511999999999@s.whatsapp.net', '123456789@lid']);
  assert.ok(FIRST_PROMOTION.includes('https://dgreych.github.io/DOMO-BJI/shogun/'));
  assert.ok(FIRST_PROMOTION.includes('https://github.com/dgreych/shogun'));
  assert.ok(FIRST_PROMOTION.includes('grátis'));
  assert.ok(FIRST_PROMOTION.includes('SHOGUN · NOVA GERAÇÃO'));
});

test('consulta os membros do grupo no momento do envio', async () => {
  const image = Buffer.from('arte-promocional');
  const sent = [];
  const socket = { groupMetadata: async group => ({ id: group, participants: [{ id: '5511999999999@s.whatsapp.net' }] }), sendMessage: async (group, payload) => { sent.push({ group, payload }); return { key: { id: 'receipt' } }; } };
  assert.equal((await sendPromotionalMessage(socket, '123@g.us', 'Texto', { image })).key.id, 'receipt');
  assert.deepEqual(sent[0], { group: '123@g.us', payload: { image, caption: 'Texto', mentions: ['5511999999999@s.whatsapp.net'] } });
});

test('falha ao consultar participantes impede uma promoção sem hidetag', async () => {
  await assert.rejects(sendPromotionalMessage({ groupMetadata: async () => { throw new Error('offline'); }, sendMessage: () => assert.fail('Não deve enviar sem os participantes.') }, '123@g.us', 'Texto'), /offline/);
});
