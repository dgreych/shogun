import { renderShogunMenu, type MenuAccessResolver } from '../../dados/src/menus/presentation.js';
import { DOWNLOAD_MENU_DEFINITION } from './definitions.js';

export interface DownloadMenuRenderOptions {
  readonly accessFor?: MenuAccessResolver;
  readonly header?: string;
  readonly menuTopBorder?: string;
  readonly bottomBorder?: string;
  readonly menuTitleIcon?: string;
  readonly menuItemIcon?: string;
  readonly separatorIcon?: string;
  readonly middleBorder?: string;
  readonly searchMenuTitle?: string;
  readonly audioMenuTitle?: string;
  readonly videoMenuTitle?: string;
  readonly downloadMenuTitle?: string;
  readonly mediaMenuTitle?: string;
  readonly gamesMenuTitle?: string;
}

export async function renderDownloadMenu(
  prefix: string,
  _botName = 'SHOGUN',
  userName = 'Usuário',
  options: DownloadMenuRenderOptions = {},
): Promise<string> {
  const titleKeys = {
    search: 'searchMenuTitle', audio: 'audioMenuTitle', video: 'videoMenuTitle',
    downloads: 'downloadMenuTitle', media: 'mediaMenuTitle', games: 'gamesMenuTitle',
  } as const;
  const sections = DOWNLOAD_MENU_DEFINITION.sections;
  if (!sections || sections.length !== 6) throw new Error('Definição de downloads incompleta.');
  return renderShogunMenu({
    options: { ...options },
    intro: "Pesquisas e downloads de música, vídeo, imagens e arquivos.",
    footer: "Informe um nome para pesquisar ou um link para baixar, conforme o comando.",
    title: 'DOWNLOADS', prefix, userName,
    ...(options.accessFor ? { accessFor: options.accessFor } : {}),
    sections: sections.map(section => ({
      title: options[titleKeys[section.id as keyof typeof titleKeys]] || section.title,
      ...(section.icon ? { icon: section.icon } : {}),
      entries: section.entries,
    })),
  });
}
