import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageReplayGuard, createMessageReplayKey } from './MessageReplayGuard.js';

test('a mesma mensagem só é aceita uma vez dentro da janela', () => {
  let now = 1000;
  const guard = new MessageReplayGuard({ ttlMs: 5000, now: () => now });
  assert.equal(guard.checkAndRecord('grupo|mensagem'), false);
  assert.equal(guard.checkAndRecord('grupo|mensagem'), true);
  now += 5001;
  assert.equal(guard.checkAndRecord('grupo|mensagem'), false);
});

test('a chave separa bot, conversa, participante e mensagem', () => {
  const key = createMessageReplayKey(
    { user: { id: 'bot@s.whatsapp.net' } },
    { key: { remoteJid: 'grupo@g.us', participant: 'pessoa@lid', id: 'ABC123' } }
  );
  assert.equal(key, 'bot@s.whatsapp.net|grupo@g.us|pessoa@lid|ABC123');
  assert.equal(createMessageReplayKey({}, { key: { remoteJid: 'grupo@g.us' } }), null);
});

test('o cache respeita o limite configurado', () => {
  const guard = new MessageReplayGuard({ ttlMs: 5000, maxEntries: 2, now: () => 1000 });
  guard.checkAndRecord('a');
  guard.checkAndRecord('b');
  guard.checkAndRecord('c');
  assert.deepEqual([...guard.entries.keys()], ['b', 'c']);
});
