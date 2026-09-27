import { MAX_FLOREIOS_POR_MENSAGEM } from './contract.js';

export type Natureza = 'bot';

export interface Persona {
  /** Identidade única da conversa. */
  readonly chave: string;
  /** Nome exibido. */
  readonly nome: string;
  readonly natureza: Natureza;
  /** Vocabulário reservado ao Shogun. */
  readonly marcadores: readonly string[];
  /** Interjeições disponíveis; o compositor usa no máximo uma por mensagem. */
  readonly floreios: readonly string[];
}

export const SHOGUN: Persona = Object.freeze({
  chave: 'shogun', nome: '𝖘𝖍𝖔𝖌𝖚𝖓', natureza: 'bot',
  marcadores: Object.freeze([]), floreios: Object.freeze([]),
});
const registro = new Map<string, Persona>([['shogun', SHOGUN]]);

export function registrarPersona(persona: Persona): void {
  if (persona.chave !== 'shogun') throw new Error('A conversa usa somente Shogun.');
  registro.set(persona.chave, persona);
}

export function obterPersona(chave: string): Persona | null {
  return registro.get(String(chave || '').trim().toLowerCase()) ?? null;
}

export function personasRegistradas(): readonly Persona[] {
  return [...registro.values()];
}

/**
 * Escolhe o floreio da vez respeitando o teto. Recebe o texto já pronto do
 * compositor: a persona acrescenta, nunca reescreve o que foi dito — senão o
 * conteúdo verdadeiro poderia ser perdido no meio do enfeite.
 */
export function aplicarFloreio(texto: string, persona: Persona | null, sorteio: () => number = Math.random): string {
  if (!persona || persona.floreios.length === 0) return texto;
  if (MAX_FLOREIOS_POR_MENSAGEM < 1) return texto;
  const escolhido = persona.floreios[Math.floor(sorteio() * persona.floreios.length)];
  return escolhido ? `${texto} ${escolhido}` : texto;
}
