import { nexoCharacterWithBunnyFy, nexoCircleWithBunnyFy } from '../../services/bunnyfy/capabilityGateway.js';
import { buildCharacterRenderView, buildCircleRenderView } from './nexoRenderViewAdapter.js';

// Melhor esforço, sempre: qualquer falha aqui (contrato, rede, timeout,
// 429, modo off/exclusive indisponível) devolve null, nunca lança --
// quem chama (runtime.js) já tem a MessageViewModel de texto pronta e
// completa independente disso, então uma imagem que falha nunca pode
// impedir a resposta real de chegar (regra do plano de coordenação:
// falha/timeout/429 da BunnyFy não cancela uma transação de jogo já
// válida -- aqui nem chega a ser transação, é só apresentação).
async function renderCircleImage({
  repository,
  group,
  env = process.env,
  clientFactory
} = {}) {
  try {
    const season = await repository.getActiveSeasonForGroup(group.id);
    const world = season ? await repository.getWorldStateBySeasonId(season.id) : null;
    const view = buildCircleRenderView({ group, season, world });
    return await nexoCircleWithBunnyFy(view, { env, ...(clientFactory ? { clientFactory } : {}) });
  } catch {
    return null;
  }
}

/**
 * Melhor esforço, mesma regra do círculo: null em qualquer falha, nunca
 * lança. Devolve null também quando faltar Impulso/Cicatriz/Origem
 * válidos (personagem criado antes desta migração, ou conteúdo
 * ausente) -- sem fabricar rótulo pra fechar o card.
 */
async function renderCharacterImage({
  character,
  env = process.env,
  clientFactory
} = {}) {
  try {
    const view = buildCharacterRenderView({ character });
    if (!view) return null;
    return await nexoCharacterWithBunnyFy(view, { env, ...(clientFactory ? { clientFactory } : {}) });
  } catch {
    return null;
  }
}

export { renderCharacterImage, renderCircleImage };
