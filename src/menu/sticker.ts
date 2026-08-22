import { STICKER_MENU_DEFINITION } from './definitions.js';

export interface StickerMenuRenderOptions {
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

function getStickerSections() {
  const sections = STICKER_MENU_DEFINITION.sections;
  if (!sections || sections.length !== 2) {
    throw new Error('Definição vNext de menuSticker inválida: esperadas 2 seções.');
  }

  const createSection = sections[0];
  const managementSection = sections[1];
  if (!createSection || !managementSection) {
    throw new Error('Definição vNext de menuSticker incompleta.');
  }

  return { createSection, managementSection };
}

export async function renderStickerMenu(
  prefix: string,
  botName = 'MeuBot',
  userName = 'Usuário',
  {
    header = `╭┈⊰ 🫟 『 *${botName}* 』\n┊💭 *Usuário:* #nome#\n┊👑 *Prefixo:* #prefix#\n╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯`,
    menuTopBorder = '╭┈',
    bottomBorder = '╰─┈┈┈┈┈┈┈┈┈┈◜❁◞┈┈┈┈┈┈┈┈┈┈─╯',
    menuTitleIcon = '🍧ฺꕸ▸',
    menuItemIcon = '•.̇𖥨֗🫟⭟',
    separatorIcon = '❁',
    middleBorder = '┊',
    createStickerMenuTitle,
    managementMenuTitle,
  }: StickerMenuRenderOptions = {},
): Promise<string> {
  void menuTitleIcon;

  const { createSection, managementSection } = getStickerSections();
  const resolvedCreateTitle = createStickerMenuTitle ?? createSection.title;
  const resolvedManagementTitle = managementMenuTitle ?? managementSection.title;

  const formattedHeader = header
    .replace(/#nome#/g, userName)
    .replace(/#prefix#/g, prefix);

  const createLines = createSection.entries
    .map(({ command }) => `${middleBorder}${menuItemIcon}${prefix}${command}`)
    .join('\n');
  const managementLines = managementSection.entries
    .map(({ command }) => `${middleBorder}${menuItemIcon}${prefix}${command}`)
    .join('\n');

  return `${formattedHeader}\n\n${menuTopBorder}${separatorIcon} *${resolvedCreateTitle}*\n${middleBorder}\n${createLines}\n${bottomBorder}\n\n${menuTopBorder}${separatorIcon} *${resolvedManagementTitle}*\n${middleBorder}\n${managementLines}\n${bottomBorder}\n`;
}
