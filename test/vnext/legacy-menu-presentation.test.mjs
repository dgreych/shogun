import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

import { LegacyMenuPresentationAdapter } from '../../dist-vnext/adapters/legacy-menu-presentation.js';
import { findMenuCommandDescriptor } from '../../dist-vnext/menu/catalog.js';

const RENDERER_KEYS = [
  'menu',
  'menuAlterador',
  'menuShogun',
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

function fixture(options = {}) {
  const calls = [];
  const rendererCalls = [];
  const logs = [];
  const files = new Map(Object.entries(options.files || {}).map(([file, value]) => [path.normalize(file), value]));
  const loadCounts = { menus: 0, database: 0, shogun: 0 };

  const renderers = Object.fromEntries(RENDERER_KEYS.map((key) => [key, async (...args) => {
    rendererCalls.push({ key, args });
    return `${key}:${args.length}`;
  }]));

  const socket = {
    async sendMessage(chatId, content, sendOptions) {
      calls.push({ chatId, content, options: sendOptions });
      if (options.failFirstText && content.text && calls.filter((item) => item.content.text).length === 1) {
        throw new Error('falha-transiente');
      }
      return { key: { id: `msg-${calls.length}` } };
    },
  };

  const groupCustomization = options.groupCustomization ?? null;
  const database = {
    isGroupCustomizationEnabled: () => Boolean(options.groupCustomizationEnabled),
    getGroupCustomization: () => groupCustomization,
    getMenuDesignWithDefaults: (botName, pushName, prefix, overrideDesign) => ({
      botName,
      pushName,
      prefix,
      overrideDesign,
    }),
    isMenuAudioEnabled: () => Boolean(options.audioEnabled),
    getMenuAudioPath: () => options.audioPath ?? null,
    getMenuLerMaisText: () => options.lerMais ?? '',
  };

  const adapter = new LegacyMenuPresentationAdapter({
    loadMenus: async () => {
      loadCounts.menus += 1;
      return { default: renderers };
    },
    loadDatabase: async () => {
      loadCounts.database += 1;
      return database;
    },
    loadShogunRuntime: async () => {
      loadCounts.shogun += 1;
      return {
        PERSONA_MENU_DESIGNS: {
          shogun: { header: 'SHOGUN-THEME' },
        },
        highlightMenuCommands: (text, prefix) => `HIGHLIGHT(${prefix}):${text}`,
        resolveCommandMedia: options.resolveCommandMedia,
      };
    },
    fileSystem: {
      existsSync: (filePath) => files.has(path.normalize(filePath)),
      readFileSync: (filePath) => {
        if (!files.has(path.normalize(filePath))) throw new Error(`arquivo-ausente:${filePath}`);
        return Buffer.from(String(files.get(path.normalize(filePath))));
      },
    },
    mediaRoot: '/media',
    sleep: async () => {},
    logger: {
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
    },
  });

  const context = Object.freeze({
    socket,
    message: { key: { remoteJid: options.chatId ?? 'grupo@g.us' } },
    mediaPath: null,
    messagesCache: {},
    rentalExpirationManager: {},
    prefix: options.prefix ?? '!',
    botName: options.botName ?? '𝖘𝖍𝖔𝖌𝖚𝖓',
    pushName: options.pushName ?? 'Mauricio',
    isOwner: Boolean(options.isOwner),
    isLiteMode: Boolean(options.isLiteMode),
    rawAliases: options.rawAliases || [],
    access: Object.freeze({ resolved: true, isGroup: true, isOwner: Boolean(options.isOwner),
      isSubOwner: false, isGroupAdmin: Boolean(options.isOwner), isRealGroupAdmin: false, isBotAdmin: true }),
  });

  return { adapter, context, calls, rendererCalls, logs, loadCounts };
}

function request(token, context) {
  const descriptor = findMenuCommandDescriptor(token);
  assert.ok(descriptor, `descriptor ausente para ${token}`);
  return Object.freeze({ descriptor, context });
}

test('preserva áudio antes da mídia e prioridade da mídia por categoria', async () => {
  const fx = fixture({
    files: {
      '/media/menu-downloads.jpg': 'CATEGORY-IMAGE',
      '/media/menu.jpg': 'GENERIC-IMAGE',
      '/audio/menu.mp3': 'AUDIO',
    },
    audioEnabled: true,
    audioPath: '/audio/menu.mp3',
    lerMais: 'MORE:',
  });

  await fx.adapter.present(request('menudown', fx.context));

  assert.equal(fx.calls.length, 2);
  assert.deepEqual(fx.calls[0].content, {
    audio: Buffer.from('AUDIO'),
    mimetype: 'audio/mpeg',
    ptt: false,
  });
  assert.deepEqual(fx.calls[1].content, {
    image: Buffer.from('CATEGORY-IMAGE'),
    caption: 'MORE:HIGHLIGHT(!):menudown:4',
    gifPlayback: false,
    mimetype: 'image/jpeg',
  });
  assert.equal(fx.rendererCalls[0].key, 'menudown');
  assert.equal(fx.rendererCalls[0].args.length, 4);
});

test('nova arte da categoria tem prioridade sobre a foto antiga do grupo', async () => {
  const fx = fixture({ files: { '/brand/downloads.jpg': 'CAT-DOWNLOADS', '/custom/group.jpg': 'OLD-PHOTO' },
    groupCustomizationEnabled: true, groupCustomization: { customPhoto: '/custom/group.jpg' },
    resolveCommandMedia: command => command === 'menudown' ? { path: '/brand/downloads.jpg', brand: true } : null });
  await fx.adapter.present(request('menudown', fx.context));
  assert.deepEqual(fx.calls[0].content.image, Buffer.from('CAT-DOWNLOADS'));
  assert.equal(fx.calls[0].content.video, undefined);
});

test('personalização antiga mantém foto e modo lite quando a nova arte está ausente', async () => {
  const fx = fixture({
    files: {
      '/custom/group.jpg': 'GROUP-PHOTO',
      '/media/menu-brincadeiras.mp4': 'CATEGORY-VIDEO',
    },
    groupCustomizationEnabled: true,
    groupCustomization: {
      customName: 'PERFIL ANTIGO',
      customPhoto: '/custom/group.jpg',
      customPersona: 'perfil_antigo',
    },
    isLiteMode: true,
  });

  await fx.adapter.present(request('menubn', fx.context));

  assert.equal(fx.calls.length, 1);
  assert.deepEqual(fx.calls[0].content.image, Buffer.from('GROUP-PHOTO'));
  assert.equal(fx.calls[0].content.video, undefined);
  assert.equal(fx.rendererCalls[0].key, 'menubn');
  assert.equal(fx.rendererCalls[0].args.length, 5);
  assert.equal(fx.rendererCalls[0].args[1], fx.context.botName);
  assert.equal(fx.rendererCalls[0].args[3], true);
  assert.equal(fx.rendererCalls[0].args[4].overrideDesign, undefined);
});

test('seleção nativa resolve aliases privados e seus parâmetros antes de mostrar o comando', async () => {
  const fx = fixture({ files: { '/media/menu.jpg': 'GENERIC' }, rawAliases: [
    { alias: 'play', command: 'reiniciar' },
    { alias: 'resumir', command: 'nexo', fixedParams: 'ativar' },
  ] });
  await fx.adapter.present(request('menudown', fx.context));
  const accessFor = fx.rendererCalls[0].args[3].accessFor;
  assert.equal(accessFor('play').visible, false);
  assert.equal(accessFor('resumir').visible, false);
  assert.equal(accessFor('sticker').visible, true);
});

test('módulos de apresentação são carregados uma única vez por adapter', async () => {
  const fx = fixture({ files: { '/media/menu.jpg': 'GENERIC' } });

  await fx.adapter.present(request('menu', fx.context));
  await fx.adapter.present(request('menushogun', fx.context));

  assert.deepEqual(fx.loadCounts, { menus: 1, database: 1, shogun: 1 });
  assert.equal(fx.rendererCalls.length, 2);
});

test('replyText preserva retentativa curta sem lançar fallback para o legado', async () => {
  const fx = fixture({
    files: { '/media/menu.jpg': 'GENERIC' },
    failFirstText: true,
  });

  await fx.adapter.replyText(fx.context, '  mensagem de teste  ');

  assert.equal(fx.calls.length, 2);
  assert.equal(fx.calls[0].content.text, 'mensagem de teste');
  assert.equal(fx.calls[1].content.text, 'mensagem de teste');
  assert.equal(fx.logs.filter((item) => item[0] === 'warn').length, 1);
});
