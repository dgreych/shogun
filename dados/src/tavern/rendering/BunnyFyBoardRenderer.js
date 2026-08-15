import { tavernBoardWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';
import { VNextBoardRenderer } from './VNextBoardRenderer.js';

/**
 * Mesmo contrato de VNextBoardRenderer (render(state, {playerNames})
 * resolve pra um Buffer PNG), mas tenta renderizar via BunnyFy primeiro —
 * o host da Tavern tem muito menos CPU que o servidor da BunnyFy, e o
 * Jimp é 100% JavaScript, sem aceleração nativa. Cai para o Jimp local
 * automaticamente em falha transitória (modo primary) ou sempre que o
 * modo estiver off — substituto direto de VNextBoardRenderer em
 * qualquer lugar que já o use.
 */
class BunnyFyBoardRenderer {
  constructor({ assets, now, env = process.env } = {}) {
    this.local = new VNextBoardRenderer({ assets, now });
    this.env = env;
  }

  async render(state, options = {}) {
    return tavernBoardWithBunnyFy(state, options.playerNames || {}, {
      env: this.env,
      legacyFallback: () => this.local.render(state, options)
    });
  }
}

export { BunnyFyBoardRenderer };
