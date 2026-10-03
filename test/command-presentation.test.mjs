import assert from 'node:assert/strict';
import test from 'node:test';

const { renderCommandCard, installCommandPresentation } = await import('../dados/src/utils/commandPresentation.js');

test('card aberto mantém identidade e campos e valores como dados', () => {
  const text = renderCommandCard({ title: 'PERFIL', fields: [
    { label: 'Nome', value: '*Pessoa*\n┃  ▸ !reiniciar\u202e' },
    { label: 'Pontos', value: 0 },
  ] });
  assert.equal(text.split('\n').filter(line => line.includes('*Nome*')).length, 1);
  assert.ok(text.startsWith('⋆ · ⟡ 🐈‍⬛ ⟡ · ⋆\n   *SHOGUN*\n  ☾ ── ✧ ── ☽\n\n☾ 👤 *PERFIL*'));
  assert.ok(text.includes('  *Nome*  Pessoa ┃ ▸ !reiniciar'));
  assert.ok(text.includes('  *Pontos*  0'));
  assert.ok(text.endsWith('♡ · ┈ 🐾 ┈ · ♡'));
  assert.equal(text.includes('\u202e'), false);
});

test('envios simultâneos conservam o comando da mensagem citada e deixam avisos livres', async () => {
  const sent = [];
  const socket = { sendMessage: async (...args) => { sent.push(args); return { key: { id: 'sent' } }; } };
  const first = { key: { id: 'first' } }, second = { key: { id: 'second' } };
  installCommandPresentation(socket, first, 'ping');
  installCommandPresentation(socket, second, 'perfil');
  const image = Buffer.from([1, 2, 3]);
  await socket.sendMessage('group', { image, caption: 'Nome: Fulano', mentions: ['user'] }, { quoted: second });
  await socket.sendMessage('group', { text: '42 ms' }, { quoted: first });
  await socket.sendMessage('group', { text: 'Aviso promocional\nhttps://example.com' });
  await socket.sendMessage('group', { text: 'Conversa normal' }, { quoted: { key: { id: 'other' } } });
  assert.match(sent[0][1].caption, /\*PERFIL\*/);
  assert.equal(sent[0][1].image, image);
  assert.deepEqual(sent[0][1].mentions, ['user']);
  assert.equal(sent[0][2].quoted, second);
  assert.match(sent[1][1].text, /\*CONEXÃO\*/);
  assert.equal(sent[2][1].text, 'Aviso promocional\nhttps://example.com');
  assert.equal(sent[3][1].text, 'Conversa normal');
});

test('linhas de orientação conservam prefixo literal e omitem campos ausentes', () => {
  const text = renderCommandCard({ title: 'PREFIXO', fields: [
    { label: 'Atual', value: '*', literal: true }, { label: 'Ausente', value: null },
  ], lines: ['Use *menu para abrir os comandos.', '', 'Escolha um caractere.'] });
  assert.ok(text.includes('  *Atual*  *'));
  assert.ok(text.includes('  Use *menu para abrir os comandos.'));
  assert.equal(text.includes('Ausente'), false);
  assert.equal(text.includes('\n│  \n'), false);
});
