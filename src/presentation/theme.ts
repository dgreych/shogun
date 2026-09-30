export const SHOGUN_SIGNATURE = '╭━━━〔 🐈‍⬛ *SHOGUN* 〕━━━';
export interface ShogunMenuTheme {
 styleVersion: number;
 header: string;
 menuTopBorder: string;
 bottomBorder: string;
 menuTitleIcon: string;
 menuItemIcon: string;
 separatorIcon: string;
 middleBorder: string;
 separator: string;
}
const previousDefaults: Record<string, string> = {
    header: '╭━╼ 🐈‍⬛ *SHOGUN*\n┃  *#title#*\n┃  #nome# #separator# prefixo #prefix#\n┃',
    menuTopBorder: '┣━╼', bottomBorder: '╰━╼ SHOGUN ━━━━━━━━━',
    menuTitleIcon: '', menuItemIcon: '  ↳ ', separatorIcon: '╸', middleBorder: '┃', separator: '┆',
};
export function createShogunMenuTheme(): ShogunMenuTheme {
    return {
        styleVersion: 3,
        header: [SHOGUN_SIGNATURE, '┃  *#title#*', '┃  #nome# #separator# prefixo #prefix#', '┣━━━━━━━━━━━━━━━━━━━━'].join('\n'),
        menuTopBorder: '┣━', bottomBorder: '╰━━━━━━━━━━〔 ◆ 〕',
        menuTitleIcon: '', menuItemIcon: '  › ', separatorIcon: '◆', middleBorder: '┃', separator: '·',
    };
}
export function withShogunMenuTheme(options: unknown = {}): ShogunMenuTheme {
    const saved: Record<string, unknown> = options && typeof options === 'object' && !Array.isArray(options) ? options as Record<string, unknown> : {};
    const defaults = createShogunMenuTheme();
    const result = { ...saved, ...defaults };
    if (saved.styleVersion === 2 || saved.styleVersion === defaults.styleVersion) {
        for (const key of Object.keys(defaults) as Array<keyof ShogunMenuTheme>) {
            if (key === 'styleVersion' || typeof saved[key] !== 'string') continue;
            if (saved.styleVersion === 2 && saved[key] === previousDefaults[key]) continue;
            result[key] = (saved[key] as string).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, key === 'header' ? 1200 : 160);
        }
    }
    return result;
}
