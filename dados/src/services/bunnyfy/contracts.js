import { BunnyFyError } from './BunnyFyError.js';

const BUNNYFY_ROUTES = Object.freeze({
  media: '/v1/media',
  imageMedia: '/v1/media/images',
  imageUpscale: '/v1/images/upscale',
  imageBackgroundRemoval: '/v1/images/remove-background',
  stickers: '/v1/stickers',
  stickerCanvas: '/v1/stickers/canvas',
  animatedLogo: '/v1/images/logo',
  youtubeAudio: '/v1/downloads/youtube/audio',
  youtubeVideo: '/v1/downloads/youtube/video',
  welcomeCard: '/v1/images/welcome-card',
  profileCard: '/v1/images/profile-card',
  compatibilityCard: '/v1/images/compatibility-card',
  rankingCard: '/v1/images/ranking-card',
  achievementCard: '/v1/images/achievement-card',
  aiChat: '/v1/ai/chat/completions',
  imageGenerate: '/v1/images/generate',
  movieQuiz: '/v1/games/quiz',
  tavernBoard: '/v1/games/tavern/board',
  tavernHand: '/v1/games/tavern/hand',
  tavernScene: '/v1/games/tavern/scene',
  transcriptions: '/v1/audio/transcriptions',
  downloadsFacebook: '/v1/downloads/facebook',
  downloadsPinterest: '/v1/downloads/pinterest',
  downloadsTiktok: '/v1/downloads/tiktok',
  downloadsKwai: '/v1/downloads/kwai'
});

const SOCIAL_CARD_TEMPLATES = new Set([
  'welcome', 'profile', 'compatibility', 'ranking', 'achievement'
]);

const TAVERN_RENDER_VIEW_SCHEMA_VERSION = 1;
const TAVERN_STATUS = new Set(['ACTIVE', 'FINISHED']);
const TAVERN_PHASE = new Set(['MULLIGAN', 'MAIN']);
const TAVERN_BOARD_SLOTS = new Set(['bottom', 'top']);
const TAVERN_SCENE_KINDS = new Set(['invite', 'mulligan', 'turn', 'victory']);
const TAVERN_CARD_TYPES = new Set(['MINION', 'SPELL', 'ARTIFACT', 'TERRAIN']);
const TAVERN_RARITIES = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const RAW_ID_PATTERN = /@(s\.whatsapp\.net|g\.us|lid|broadcast|newsletter)/i;
const PHONE_LIKE_PATTERN = /^\+?\d{8,20}$/;
const PHONE_FORMATTED_PATTERN = /^[+\d\s().-]+$/;
const COMPACT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function badTavernRenderView() {
  throw new BunnyFyError('BUNNYFY_BAD_REQUEST');
}

function exactRecord(value, requiredKeys, optionalKeys = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badTavernRenderView();
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Object.keys(value);
  if (requiredKeys.some(key => !Object.hasOwn(value, key)) || keys.some(key => !allowed.has(key))) {
    badTavernRenderView();
  }
  return value;
}

function boundedString(value, { min = 1, max = 191 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) badTavernRenderView();
  return value;
}

function boundedNumber(value, { min = 0, max = 99_999 } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) badTavernRenderView();
  return value;
}

function assertKeywords(value) {
  if (!Array.isArray(value) || value.length > 8) badTavernRenderView();
  for (const keyword of value) assertCompactId(keyword);
}

function assertPublicString(value, options) {
  const string = boundedString(value, options);
  if (RAW_ID_PATTERN.test(string)) badTavernRenderView();
  return string;
}

function assertCompactId(value) {
  const compactId = assertPublicString(value, { max: 64 });
  if (!COMPACT_ID_PATTERN.test(compactId)) badTavernRenderView();
  return compactId;
}

function assertDisplayName(value, max = 64) {
  const name = assertPublicString(value, { max });
  const digits = name.replace(/\D/g, '');
  if (
    digits.length >= 7
    ||
    PHONE_LIKE_PATTERN.test(name)
    || (digits.length >= 8 && PHONE_FORMATTED_PATTERN.test(name))
  ) {
    badTavernRenderView();
  }
  return name;
}

function assertBoardCard(value) {
  const card = exactRecord(value, [
    'cardId',
    'name',
    'rarity',
    'classId',
    'attack',
    'health',
    'keywords',
    'canAttack',
    'attacksThisTurn'
  ]);
  assertCompactId(card.cardId);
  assertPublicString(card.name, { max: 120 });
  if (!TAVERN_RARITIES.has(card.rarity)) badTavernRenderView();
  assertCompactId(card.classId);
  boundedNumber(card.attack);
  boundedNumber(card.health);
  assertKeywords(card.keywords);
  if (typeof card.canAttack !== 'boolean') badTavernRenderView();
  boundedNumber(card.attacksThisTurn, { max: 16 });
}

function assertHandCard(value) {
  const card = exactRecord(value, [
    'cardId',
    'name',
    'type',
    'rarity',
    'cost',
    'keywords',
    'classId'
  ], ['attack', 'health', 'text']);
  assertCompactId(card.cardId);
  assertPublicString(card.name, { max: 120 });
  if (!TAVERN_CARD_TYPES.has(card.type) || !TAVERN_RARITIES.has(card.rarity)) badTavernRenderView();
  assertCompactId(card.classId);
  boundedNumber(card.cost, { max: 100 });
  if (Object.hasOwn(card, 'attack')) boundedNumber(card.attack);
  if (Object.hasOwn(card, 'health')) boundedNumber(card.health);
  if (Object.hasOwn(card, 'text')) assertPublicString(card.text, { max: 500 });
  assertKeywords(card.keywords);
}

function assertTavernStatusAndPhase(view) {
  if (!TAVERN_STATUS.has(view.status) || !TAVERN_PHASE.has(view.phase)) badTavernRenderView();
}

function assertTavernBoardRenderView(value) {
  const view = exactRecord(value, [
    'schemaVersion', 'kind', 'status', 'phase', 'turn', 'terrain', 'players'
  ]);
  if (view.schemaVersion !== TAVERN_RENDER_VIEW_SCHEMA_VERSION || view.kind !== 'board') {
    badTavernRenderView();
  }
  assertTavernStatusAndPhase(view);
  const turn = exactRecord(view.turn, ['number', 'activeSlot', 'deadlineAt']);
  boundedNumber(turn.number, { min: 1, max: 99_999 });
  if (!TAVERN_BOARD_SLOTS.has(turn.activeSlot)) badTavernRenderView();
  if (turn.deadlineAt !== null) {
    boundedString(turn.deadlineAt, { max: 64 });
    if (!Number.isFinite(Date.parse(turn.deadlineAt))) badTavernRenderView();
  }
  if (view.terrain !== null) {
    const terrain = exactRecord(view.terrain, ['name']);
    assertPublicString(terrain.name, { max: 120 });
  }
  if (!Array.isArray(view.players) || view.players.length !== 2) badTavernRenderView();
  if (view.players[0]?.slot !== 'bottom' || view.players[1]?.slot !== 'top') badTavernRenderView();
  const slots = new Set();
  for (const value of view.players) {
    const player = exactRecord(value, [
      'slot', 'displayName', 'classId', 'hero', 'mana', 'handCount', 'deckCount', 'board'
    ]);
    if (!TAVERN_BOARD_SLOTS.has(player.slot) || slots.has(player.slot)) badTavernRenderView();
    slots.add(player.slot);
    assertDisplayName(player.displayName);
    assertCompactId(player.classId);
    const hero = exactRecord(player.hero, ['hp', 'armor']);
    boundedNumber(hero.hp);
    boundedNumber(hero.armor);
    const mana = exactRecord(player.mana, ['current', 'max']);
    boundedNumber(mana.current, { max: 100 });
    boundedNumber(mana.max, { max: 100 });
    if (mana.current > mana.max) badTavernRenderView();
    boundedNumber(player.handCount, { max: 10 });
    boundedNumber(player.deckCount, { max: 100 });
    if (!Array.isArray(player.board) || player.board.length > 7) badTavernRenderView();
    for (const card of player.board) assertBoardCard(card);
  }
  return view;
}

function assertTavernHandRenderView(value) {
  const view = exactRecord(value, [
    'schemaVersion', 'kind', 'status', 'phase', 'isActive', 'viewer', 'cards'
  ]);
  if (view.schemaVersion !== TAVERN_RENDER_VIEW_SCHEMA_VERSION || view.kind !== 'hand') {
    badTavernRenderView();
  }
  assertTavernStatusAndPhase(view);
  if (typeof view.isActive !== 'boolean') badTavernRenderView();
  const viewer = exactRecord(view.viewer, [
    'classId', 'mana', 'nextSpellDiscount', 'boardCount'
  ]);
  assertCompactId(viewer.classId);
  const mana = exactRecord(viewer.mana, ['current', 'max']);
  boundedNumber(mana.current, { max: 100 });
  boundedNumber(mana.max, { max: 100 });
  if (mana.current > mana.max) badTavernRenderView();
  boundedNumber(viewer.nextSpellDiscount, { max: 100 });
  boundedNumber(viewer.boardCount, { max: 7 });
  if (!Array.isArray(view.cards) || view.cards.length > 10) badTavernRenderView();
  for (const card of view.cards) assertHandCard(card);
  return view;
}

function assertNullableLabel(value, max = 64) {
  if (value === null) return;
  assertPublicString(value, { max });
}

function assertTavernSceneRenderView(value) {
  const view = exactRecord(value, ['schemaVersion', 'kind', 'sceneKind', 'payload']);
  if (
    view.schemaVersion !== TAVERN_RENDER_VIEW_SCHEMA_VERSION
    || view.kind !== 'scene'
    || !TAVERN_SCENE_KINDS.has(view.sceneKind)
  ) {
    badTavernRenderView();
  }
  switch (view.sceneKind) {
    case 'invite': {
      const payload = exactRecord(view.payload, [
        'challengerName',
        'challengedName',
        'challengerClassId',
        'challengedClassId',
        'modeLabel',
        'expiresLabel'
      ]);
      assertDisplayName(payload.challengerName);
      assertDisplayName(payload.challengedName);
      assertCompactId(payload.challengerClassId);
      assertCompactId(payload.challengedClassId);
      assertPublicString(payload.modeLabel, { max: 40 });
      assertPublicString(payload.expiresLabel, { max: 40 });
      break;
    }
    case 'mulligan': {
      const payload = exactRecord(view.payload, ['playerName', 'classId', 'handSize']);
      assertDisplayName(payload.playerName);
      assertCompactId(payload.classId);
      boundedNumber(payload.handSize, { max: 10 });
      break;
    }
    case 'turn': {
      const payload = exactRecord(view.payload, [
        'playerName', 'classId', 'turnNumber', 'deadlineLabel'
      ]);
      assertDisplayName(payload.playerName);
      assertCompactId(payload.classId);
      boundedNumber(payload.turnNumber, { min: 1, max: 99_999 });
      assertNullableLabel(payload.deadlineLabel, 40);
      break;
    }
    case 'victory': {
      const payload = exactRecord(view.payload, [
        'winnerName', 'classId', 'reasonLabel', 'progressionLabel'
      ]);
      assertDisplayName(payload.winnerName);
      assertCompactId(payload.classId);
      assertPublicString(payload.reasonLabel, { max: 64 });
      assertNullableLabel(payload.progressionLabel, 120);
      break;
    }
    default:
      badTavernRenderView();
  }
  return view;
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return value;
}

function parseEnvelope(value) {
  const envelope = requireObject(value, 'envelope');
  if (envelope.ok === true) {
    if (!Object.hasOwn(envelope, 'data')) throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    return {
      ok: true,
      data: envelope.data,
      meta: envelope.meta && typeof envelope.meta === 'object' ? envelope.meta : {}
    };
  }
  if (envelope.ok === false) {
    const error = requireObject(envelope.error, 'error');
    return {
      ok: false,
      error: {
        code: typeof error.code === 'string' ? error.code : 'BUNNYFY_REMOTE_ERROR',
        retryable: error.retryable === true
      },
      meta: envelope.meta && typeof envelope.meta === 'object' ? envelope.meta : {}
    };
  }
  throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
}

function requireMediaDescriptor(value) {
  const media = requireObject(value, 'media');
  if (typeof media.mediaId !== 'string' || !media.mediaId.trim()) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  if (typeof media.mediaUrl !== 'string' || !media.mediaUrl.trim()) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return media;
}

function parseMediaUpload(value) {
  const data = requireObject(value, 'data');
  return requireMediaDescriptor(data.media || data);
}

function parseYouTubeDownload(value) {
  const data = requireObject(value, 'data');
  const media = requireMediaDescriptor(data.media || data);
  return {
    ...data,
    media,
    title: typeof data.title === 'string' ? data.title : '',
    durationSeconds: Number.isFinite(data.durationSeconds) ? data.durationSeconds : null,
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : null
  };
}

function parseSocialCard(value) {
  const data = requireObject(value, 'data');
  const media = requireMediaDescriptor(data.media);
  if (!SOCIAL_CARD_TEMPLATES.has(data.template)) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  if (!Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width <= 0 || data.height <= 0) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return {
    template: data.template,
    width: data.width,
    height: data.height,
    media
  };
}

function parseImageProcess(value) {
  const data = requireObject(value, 'data');
  const media = requireMediaDescriptor(data.media);
  if (!Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width <= 0 || data.height <= 0) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  if (Object.hasOwn(data, 'scale') && ![2, 4].includes(data.scale)) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return { ...data, media };
}

function parseSticker(value) {
  const data = requireObject(value, 'data');
  const media = requireMediaDescriptor(data.media);
  if (
    !Number.isInteger(data.width)
    || !Number.isInteger(data.height)
    || data.width !== 512
    || data.height !== 512
    || typeof data.animated !== 'boolean'
    || (data.durationSeconds !== null && (!Number.isFinite(data.durationSeconds) || data.durationSeconds <= 0))
  ) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return {
    ...(typeof data.template === 'string' ? { template: data.template } : {}),
    width: data.width,
    height: data.height,
    animated: data.animated,
    durationSeconds: data.durationSeconds,
    media
  };
}

function parseAnimatedLogo(value) {
  const data = requireObject(value, 'data');
  const media = requireMediaDescriptor(data.media);
  if (
    typeof data.model !== 'string'
    || data.animated !== true
    || data.format !== 'sticker'
    || data.width !== 512
    || data.height !== 512
    || data.fps !== 9
    || data.frames !== 18
    || data.durationSeconds !== 2
    || media.mime !== 'image/webp'
  ) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return { ...data, media };
}

function parseMovieQuiz(value) {
  const data = requireObject(value, 'data');
  if (
    data.category !== 'movies'
    || data.type !== 'multiple-choice'
    || !['easy', 'medium', 'hard'].includes(data.difficulty)
    || typeof data.question !== 'string'
    || !data.question.trim()
    || !Array.isArray(data.choices)
    || data.choices.length !== 4
    || !['A', 'B', 'C', 'D'].includes(data.correctChoiceId)
  ) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  const ids = new Set();
  for (const choice of data.choices) {
    if (
      !choice
      || typeof choice !== 'object'
      || !['A', 'B', 'C', 'D'].includes(choice.id)
      || ids.has(choice.id)
      || typeof choice.text !== 'string'
      || !choice.text.trim()
    ) {
      throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
    }
    ids.add(choice.id);
  }
  if (!ids.has(data.correctChoiceId)) throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  return {
    category: data.category,
    difficulty: data.difficulty,
    type: data.type,
    question: data.question,
    choices: data.choices.map(choice => ({ id: choice.id, text: choice.text })),
    correctChoiceId: data.correctChoiceId
  };
}

const AI_FINISH_REASONS = new Set(['stop', 'length', 'content_filter', 'tool_calls', 'other']);

function parseAiChat(value) {
  const data = requireObject(value, 'data');
  if (typeof data.text !== 'string' || !data.text.trim()) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  if (data.finishReason !== null && !AI_FINISH_REASONS.has(data.finishReason)) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }

  let usage = null;
  if (data.usage !== null) {
    const parsedUsage = requireObject(data.usage, 'usage');
    for (const field of ['inputTokens', 'outputTokens', 'totalTokens']) {
      if (parsedUsage[field] !== null && (!Number.isSafeInteger(parsedUsage[field]) || parsedUsage[field] < 0)) {
        throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
      }
    }
    usage = {
      inputTokens: parsedUsage.inputTokens,
      outputTokens: parsedUsage.outputTokens,
      totalTokens: parsedUsage.totalTokens
    };
  }

  return {
    text: data.text,
    finishReason: data.finishReason,
    usage
  };
}

function parseTranscription(value) {
  const data = requireObject(value, 'data');
  if (typeof data.text !== 'string') {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  if (typeof data.language !== 'string' || !data.language.trim()) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  if (!Number.isFinite(data.durationSeconds) || data.durationSeconds < 0) {
    throw new BunnyFyError('BUNNYFY_BAD_RESPONSE');
  }
  return {
    text: data.text,
    language: data.language,
    durationSeconds: data.durationSeconds
  };
}

function parseSocialDownload(value) {
  const data = requireObject(value, 'data');
  const media = requireMediaDescriptor(data.media);
  return {
    title: typeof data.title === 'string' ? data.title : null,
    durationSeconds: Number.isFinite(data.durationSeconds) ? data.durationSeconds : null,
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : null,
    media
  };
}

export {
  BUNNYFY_ROUTES,
  TAVERN_RENDER_VIEW_SCHEMA_VERSION,
  assertTavernBoardRenderView,
  assertTavernHandRenderView,
  assertTavernSceneRenderView,
  parseAnimatedLogo,
  parseEnvelope,
  parseAiChat,
  parseImageProcess,
  parseSticker,
  parseMediaUpload,
  parseMovieQuiz,
  parseSocialCard,
  parseSocialDownload,
  parseTranscription,
  parseYouTubeDownload
};
