import assert from 'node:assert/strict';
import test from 'node:test';

import { BunnyFyError } from '../../services/bunnyfy/BunnyFyError.js';
import { BunnyFyBoardRenderer } from '../rendering/BunnyFyBoardRenderer.js';
import { BunnyFyHandRenderer } from '../rendering/BunnyFyHandRenderer.js';
import { BunnyFySceneRenderer } from '../rendering/BunnyFySceneRenderer.js';
import {
  buildTavernBoardRenderView,
  buildTavernHandRenderView,
  buildTavernSceneRenderView
} from '../rendering/TavernRenderView.js';

const PLAYER = '5511999999999@s.whatsapp.net';
const ENEMY = '5511888888888@s.whatsapp.net';
const ENV_PRIMARY = {
  BUNNYFY_ENABLED: 'true',
  BUNNYFY_TAVERN_RENDER_MODE: 'primary'
};

function card(cardId, name, ownerId, overrides = {}) {
  return {
    instanceId: `INSTANCE_SECRET_${cardId}`,
    ownerId,
    cardId,
    name,
    type: overrides.type || 'MINION',
    rarity: overrides.rarity || 'COMMON',
    cost: overrides.cost ?? 2,
    baseCost: overrides.cost ?? 2,
    text: overrides.text ?? 'Texto público.',
    attack: overrides.attack ?? 2,
    baseAttack: overrides.attack ?? 2,
    health: overrides.health ?? 3,
    maxHealth: overrides.health ?? 3,
    keywords: overrides.keywords || ['GUARD'],
    effects: [{ privateEffect: 'EFFECT_SECRET' }],
    statuses: { PRIVATE_STATUS: { source: 'STATUS_SECRET' } },
    attacksThisTurn: overrides.attacksThisTurn ?? 0,
    canAttack: overrides.canAttack ?? true,
    summonedOnTurn: 1,
    temporaryAttack: 0,
    silenced: false
  };
}

function privateState() {
  return {
    schemaVersion: 1,
    version: 9,
    matchId: 'MATCH_SECRET',
    groupId: 'GROUP_SECRET@g.us',
    mode: 'NORMAL',
    status: 'ACTIVE',
    phase: 'MAIN',
    seed: 'SEED_SECRET',
    rng: { state: 'RNG_SECRET' },
    nextInstanceNumber: 99,
    playerOrder: [PLAYER, ENEMY],
    turn: {
      number: 3,
      activePlayerId: PLAYER,
      deadlineAt: '2026-08-15T21:00:00.000Z',
      consecutiveTimeouts: { [PLAYER]: 0, [ENEMY]: 0 }
    },
    terrain: {
      ownerId: PLAYER,
      card: card('GY-TERRAIN', 'Salão da Lua', PLAYER)
    },
    mulligan: { enabled: true, responses: { [PLAYER]: { done: true } } },
    winnerId: null,
    finishReason: null,
    players: {
      [PLAYER]: {
        id: PLAYER,
        classId: 'GUARDIAN',
        hero: {
          hp: 28,
          maxHp: 30,
          armor: 2,
          powerUsed: false,
          powerCost: 2,
          statuses: { HERO_SECRET: true }
        },
        mana: { current: 3, max: 3 },
        deck: [card('DECK_SELF_SECRET', 'DECK_SELF_SECRET', PLAYER)],
        hand: [card('GY-001', 'Sentinela da Mão', PLAYER)],
        board: [card('GY-014', 'Guardião Visível', PLAYER)],
        graveyard: [card('GRAVE_SELF_SECRET', 'GRAVE_SELF_SECRET', PLAYER)],
        artifact: { privateArtifact: 'ARTIFACT_SECRET' },
        fatigue: 0,
        nextSpellDiscount: 1
      },
      [ENEMY]: {
        id: ENEMY,
        classId: 'EXILE',
        hero: { hp: 24, maxHp: 30, armor: 0, powerUsed: true, powerCost: 2, statuses: {} },
        mana: { current: 0, max: 2 },
        deck: [card('DECK_ENEMY_SECRET', 'DECK_ENEMY_SECRET', ENEMY)],
        hand: [card('HAND_ENEMY_SECRET', 'HAND_ENEMY_SECRET', ENEMY)],
        board: [card('GY-027', 'Lobo Visível', ENEMY, { canAttack: false })],
        graveyard: [],
        artifact: null,
        fatigue: 0,
        nextSpellDiscount: 0
      }
    }
  };
}

const PRIVATE_SENTINELS = [
  'MATCH_SECRET',
  'GROUP_SECRET',
  'SEED_SECRET',
  'RNG_SECRET',
  'DECK_SELF_SECRET',
  'DECK_ENEMY_SECRET',
  'HAND_ENEMY_SECRET',
  'GRAVE_SELF_SECRET',
  'EFFECT_SECRET',
  'STATUS_SECRET',
  'ARTIFACT_SECRET',
  'instanceId',
  'ownerId',
  '@s.whatsapp.net',
  '@g.us'
];

function assertNoPrivateSentinel(value, sentinels = PRIVATE_SENTINELS) {
  const serialized = JSON.stringify(value);
  for (const sentinel of sentinels) {
    assert.equal(serialized.includes(sentinel), false, `Render View expôs ${sentinel}`);
  }
}

test('board view publica só slots, contagens e campo visível sem IDs ou zonas privadas', () => {
  const state = privateState();
  const view = buildTavernBoardRenderView(state, {
    [PLAYER]: '+55 (11) 99999-9999',
    [ENEMY]: `Nome ${ENEMY} (privado)`
  });

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.kind, 'board');
  assert.deepEqual(view.players.map(player => player.slot), ['bottom', 'top']);
  assert.deepEqual(view.players.map(player => player.displayName), ['Jogador 1', 'Jogador 2']);
  assert.deepEqual(view.players.map(player => [player.handCount, player.deckCount]), [[1, 1], [1, 1]]);
  assert.deepEqual(view.players.map(player => player.board[0].name), ['Guardião Visível', 'Lobo Visível']);
  assert.deepEqual(view.terrain, { name: 'Salão da Lua' });
  assertNoPrivateSentinel(view);
});

test('hand view contém somente a própria mão allowlisted e o mínimo para jogabilidade', () => {
  const state = privateState();
  const view = buildTavernHandRenderView(state, PLAYER);

  assert.deepEqual(Object.keys(view).sort(), [
    'cards', 'isActive', 'kind', 'phase', 'schemaVersion', 'status', 'viewer'
  ]);
  assert.equal(view.isActive, true);
  assert.deepEqual(view.viewer, {
    classId: 'GUARDIAN',
    mana: { current: 3, max: 3 },
    nextSpellDiscount: 1,
    boardCount: 1
  });
  assert.deepEqual(view.cards, [{
    cardId: 'GY-001',
    name: 'Sentinela da Mão',
    type: 'MINION',
    rarity: 'COMMON',
    cost: 2,
    keywords: ['GUARD'],
    classId: 'GUARDIAN',
    attack: 2,
    health: 3,
    text: 'Texto público.'
  }]);
  assertNoPrivateSentinel(view);
  assert.equal(JSON.stringify(view).includes('Guardião Visível'), false);
  assert.equal(JSON.stringify(view).includes('Lobo Visível'), false);
});

test('scene view allowlista cada cena e redige JID, telefone e extras', () => {
  const invite = buildTavernSceneRenderView('invite', {
    challengerName: 'Mauricio 11999999999',
    challengedName: ENEMY,
    challengerClassId: 'GUARDIAN',
    challengedClassId: 'EXILE',
    modeLabel: 'NORMAL',
    expiresLabel: '5 MIN',
    playerId: PLAYER,
    privateMessage: 'SCENE_SECRET'
  });
  assert.deepEqual(invite.payload, {
    challengerName: 'DESAFIANTE',
    challengedName: 'OPONENTE',
    challengerClassId: 'GUARDIAN',
    challengedClassId: 'EXILE',
    modeLabel: 'NORMAL',
    expiresLabel: '5 MIN'
  });
  assertNoPrivateSentinel(invite, [...PRIVATE_SENTINELS, 'SCENE_SECRET', '11999999999']);

  assert.deepEqual(buildTavernSceneRenderView('mulligan', {}).payload, {
    playerName: 'AVENTUREIRO', classId: 'GUARDIAN', handSize: 4
  });
  assert.deepEqual(buildTavernSceneRenderView('turn', {}).payload, {
    playerName: 'AVENTUREIRO', classId: 'GUARDIAN', turnNumber: 1, deadlineLabel: null
  });
  assert.deepEqual(buildTavernSceneRenderView('victory', {}).payload, {
    winnerName: 'VENCEDOR', classId: 'GUARDIAN', reasonLabel: 'VITÓRIA', progressionLabel: null
  });
});

test('wrappers primary enviam somente views sanitizadas quando a BunnyFy responde', async () => {
  const state = privateState();
  const scenePayload = {
    playerName: PLAYER,
    classId: 'GUARDIAN',
    turnNumber: 3,
    deadlineLabel: '2min',
    privateMessage: 'SCENE_SECRET'
  };
  const views = [];
  const remote = {
    async renderTavernBoard(view) { views.push(view); return { media: { mediaId: 'board-media-12345' } }; },
    async renderTavernHand(view) { views.push(view); return { media: { mediaId: 'hand-media-12345' } }; },
    async renderTavernScene(view) { views.push(view); return { media: { mediaId: 'scene-media-12345' } }; },
    async downloadMedia(media) { return { buffer: Buffer.from(media.mediaId), mime: 'image/png' }; }
  };
  const clientFactory = () => remote;
  const localRenderer = { render() { throw new Error('fallback não deveria rodar'); } };
  const localSceneRenderer = {
    renderTurn() { throw new Error('fallback de cena não deveria rodar'); }
  };

  await new BunnyFyBoardRenderer({ env: ENV_PRIMARY, clientFactory, localRenderer })
    .render(state, { playerNames: { [PLAYER]: PLAYER, [ENEMY]: ENEMY } });
  await new BunnyFyHandRenderer({ env: ENV_PRIMARY, clientFactory, localRenderer })
    .render(state, PLAYER);
  await new BunnyFySceneRenderer({ env: ENV_PRIMARY, clientFactory, localRenderer: localSceneRenderer })
    .renderTurn(scenePayload);

  assert.deepEqual(views.map(view => view.kind), ['board', 'hand', 'scene']);
  for (const view of views) assertNoPrivateSentinel(view, [...PRIVATE_SENTINELS, 'SCENE_SECRET']);
});

test('wrapper da mão pede e devolve todas as páginas em ordem sem alterar a Render View', async () => {
  const state = privateState();
  state.players[PLAYER].hand = Array.from({ length: 10 }, (_, index) => (
    card(`GY-${String(index + 1).padStart(3, '0')}`, `Carta ${index + 1}`, PLAYER)
  ));
  const calls = [];
  const remote = {
    async renderTavernHand(view, options) {
      calls.push({ view, page: options.page });
      return { media: { mediaId: `hand-media-page-${options.page}` } };
    },
    async downloadMedia(media) {
      return { buffer: Buffer.from(media.mediaId), mime: 'image/png' };
    }
  };

  const pages = await new BunnyFyHandRenderer({
    env: ENV_PRIMARY,
    clientFactory: () => remote,
    localRenderer: { render() { throw new Error('fallback não deveria rodar'); } }
  }).renderPages(state, PLAYER);

  assert.deepEqual(calls.map(call => call.page), [1, 2]);
  assert.deepEqual(pages.map(page => page.toString()), [
    'hand-media-page-1',
    'hand-media-page-2'
  ]);
  assert.deepEqual(calls[0].view, calls[1].view);
  assert.deepEqual(Object.keys(calls[0].view).sort(), [
    'cards', 'isActive', 'kind', 'phase', 'schemaVersion', 'status', 'viewer'
  ]);
  assertNoPrivateSentinel(calls[0].view);
});

test('falha transitória preserva a mesma referência completa no fallback local', async () => {
  const state = privateState();
  const scenePayload = {
    winnerName: PLAYER,
    classId: 'GUARDIAN',
    reasonLabel: 'VITÓRIA',
    progressionLabel: null,
    privateMessage: 'SCENE_SECRET'
  };
  const remote = {
    async renderTavernBoard() { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); },
    async renderTavernHand() { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); },
    async renderTavernScene() { throw new BunnyFyError('BUNNYFY_UNAVAILABLE'); }
  };
  const received = {};
  const boardLocal = {
    async render(receivedState, options) {
      received.boardState = receivedState;
      received.boardOptions = options;
      return Buffer.from('board-local');
    }
  };
  const handLocal = {
    async render(receivedState, playerId) {
      received.handState = receivedState;
      received.playerId = playerId;
      return Buffer.from('hand-local');
    }
  };
  const sceneLocal = {
    async renderVictory(receivedPayload) {
      received.scenePayload = receivedPayload;
      return Buffer.from('scene-local');
    }
  };
  const playerNames = { [PLAYER]: 'Jogador', [ENEMY]: 'Oponente' };

  await new BunnyFyBoardRenderer({ env: ENV_PRIMARY, clientFactory: () => remote, localRenderer: boardLocal })
    .render(state, { playerNames });
  await new BunnyFyHandRenderer({ env: ENV_PRIMARY, clientFactory: () => remote, localRenderer: handLocal })
    .render(state, PLAYER);
  await new BunnyFySceneRenderer({ env: ENV_PRIMARY, clientFactory: () => remote, localRenderer: sceneLocal })
    .renderVictory(scenePayload);

  assert.equal(received.boardState, state);
  assert.equal(received.handState, state);
  assert.equal(received.scenePayload, scenePayload);
  assert.equal(received.playerId, PLAYER);
  assert.equal(received.boardOptions.playerNames, playerNames);
  assert.equal(received.boardState.seed, 'SEED_SECRET');
  assert.equal(received.scenePayload.privateMessage, 'SCENE_SECRET');
});
