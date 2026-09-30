export const SHOGUN_SIGNATURE = '⟡━━〔 🐈‍⬛ *SHOGUN* 〕━━⟡';
const versionTwo = {
    header: '╭━╼ 🐈‍⬛ *SHOGUN*\n┃  *#title#*\n┃  #nome# #separator# prefixo #prefix#\n┃',
    menuTopBorder: '┣━╼', bottomBorder: '╰━╼ SHOGUN ━━━━━━━━━',
    menuTitleIcon: '', menuItemIcon: '  ↳ ', separatorIcon: '╸', middleBorder: '┃', separator: '┆',
};
const versionThree = {
    header: '╭━━━〔 🐈‍⬛ *SHOGUN* 〕━━━\n┃  *#title#*\n┃  #nome# #separator# prefixo #prefix#\n┣━━━━━━━━━━━━━━━━━━━━',
    menuTopBorder: '┣━', bottomBorder: '╰━━━━━━━━━━〔 ◆ 〕',
    menuTitleIcon: '', menuItemIcon: '  › ', separatorIcon: '◆', middleBorder: '┃', separator: '·',
};
export function createShogunMenuTheme() {
    return {
        styleVersion: 4,
        header: [SHOGUN_SIGNATURE, '     *#title#*', '', '╭─ ☾ ─────────────', '│  ☾ Salve, *#nome#*.', '│  #intro#', '│  ⌘ Prefixo *#prefix#*', '╰───────────── ⟡', ''].join('\n'),
        menuTopBorder: '╭─', bottomBorder: '╰───────────── ⟡',
        menuTitleIcon: '', menuItemIcon: '  ⤷ ', separatorIcon: '⟡', middleBorder: '│', separator: '·',
    };
}
export function withShogunMenuTheme(options = {}) {
    const saved = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    const defaults = createShogunMenuTheme();
    const result = { ...saved, ...defaults };
    if ([2, 3, defaults.styleVersion].includes(Number(saved.styleVersion))) {
        const previous = saved.styleVersion === 2 ? versionTwo : saved.styleVersion === 3 ? versionThree : undefined;
        for (const key of Object.keys(defaults)) {
            if (key === 'styleVersion' || typeof saved[key] !== 'string')
                continue;
            if (previous && saved[key] === previous[key])
                continue;
            result[key] = saved[key].replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, key === 'header' ? 1200 : 160);
        }
    }
    return result;
}
//# sourceMappingURL=theme.js.map