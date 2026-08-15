class MessageReplayGuard {
  constructor({ ttlMs = 5 * 60 * 1000, maxEntries = 10000, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  checkAndRecord(key) {
    if (!key) return false;
    const currentTime = this.now();
    const previousTime = this.entries.get(key);
    if (previousTime !== undefined && currentTime - previousTime <= this.ttlMs) {
      return true;
    }
    this.entries.delete(key);
    this.entries.set(key, currentTime);
    this.prune(currentTime);
    return false;
  }

  prune(currentTime = this.now()) {
    for (const [key, timestamp] of this.entries) {
      if (currentTime - timestamp <= this.ttlMs && this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}

function createMessageReplayKey(socket, info) {
  const messageId = info?.key?.id;
  const remoteJid = info?.key?.remoteJid;
  if (!messageId || !remoteJid) return null;
  const socketId = socket?.user?.lid || socket?.user?.id || 'socket';
  const participant = info?.key?.participant || info?.participant || '';
  return `${socketId}|${remoteJid}|${participant}|${messageId}`;
}

export { MessageReplayGuard, createMessageReplayKey };
