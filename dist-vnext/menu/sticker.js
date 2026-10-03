import { renderShogunMenu } from '../../dados/src/menus/presentation.js';
import { STICKER_MENU_DEFINITION } from './definitions.js';
export async function renderStickerMenu(prefix, _botName = 'SHOGUN', userName = 'Usuário', options = {}) {
    const titles = [options.createStickerMenuTitle, options.managementMenuTitle];
    const sections = STICKER_MENU_DEFINITION.sections;
    if (!sections || sections.length !== 2)
        throw new Error('Definição de figurinhas incompleta.');
    return renderShogunMenu({
        options: { ...options },
        intro: "Criação de figurinhas a partir de texto, imagem ou vídeo.",
        footer: "Responda à foto ou ao vídeo com #prefix#sticker; para texto, use #prefix#ttp seu texto.",
        title: 'FIGURINHAS', prefix, userName,
        ...(options.accessFor ? { accessFor: options.accessFor } : {}),
        sections: sections.map((section, index) => ({
            title: titles[index] || section.title,
            ...(section.icon ? { icon: section.icon } : {}),
            entries: section.entries,
        })),
    });
}
//# sourceMappingURL=sticker.js.map