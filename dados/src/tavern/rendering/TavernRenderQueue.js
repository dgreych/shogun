import { TavernRuleError, TavernValidationError } from '../errors.js';

class TavernRenderQueue {
  constructor({ concurrency = 2, maxPending = 40 } = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new TavernValidationError('Concorrência de renderização inválida');
    }
    this.concurrency = concurrency;
    this.maxPending = maxPending;
    this.active = 0;
    this.pending = [];
  }

  run(operation) {
    if (typeof operation !== 'function') {
      return Promise.reject(new TavernValidationError('Operação de renderização inválida'));
    }
    if (this.pending.length >= this.maxPending) {
      return Promise.reject(new TavernRuleError('A fila visual da Taverna está cheia. Tente novamente em instantes.'));
    }
    return new Promise((resolve, reject) => {
      this.pending.push({ operation, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const task = this.pending.shift();
      this.active += 1;
      setImmediate(() => {
        Promise.resolve()
          .then(task.operation)
          .then(task.resolve, task.reject)
          .finally(() => {
            this.active -= 1;
            this.drain();
          });
      });
    }
  }
}

export { TavernRenderQueue };
