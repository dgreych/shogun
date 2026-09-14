const BASE_DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━';

function normalizeBotName(value) {
    const name = String(value || '').trim();
    return name || 'SHOGUN';
}

/**
 * Identidade visual padrão dos menus SHOGUN.
 *
 * O tema é propositalmente sóbrio e textual para permanecer legível em qualquer
 * cliente WhatsApp. Customizações de grupo/instância são aplicadas depois e,
 * portanto, sempre têm precedência sobre estes valores.
 */
export function createShogunMenuTheme({ botName } = {}) {
    const instanceName = normalizeBotName(botName);
    const label = instanceName.toLocaleUpperCase('pt-BR') === 'SHOGUN'
        ? 'SHOGUN'
        : `SHOGUN · ${instanceName}`;

    return {
        header: [
            `┏━〔 ${label} 〕━┓`,
            '┃ OPERADOR // #nome#',
            '┃ PREFIXO  // #prefix#',
            `┗${BASE_DIVIDER}`
        ].join('\n'),
        menuTopBorder: '┏━',
        bottomBorder: `┗${BASE_DIVIDER}`,
        menuTitleIcon: '◆',
        menuItemIcon: '├',
        separatorIcon: '◇',
        middleBorder: '┃',
        separator: '│'
    };
}

export function withShogunMenuTheme(options = {}, context = {}) {
    const safeOptions = options && typeof options === 'object' && !Array.isArray(options)
        ? options
        : {};

    return {
        ...createShogunMenuTheme(context),
        ...safeOptions
    };
}
