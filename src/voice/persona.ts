import { MAX_FLOREIOS_POR_MENSAGEM } from './contract.js';

/**
 * Uma persona é a VOZ inteira do bot enquanto estiver ativa.
 *
 * O !changeperso troca a persona por completo: nada da anterior permanece.
 * Por isso todo vocabulário característico mora aqui dentro, e nunca em
 * camadas compartilhadas — o que estivesse compartilhado vazaria para todas.
 */
/**
 * Nem toda persona é sobrenatural — depende do personagem. Isso muda a voz:
 * quem não tem pressa nem medo fala diferente de quem tem os dois.
 */
export type Natureza = 'humana' | 'fantasma' | 'vampira' | 'outra-sobrenatural';

export interface Persona {
  /** Chave usada pelo !changeperso. */
  readonly chave: string;
  /** Nome exibido. */
  readonly nome: string;
  readonly natureza: Natureza;
  /**
   * Palavras e expressões que marcam esta voz. Servem para escrever as falas e,
   * principalmente, para o teste de vazamento: se um termo desta lista aparecer
   * com outra persona ativa, a separação foi quebrada.
   */
  readonly marcadores: readonly string[];
  /** Interjeições disponíveis; o compositor usa no máximo uma por mensagem. */
  readonly floreios: readonly string[];
}

const registro = new Map<string, Persona>();

export function registrarPersona(persona: Persona): void {
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
