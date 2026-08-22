#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FILE = path.join(ROOT, 'dados/src/index.js');
const SEEDS_FILE = path.join(ROOT, 'dados/src/.scripts/vnextMacrotrancheSeeds.json');
const OUTPUT_FILE = path.join(ROOT, 'src/members/generated-domain.ts');
const MANIFEST_FILE = path.join(ROOT, 'dados/src/.scripts/vnextMembersDomainScope.json');

const EXPECTED_BASE = Object.freeze({ families: 29, tokens: 148 });
const EXPECTED_CUTOVER = Object.freeze({ families: 32, tokens: 152 });

// O monólito possui alguns nomes redeclarados em blocos internos da mesma
// família. Uma coleta ingênua por família inteira os confunde com bindings
// locais e os remove da scope externa. Estes três nomes foram encontrados pelo
// compilador como referências externas reais dos cases extraídos e são
// protegidos explicitamente até a família RPG/meustatus ser decomposta em
// módulos menores após o cutover atômico.
const FORCED_BINDINGS_BY_PRIMARY = Object.freeze({
  perfilrpg: Object.freeze(['q', 'timeLeft']),
  meustatus: Object.freeze(['groupData']),
});

const KNOWN_GLOBALS = new Set([
  'Array', 'ArrayBuffer', 'BigInt', 'Boolean', 'Buffer', 'Date', 'Error', 'EvalError',
  'Infinity', 'Intl', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'Promise',
  'RangeError', 'ReferenceError', 'RegExp', 'Set', 'String', 'Symbol', 'SyntaxError',
  'TextDecoder', 'TextEncoder', 'TypeError', 'URIError', 'URL', 'URLSearchParams',
  'WeakMap', 'WeakSet', 'clearImmediate', 'clearInterval', 'clearTimeout', 'console',
  'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape',
  'eval', 'fetch', 'global', 'globalThis', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
  'process', 'queueMicrotask', 'setImmediate', 'setInterval', 'setTimeout', 'structuredClone',
  'undefined', 'unescape',
]);

function bindingNames(name, out) {
  if (!name) return;
  if (ts.isIdentifier(name)) {
    out.add(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isOmittedExpression(element)) continue;
      bindingNames(element.name, out);
    }
  }
}

function collectDeclaredNames(node, out) {
  if (ts.isVariableDeclaration(node)) bindingNames(node.name, out);
  if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
    out.add(node.name.text);
  }
  if (ts.isFunctionLike(node)) {
    for (const parameter of node.parameters) bindingNames(parameter.name, out);
  }
  if (ts.isCatchClause(node) && node.variableDeclaration) {
    bindingNames(node.variableDeclaration.name, out);
  }
  ts.forEachChild(node, (child) => collectDeclaredNames(child, out));
}

function isWithinBindingName(node, binding) {
  if (!binding) return false;
  if (node === binding) return true;
  let current = node.parent;
  while (current && current !== binding.parent) {
    if (current === binding) return true;
    current = current.parent;
  }
  return false;
}

function isReferenceIdentifier(node) {
  const parent = node.parent;
  if (!parent) return true;

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return false;
  if (ts.isGetAccessorDeclaration(parent) && parent.name === node) return false;
  if (ts.isSetAccessorDeclaration(parent) && parent.name === node) return false;
  if (ts.isLabeledStatement(parent) && parent.label === node) return false;
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) return false;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isExportSpecifier(parent)) return false;

  if (ts.isVariableDeclaration(parent) && isWithinBindingName(node, parent.name)) return false;
  if (ts.isParameter(parent) && isWithinBindingName(node, parent.name)) return false;
  if (ts.isBindingElement(parent) && isWithinBindingName(node, parent.name)) return false;
  if ((ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent)) && parent.name === node) return false;
  if (ts.isCatchClause(parent) && parent.variableDeclaration && isWithinBindingName(node, parent.variableDeclaration.name)) return false;

  return true;
}

function isAssignmentOperator(kind) {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function containsNode(root, target) {
  if (root === target) return true;
  let found = false;
  ts.forEachChild(root, (child) => {
    if (!found && containsNode(child, target)) found = true;
  });
  return found;
}

function isWriteIdentifier(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isBinaryExpression(parent) && isAssignmentOperator(parent.operatorToken.kind)) {
    return containsNode(parent.left, node);
  }
  if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent))
    && (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)) {
    return true;
  }
  if ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) && parent.initializer === node) return true;
  return false;
}

function collectFreeBindings(family) {
  const declared = new Set();
  for (const clause of family.clauses) {
    for (const statement of clause.statements) collectDeclaredNames(statement, declared);
  }

  const free = new Set();
  const writes = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      const name = node.text;
      if (!declared.has(name) && !KNOWN_GLOBALS.has(name) && name !== 'command') {
        free.add(name);
        if (isWriteIdentifier(node)) writes.add(name);
      }
    }
    ts.forEachChild(node, visit);
  };

  for (const clause of family.clauses) {
    for (const statement of clause.statements) visit(statement);
  }
  return { free, writes };
}

function caseToken(clause) {
  if (!ts.isCaseClause(clause)) return null;
  const expression = clause.expression;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text.trim().toLowerCase();
  }
  throw new Error(`Case não literal no domínio Members próximo ao offset ${clause.getStart()}.`);
}

function collectFamilies(switchStatement, sourceFile, sourceText) {
  const families = [];
  let pending = [];

  const flush = () => {
    if (!pending.length) return;
    const tokens = pending.map(caseToken).filter(Boolean);
    const first = pending[0];
    const last = pending[pending.length - 1];
    families.push({
      tokens,
      clauses: pending,
      start: first.getStart(sourceFile),
      end: last.end,
      source: sourceText.slice(first.getStart(sourceFile), last.end),
    });
    pending = [];
  };

  for (const clause of switchStatement.caseBlock.clauses) {
    if (ts.isDefaultClause(clause)) {
      flush();
      continue;
    }
    pending.push(clause);
    if (clause.statements.length > 0) flush();
  }
  flush();
  return families;
}

function findMainSwitch(sourceFile) {
  const matches = [];
  const visit = (node) => {
    if (ts.isSwitchStatement(node) && ts.isIdentifier(node.expression) && node.expression.text === 'command') {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (matches.length !== 1) {
    throw new Error(`switch(command) principal precisa ser único; encontrado ${matches.length}.`);
  }
  return matches[0];
}

function resolveSeedIndexes(families, seeds) {
  const indexes = new Set();
  const unresolved = [];
  for (const rawSeed of seeds) {
    const seed = String(rawSeed).trim().toLowerCase();
    const matches = families
      .map((family, index) => ({ family, index }))
      .filter(({ family }) => family.tokens.includes(seed));
    if (!matches.length) {
      unresolved.push(seed);
      continue;
    }
    if (matches.length > 1) {
      throw new Error(`Seed Members ambíguo ${seed}: ${matches.map(({ index }) => index).join(',')}.`);
    }
    indexes.add(matches[0].index);
  }
  if (unresolved.length) throw new Error(`Seeds Members não resolvidos: ${unresolved.join(',')}.`);
  return indexes;
}

function closeDuplicateFamilies(families, indexes) {
  const selected = new Set(indexes);
  let changed = true;
  while (changed) {
    changed = false;
    const selectedTokens = new Set([...selected].flatMap((index) => families[index].tokens));
    families.forEach((family, index) => {
      if (selected.has(index)) return;
      if (family.tokens.some((token) => selectedTokens.has(token))) {
        selected.add(index);
        changed = true;
      }
    });
  }
  return selected;
}

function sanitizeFunctionName(primary, index) {
  return `member_${String(index).padStart(3, '0')}_${primary.replace(/[^A-Za-z0-9_$]/g, '_')}`;
}

function generateDomain({ families, selectedIndexes, freeBindings, writeBindings }) {
  const selected = [...selectedIndexes].sort((a, b) => families[a].start - families[b].start);
  const lines = [];

  // A implementação é um artefato gerado diretamente do JavaScript legado e
  // não deve ser editada nem "corrigida" manualmente. O contrato público que a
  // consome continua sob strict TypeScript em src/members/domain.ts. O
  // ts-nocheck aqui evita transformar milhares de linhas de JS histórico em
  // centenas de casts sem valor semântico antes do cutover. Sintaxe, ownership,
  // roteamento e comportamento continuam cobertos pelos gates e testes.
  lines.push('// @ts-nocheck');
  lines.push('// AUTO-GENERATED FROM dados/src/index.js. DO NOT EDIT BY HAND.');
  lines.push("import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';");
  lines.push('');
  lines.push('export type MembersGeneratedScope = Record<string, any> & { command: string };');
  lines.push('');
  lines.push('export interface MembersGeneratedExecutionContext {');
  lines.push('  readonly membersScope: MembersGeneratedScope;');
  lines.push('}');
  lines.push('');
  lines.push('type MembersGeneratedHandler = (scope: MembersGeneratedScope) => Promise<unknown>;');
  lines.push('');

  const tokenOwners = new Map();
  for (const index of selected) {
    const family = families[index];
    const primary = family.tokens[0] || 'command';
    const functionName = sanitizeFunctionName(primary, index);
    const analysis = collectFreeBindings(family);
    for (const forced of FORCED_BINDINGS_BY_PRIMARY[primary] || []) analysis.free.add(forced);

    const bindings = [...analysis.free].sort();
    const writes = [...analysis.writes].sort();
    bindings.forEach((name) => freeBindings.add(name));
    writes.forEach((name) => writeBindings.add(name));

    lines.push(`async function ${functionName}(scope: MembersGeneratedScope): Promise<unknown> {`);
    lines.push('  const command = String(scope.command || "").trim().toLowerCase();');
    if (bindings.length) lines.push(`  let { ${bindings.join(', ')} } = scope;`);
    lines.push('  try {');
    lines.push('    switch (command) {');
    for (const sourceLine of family.source.split(/\r?\n/)) lines.push(`      ${sourceLine}`);
    lines.push('    }');
    lines.push('    return undefined;');
    lines.push('  } finally {');
    if (writes.length) {
      for (const name of writes) lines.push(`    scope.${name} = ${name};`);
    } else {
      lines.push('    // Nenhum binding externo mutável nesta família.');
    }
    lines.push('  }');
    lines.push('}');
    lines.push('');

    for (const token of family.tokens) {
      if (!tokenOwners.has(token)) tokenOwners.set(token, functionName);
    }
  }

  lines.push('const HANDLERS = new Map<string, MembersGeneratedHandler>([');
  for (const [token, functionName] of [...tokenOwners.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  [${JSON.stringify(token)}, ${functionName}],`);
  }
  lines.push(']);');
  lines.push('');
  lines.push('export const MEMBERS_GENERATED_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);');
  lines.push('');
  lines.push('export class MembersGeneratedDomainDispatchTarget');
  lines.push('implements VNextCommandDispatchTarget<MembersGeneratedExecutionContext> {');
  lines.push('  async dispatch(command: string, context: MembersGeneratedExecutionContext): Promise<boolean> {');
  lines.push("    const normalized = String(command || '').trim().toLowerCase();");
  lines.push('    const handler = HANDLERS.get(normalized);');
  lines.push('    if (!handler) return false;');
  lines.push('    context.membersScope.command = normalized;');
  lines.push('    await handler(context.membersScope);');
  lines.push('    return true;');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  return { source: `${lines.join('\n')}\n`, tokenOwners };
}

const sourceText = fs.readFileSync(SOURCE_FILE, 'utf8');
const config = JSON.parse(fs.readFileSync(SEEDS_FILE, 'utf8'));
const seeds = config?.buckets?.members || [];
const sourceFile = ts.createSourceFile(SOURCE_FILE, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const mainSwitch = findMainSwitch(sourceFile);
const families = collectFamilies(mainSwitch, sourceFile, sourceText);

const baseIndexes = resolveSeedIndexes(families, seeds);
const baseTokens = new Set([...baseIndexes].flatMap((index) => families[index].tokens));
if (baseIndexes.size !== EXPECTED_BASE.families || baseTokens.size !== EXPECTED_BASE.tokens) {
  throw new Error(
    `Drift Members base: esperado=${EXPECTED_BASE.families}/${EXPECTED_BASE.tokens} `
    + `real=${baseIndexes.size}/${baseTokens.size}.`,
  );
}

const selectedIndexes = closeDuplicateFamilies(families, baseIndexes);
const selectedTokens = new Set([...selectedIndexes].flatMap((index) => families[index].tokens));
if (selectedIndexes.size !== EXPECTED_CUTOVER.families || selectedTokens.size !== EXPECTED_CUTOVER.tokens) {
  throw new Error(
    `Drift Members cutover: esperado=${EXPECTED_CUTOVER.families}/${EXPECTED_CUTOVER.tokens} `
    + `real=${selectedIndexes.size}/${selectedTokens.size}.`,
  );
}

const freeBindings = new Set();
const writeBindings = new Set();
const generated = generateDomain({ families, selectedIndexes, freeBindings, writeBindings });

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, generated.source);

const selectedFamilies = [...selectedIndexes]
  .sort((a, b) => families[a].start - families[b].start)
  .map((index) => ({
    index,
    baseMemberFamily: baseIndexes.has(index),
    primary: families[index].tokens[0],
    tokens: families[index].tokens,
  }));

const closureIndexes = [...selectedIndexes].filter((index) => !baseIndexes.has(index));
const manifest = {
  schemaVersion: 2,
  id: 'members-domain-full-cutover',
  strategy: 'atomic-domain-cutover',
  implementationMode: 'generated-direct-behavior-with-strict-typed-boundary',
  baseExpected: EXPECTED_BASE,
  baseActual: { families: baseIndexes.size, tokens: baseTokens.size },
  cutoverExpected: EXPECTED_CUTOVER,
  closure: {
    addedFamilies: closureIndexes.length,
    addedTokens: selectedTokens.size - baseTokens.size,
    familyIndexes: closureIndexes,
  },
  selected: { families: selectedIndexes.size, tokens: selectedTokens.size },
  families: selectedFamilies,
  tokens: [...selectedTokens].sort(),
  forcedBindings: FORCED_BINDINGS_BY_PRIMARY,
  freeBindings: [...freeBindings].sort(),
  writeBindings: [...writeBindings].sort(),
};
fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`MEMBERS_BASE_FAMILIES=${baseIndexes.size}`);
console.log(`MEMBERS_BASE_TOKENS=${baseTokens.size}`);
console.log(`MEMBERS_CUTOVER_FAMILIES=${selectedIndexes.size}`);
console.log(`MEMBERS_CUTOVER_TOKENS=${selectedTokens.size}`);
console.log(`MEMBERS_DUPLICATE_CLOSURE_FAMILIES=${closureIndexes.length}`);
console.log(`MEMBERS_DUPLICATE_CLOSURE_TOKENS=${manifest.closure.addedTokens}`);
console.log(`MEMBERS_FREE_BINDINGS=${manifest.freeBindings.length}`);
console.log(`MEMBERS_WRITE_BINDINGS=${manifest.writeBindings.join(',') || 'NONE'}`);
console.log(`MEMBERS_OUTPUT=${path.relative(ROOT, OUTPUT_FILE)}`);
console.log(`MEMBERS_MANIFEST=${path.relative(ROOT, MANIFEST_FILE)}`);
