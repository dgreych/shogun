import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../dados/src/index.js', import.meta.url), 'utf8');

test('figurinhas comuns usam o conversor local sem depender da BunnyFy', () => {
  const autoStart = source.indexOf('if (isGroup && groupData.autoSticker');
  const autoEnd = source.indexOf('let quotedMessageContent = null;', autoStart);
  const automatic = source.slice(autoStart, autoEnd);
  const commandStart = source.indexOf("case 'st':");
  const commandEnd = source.indexOf("case 'st2':", commandStart);
  const command = source.slice(commandStart, commandEnd);

  assert.ok(autoStart >= 0 && autoEnd > autoStart, 'bloco de figurinha automática precisa existir');
  assert.ok(commandStart >= 0 && commandEnd > commandStart, 'comando de figurinha comum precisa existir');
  assert.ok(!automatic.includes('stickerWithBunnyFy('), 'figurinha automática não pode depender da API');
  assert.ok(!command.includes('stickerWithBunnyFy('), 'sticker, st, stk e s não podem depender da API');
  assert.ok(automatic.includes('sticker: buffer'), 'figurinha automática precisa entregar a mídia ao conversor local');
  assert.ok(command.includes('sticker: buffer'), 'comando comum precisa entregar a mídia ao conversor local');
});
