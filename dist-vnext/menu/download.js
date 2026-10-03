import { renderShogunMenu } from '../../dados/src/menus/presentation.js';
import { DOWNLOAD_MENU_DEFINITION } from './definitions.js';
export async function renderDownloadMenu(prefix, _botName = 'SHOGUN', userName = 'Usuário', options = {}) {
    const titleKeys = {
        search: 'searchMenuTitle', audio: 'audioMenuTitle', video: 'videoMenuTitle',
        downloads: 'downloadMenuTitle', media: 'mediaMenuTitle', games: 'gamesMenuTitle',
    };
    const sections = DOWNLOAD_MENU_DEFINITION.sections;
    if (!sections || sections.length !== 6)
        throw new Error('Definição de downloads incompleta.');
    return renderShogunMenu({
        options: { ...options },
        intro: "Pesquisas e downloads de música, vídeo, imagens e arquivos.",
        footer: "Informe um nome para pesquisar ou um link para baixar, conforme o comando.",
        title: 'DOWNLOADS', prefix, userName,
        ...(options.accessFor ? { accessFor: options.accessFor } : {}),
        sections: sections.map(section => ({
            title: options[titleKeys[section.id]] || section.title,
            ...(section.icon ? { icon: section.icon } : {}),
            entries: section.entries,
        })),
    });
}
//# sourceMappingURL=download.js.map