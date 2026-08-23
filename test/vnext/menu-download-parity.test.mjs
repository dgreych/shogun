import assert from 'node:assert/strict';
import test from 'node:test';

import legacyDownloadMenu from '../../dados/src/menus/menudown.js';
import { renderDownloadMenu } from '../../dist-vnext/menu/download.js';

const cases = [
  ['default', ['!', '𝖘𝖍𝖔𝖌𝖚𝖓', 'Maurício']],
  ['alternate-prefix', ['#', 'Gyomei Bot', 'Teste']],
  ['custom-theme', ['.', '𝖘𝖍𝖔𝖌𝖚𝖓', 'Usuário', {
    header: 'BOT=#nome#|P=#prefix#',
    menuTopBorder: '<TOP>',
    bottomBorder: '<BOTTOM>',
    menuTitleIcon: '<TITLE>',
    menuItemIcon: '<ITEM>',
    separatorIcon: '<SEP>',
    middleBorder: '<MID>',
    searchMenuTitle: 'PESQUISA',
    audioMenuTitle: 'AUDIO',
    videoMenuTitle: 'VIDEO',
    downloadMenuTitle: 'DOWNLOAD',
    mediaMenuTitle: 'MEDIA',
    gamesMenuTitle: 'GAMES',
  }]],
];

for (const [name, args] of cases) {
  test(`menudown parity: ${name}`, async () => {
    const legacy = await legacyDownloadMenu(...args);
    const vnext = await renderDownloadMenu(...args);
    assert.equal(vnext, legacy);
  });
}
