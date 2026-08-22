import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertDeployableCodePath,
  classifyDeploymentPath,
  isProductionStatePath,
  normalizeRepositoryPath,
} from '../../dist-vnext/runtime/state.js';

test('normaliza caminhos sem alterar semântica', () => {
  assert.equal(normalizeRepositoryPath('./dados\\database//grupos/'), 'dados/database/grupos');
});

for (const value of [
  'dados/src/config.json',
  'dados/database',
  'dados/database/qr-code/creds.json',
  'dados/database/grupos/1203630.json',
  'dados/database/dono/automacoes-v9.json',
  'dados/database/users/5511.json',
]) {
  test(`preserva estado vivo: ${value}`, () => {
    assert.equal(isProductionStatePath(value), true);
    assert.equal(classifyDeploymentPath(value), 'preserve-state');
    assert.throws(() => assertDeployableCodePath(value), /não pode ser promovido como código/);
  });
}

for (const value of [
  'dados/src/.runtime-start.js',
  'dados/src/.runtime-index.js',
  'dados/src/funcs/private/.runtime-ia.js',
]) {
  test(`reconhece runtime gerado: ${value}`, () => {
    assert.equal(classifyDeploymentPath(value), 'generated-runtime');
    assert.throws(() => assertDeployableCodePath(value), /generated-runtime/);
  });
}

for (const value of [
  'src/index.ts',
  'src/menu/sticker.ts',
  'dados/src/connect.js',
  'package.json',
]) {
  test(`permite código versionado: ${value}`, () => {
    assert.equal(classifyDeploymentPath(value), 'deployable-code');
    assert.equal(assertDeployableCodePath(value), value);
  });
}
