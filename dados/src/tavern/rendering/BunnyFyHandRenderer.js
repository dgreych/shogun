import { tavernHandWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';
import { VNextHandRenderer } from './VNextHandRenderer.js';

/**
 * Mesmo contrato de VNextHandRenderer (render(state, playerId) resolve
 * pra um Buffer PNG) — ver BunnyFyBoardRenderer.js para o motivo.
 */
class BunnyFyHandRenderer {
  constructor({ assets, env = process.env } = {}) {
    this.local = new VNextHandRenderer({ assets });
    this.env = env;
  }

  async render(state, playerId) {
    return tavernHandWithBunnyFy(state, playerId, {
      env: this.env,
      legacyFallback: () => this.local.render(state, playerId)
    });
  }
}

export { BunnyFyHandRenderer };
