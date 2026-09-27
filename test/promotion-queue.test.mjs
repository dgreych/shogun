import test from 'node:test';
import assert from 'node:assert/strict';
import { PromotionQueue } from '../dados/src/utils/promotionQueue.js';

function fixture(existing) {
  let time = 1000; let saved = existing;
  const queue = new PromotionQueue({ now: () => time, random: () => 0,
    load: () => existing || { nextId: 1, messages: [], campaign: null },
    save: state => { saved = structuredClone(state); },
  });
  return { queue, advance: ms => { time += ms; }, saved: () => saved };
}
test('IDs simples preservam a mensagem e a fila filtra destinatários de grupo', () => {
  const f = fixture(); assert.equal(f.queue.define('Mensagem\ncom link').id, 1);
  assert.equal(f.queue.define('Outra').id, 2);
  assert.equal(f.queue.start(1, ['1@g.us', '1@g.us', '5511@s.whatsapp.net']).total, 1);
  assert.throws(() => f.queue.start(2, ['2@g.us']), /andamento/);
  assert.equal(f.queue.state.campaign.text, 'Mensagem\ncom link');
});
test('envio é sequencial, espaçado e não repete grupos depois de reiniciar', async () => {
  const f = fixture(); f.queue.define('Aviso'); f.queue.start(1, ['1@g.us', '2@g.us']);
  const calls = []; const send = async group => { calls.push(group); return { key: { id: group } }; };
  assert.equal((await f.queue.step(send)).waitMs, 30_000);
  f.advance(30_000); await f.queue.step(send);
  assert.equal((await f.queue.step(send)).waitMs, 120_000);
  const restarted = fixture(f.saved()); restarted.advance(f.queue.state.campaign.nextSendAt);
  await restarted.queue.step(send);
  assert.deepEqual(calls, ['1@g.us', '2@g.us']);
  assert.equal(restarted.queue.progress().status, 'completed');
});
test('reinício durante envio deixa resultado incerto e não duplica automaticamente', async () => {
  const f = fixture(); f.queue.define('Aviso'); f.queue.start(1, ['1@g.us', '2@g.us']);
  const saved = f.saved(); saved.campaign.inFlight = '1@g.us';
  const restarted = fixture(saved); restarted.advance(1_000_000);
  const calls = []; await restarted.queue.step(async group => { calls.push(group); return { key: { id: 'ok' } }; });
  assert.deepEqual(calls, ['2@g.us']); assert.equal(restarted.queue.progress().uncertain, 1);
});
test('falhas são contadas sem sucesso falso e concorrência não dispara outra mensagem', async () => {
  const f = fixture(); f.queue.define('Aviso'); f.queue.start(1, ['1@g.us', '2@g.us']); f.advance(30_000);
  let release; const pending = f.queue.step(() => new Promise(resolve => { release = resolve; }));
  assert.deepEqual(await f.queue.step(() => assert.fail('envio concorrente')), { idle: true });
  release(undefined); await pending; assert.equal(f.queue.progress().uncertain, 1);
  f.advance(120_000); await f.queue.step(async () => { throw new Error('sem conexão'); });
  assert.equal(f.queue.progress().failed, 1); assert.equal(f.queue.progress().sent, 0);
});

test('pausa preserva destinatários e retoma somente quem ainda não recebeu', async () => {
  const f = fixture(); f.queue.define('Aviso'); f.queue.start(1, ['1@g.us', '2@g.us']);
  f.advance(30_000); const calls = [];
  const send = async group => { calls.push(group); return { key: { id: 'ok' } }; };
  await f.queue.step(send); f.queue.pause(); f.advance(1_000_000);
  assert.deepEqual(await f.queue.step(send), { idle: true });
  assert.throws(() => f.queue.start(1, ['3@g.us']), /andamento/);
  const restarted = fixture(f.saved()); restarted.queue.resume(); restarted.advance(1_000_000);
  await restarted.queue.step(send);
  assert.deepEqual(calls, ['1@g.us', '2@g.us']); assert.equal(restarted.queue.progress().status, 'completed');
});
