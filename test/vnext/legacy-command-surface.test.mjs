import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_DUPLICATE_BASELINE,
  analyzeLegacyCommandFile,
  analyzeLegacyCommandSurface,
  compareLegacyDuplicateBaseline,
} from '../../scripts/analyze-legacy-command-surface.mjs';

test('inventário considera apenas cases do switch(command) principal', () => {
  const source = `
function run(command, sub) {
    switch (command) {
      case 'a':
      case 'alias-a': {
        switch (sub) {
          case 'nao-e-comando-principal': return 1;
        }
        break;
      }
      case 'b':
        return 2;
    }
}
  `;
  const result = analyzeLegacyCommandSurface(source);
  assert.deepEqual(result.tokens, ['a', 'alias-a', 'b']);
  assert.equal(result.familyCount, 2);
  assert.deepEqual(result.families[0].tokens, ['a', 'alias-a']);
  assert.deepEqual(result.families[1].tokens, ['b']);
});

test('scanner não perde cases após regex com chaves nem template aninhado', () => {
  const source = [
    'function run(command) {',
    '    switch (command) {',
    "      case 'antes': {",
    '        const quantifier = /foo{1,3}bar\\}/gi;',
    "        const nested = `externo ${true ? `interno ${({ a: 1 }).a}` : 'x'} fim`;",
    '        void quantifier;',
    '        void nested;',
    '        break;',
    '      }',
    "      case 'gay':",
    "      case 'rankgay': {",
    '        const literalBrace = /[{}]/;',
    '        void literalBrace;',
    '        break;',
    '      }',
    "      case 'tapa':",
    '        return 1;',
    '    }',
    '}',
  ].join('\n');

  const result = analyzeLegacyCommandSurface(source);
  assert.deepEqual(result.tokens, ['antes', 'gay', 'rankgay', 'tapa']);
  assert.equal(result.familyCount, 3);
  assert.deepEqual(result.families[1].tokens, ['gay', 'rankgay']);
});

test('analisador usa o mesmo anchor canônico e recusa switch(command) ambíguo', () => {
  const block = `
function run(command) {
    switch (command) {
      case 'a': return 1;
    }
}
  `;
  assert.throws(
    () => analyzeLegacyCommandSurface(block + block),
    /precisa aparecer exatamente uma vez/,
  );
});

test('baseline detecta duplicata nova e remoção não registrada', () => {
  const clean = compareLegacyDuplicateBaseline(['vender', 'equip', 'slots', 'inventario']);
  assert.equal(clean.ok, true);

  const unexpected = compareLegacyDuplicateBaseline(['equip', 'slots', 'vender', 'inventario', 'novo']);
  assert.equal(unexpected.ok, false);
  assert.deepEqual(unexpected.unexpected, ['novo']);
  assert.deepEqual(unexpected.missing, []);

  const missing = compareLegacyDuplicateBaseline(['equip', 'slots', 'vender']);
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.unexpected, []);
  assert.deepEqual(missing.missing, ['inventario']);
});

test('dispatcher real mantém somente as duplicatas legadas explicitamente congeladas', () => {
  const result = analyzeLegacyCommandFile();
  const baseline = compareLegacyDuplicateBaseline(result.duplicateTokens);

  assert.ok(result.uniqueTokenCount > 0, 'switch(command) real não pode ficar vazio');
  assert.ok(result.familyCount > 0, 'dispatcher real precisa conter famílias');
  assert.equal(baseline.ok, true, `drift de duplicatas: ${JSON.stringify(baseline)}`);
  assert.deepEqual(
    [...result.duplicateTokens].sort(),
    [...LEGACY_DUPLICATE_BASELINE].sort(),
  );
  assert.equal(
    result.tokenCount - result.uniqueTokenCount,
    LEGACY_DUPLICATE_BASELINE.length,
    'cada duplicata conhecida deve continuar aparecendo exatamente duas vezes até sua migração consciente',
  );

  for (const token of ['gay', 'rankgay', 'tapa']) {
    assert.ok(result.tokens.includes(token), `scanner real perdeu token top-level conhecido: ${token}`);
  }
});
