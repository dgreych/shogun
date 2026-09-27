export function createShogunMenuTheme() {
    return {
        header: [
            '╭━━━─〔 🐈‍⬛ SHOGUN 〕─━━━',
            '┃',
            '┃  Usuário › #nome#',
            '┃  Prefixo › #prefix#',
            '┃',
        ].join('\n'),
        menuTopBorder: '┣━━〔',
        bottomBorder: '╰━━━─〔 SHOGUN 〕─━━━━',
        menuTitleIcon: '',
        menuItemIcon: '  ▸ ',
        separatorIcon: '◈',
        middleBorder: '┃',
        separator: '│',
    };
}

export function withShogunMenuTheme(options = {}) {
    const safeOptions = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    return { ...safeOptions, ...createShogunMenuTheme() };
}
