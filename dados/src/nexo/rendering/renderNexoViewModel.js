// Renderer texto-first: sempre disponível, determinístico, sem LLM nem
// mídia (seção 28.5 do PDF: "o que não deve ser simplificado sem decisão
// de produto" inclui texto-first e fallback). Formatos mais ricos
// (imagem, lista/botão nativos) entram depois sem quebrar este contrato.

function formatSection(section) {
  const lines = [];
  if (section.heading) lines.push(`*${section.heading}:*`);
  lines.push(...section.lines);
  return lines.join('\n');
}

function renderNexoViewModel(viewModel) {
  const parts = [];
  if (viewModel.title) parts.push(`*${viewModel.title}*`);
  for (const section of viewModel.sections) {
    const formatted = formatSection(section);
    if (formatted) parts.push(formatted);
  }
  if (viewModel.actions?.length) {
    parts.push(viewModel.actions.map((action, index) => `${index + 1}. ${action.label}`).join('\n'));
  }
  if (viewModel.footer) parts.push(`_${viewModel.footer}_`);
  return { text: parts.filter(Boolean).join('\n\n'), mentions: [] };
}

export { renderNexoViewModel };
