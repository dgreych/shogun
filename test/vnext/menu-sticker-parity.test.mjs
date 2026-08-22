import assert from 'node:assert/strict';
import test from 'node:test';

import legacyMenuSticker from '../../dados/src/menus/menufig.js';
import { renderStickerMenu } from '../../dist-vnext/menu/sticker.js';

const cases = [
  ['default', ['!', 'GYOMEI', 'Maurício']],
  ['alternate-prefix', ['#', 'Gyomei Bot', 'Teste']],
  ['custom-theme', ['.', 'GYOMEI', 'Usuário', {
    header: 'BOT=#nome#|P=#prefix#',
    menuTopBorder: '<TOP>',
    bottomBorder: '<BOTTOM>',
    menuTitleIcon: '<TITLE>',
    menuItemIcon: '<ITEM>',
    separatorIcon: '<SEP>',
    middleBorder: '<MID>',
    createStickerMenuTitle: 'CRIAR',
    managementMenuTitle: 'GERIR',
  }]],
];

for (const [name, args] of cases) {
  test(`menuSticker parity: ${name}`, async () => {
    const legacy = await legacyMenuSticker(...args);
    const vnext = await renderStickerMenu(...args);
    assert.equal(vnext, legacy);
  });
}
