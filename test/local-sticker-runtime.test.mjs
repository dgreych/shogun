import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { sendSticker } from '../dados/src/funcs/utils/sticker.js';
import { prepareMediaTools } from '../scripts/media-tools.mjs';

test('conversor local produz e envia WebP sem acessar a BunnyFy', async () => {
  const prepared = prepareMediaTools({ log: () => undefined });
  assert.deepEqual(prepared.missing, []);

  const png = fs.readFileSync(new URL('../assets/brand/shogun-mark.png', import.meta.url));
  const sent = [];
  const socket = {
    async sendMessage(jid, message, options) {
      sent.push({ jid, message, options });
    },
  };

  const output = await sendSticker(socket, 'teste@s.whatsapp.net', {
    sticker: png,
    type: 'image',
    forceSquare: false,
  });

  assert.equal(output.subarray(0, 4).toString(), 'RIFF');
  assert.equal(output.subarray(8, 12).toString(), 'WEBP');
  assert.equal(sent.length, 1);
  assert.ok(sent[0].message.sticker.equals(output));
});
