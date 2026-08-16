// Catálogo legado de modelos aceitos pela BunnyFy. Este módulo não realiza
// transporte externo: toda inferência do bot passa pelo gateway BunnyFy.
export const DEFAULT_NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';

export const NVIDIA_MODEL_CATALOG = [
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    label: 'Nemotron Super 49B (mais completo)',
    description: 'Mantém respostas detalhadas e a personalidade do Gyomei de forma consistente.'
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B (mais rápido)',
    description: 'Prioriza respostas rápidas para conversas e perguntas diretas.'
  },
  {
    id: 'meta/llama-3.2-3b-instruct',
    label: 'Llama 3.2 3B (mais leve)',
    description: 'Alternativa enxuta para interações simples.'
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B (equilíbrio)',
    description: 'Equilibra consistência, profundidade e tempo de resposta.'
  }
];

export function isKnownNvidiaModel(modelId) {
  return NVIDIA_MODEL_CATALOG.some(entry => entry.id === modelId);
}
