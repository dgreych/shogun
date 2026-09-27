import { renderShogunMenu } from '../../dados/src/menus/presentation.js';
import { STICKER_MENU_DEFINITION } from './definitions.js';
export async function renderStickerMenu(prefix, _botName = 'SHOGUN', userName = 'Usuário', options = {}) {
    const titles = [options.createStickerMenuTitle, options.managementMenuTitle];
    const sections = STICKER_MENU_DEFINITION.sections;
    if (!sections || sections.length !== 2)
        throw new Error('Definição de figurinhas incompleta.');
    return renderShogunMenu({
        title: 'FIGURINHAS', prefix, userName,
        ...(options.accessFor ? { accessFor: options.accessFor } : {}),
        sections: sections.map((section, index) => ({
            title: titles[index] || section.title,
            entries: section.entries,
        })),
    });
}
//# sourceMappingURL=sticker.js.map