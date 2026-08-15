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
