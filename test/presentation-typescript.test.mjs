import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { executeInstagramDownload as legacyInstagram } from '../dados/src/utils/instagramCommand.js';
import { executeInstagramDownload as typedInstagram } from '../dist-vnext/downloads/instagram-command.js';
import { isValidReaction as legacyReaction } from '../dados/src/utils/reactionPresentation.js';
import { isValidReaction as typedReaction } from '../dist-vnext/presentation/reaction.js';
import { createShogunMenuTheme as legacyTheme } from '../dados/src/menus/theme.js';
import { createShogunMenuTheme as typedTheme } from '../dist-vnext/presentation/theme.js';
test('fachadas usam os mesmos executores TypeScript sem implementação duplicada', () => {
  assert.equal(legacyInstagram, typedInstagram);
  assert.equal(legacyReaction, typedReaction);
  assert.equal(legacyTheme, typedTheme);
  for (const file of ['dados/src/utils/instagramCommand.js','dados/src/utils/reactionPresentation.js','dados/src/menus/theme.js','dados/src/menus/renderedOutput.js']) {
    assert.match(fs.readFileSync(file,'utf8'), /^export \{/);
  }
});

test('transporte e renderer de respostas também têm implementação única tipada', async () => {
  const legacy = await import('../dados/src/utils/commandPresentation.js');
  const typed = await import('../dist-vnext/presentation/command-presentation.js');
  for (const name of ['renderCommandCard','formatCommandResponse','installBotPresentation','installCommandPresentation']) assert.equal(legacy[name], typed[name]);
});

test('catálogo de menus também usa renderer tipado único', async () => {
  const legacy = await import('../dados/src/menus/presentation.js');
  const typed = await import('../dist-vnext/presentation/menu.js');
  for (const name of ['renderShogunMenu','selectMenuEntries','prepareMenuSections','sanitizeMenuDisplayName']) assert.equal(legacy[name],typed[name]);
});

test('fila ativa usa núcleo tipado único', async () => {
  const legacy=await import('../dados/src/core/messageQueue.js');
  const typed=await import('../dist-vnext/core/message-queue.js');
  assert.equal(legacy.MessageQueue,typed.MessageQueue);
  assert.equal(legacy.chavesDeJustica,typed.chavesDeJustica);
});
