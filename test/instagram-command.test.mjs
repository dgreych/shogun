import assert from 'node:assert/strict';
import test from 'node:test';
import { executeInstagramDownload } from '../dados/src/utils/instagramCommand.js';
const key = { id: 'request', remoteJid: 'chat' };
function fixture() {
  const events = [];
  return { events, message: { key }, chatId: 'chat', prefix: '!', command: 'instagram',
    socket: { sendMessage: async (chat, content, options) => { events.push({ chat, content, options }); } },
    reply: async text => events.push({ reply: text }),
    download: async () => ({ ok: true, data: [{ type: 'image', mime: 'image/png', buff: Buffer.from('image') }, { type: 'video', mime: 'video/mp4', buff: Buffer.from('video') }] }),
  };
}
test('carrossel aguarda mídias em ordem com MIME e cita original, sucesso só ao terminar', async () => {
  const f = fixture();
  await executeInstagramDownload({ ...f, url: 'https://instagram.com/reel/Example/' });
  assert.equal(f.events[0].content.react.text, '⏳');
  const media = f.events.filter(event => event.content?.image || event.content?.video);
  assert.deepEqual(media.map(x => x.content.mimetype), ['image/png', 'video/mp4']);
  assert.ok(media.every(x => x.options.quoted === f.message));
  assert.equal(f.events.at(-1).content.react.text, '✅');
});
test('falha de API informa usuário e erro, não sucesso', async () => {
  const f = fixture();
  await executeInstagramDownload({ ...f, url: 'url', download: async () => ({ ok: false, msg: 'Story expirado.' }) });
  assert.ok(f.events.some(event => event.reply === 'Story expirado.'));
  assert.equal(f.events.at(-1).content.react.text, '⚠️');
  assert.equal(f.events.some(event => event.content?.react?.text === '✅'), false);
});
test('falha de envio posterior não anuncia entrega completa e não reenvia itens anteriores', async () => {
  const f = fixture();
  const send = f.socket.sendMessage;
  f.socket.sendMessage = async (...args) => { if (args[1].video) throw new Error('transport'); return send(...args); };
  await executeInstagramDownload({ ...f, url: 'url' });
  assert.equal(f.events.filter(event => event.content?.image).length, 1);
  assert.match(f.events.find(event => event.reply?.includes('entregar'))?.reply ?? '', /Instagram/);
  assert.equal(f.events.at(-1).content.react.text, '⚠️');
});
test('sem link dá exemplos de post, reel e story sem iniciar download', async () => {
  const f = fixture(); let called = false;
  await executeInstagramDownload({ ...f, url: '', download: async () => { called = true; } });
  assert.equal(called, false);
  assert.match(f.events[0].reply, /post.*reel.*story/i);
  assert.match(f.events[0].reply, /!igstory/);
});
