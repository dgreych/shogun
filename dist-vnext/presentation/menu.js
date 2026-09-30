import { withShogunMenuTheme } from './theme.js';
import { rememberRenderedOutput } from './rendered-output.js';
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
function plainText(value) {
    return String(value ?? '')
        .replace(/[\r\n\t]/g, ' ')
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
        .replace(/[*_~`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
export function sanitizeMenuDisplayName(value) {
    return [...segmenter.segment(plainText(value))].slice(0, 48).map(part => part.segment).join('') || 'Usuário';
}
export function prepareMenuSections(sections, options = {}, { isLiteMode = false } = {}) {
    return sections.map(section => ({
        ...section,
        title: section.optionKey && typeof options?.[section.optionKey] === 'string'
            ? plainText(options[section.optionKey]) || section.title
            : section.title,
        entries: selectMenuEntries(section.entries.filter(entry => !isLiteMode || !entry.liteExcluded), options.accessFor),
    }));
}
export function selectMenuEntries(entries, accessFor) {
    if (typeof accessFor !== 'function')
        return [...entries];
    return entries.flatMap(entry => {
        let decision;
        try {
            decision = accessFor(entry.command, entry);
        }
        catch {
            return [];
        }
        if (decision?.visible !== true)
            return [];
        return [{ ...entry, ...(decision.executable === false ? { unavailableReason: 'O Shogun precisa ser administrador do grupo.' } : {}) }];
    });
}
export function renderShogunMenu({ title, prefix, userName, sections, intro = 'Escolha seu próximo passo. Eu cuido do resto.', footer = 'Escolha um comando e deixe comigo.', accessFor, options = {} }) {
    const theme = withShogunMenuTheme(options);
    const heading = `${theme.menuTitleIcon}${plainText(title)}`;
    const header = theme.header.replaceAll('#title#', heading).replaceAll('#titulo#', heading)
        .replaceAll('{botName}', 'SHOGUN').replaceAll('{userName}', sanitizeMenuDisplayName(userName))
        .replaceAll('#nome#', sanitizeMenuDisplayName(userName)).replaceAll('{prefix}', prefix)
        .replaceAll('#prefix#', prefix).replaceAll('#separator#', theme.separator)
        .replaceAll('#intro#', plainText(intro)).replaceAll('#footer#', plainText(footer));
    const lines = header.split('\n');
    let sectionNumber = 0;
    for (const section of prepareMenuSections(sections, { ...options, accessFor: accessFor || options.accessFor })) {
        if (!section.entries.length)
            continue;
        lines.push(`${theme.menuTopBorder} ${String(++sectionNumber).padStart(2, '0')} ${theme.separatorIcon} *${plainText(section.icon || '✦')} ${plainText(section.title)}*`, theme.middleBorder);
        for (const entry of section.entries) {
            const commandText = `${prefix}${entry.command}`;
            const command = /[*_~`]/u.test(commandText) ? commandText : `*${commandText}*`;
            lines.push(`${theme.middleBorder}${theme.menuItemIcon}${command}${entry.arguments ? ` ${entry.arguments}` : ''}`);
            if (entry.description)
                lines.push(`${theme.middleBorder}     ${plainText(entry.description)}`);
            if (entry.unavailableReason)
                lines.push(`${theme.middleBorder}    Indisponível: ${plainText(entry.unavailableReason)}`);
        }
        for (const note of section.notes ?? [])
            lines.push(`${theme.middleBorder}    ${plainText(note).replaceAll('#prefix#', prefix)}`);
        lines.push(theme.bottomBorder, '');
    }
    lines.push(`${theme.menuTopBorder} 🐾 SEU PRÓXIMO PASSO`, `${theme.middleBorder}  ${plainText(footer).replaceAll('#prefix#', prefix)}`, theme.bottomBorder);
    return rememberRenderedOutput(lines.join('\n'));
}
//# sourceMappingURL=menu.js.map