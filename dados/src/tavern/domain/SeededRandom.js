function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 0x6d2b79f5;
}

class SeededRandom {
  constructor(seedOrSnapshot) {
    if (seedOrSnapshot && typeof seedOrSnapshot === 'object') {
      this.state = Number(seedOrSnapshot.state) >>> 0;
      this.counter = Number(seedOrSnapshot.counter) || 0;
    } else {
      this.state = hashSeed(seedOrSnapshot);
      this.counter = 0;
    }
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next() {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    this.counter += 1;
    return this.state / 0x100000000;
  }

  int(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive precisa ser um inteiro positivo');
    }
    return Math.floor(this.next() * maxExclusive);
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values[this.int(values.length)];
  }

  shuffle(values) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  snapshot() {
    return { state: this.state, counter: this.counter };
  }
}

export { SeededRandom, hashSeed };
