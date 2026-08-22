import { MAX_FLOREIOS_POR_MENSAGEM } from './contract.js';
const registro = new Map();
export function registrarPersona(persona) {
    registro.set(persona.chave, persona);
}
export function obterPersona(chave) {
    return registro.get(String(chave || '').trim().toLowerCase()) ?? null;
}
export function personasRegistradas() {
    return [...registro.values()];
}
/**
 * Escolhe o floreio da vez respeitando o teto. Recebe o texto já pronto do
 * compositor: a persona acrescenta, nunca reescreve o que foi dito — senão o
 * conteúdo verdadeiro poderia ser perdido no meio do enfeite.
 */
export function aplicarFloreio(texto, persona, sorteio = Math.random) {
    if (!persona || persona.floreios.length === 0)
        return texto;
    if (MAX_FLOREIOS_POR_MENSAGEM < 1)
        return texto;
    const escolhido = persona.floreios[Math.floor(sorteio() * persona.floreios.length)];
    return escolhido ? `${texto} ${escolhido}` : texto;
}
//# sourceMappingURL=persona.js.map