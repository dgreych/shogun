/**
 * Compatibilidade das ferramentas de imagem.
 * Esta distribuição pública não usa provedores externos legados.
 * O recurso permanece indisponível até ser atendido pelo fluxo BunnyFy da instância.
 */

function indisponivel() {
  return {
    ok: false,
    code: 'BUNNYFY_DISABLED',
    msg: 'Esta ferramenta de imagem requer BunnyFy configurada nesta instância.'
  };
}

async function removeBg(url) {
  if (!url || typeof url !== 'string') {
    return { ok: false, msg: 'URL da imagem é obrigatória' };
  }
  return indisponivel();
}

async function upscale(url, scale = 2) {
  if (!url || typeof url !== 'string') {
    return { ok: false, msg: 'URL da imagem é obrigatória' };
  }
  if (![2, 4].includes(Number(scale))) {
    return { ok: false, msg: 'Escala inválida. Use 2 ou 4.' };
  }
  return indisponivel();
}

export default { removeBg, upscale };
export { removeBg, upscale };
