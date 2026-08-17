import { createHash } from 'node:crypto';

// Seção 5.2/5.4 do PDF: "O sistema gera Signatura, Origem, atributos,
// três técnicas e equipamento inicial" -- Origem NUNCA é escolha manual
// do jogador (só Impulso e Cicatriz são, seção 5.2 passos 2-3). O PDF
// fixa oito Origens mas só documenta o mapeamento de UMA delas
// (archive_runaway com o Impulso "understand_hidden" + Cicatriz
// "strange_echo" no exemplo de CharacterSeed da seção 5.4) -- as outras
// sete não têm regra de atribuição especificada. Determinística por
// (impulso, cicatriz) via hash pra todo o resto: a mesma combinação
// sempre gera a mesma Origem (reproduzível, sem RNG novo, sem fricção
// extra no onboarding rápido).
//
// Achado real de GPT-NEXO-007 (severidade MÉDIA): a versão anterior
// (hash puro) não preservava esse único exemplo canônico -- o par
// understand_hidden+strange_echo caía em lantern_courier em vez de
// archive_runaway. Corrigido com um caso especial só pra esse par,
// condicionado a archive_runaway realmente existir na lista recebida
// (defesa contra o provider de teste genérico, que não usa IDs reais).
const CANONICAL_ORIGIN_BY_PAIR = Object.freeze({
  'understand_hidden:strange_echo': 'archive_runaway'
});

function assignOriginId({ impulseId, scarId, origins }) {
  if (!Array.isArray(origins) || origins.length === 0) return null;
  const canonicalId = CANONICAL_ORIGIN_BY_PAIR[`${impulseId}:${scarId}`];
  if (canonicalId && origins.some(origin => origin.id === canonicalId)) return canonicalId;
  const digest = createHash('sha256').update(`${impulseId}:${scarId}`).digest();
  const index = digest.readUInt32BE(0) % origins.length;
  return origins[index].id;
}

export { assignOriginId };
