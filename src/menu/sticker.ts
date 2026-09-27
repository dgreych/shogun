import { renderShogunMenu, type MenuAccessResolver } from '../../dados/src/menus/presentation.js';
import { STICKER_MENU_DEFINITION } from './definitions.js';

export interface StickerMenuRenderOptions {
  readonly accessFor?: MenuAccessResolver;
  readonly header?: string;
  readonly menuTopBorder?: string;
  readonly bottomBorder?: string;
  readonly menuTitleIcon?: string;
  readonly menuItemIcon?: string;
  readonly separatorIcon?: string;
  readonly middleBorder?: string;
  readonly createStickerMenuTitle?: string;
  readonly managementMenuTitle?: string;
}

export async function renderStickerMenu(
  prefix: string,
  _botName = 'SHOGUN',
  userName = 'Usuário',
  options: StickerMenuRenderOptions = {},
): Promise<string> {
  const titles = [options.createStickerMenuTitle, options.managementMenuTitle];
  const sections = STICKER_MENU_DEFINITION.sections;
  if (!sections || sections.length !== 2) throw new Error('Definição de figurinhas incompleta.');
  return renderShogunMenu({
    title: 'FIGURINHAS', prefix, userName,
    ...(options.accessFor ? { accessFor: options.accessFor } : {}),
    sections: sections.map((section, index) => ({
      title: titles[index] || section.title,
      entries: section.entries,
    })),
  });
}
