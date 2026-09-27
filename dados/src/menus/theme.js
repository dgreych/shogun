export function createShogunMenuTheme() {
    return {
        styleVersion: 2,
        header: [
            '╭━╼ 🐈‍⬛ *SHOGUN*',
            '┃  *#title#*',
            '┃  #nome# #separator# prefixo #prefix#',
            '┃',
        ].join('\n'),
        menuTopBorder: '┣━╼',
        bottomBorder: '╰━╼ SHOGUN ━━━━━━━━━',
        menuTitleIcon: '',
        menuItemIcon: '  ↳ ',
        separatorIcon: '╸',
        middleBorder: '┃',
        separator: '┆',
    };
}

export function withShogunMenuTheme(options = {}) {
    const safeOptions = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    const defaults = createShogunMenuTheme();
    const result = { ...safeOptions, ...defaults };
    // Desenhos antigos cedem lugar ao padrão; as próximas edições ficam salvas.
    if (safeOptions.styleVersion === defaults.styleVersion) {
        for (const key of Object.keys(defaults)) {
            if (key === 'styleVersion' || typeof safeOptions[key] !== 'string') continue;
            result[key] = safeOptions[key].replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, key === 'header' ? 1200 : 160);
        }
    }
    return result;
}
