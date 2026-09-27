import assert from 'node:assert/strict';
import test from 'node:test';

import menus from '../dados/src/menus/index.js';
import { createShogunMenuTheme, withShogunMenuTheme } from '../dados/src/menus/theme.js';

test('tema padrão usa identidade SHOGUN sem ornamentação legada', () => {
    const theme = createShogunMenuTheme({ botName: 'SHOGUN' });

    assert.match(theme.header, /SHOGUN/);
    assert.doesNotMatch(theme.header, /MeuBot|🫟|🍧|❁/u);
    assert.equal(theme.menuItemIcon, '  ▸ ');
    assert.equal(theme.middleBorder, '┃');
});

test('marca do menu permanece SHOGUN mesmo com nome customizado da instância', () => {
    const theme = createShogunMenuTheme({ botName: 'Sentinela Norte' });
    assert.match(theme.header, /🐈‍⬛ SHOGUN/);
    assert.doesNotMatch(theme.header, /Sentinela Norte/);
});

test('configuração antiga não substitui a moldura aprovada', () => {
    const themed = withShogunMenuTheme({
        header: 'HEADER PERSONALIZADO',
        menuItemIcon: '>'
    }, { botName: 'SHOGUN' });

    assert.match(themed.header, /🐈‍⬛ SHOGUN/);
    assert.equal(themed.menuItemIcon, '  ▸ ');
    assert.equal(themed.middleBorder, '┃');
});

test('loader aplica tema SHOGUN ao menu principal', async () => {
    const output = await menus.menu('!', 'SHOGUN', 'Operador');
    assert.match(output, /SHOGUN/);
    assert.doesNotMatch(output, /MeuBot|🐦‍⬛|🪼/u);
});

test('loader mantém identidade aprovada sobre header antigo no menu principal', async () => {
    const output = await menus.menu('!', 'SHOGUN', 'Operador', {
        header: 'CABECALHO DO GRUPO',
        separator: '|'
    });

    assert.doesNotMatch(output, /CABECALHO DO GRUPO/);
    assert.match(output, /🐈‍⬛ SHOGUN/);
});

test('loader respeita contrato especial de menubn com isLiteMode', async () => {
    const output = await menus.menubn('!', 'SHOGUN', 'Operador', true);
    assert.equal(typeof output, 'string');
    assert.match(output, /SHOGUN/);
});

test('loader respeita contrato especial de menuTopCmd com lista de comandos', async () => {
    const output = await menus.menuTopCmd('!', 'SHOGUN', 'Operador', []);
    assert.equal(typeof output, 'string');
    assert.match(output, /SHOGUN/);
});
