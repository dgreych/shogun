import { tavernHandWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';
import { buildTavernHandRenderView } from './TavernRenderView.js';
import { VNextHandRenderer } from './VNextHandRenderer.js';

/**
 * render() preserva o contrato histórico de um Buffer. renderPages() é a
 * extensão usada pelo privado para mãos de seis a dez cartas, sem expor o
 * estado cru fora do processo do bot.
 */
class BunnyFyHandRenderer {
  constructor({ assets, env = process.env, clientFactory, localRenderer } = {}) {
    this.local = localRenderer || new VNextHandRenderer({ assets });
    this.env = env;
    this.clientFactory = clientFactory;
  }

  async render(state, playerId, { page = 1 } = {}) {
    const view = buildTavernHandRenderView(state, playerId);
    return tavernHandWithBunnyFy(view, {
      page,
      env: this.env,
      clientFactory: this.clientFactory,
      legacyFallback: () => this.local.render(state, playerId, { page })
    });
  }

  async renderPages(state, playerId) {
    const handSize = state?.players?.[playerId]?.hand?.length;
    if (!Number.isInteger(handSize) || handSize < 0 || handSize > 10) {
      return [await this.render(state, playerId)];
    }
    const totalPages = Math.max(1, Math.ceil(handSize / 5));
    const pages = [];
    for (let page = 1; page <= totalPages; page += 1) {
      pages.push(await this.render(state, playerId, { page }));
    }
    return pages;
  }
}

export { BunnyFyHandRenderer };
