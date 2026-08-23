/**
 * Contrato de qualidade da fala do bot.
 *
 * Isto NÃO é voz. É engenharia: as regras que valem para qualquer persona
 * ativa. Nazuna cumpre falando como vampira; Alaska cumpre falando como Alaska.
 * O contrato não tem sotaque.
 *
 * A separação existe porque a arquitetura anterior errava nisso: a identidade
 * base carregava traços de personalidade, então trocar de persona dava a
 * persona nova com o sotaque da antiga. É o defeito que o !changeperso tem
 * hoje, em que escolher Zenitsu ainda devolve menus falando como Gyomei.
 */
/** Teto de floreio por mensagem, igual para todas as personas. */
export const MAX_FLOREIOS_POR_MENSAGEM = 1;
/**
 * O nome vive em configuração porque vai mudar. Deixá-lo incrustado em
 * centenas de strings foi o que tornou a troca cara da última vez.
 */
export const NOME_PADRAO = '𝖘𝖍𝖔𝖌𝖚𝖓';
export function resolveBotName(env = process.env) {
    return String(env.BOT_NAME ?? '').trim() || NOME_PADRAO;
}
/**
 * Obrigações que toda persona cumpre, independentemente de como fale.
 * Ficam declaradas para poderem ser verificadas por teste, não confiadas à
 * disciplina de quem escrever a próxima persona.
 */
export const OBRIGACOES = Object.freeze([
    'a frase diz o que está realmente acontecendo, com o assunto do pedido',
    'erro repete o termo e entrega um próximo passo',
    'comando rápido não anuncia que está processando',
    'no máximo um floreio por mensagem',
    'emoji deriva da intenção, não do nome do comando',
]);
//# sourceMappingURL=contract.js.map