export type LegacyMenuRendererKey =
  | 'menu'
  | 'menuAlterador'
  | 'menuIa'
  | 'menuLogos'
  | 'menubn'
  | 'menudown'
  | 'menuFerramentas'
  | 'menuadm'
  | 'menuMembros'
  | 'menuDono'
  | 'menuSticker'
  | 'menuRPG'
  | 'menuNexo';

export interface MenuCommandDescriptor {
  readonly id: string;
  readonly presentationKey: string;
  readonly rendererKey: LegacyMenuRendererKey;
  readonly tokens: readonly string[];
  readonly ownerOnly: boolean;
  readonly liteModeAware: boolean;
  readonly failureMessage: string;
}

function descriptor(input: MenuCommandDescriptor): MenuCommandDescriptor {
  return Object.freeze({
    ...input,
    tokens: Object.freeze([...input.tokens]),
  });
}

/**
 * Ownership vNext do domínio de apresentação.
 *
 * Cada entrada corresponde a UMA família real do switch(command) legado.
 * O gate de ownership recusa famílias parcialmente migradas: se um alias de
 * uma família ficar de fora, a qualificação falha em vez de criar dois donos
 * silenciosos para a mesma implementação.
 */
export const MENU_COMMAND_DESCRIPTORS = Object.freeze([
  descriptor({
    id: 'principal',
    presentationKey: 'principal',
    rendererKey: 'menu',
    tokens: ['menu', 'help', 'comandos', 'commands'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu principal.',
  }),
  descriptor({
    id: 'alteradores',
    presentationKey: 'alteradores',
    rendererKey: 'menuAlterador',
    tokens: ['alteradores', 'menualterador', 'menualteradores', 'changersmenu', 'changers'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de alteradores.',
  }),
  descriptor({
    id: 'ia',
    presentationKey: 'ia',
    rendererKey: 'menuIa',
    tokens: ['menuia', 'aimenu', 'menuias'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de IA.',
  }),
  descriptor({
    id: 'logotipos',
    presentationKey: 'logotipos',
    rendererKey: 'menuLogos',
    tokens: ['menulogo', 'menulogos'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de Logos.',
  }),
  descriptor({
    id: 'brincadeiras',
    presentationKey: 'brincadeiras',
    rendererKey: 'menubn',
    tokens: ['menubn', 'menubrincadeira', 'menubrincadeiras', 'gamemenu'],
    ownerOnly: false,
    liteModeAware: true,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de brincadeiras.',
  }),
  descriptor({
    id: 'downloads',
    presentationKey: 'downloads',
    rendererKey: 'menudown',
    tokens: ['menudown', 'menudownload', 'menudownloads', 'downmenu', 'downloadmenu'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de downloads.',
  }),
  descriptor({
    id: 'ferramentas',
    presentationKey: 'ferramentas',
    rendererKey: 'menuFerramentas',
    tokens: ['ferramentas', 'menuferramentas', 'menuferramenta', 'toolsmenu', 'tools'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de ferramentas.',
  }),
  descriptor({
    id: 'admin',
    presentationKey: 'admin',
    rendererKey: 'menuadm',
    tokens: ['menuadm', 'menuadmin', 'menuadmins', 'admmenu'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de administração.',
  }),
  descriptor({
    id: 'membros',
    presentationKey: 'membros',
    rendererKey: 'menuMembros',
    tokens: ['menumembros', 'menumemb', 'menugeral', 'membmenu', 'membermenu'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de membros.',
  }),
  descriptor({
    id: 'dono',
    presentationKey: 'dono',
    rendererKey: 'menuDono',
    tokens: ['menudono', 'ownermenu'],
    ownerOnly: true,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu do dono.',
  }),
  descriptor({
    id: 'stickers',
    presentationKey: 'stickers',
    rendererKey: 'menuSticker',
    tokens: ['stickermenu', 'menusticker', 'menufig'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu de stickers.',
  }),
  descriptor({
    id: 'rpg',
    presentationKey: 'menurpg',
    rendererKey: 'menuRPG',
    tokens: ['menurpg', 'rpg'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu RPG.',
  }),
  descriptor({
    id: 'nexo',
    presentationKey: 'menunexo',
    rendererKey: 'menuNexo',
    tokens: ['menunexo'],
    ownerOnly: false,
    liteModeAware: false,
    failureMessage: '❌ Ocorreu um erro ao carregar o menu NEXO.',
  }),
] satisfies readonly MenuCommandDescriptor[]);

export const MENU_COMMAND_TOKENS = Object.freeze(
  MENU_COMMAND_DESCRIPTORS.flatMap((item) => item.tokens),
);

const menuByToken = new Map<string, MenuCommandDescriptor>();
for (const item of MENU_COMMAND_DESCRIPTORS) {
  for (const token of item.tokens) {
    if (menuByToken.has(token)) {
      throw new Error(`Token duplicado no catálogo vNext de menus: ${token}`);
    }
    menuByToken.set(token, item);
  }
}

export function findMenuCommandDescriptor(command: string): MenuCommandDescriptor | undefined {
  return menuByToken.get(String(command || '').trim().toLowerCase());
}
