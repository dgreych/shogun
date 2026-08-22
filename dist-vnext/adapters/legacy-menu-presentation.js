import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
const DEFAULT_MEDIA_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dados/midias');
function recordOf(value, description) {
    if (!value || typeof value !== 'object') {
        throw new Error(`${description} inválido.`);
    }
    return value;
}
function functionOf(record, name, description) {
    const value = record[name];
    if (typeof value !== 'function') {
        throw new Error(`${description} não exporta ${name}().`);
    }
    return value;
}
function socketOf(value) {
    const socket = recordOf(value, 'Socket WhatsApp');
    if (typeof socket.sendMessage !== 'function') {
        throw new Error('Socket WhatsApp não fornece sendMessage().');
    }
    return socket;
}
function chatIdOf(context) {
    const message = recordOf(context.message, 'Mensagem WhatsApp');
    const key = recordOf(message.key, 'Chave da mensagem');
    const chatId = typeof key.remoteJid === 'string' ? key.remoteJid : '';
    if (!chatId)
        throw new Error('Mensagem sem remoteJid para apresentação do menu.');
    return chatId;
}
function errorSummary(error) {
    if (error instanceof Error)
        return `${error.name}: ${error.message}`;
    return String(error);
}
async function defaultLoadMenus() {
    return import(new URL('../../dados/src/menus/.runtime-index.js', import.meta.url).href);
}
async function defaultLoadDatabase() {
    return import(new URL('../../dados/src/utils/database.js', import.meta.url).href);
}
async function defaultLoadGyomeiRuntime() {
    return import(new URL('../../dados/src/utils/gyomeiRuntime.js', import.meta.url).href);
}
function defaultSleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function resolveRenderers(moduleValue) {
    const moduleRecord = recordOf(moduleValue, 'Módulo de menus');
    const candidate = moduleRecord.default ?? moduleRecord;
    const renderers = recordOf(candidate, 'Catálogo de menus');
    const required = [
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
    const resolved = {};
    for (const key of required) {
        const renderer = renderers[key];
        if (typeof renderer !== 'function') {
            throw new Error(`Renderer legado ausente: ${key}.`);
        }
        resolved[key] = renderer;
    }
    return Object.freeze(resolved);
}
function resolveDatabase(moduleValue) {
    const record = recordOf(moduleValue, 'Módulo de database');
    return Object.freeze({
        isGroupCustomizationEnabled: functionOf(record, 'isGroupCustomizationEnabled', 'Database'),
        getGroupCustomization: functionOf(record, 'getGroupCustomization', 'Database'),
        getMenuDesignWithDefaults: functionOf(record, 'getMenuDesignWithDefaults', 'Database'),
        isMenuAudioEnabled: functionOf(record, 'isMenuAudioEnabled', 'Database'),
        getMenuAudioPath: functionOf(record, 'getMenuAudioPath', 'Database'),
        getMenuLerMaisText: functionOf(record, 'getMenuLerMaisText', 'Database'),
    });
}
function resolveGyomeiRuntime(moduleValue) {
    const record = recordOf(moduleValue, 'Runtime Gyomei');
    return Object.freeze({
        PERSONA_MENU_DESIGNS: recordOf(record.PERSONA_MENU_DESIGNS, 'PERSONA_MENU_DESIGNS'),
        highlightMenuCommands: functionOf(record, 'highlightMenuCommands', 'Runtime Gyomei'),
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
export class LegacyMenuPresentationAdapter {
    #loadMenus;
    #loadDatabase;
    #loadGyomeiRuntime;
    #fs;
    #mediaRoot;
    #sleep;
    #logger;
    #modulesPromise;
    constructor(dependencies = {}) {
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
    async #modules() {
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
    async #sendText(context, text) {
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
            }
            catch (error) {
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
                }
                catch (fallbackError) {
                    this.#logger.error('[VNEXT][MENU] Falha também no aviso mínimo.', {
                        error: errorSummary(fallbackError),
                    });
                }
                return;
            }
        }
    }
    async present(request) {
        const modules = await this.#modules();
        const { descriptor, context } = request;
        const chatId = chatIdOf(context);
        const socket = socketOf(context.socket);
        const isGroup = chatId.endsWith('@g.us');
        let botName = context.botName;
        let customMediaPath = null;
        let personaDesign = null;
        if (isGroup && modules.database.isGroupCustomizationEnabled()) {
            const custom = modules.database.getGroupCustomization(chatId);
            if (custom && typeof custom === 'object') {
                const record = custom;
                if (typeof record.customName === 'string' && record.customName) {
                    botName = record.customName;
                }
                if (typeof record.customPhoto === 'string'
                    && record.customPhoto
                    && this.#fs.existsSync(record.customPhoto)) {
                    customMediaPath = record.customPhoto;
                }
                if (typeof record.customPersona === 'string' && record.customPersona) {
                    personaDesign = modules.gyomei.PERSONA_MENU_DESIGNS[record.customPersona] ?? null;
                }
            }
        }
        let mediaPath;
        let useVideo = false;
        if (customMediaPath) {
            mediaPath = customMediaPath;
        }
        else {
            const categoryVideo = path.join(this.#mediaRoot, `menu-${descriptor.presentationKey}.mp4`);
            const categoryImage = path.join(this.#mediaRoot, `menu-${descriptor.presentationKey}.jpg`);
            const genericVideo = path.join(this.#mediaRoot, 'menu.mp4');
            const genericImage = path.join(this.#mediaRoot, 'menu.jpg');
            if (this.#fs.existsSync(categoryVideo)) {
                mediaPath = categoryVideo;
                useVideo = true;
            }
            else if (this.#fs.existsSync(categoryImage)) {
                mediaPath = categoryImage;
            }
            else if (this.#fs.existsSync(genericVideo)) {
                mediaPath = genericVideo;
                useVideo = true;
            }
            else {
                mediaPath = genericImage;
            }
        }
        const mediaBuffer = this.#fs.readFileSync(mediaPath);
        const design = modules.database.getMenuDesignWithDefaults(botName, context.pushName, context.prefix, personaDesign);
        const renderer = modules.renderers[descriptor.rendererKey];
        const rawMenu = descriptor.liteModeAware
            ? await renderer(context.prefix, botName, context.pushName, context.isLiteMode, design)
            : await renderer(context.prefix, botName, context.pushName, design);
        const menuText = modules.gyomei.highlightMenuCommands(rawMenu, context.prefix);
        const lerMais = String(modules.database.getMenuLerMaisText() || '');
        const sendMedia = async () => {
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
    async replyText(context, text) {
        await this.#sendText(context, text);
    }
    reportError(error, request) {
        this.#logger.error('[VNEXT][MENU] Falha de apresentação.', {
            menu: request.descriptor.id,
            error: errorSummary(error),
        });
    }
}
//# sourceMappingURL=legacy-menu-presentation.js.map