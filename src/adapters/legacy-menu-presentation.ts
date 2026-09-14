import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import type { MenuPresentationPort, MenuPresentationRequest, MenuExecutionContext } from '../menu/domain.js';
import type { LegacyMenuRendererKey } from '../menu/catalog.js';

type UnknownRecord = Record<string, unknown>;
type ModuleLoader = () => Promise<unknown>;
type MenuRenderer = (...args: unknown[]) => Promise<unknown> | unknown;

interface FileSystemPort {
  existsSync(filePath: string): boolean;
  readFileSync(filePath: string): Buffer;
}

interface MenuSocketPort {
  sendMessage(
    chatId: string,
    content: UnknownRecord,
    options?: UnknownRecord,
  ): Promise<unknown>;
}

interface MenuDatabasePort {
  isGroupCustomizationEnabled(): boolean;
  getGroupCustomization(chatId: string): unknown;
  getMenuDesignWithDefaults(
    botName: string,
    pushName: string,
    prefix: string,
    overrideDesign?: unknown,
  ): unknown;
  isMenuAudioEnabled(): boolean;
  getMenuAudioPath(): unknown;
  getMenuLerMaisText(): unknown;
}

interface GyomeiMenuRuntimePort {
  readonly PERSONA_MENU_DESIGNS: UnknownRecord;
  highlightMenuCommands(text: unknown, prefix: string): string;
}

interface MenuRuntimeModules {
  readonly renderers: Readonly<Record<LegacyMenuRendererKey, MenuRenderer>>;
  readonly database: MenuDatabasePort;
  readonly gyomei: GyomeiMenuRuntimePort;
}

export interface LegacyMenuPresentationDependencies {
  readonly loadMenus?: ModuleLoader;
  readonly loadDatabase?: ModuleLoader;
  readonly loadGyomeiRuntime?: ModuleLoader;
  readonly fileSystem?: FileSystemPort;
  readonly mediaRoot?: string;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly logger?: Pick<Console, 'warn' | 'error'>;
}

const DEFAULT_MEDIA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../dados/midias',
);

function recordOf(value: unknown, description: string): UnknownRecord {
  if (!value || typeof value !== 'object') {
    throw new Error(`${description} inválido.`);
  }
  return value as UnknownRecord;
}

function functionOf<TFunction extends (...args: never[]) => unknown>(
  record: UnknownRecord,
  name: string,
  description: string,
): TFunction {
  const value = record[name];
  if (typeof value !== 'function') {
    throw new Error(`${description} não exporta ${name}().`);
  }
  return value as TFunction;
}

function socketOf(value: unknown): MenuSocketPort {
  const socket = recordOf(value, 'Socket WhatsApp');
  if (typeof socket.sendMessage !== 'function') {
    throw new Error('Socket WhatsApp não fornece sendMessage().');
  }
  return socket as unknown as MenuSocketPort;
}

function chatIdOf(context: MenuExecutionContext): string {
  const message = recordOf(context.message, 'Mensagem WhatsApp');
  const key = recordOf(message.key, 'Chave da mensagem');
  const chatId = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  if (!chatId) throw new Error('Mensagem sem remoteJid para apresentação do menu.');
  return chatId;
}

function errorSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function defaultLoadMenus(): Promise<unknown> {
  return import(new URL('../../dados/src/menus/.runtime-index.js', import.meta.url).href);
}

async function defaultLoadDatabase(): Promise<unknown> {
  return import(new URL('../../dados/src/utils/database.js', import.meta.url).href);
}

async function defaultLoadGyomeiRuntime(): Promise<unknown> {
  return import(new URL('../../dados/src/utils/gyomeiRuntime.js', import.meta.url).href);
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveRenderers(moduleValue: unknown): Readonly<Record<LegacyMenuRendererKey, MenuRenderer>> {
  const moduleRecord = recordOf(moduleValue, 'Módulo de menus');
  const candidate = moduleRecord.default ?? moduleRecord;
  const renderers = recordOf(candidate, 'Catálogo de menus');
  const required: readonly LegacyMenuRendererKey[] = [
    'menu',
    'menuAlterador',
    'menuIa',
    'menuLogos',
    'menubn',
    'menudown',
    'menuFerramentas',
    'menuadm',
    'menuMembros',
    'menuDono',
    'menuSticker',
    'menuRPG',
    'menuNexo',
    'menuVIP',
  ];

  const resolved = {} as Record<LegacyMenuRendererKey, MenuRenderer>;
  for (const key of required) {
    const renderer = renderers[key];
    if (typeof renderer !== 'function') {
      throw new Error(`Renderer legado ausente: ${key}.`);
    }
    resolved[key] = renderer as MenuRenderer;
  }
  return Object.freeze(resolved);
}

function resolveDatabase(moduleValue: unknown): MenuDatabasePort {
  const record = recordOf(moduleValue, 'Módulo de database');
  return Object.freeze({
    isGroupCustomizationEnabled: functionOf(record, 'isGroupCustomizationEnabled', 'Database') as () => boolean,
    getGroupCustomization: functionOf(record, 'getGroupCustomization', 'Database') as (chatId: string) => unknown,
    getMenuDesignWithDefaults: functionOf(record, 'getMenuDesignWithDefaults', 'Database') as MenuDatabasePort['getMenuDesignWithDefaults'],
    isMenuAudioEnabled: functionOf(record, 'isMenuAudioEnabled', 'Database') as () => boolean,
    getMenuAudioPath: functionOf(record, 'getMenuAudioPath', 'Database') as () => unknown,
    getMenuLerMaisText: functionOf(record, 'getMenuLerMaisText', 'Database') as () => unknown,
  });
}

function resolveGyomeiRuntime(moduleValue: unknown): GyomeiMenuRuntimePort {
  const record = recordOf(moduleValue, 'Runtime Gyomei');
  return Object.freeze({
    PERSONA_MENU_DESIGNS: recordOf(record.PERSONA_MENU_DESIGNS, 'PERSONA_MENU_DESIGNS'),
    highlightMenuCommands: functionOf(record, 'highlightMenuCommands', 'Runtime Gyomei') as GyomeiMenuRuntimePort['highlightMenuCommands'],
  });
}

/**
 * Adapter transitório de apresentação.
 *
 * Ownership e decisão de roteamento já pertencem ao vNext. Este adapter apenas
 * reproduz a apresentação conhecida do legado enquanto os serviços de mídia,
 * design e personalização são portados. Ele não chama dados/src/index.js e,
 * portanto, não cria um segundo executor para o mesmo comando.
 */
export class LegacyMenuPresentationAdapter implements MenuPresentationPort {
  readonly #loadMenus: ModuleLoader;
  readonly #loadDatabase: ModuleLoader;
  readonly #loadGyomeiRuntime: ModuleLoader;
  readonly #fs: FileSystemPort;
  readonly #mediaRoot: string;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #logger: Pick<Console, 'warn' | 'error'>;
  #modulesPromise?: Promise<MenuRuntimeModules>;

  constructor(dependencies: LegacyMenuPresentationDependencies = {}) {
    this.#loadMenus = dependencies.loadMenus ?? defaultLoadMenus;
    this.#loadDatabase = dependencies.loadDatabase ?? defaultLoadDatabase;
    this.#loadGyomeiRuntime = dependencies.loadGyomeiRuntime ?? defaultLoadGyomeiRuntime;
    this.#fs = dependencies.fileSystem ?? {
      existsSync: (filePath) => fs.existsSync(filePath),
      readFileSync: (filePath) => fs.readFileSync(filePath),
    };
    this.#mediaRoot = dependencies.mediaRoot ?? DEFAULT_MEDIA_ROOT;
    this.#sleep = dependencies.sleep ?? defaultSleep;
    this.#logger = dependencies.logger ?? console;
  }

  async #modules(): Promise<MenuRuntimeModules> {
    if (!this.#modulesPromise) {
      this.#modulesPromise = Promise.all([
        this.#loadMenus(),
        this.#loadDatabase(),
        this.#loadGyomeiRuntime(),
      ]).then(([menus, database, gyomei]) => Object.freeze({
        renderers: resolveRenderers(menus),
        database: resolveDatabase(database),
        gyomei: resolveGyomeiRuntime(gyomei),
      }));
    }
    return this.#modulesPromise;
  }

  async #sendText(context: MenuExecutionContext, text: string): Promise<void> {
    const socket = socketOf(context.socket);
    const chatId = chatIdOf(context);
    const content = { text: text.trim(), mentions: [] };
    const options = {
      sendEphemeral: true,
      contextInfo: {
        forwardingScore: 50,
        isForwarded: true,
        externalAdReply: { showAdAttribution: true },
      },
      quoted: context.message,
    };

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await socket.sendMessage(chatId, content, options);
        return;
      } catch (error) {
        if (attempt === 1) {
          this.#logger.warn('[VNEXT][MENU] Falha ao enviar texto; repetindo uma vez.', {
            attempt,
            error: errorSummary(error),
          });
          await this.#sleep(800);
          continue;
        }
        this.#logger.error('[VNEXT][MENU] Falha ao enviar texto após retentativa.', {
          attempt,
          error: errorSummary(error),
        });
        try {
          await socket.sendMessage(chatId, {
            text: '⚠️ Não consegui enviar a resposta completa. Tente o comando novamente em instantes.',
          });
        } catch (fallbackError) {
          this.#logger.error('[VNEXT][MENU] Falha também no aviso mínimo.', {
            error: errorSummary(fallbackError),
          });
        }
        return;
      }
    }
  }

  async present(request: MenuPresentationRequest): Promise<void> {
    const modules = await this.#modules();
    const { descriptor, context } = request;
    const chatId = chatIdOf(context);
    const socket = socketOf(context.socket);
    const isGroup = chatId.endsWith('@g.us');

    let botName = context.botName;
    let customMediaPath: string | null = null;
    let personaDesign: unknown = null;

    if (isGroup && modules.database.isGroupCustomizationEnabled()) {
      const custom = modules.database.getGroupCustomization(chatId);
      if (custom && typeof custom === 'object') {
        const record = custom as UnknownRecord;
        if (typeof record.customName === 'string' && record.customName) {
          botName = record.customName;
        }
        if (
          typeof record.customPhoto === 'string'
          && record.customPhoto
          && this.#fs.existsSync(record.customPhoto)
        ) {
          customMediaPath = record.customPhoto;
        }
        if (typeof record.customPersona === 'string' && record.customPersona) {
          personaDesign = modules.gyomei.PERSONA_MENU_DESIGNS[record.customPersona] ?? null;
        }
      }
    }

    let mediaPath: string;
    let useVideo = false;
    if (customMediaPath) {
      mediaPath = customMediaPath;
    } else {
      const categoryVideo = path.join(this.#mediaRoot, `menu-${descriptor.presentationKey}.mp4`);
      const categoryImage = path.join(this.#mediaRoot, `menu-${descriptor.presentationKey}.jpg`);
      const genericVideo = path.join(this.#mediaRoot, 'menu.mp4');
      const genericImage = path.join(this.#mediaRoot, 'menu.jpg');

      if (this.#fs.existsSync(categoryVideo)) {
        mediaPath = categoryVideo;
        useVideo = true;
      } else if (this.#fs.existsSync(categoryImage)) {
        mediaPath = categoryImage;
      } else if (this.#fs.existsSync(genericVideo)) {
        mediaPath = genericVideo;
        useVideo = true;
      } else {
        mediaPath = genericImage;
      }
    }

    const mediaBuffer = this.#fs.readFileSync(mediaPath);
    const design = modules.database.getMenuDesignWithDefaults(
      botName,
      context.pushName,
      context.prefix,
      personaDesign,
    );
    const renderer = modules.renderers[descriptor.rendererKey];
    const rawMenu = descriptor.liteModeAware
      ? await renderer(context.prefix, botName, context.pushName, context.isLiteMode, design)
      : await renderer(context.prefix, botName, context.pushName, design);
    const menuText = modules.gyomei.highlightMenuCommands(rawMenu, context.prefix);
    const lerMais = String(modules.database.getMenuLerMaisText() || '');

    const sendMedia = async (): Promise<void> => {
      await socket.sendMessage(chatId, {
        [useVideo ? 'video' : 'image']: mediaBuffer,
        caption: lerMais + menuText,
        gifPlayback: useVideo,
        mimetype: useVideo ? 'video/mp4' : 'image/jpeg',
      }, {
        quoted: context.message,
      });
    };

    if (modules.database.isMenuAudioEnabled()) {
      const audioPath = modules.database.getMenuAudioPath();
      if (typeof audioPath === 'string' && audioPath && this.#fs.existsSync(audioPath)) {
        const audioBuffer = this.#fs.readFileSync(audioPath);
        await socket.sendMessage(chatId, {
          audio: audioBuffer,
          mimetype: 'audio/mpeg',
          ptt: false,
        }, {
          quoted: context.message,
        });
        await sendMedia();
        return;
      }
    }

    await sendMedia();
  }

  async replyText(context: MenuExecutionContext, text: string): Promise<void> {
    await this.#sendText(context, text);
  }

  reportError(error: unknown, request: MenuPresentationRequest): void {
    this.#logger.error('[VNEXT][MENU] Falha de apresentação.', {
      menu: request.descriptor.id,
      error: errorSummary(error),
    });
  }
}
