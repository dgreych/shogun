import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildPreparedRuntimeCommandSource } from '../scripts/analyze-runtime-command-surface.mjs';

const source = buildPreparedRuntimeCommandSource();
const retired = ['change' + 'perso', 'mudar' + 'persona', 'setperfil' + 'persona', 'setmidia-' + 'profilep', 'set-' + 'personalidade', 'set' + 'personalidade', 'personalidade', 'test' + 'personalidade', 'test' + 'assistant'];

test('o boot não recria comandos de seleção de perfil nem seus diagnósticos', () => {
  for (const token of retired) assert.doesNotMatch(source, new RegExp(`case ['"]${token}['"]\\s*:`));
});

test('a entrada de produção carrega somente o módulo de voz distribuído', () => {
  const imports = [...source.matchAll(/import\s+[^;]+?from\s+['"]([^'"]*voice\/personas\/[^'"]+)['"]/g)];
  assert.equal(imports.length, 1);
  assert.equal(imports[0][1], '../../dist-vnext/voice/personas/shogun.js');
  const target = new URL('../dist-vnext/voice/personas/shogun.js', import.meta.url);
  assert.equal(fs.existsSync(target), true);
});

test('a distribuição contém somente os arquivos da voz Shogun', () => {
  for (const directory of ['../src/voice/personas/', '../dist-vnext/voice/personas/']) {
    const files = fs.readdirSync(new URL(directory, import.meta.url));
    assert.ok(files.length > 0);
    for (const file of files) assert.match(file, /^shogun\.(?:ts|js(?:\.map)?)$/);
  }
});

test('o cartão do criador apresenta o mantenedor do Shogun', () => {
  assert.ok(source.includes('*Maurício Almeida*'));
  assert.ok(source.includes('Criador e mantenedor do SHOGUN'));
});

test('ativar conversa preserva a configuração do grupo e não oferece troca de identidade', () => {
  const start = source.indexOf("case 'assistente':");
  const block = source.slice(start, source.indexOf("case 'antigore':", start));
  assert.match(block, /groupData\.assistente = true/);
  assert.match(block, /groupData\.assistente = false/);
  assert.match(block, /SHOGUN/);
  assert.doesNotMatch(block, /customPersona|rotulosEspeciais/);
});

test('restaurar a identidade não altera as fotos escolhidas pelo dono', () => {
  const start = source.indexOf("case 'default':");
  const block = source.slice(start, source.indexOf("case 'menumidia':", start));
  assert.match(block, /defaultDisplayName = 'SHOGUN'/);
  assert.doesNotMatch(block, /updateProfilePicture|copyFileSync|setGroupCustomPhoto/);
});

test('configuração de fábrica ignora seleção antiga de perfil', () => {
  const store = fs.readFileSync(new URL('../dados/src/utils/shogunStore.js', import.meta.url), 'utf8');
  assert.match(store, /activePersona: 'shogun'/);
  assert.doesNotMatch(store, /activePersona: process\.env|activePersona: stored\.activePersona/);
});

test('nomegrupo desvincula a seleção antiga e mantém a foto configurada', () => {
  const database = fs.readFileSync(new URL('../dados/src/utils/database.js', import.meta.url), 'utf8');
  const getStart = database.indexOf('const getGroupCustomization =');
  const setEnd = database.indexOf('const setGroupCustomPhoto =', getStart);
  const data = { groups: { grupo: { customPersona: 'perfil_antigo', customName: 'Perfil antigo', customPhoto: '/chosen.jpg' } } };
  const api = new Function('isGroupCustomizationEnabled', 'loadGroupCustomization', 'saveGroupCustomization',
    database.slice(getStart, setEnd) + '\nreturn { getGroupCustomization, setGroupCustomName };')(
    () => true, () => data, value => Object.assign(data, value));
  assert.equal(api.setGroupCustomName('grupo', 'Nome novo'), true);
  assert.equal(api.getGroupCustomization('grupo').customName, 'Nome novo');
  assert.equal(api.getGroupCustomization('grupo').customPhoto, '/chosen.jpg');
  assert.equal(data.groups.grupo.customPersona, undefined);
});
