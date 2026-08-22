export const EMOJI_POR_INTENCAO = Object.freeze({
    buscar: '🔍',
    baixar: '📥',
    gerar: '🎨',
    converter: '🔄',
    enviar: '📤',
    jogar: '🎲',
    consultar: '📊',
    configurar: '⚙️',
    moderar: '🧹',
    punir: '🚫',
    promover: '⭐',
    conversar: '💬',
    calcular: '🧮',
    sortear: '🍀',
    perfilar: '👤',
    ajudar: '📖',
    brincar: '😄',
    negociar: '💰',
    progredir: '⚔️',
});
/**
 * Quanto tempo, tipicamente, a intenção leva. Só o que é lento merece aviso de
 * espera: anunciar "processando" num comando de 200ms é ruído, e é parte do que
 * faz o bot soar robótico. Silêncio também é resposta humana.
 */
export const LENTA = new Set(['buscar', 'baixar', 'gerar', 'converter']);
export function emojiDaIntencao(intencao) {
    return EMOJI_POR_INTENCAO[intencao];
}
export function mereceAvisoDeEspera(intencao) {
    return LENTA.has(intencao);
}
/**
 * Verbo no gerúndio para compor o aviso de espera com o assunto real do pedido.
 * É a diferença entre "Nas sombras, já estou preparando tudo" — que serve para
 * qualquer coisa e portanto não informa nada — e "Procurando X".
 */
const GERUNDIO = Object.freeze({
    buscar: 'Procurando',
    baixar: 'Baixando',
    gerar: 'Criando',
    converter: 'Convertendo',
    enviar: 'Enviando',
    jogar: 'Preparando',
    consultar: 'Consultando',
    configurar: 'Ajustando',
    moderar: 'Organizando',
    punir: 'Aplicando',
    promover: 'Promovendo',
    conversar: 'Pensando',
    calcular: 'Calculando',
    sortear: 'Sorteando',
    perfilar: 'Montando',
    ajudar: 'Reunindo',
    brincar: 'Preparando',
    negociar: 'Registrando',
    progredir: 'Resolvendo',
});
export function gerundioDaIntencao(intencao) {
    return GERUNDIO[intencao];
}
//# sourceMappingURL=intents.js.map