import { DOWNLOAD_MENU_DEFINITION } from './definitions.js';
function sectionById(id) {
    const section = DOWNLOAD_MENU_DEFINITION.sections?.find((candidate) => candidate.id === id);
    if (!section)
        throw new Error(`Definição vNext de menudown incompleta: seção ${id} ausente.`);
    return section;
}
function renderEntries(entries, prefix, middleBorder, menuItemIcon) {
    return entries
        .map(({ command, blankLineAfter }) => `${middleBorder}${menuItemIcon}${prefix}${command}${blankLineAfter ? '\n' : ''}`)
        .join('\n');
}
export async function renderDownloadMenu(prefix, botName = 'MeuBot', userName = 'Usuário', { header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`, menuTopBorder = '╭┈', bottomBorder = '╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯', menuTitleIcon = '🍧ฺꕸ▸', menuItemIcon = '•.̇𖥨֗🫟⭟', separatorIcon = '❁', middleBorder = '┊', searchMenuTitle, audioMenuTitle, videoMenuTitle, downloadMenuTitle, mediaMenuTitle, gamesMenuTitle, } = {}) {
    void menuTitleIcon;
    const sections = [
        { section: sectionById('search'), title: searchMenuTitle },
        { section: sectionById('audio'), title: audioMenuTitle },
        { section: sectionById('video'), title: videoMenuTitle },
        { section: sectionById('downloads'), title: downloadMenuTitle },
        { section: sectionById('media'), title: mediaMenuTitle },
        { section: sectionById('games'), title: gamesMenuTitle },
    ];
    const formattedHeader = header
        .replace(/#nome#/g, userName)
        .replace(/#prefix#/g, prefix);
    const renderedSections = sections.map(({ section, title }) => {
        const resolvedTitle = title ?? section.title;
        const entries = renderEntries(section.entries, prefix, middleBorder, menuItemIcon);
        return `${menuTopBorder}${separatorIcon} *${resolvedTitle}*\n${middleBorder}\n${entries}\n${bottomBorder}`;
    });
    return `${formattedHeader}\n\n${renderedSections.join('\n\n')}\n`;
}
//# sourceMappingURL=download.js.map