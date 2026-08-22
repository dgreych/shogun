import { MAX_FLOREIOS_POR_MENSAGEM } from './contract.js';
import { emojiDaIntencao, gerundioDaIntencao, mereceAvisoDeEspera } from './intents.js';
function aspas(assunto) {
    return `"${assunto.trim()}"`;
}
/**
 * Aviso de espera. Devolve null quando a operação é rápida: nesse caso a reação
 * de emoji já disse "ouvi você", e uma segunda mensagem só polui a conversa.
 */
export function avisoDeEspera(ctx) {
    if (!mereceAvisoDeEspera(ctx.intencao))
        return null;
    const emoji = emojiDaIntencao(ctx.intencao);
    const verbo = gerundioDaIntencao(ctx.intencao);
    const alvo = ctx.assunto?.trim() ? ` ${aspas(ctx.assunto)}` : '';
    const quantos = typeof ctx.quantidade === 'number' && ctx.quantidade > 0
        ? ` — ${ctx.quantidade} ${ctx.quantidade === 1 ? 'item' : 'itens'}`
        : '';
    return `${emoji} ${verbo}${alvo}${quantos}.`;
}
/**
 * Erro. Sempre diz o que foi tentado e, quando existe, o próximo passo.
 *
 * O padrão anterior — "Nenhuma imagem encontrada para o termo pesquisado. 😕" —
 * falha em três frentes: não repete o termo (então o usuário não sabe se houve
 * erro de digitação), não sugere saída, e usa carinha triste no lugar de
 * utilidade.
 */
export function mensagemDeErro(ctx) {
    const emoji = emojiDaIntencao(ctx.intencao);
    const alvo = ctx.assunto?.trim() ? ` para ${aspas(ctx.assunto)}` : '';
    const cabeca = `${emoji} Não achei nada${alvo}.`;
    const passo = ctx.proximoPasso?.trim();
    return passo ? `${cabeca}\n${passo}` : cabeca;
}
/**
 * Aplica o floreio da persona respeitando o teto. Recebe o texto já composto
 * pelo anfitrião: a persona não pode mudar o que foi dito, só acrescentar.
 */
export function comFloreio(texto, floreios) {
    const permitidos = floreios.filter((f) => f.trim()).slice(0, MAX_FLOREIOS_POR_MENSAGEM);
    if (permitidos.length === 0)
        return texto;
    return `${texto} ${permitidos[0].trim()}`;
}
//# sourceMappingURL=compose.js.map