#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = path.join(ROOT, 'dados/src/index.js');
const MAIN_SWITCH_ANCHOR = '    switch (command) {';

// Dívida real do baseline legado. Esses tokens aparecem mais de uma vez no
// switch(command) principal. Durante a migração eles precisam ser resolvidos
// conscientemente, não apagados silenciosamente só para deixar um gate verde.
// Qualquer entrada nova, ou desaparecimento não acompanhado da atualização
// deste baseline, é tratado como drift estrutural.
export const LEGACY_DUPLICATE_BASELINE = Object.freeze([
  'equip',
  'slots',
  'vender',
  'inventario',
]);

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char || '');
}

function skipQuoted(source, start, quote) {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  throw new Error(`String ${quote} não terminada no source legado.`);
}

function skipComment(source, start) {
  if (source[start + 1] === '/') {
    const end = source.indexOf('\n', start + 2);
    return end === -1 ? source.length : end + 1;
  }
  if (source[start + 1] === '*') {
    const end = source.indexOf('*/', start + 2);
    if (end === -1) throw new Error('Comentário de bloco não terminado no source legado.');
    return end + 2;
  }
  return start;
}

const REGEX_PREFIX_KEYWORDS = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new',
  'of', 'return', 'throw', 'typeof', 'void', 'yield',
]);

function isRegexStart(source, start) {
  if (source[start] !== '/' || source[start + 1] === '/' || source[start + 1] === '*') return false;

  let i = start - 1;
  while (i >= 0 && /\s/.test(source[i])) i -= 1;
  if (i < 0) return true;

  const previous = source[i];
  if ('([{=,:;!?&|^~<>+-*%'.includes(previous)) return true;
  if (previous === '>') return true;

  if (isIdentifierPart(previous)) {
    const end = i + 1;
    while (i >= 0 && isIdentifierPart(source[i])) i -= 1;
    return REGEX_PREFIX_KEYWORDS.has(source.slice(i + 1, end));
  }

  return false;
}

function skipRegex(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === '[') {
      inClass = true;
      i += 1;
      continue;
    }
    if (char === ']' && inClass) {
      inClass = false;
      i += 1;
      continue;
    }
    if ((char === '\n' || char === '\r') && !inClass) {
      throw new Error('Literal regex não terminado no source legado.');
    }
    if (char === '/' && !inClass) {
      i += 1;
      while (/[A-Za-z]/.test(source[i] || '')) i += 1;
      return i;
    }
    i += 1;
  }
  throw new Error('Literal regex não terminado no source legado.');
}

function skipTemplateExpression(source, openBraceIndex) {
  let depth = 1;
  for (let i = openBraceIndex + 1; i < source.length;) {
    const char = source[i];
    if (char === "'" || char === '"') {
      i = skipQuoted(source, i, char);
      continue;
    }
    if (char === '`') {
      i = skipTemplate(source, i);
      continue;
    }
    if (char === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipComment(source, i);
      continue;
    }
    if (char === '/' && isRegexStart(source, i)) {
      i = skipRegex(source, i);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  throw new Error('Expressão ${...} não terminada em template literal legado.');
}

function skipTemplate(source, start) {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '`') return i + 1;
    if (source[i] === '$' && source[i + 1] === '{') {
      i = skipTemplateExpression(source, i + 1);
      continue;
    }
    i += 1;
  }
  throw new Error('Template literal não terminado no source legado.');
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length;) {
    const char = source[i];
    if (char === "'" || char === '"') {
      i = skipQuoted(source, i, char);
      continue;
    }
    if (char === '`') {
      i = skipTemplate(source, i);
      continue;
    }
    if (char === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipComment(source, i);
      continue;
    }
    if (char === '/' && isRegexStart(source, i)) {
      i = skipRegex(source, i);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  throw new Error('Bloco switch(command) não terminou corretamente.');
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function findMainCommandSwitch(source) {
  const occurrences = countOccurrences(source, MAIN_SWITCH_ANCHOR);
  if (occurrences !== 1) {
    throw new Error(`Anchor canônico do switch(command) precisa aparecer exatamente uma vez; encontrado ${occurrences}.`);
  }
  const anchorIndex = source.indexOf(MAIN_SWITCH_ANCHOR);
  const openIndex = anchorIndex + MAIN_SWITCH_ANCHOR.lastIndexOf('{');
  const closeIndex = findMatchingBrace(source, openIndex);
  return { openIndex, closeIndex, body: source.slice(openIndex + 1, closeIndex) };
}

function decodeSimpleEscape(next) {
  const map = {
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
    v: '\v',
    '0': '\0',
    "'": "'",
    '"': '"',
    '\\': '\\',
  };
  return Object.prototype.hasOwnProperty.call(map, next) ? map[next] : next;
}

function parseStringLiteral(source, start) {
  const quote = source[start];
  if (quote !== "'" && quote !== '"') return null;
  let i = start + 1;
  let value = '';
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      const next = source[i + 1];
      if (next === undefined) throw new Error('Escape inválido em case legado.');
      value += decodeSimpleEscape(next);
      i += 2;
      continue;
    }
    if (char === quote) return { value, end: i + 1 };
    value += char;
    i += 1;
  }
  throw new Error('Literal de case não terminado.');
}

function isTopLevelCase(body, index, depth) {
  return depth === 0
    && body.startsWith('case', index)
    && !isIdentifierPart(body[index - 1])
    && !isIdentifierPart(body[index + 4]);
}

function freezeFamily(tokens) {
  return Object.freeze({
    primary: tokens[0],
    tokens: Object.freeze([...tokens]),
  });
}

export function compareLegacyDuplicateBaseline(
  actualTokens,
  expectedTokens = LEGACY_DUPLICATE_BASELINE,
) {
  const actual = [...new Set(actualTokens)].sort();
  const expected = [...new Set(expectedTokens)].sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const unexpected = actual.filter((token) => !expectedSet.has(token));
  const missing = expected.filter((token) => !actualSet.has(token));

  return Object.freeze({
    ok: unexpected.length === 0 && missing.length === 0,
    actual: Object.freeze(actual),
    expected: Object.freeze(expected),
    unexpected: Object.freeze(unexpected),
    missing: Object.freeze(missing),
  });
}

export function analyzeLegacyCommandSurface(source) {
  const { body } = findMainCommandSwitch(source);
  const tokens = [];
  const families = [];
  let pendingTokens = [];
  let depth = 0;

  for (let i = 0; i < body.length;) {
    const char = body[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === '/' && (body[i + 1] === '/' || body[i + 1] === '*')) {
      i = skipComment(body, i);
      continue;
    }

    if (char === '/' && isRegexStart(body, i)) {
      i = skipRegex(body, i);
      continue;
    }

    if (isTopLevelCase(body, i, depth)) {
      let cursor = i + 4;
      while (/\s/.test(body[cursor] || '')) cursor += 1;
      const literal = parseStringLiteral(body, cursor);
      if (!literal) throw new Error(`Case não literal detectado próximo ao offset ${i}.`);
      cursor = literal.end;
      while (/\s/.test(body[cursor] || '')) cursor += 1;
      if (body[cursor] !== ':') throw new Error(`Case sem ':' para token ${literal.value}.`);
      const token = literal.value.trim().toLowerCase();
      if (!token) throw new Error('Token vazio no switch(command).');
      tokens.push(token);
      pendingTokens.push(token);
      i = cursor + 1;
      continue;
    }

    // O primeiro token real depois de uma sequência de cases inicia o corpo
    // daquela família. Isso precisa acontecer ANTES de consumir uma chave de
    // bloco, senão `case 'a': { ... } case 'b':` seria agrupado como uma única
    // família.
    if (depth === 0 && pendingTokens.length > 0) {
      families.push(freezeFamily(pendingTokens));
      pendingTokens = [];
    }

    if (char === "'" || char === '"') {
      i = skipQuoted(body, i, char);
      continue;
    }
    if (char === '`') {
      i = skipTemplate(body, i);
      continue;
    }
    if (char === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (char === '}') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }

    i += 1;
  }

  if (pendingTokens.length > 0) families.push(freezeFamily(pendingTokens));

  const duplicates = tokens.filter((token, index) => tokens.indexOf(token) !== index);
  const uniqueTokens = [...new Set(tokens)];

  return Object.freeze({
    tokenCount: tokens.length,
    uniqueTokenCount: uniqueTokens.length,
    familyCount: families.length,
    duplicateTokens: Object.freeze([...new Set(duplicates)]),
    tokens: Object.freeze(uniqueTokens),
    families: Object.freeze(families),
  });
}

export function analyzeLegacyCommandFile(filePath = DEFAULT_SOURCE) {
  return analyzeLegacyCommandSurface(fs.readFileSync(filePath, 'utf8'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = analyzeLegacyCommandFile(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE);
  const baseline = compareLegacyDuplicateBaseline(result.duplicateTokens);

  console.log(`LEGACY_COMMAND_TOKENS=${result.uniqueTokenCount}`);
  console.log(`LEGACY_COMMAND_FAMILIES=${result.familyCount}`);
  console.log(`LEGACY_COMMAND_DUPLICATES=${result.duplicateTokens.length}`);
  if (result.duplicateTokens.length > 0) {
    console.log(`LEGACY_DUPLICATE_TOKENS=${result.duplicateTokens.join(',')}`);
  }
  console.log(`LEGACY_DUPLICATE_BASELINE=${baseline.ok ? 'OK' : 'DRIFT'}`);

  if (!baseline.ok) {
    if (baseline.unexpected.length > 0) {
      console.log(`LEGACY_DUPLICATE_UNEXPECTED=${baseline.unexpected.join(',')}`);
    }
    if (baseline.missing.length > 0) {
      console.log(`LEGACY_DUPLICATE_MISSING=${baseline.missing.join(',')}`);
    }
    process.exitCode = 2;
  }
}
