import { TavernRuleError } from '../errors.js';

class TavernRateLimiter {
  constructor({ maxCommands = 10, windowMs = 10_000, now = () => Date.now() } = {}) {
    this.maxCommands = maxCommands;
    this.windowMs = windowMs;
    this.now = now;
    this.entries = new Map();
  }

  consume(key) {
    const timestamp = this.now();
    const recent = (this.entries.get(key) || []).filter(value => timestamp - value < this.windowMs);
    if (recent.length >= this.maxCommands) {
      throw new TavernRuleError('Muitos comandos em sequência. Aguarde alguns segundos.');
    }
    recent.push(timestamp);
    this.entries.set(key, recent);
  }
}

export { TavernRateLimiter };
