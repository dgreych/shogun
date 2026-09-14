// Loader ESM-safe para todos os menus.
// Mantém a mesma API: objeto `menus` com chaves nomeadas (menu, menuAlterador, etc.)
// e adiciona `getMenus()` para acesso explícito assíncrono.

import { withShogunMenuTheme } from './theme.js';

// Mapa estático dos menus e seus arquivos correspondentes.
const menuModules = {
    menu: './menu.js',
    menuAlterador: './alteradores.js',
    menudown: './menudown.js',
    menuadm: './menuadm.js',
    menubn: './menubn.js',
    menuLogos: './menulogo.js',
    menuDono: './menudono.js',
    menuMembros: './menumemb.js',
    menuFerramentas: './ferramentas.js',
    menuSticker: './menufig.js',
    menuIa: './menuia.js',
    menuTopCmd: './topcmd.js',
    menuRPG: './menurpg.js',
    menuNexo: './menunexo.js'
};

// Índice do argumento de opções visuais por contrato de menu.
// menubn recebe `isLiteMode` antes das opções; menuTopCmd recebe `topCommands`.
const menuOptionsArgumentIndex = Object.freeze({
    menu: 3,
    menuAlterador: 3,
    menudown: 3,
    menuadm: 3,
    menubn: 4,
    menuLogos: 3,
    menuDono: 3,
    menuMembros: 3,
    menuFerramentas: 3,
    menuSticker: 3,
    menuIa: 3,
    menuTopCmd: 4,
    menuRPG: 3,
    menuNexo: 3
});

function wrapWithShogunTheme(name, fn) {
    const optionsIndex = menuOptionsArgumentIndex[name];

    if (!Number.isInteger(optionsIndex)) return fn;

    return function themedMenu(...args) {
        const nextArgs = [...args];
        const botName = nextArgs[1] || 'SHOGUN';
        const existingOptions = nextArgs[optionsIndex];

        while (nextArgs.length < optionsIndex) {
            nextArgs.push(undefined);
        }

        nextArgs[optionsIndex] = withShogunMenuTheme(existingOptions, { botName });
        return fn(...nextArgs);
    };
}

let menusPromise;

async function loadMenus() {
    if (menusPromise) return menusPromise;

    menusPromise = (async () => {
        const menus = {};

        for (const [name, relPath] of Object.entries(menuModules)) {
            try {
                const mod = await import(new URL(relPath, import.meta.url));
                const fn = mod.default || mod[name];

                if (typeof fn === 'function') {
                    menus[name] = wrapWithShogunTheme(name, fn);
                } else {
                    console.error(
                        `[${new Date().toISOString()}] [AVISO] Menu '${name}' em ${relPath} não exporta função válida (esperado default function).`
                    );
                }
            } catch (err) {
                console.error(
                    `[${new Date().toISOString()}] [AVISO] Falha ao carregar o menu '${name}' de ${relPath}: ${err.message}`
                );
            }
        }

        const failed = Object.keys(menuModules).filter((name) => !menus[name]);
        if (failed.length > 0) {
            console.error(
                `[${new Date().toISOString()}] [AVISO] Os seguintes menus não foram carregados corretamente: ${failed.join(', ')}.`
            );
            console.error(
                `[${new Date().toISOString()}] [AVISO] Verifique se os arquivos exportam "export default function(...) { ... }" conforme esperado.`
            );
        }

        return menus;
    })();

    return menusPromise;
}

export async function getMenus() {
    return await loadMenus();
}

const menus = await loadMenus();
export default menus;
