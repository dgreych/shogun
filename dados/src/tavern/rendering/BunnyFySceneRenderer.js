import { tavernSceneWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';
import { buildTavernSceneRenderView } from './TavernRenderView.js';
import { VNextSceneRenderer } from './VNextSceneRenderer.js';

/**
 * Mesmo contrato de VNextSceneRenderer (renderInvite/renderMulligan/
 * renderTurn/renderVictory resolvem pra um Buffer PNG cada) — ver
 * BunnyFyBoardRenderer.js para o motivo.
 */
class BunnyFySceneRenderer {
  constructor({ assets, env = process.env, clientFactory, localRenderer } = {}) {
    this.local = localRenderer || new VNextSceneRenderer({ assets });
    this.env = env;
    this.clientFactory = clientFactory;
  }

  renderInvite(payload = {}) {
    return tavernSceneWithBunnyFy(buildTavernSceneRenderView('invite', payload), {
      env: this.env,
      clientFactory: this.clientFactory,
      legacyFallback: () => this.local.renderInvite(payload)
    });
  }

  renderMulligan(payload = {}) {
    return tavernSceneWithBunnyFy(buildTavernSceneRenderView('mulligan', payload), {
      env: this.env,
      clientFactory: this.clientFactory,
      legacyFallback: () => this.local.renderMulligan(payload)
    });
  }

  renderTurn(payload = {}) {
    return tavernSceneWithBunnyFy(buildTavernSceneRenderView('turn', payload), {
      env: this.env,
      clientFactory: this.clientFactory,
      legacyFallback: () => this.local.renderTurn(payload)
    });
  }

  renderVictory(payload = {}) {
    return tavernSceneWithBunnyFy(buildTavernSceneRenderView('victory', payload), {
      env: this.env,
      clientFactory: this.clientFactory,
      legacyFallback: () => this.local.renderVictory(payload)
    });
  }
}

export { BunnyFySceneRenderer };
