import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

async function isolatedCore(t) {
  const root = fs.mkdtempSync(path.resolve('test/.single-shogun-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve('test'));
    assert.ok(path.basename(root).startsWith('.single-shogun-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, 'src/utils'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/menus'), { recursive: true });
  for (const file of ['shogunCore.js', 'shogunStore.js', 'nvidiaApi.js']) {
    fs.copyFileSync(path.resolve('dados/src/utils', file), path.join(root, 'src/utils', file));
  }
  fs.copyFileSync('dados/src/menus/theme.js', path.join(root, 'src/menus/theme.js'));
  fs.writeFileSync(path.join(root, 'src/config.json'), JSON.stringify({ nomebot: 'SHOGUN' }));
  return {
    core: await import(pathToFileURL(path.join(root, 'src/utils/shogunCore.js'))),
    store: await import(pathToFileURL(path.join(root, 'src/utils/shogunStore.js'))),
  };
}

test('catálogo e leitura de estado oferecem somente Shogun', async t => {
  const { core, store } = await isolatedCore(t);
  assert.deepEqual(core.PERSONALITY_KEYS, ['shogun']);
  assert.deepEqual(Object.keys(core.PERSONA_LABELS), ['shogun']);
  assert.deepEqual(Object.keys(core.PERSONA_DESCRIPTIONS), ['shogun']);
  assert.deepEqual(Object.keys(core.PERSONA_MENU_DESIGNS), ['shogun']);
  store.saveAutomationData({ activePersona: 'perfil_antigo', additionalOwners: ['123456789@lid'] });
  assert.equal(core.getActivePersona(), 'shogun');
  assert.equal(core.setActivePersona('perfil_antigo').ok, false);
  assert.deepEqual(core.listAdditionalOwners(), ['123456789@lid']);
  assert.equal(core.setActivePersona('shogun').ok, true);
});

test('parâmetros antigos não trocam a voz nem retomam um texto legado', async t => {
  const { core } = await isolatedCore(t);
  for (const profile of ['shogun', 'perfil_antigo', 'pro', undefined]) {
    for (const modoAdulto of [false, true]) {
      const prompt = core.buildAssistantSystemPrompt(profile, 'TEXTO_LEGADO_NAO_USAR', { modoAdulto });
      assert.equal(prompt.includes('TEXTO_LEGADO_NAO_USAR'), false);
      assert.ok(prompt.includes('𝖘𝖍𝖔𝖌𝖚𝖓'));
      assert.ok(prompt.includes('"resp"'));
      assert.ok(prompt.includes('"aprender"'));
      assert.equal(prompt.includes(String.fromCharCode(92) + 'n'), false);
      assert.equal(/operação militar|patente|relatório de campo/i.test(prompt), false);
    }
  }
});

test('orientações de dono mantêm o mesmo contrato e não criam outro perfil', async t => {
  const { core } = await isolatedCore(t);
  assert.equal(core.setAssistantPrompt('perfil_antigo', 'outro perfil').ok, false);
  assert.equal(core.setAssistantPrompt('shogun', 'Explique as regras da comunidade com clareza.').ok, true);
  const prompt = core.buildAssistantSystemPrompt('perfil_antigo', 'TEXTO_LEGADO_NAO_USAR');
  assert.ok(prompt.includes('Explique as regras da comunidade com clareza.'));
  assert.ok(prompt.includes('Seu nome é 𝖘𝖍𝖔𝖌𝖚𝖓'));
});

test('a mídia escolhida no perfil anterior continua disponível para Shogun', async t => {
  const { store } = await isolatedCore(t);
  const media = { path: '/chosen/menu.mp4', type: 'video', gifPlayback: false };
  store.saveAutomationData({ activePersona: 'perfil_antigo', commandMedia: { perfil_antigo_menu: media } });
  assert.deepEqual(store.getAutomationData().commandMedia.shogun_menu, media);
  assert.equal(store.getAutomationData().activePersona, 'shogun');
  const current = { path: '/chosen/new.jpg', type: 'image' };
  store.saveAutomationData({ activePersona: 'perfil_antigo', commandMedia: { perfil_antigo_menu: media, shogun_menu: current } });
  assert.deepEqual(store.getAutomationData().commandMedia.shogun_menu, current);
});
