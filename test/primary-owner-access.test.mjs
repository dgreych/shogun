import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { patchPrimaryOwnerRuntime } from '../scripts/primary-owner-runtime-patch.mjs';
import { ramoResetRpg } from '../dist-vnext/rpg/economia/ramos.js';

test('donos principais privados recebem acesso original sem promover donos adicionais', async t => {
  const root = fs.mkdtempSync(path.resolve('test/.owner-access-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve('test'));
    assert.ok(path.basename(root).startsWith('.owner-access-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const source = path.join(root, 'src');
  fs.mkdirSync(path.join(source, 'utils'), { recursive: true });
  for (const file of ['shogunCore.js', 'shogunStore.js', 'nvidiaApi.js']) {
    fs.copyFileSync(path.resolve('dados/src/utils', file), path.join(source, 'utils', file));
  }
  const configPath = path.join(source, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ primaryOwners: ['5511987654321', '987654321@lid'] }));
  const core = await import(pathToFileURL(path.join(source, 'utils/shogunCore.js')));
  const store = await import(pathToFileURL(path.join(source, 'utils/shogunStore.js')));
  store.saveAutomationData({ additionalOwners: ['5511888888888@s.whatsapp.net'] });
  for (const identity of ['5511987654321@s.whatsapp.net', '987654321@lid']) {
    assert.equal(core.isPrimaryOwner(identity, '5511777777777', '7654321@lid'), true);
    assert.equal(core.isAdditionalOwner(identity), true);
  }
  assert.equal(core.isPrimaryOwner('5511777777777@s.whatsapp.net', '5511777777777', '7654321@lid'), true);
  assert.equal(core.isPrimaryOwner('7654321@lid', '5511777777777', '7654321@lid'), true);
  assert.equal(core.isAdditionalOwner('5511888888888@s.whatsapp.net'), true);
  assert.equal(core.isPrimaryOwner('5511888888888@s.whatsapp.net', '5511777777777', '7654321@lid'), false);
  assert.equal(core.isPrimaryOwner('5511666666666@s.whatsapp.net', '5511777777777', '7654321@lid'), false);
  assert.deepEqual(core.listAdditionalOwners(), ['5511888888888@s.whatsapp.net']);
  fs.writeFileSync(configPath, JSON.stringify({ primaryOwners: [] }));
  assert.equal(core.isPrimaryOwner('987654321@lid', '5511777777777', '7654321@lid'), false);
  assert.equal(core.isAdditionalOwner('987654321@lid'), false);
  fs.writeFileSync(configPath, JSON.stringify({ primaryOwners: '987654321@lid' }));
  assert.equal(core.isPrimaryOwner('987654321@lid', '5511777777777', '7654321@lid'), false);
});

test('as guardas reais do RPG mantêm os donos principais e recusam o dono adicional', () => {
  const source = fs.readFileSync('dados/src/index.js', 'utf8');
  const patched = patchPrimaryOwnerRuntime(source);
  assert.equal(patchPrimaryOwnerRuntime(patched), patched);
  const expression = patched.match(/donoPrincipal: (.+?), enviadoPeloBot: isBotSender/)[1];
  const resolvePrincipal = new Function('automacoesV9', 'sender', 'numerodono', 'lidowner', 'info', 'nmrdn', `return ${expression};`);
  const helper = { isPrimaryOwner: sender => sender === 'original@lid' || sender === 'novo@lid' };
  for (const sender of ['original@lid', 'novo@lid', 'adicional@lid']) {
    const economy = { users: { 'jogador@lid': { wallet: 10 } } };
    const principal = resolvePrincipal(helper, sender, '', '', { key: { fromMe: false } }, 'original@lid');
    let saves = 0;
    ramoResetRpg({ econ: economy }, { saveEconomy: () => saves++, getUserName: id => id }, {
      isOwner: true, isSubOwner: false, remetente: sender, donoPrincipal: principal, enviadoPeloBot: false,
    }, 'jogador@lid', [], '');
    assert.equal(saves, sender === 'adicional@lid' ? 0 : 1);
    assert.equal(Boolean(economy.users['jogador@lid']), sender === 'adicional@lid');
  }
  assert.throws(() => patchPrimaryOwnerRuntime('const outraFonte = true;'), /divergente/);
});
