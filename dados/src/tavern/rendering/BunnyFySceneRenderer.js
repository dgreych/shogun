import { tavernSceneWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';
import { VNextSceneRenderer } from './VNextSceneRenderer.js';

/**
 * Mesmo contrato de VNextSceneRenderer (renderInvite/renderMulligan/
 * renderTurn/renderVictory resolvem pra um Buffer PNG cada) — ver
 * BunnyFyBoardRenderer.js para o motivo.
 */
class BunnyFySceneRenderer {
  constructor({ assets, env = process.env } = {}) {
    this.local = new VNextSceneRenderer({ assets });
    this.env = env;
  }

  renderInvite(payload = {}) {
    return tavernSceneWithBunnyFy('invite', payload, {
      env: this.env,
      legacyFallback: () => this.local.renderInvite(payload)
    });
  }

  renderMulligan(payload = {}) {
    return tavernSceneWithBunnyFy('mulligan', payload, {
      env: this.env,
      legacyFallback: () => this.local.renderMulligan(payload)
    });
  }

  renderTurn(payload = {}) {
    return tavernSceneWithBunnyFy('turn', payload, {
      env: this.env,
      legacyFallback: () => this.local.renderTurn(payload)
    });
  }

  renderVictory(payload = {}) {
    return tavernSceneWithBunnyFy('victory', payload, {
      env: this.env,
      legacyFallback: () => this.local.renderVictory(payload)
    });
  }
}

export { BunnyFySceneRenderer };
