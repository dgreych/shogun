// Compartilhado por menus e respostas, inclusive desenhos personalizados.
const rendered = new Map();
let totalBytes = 0;
const MAX_BYTES = 2 * 1024 * 1024;
export function rememberRenderedOutput(text, { body = text } = {}) {
    const value = text.trim();
    if (!rendered.has(value)) {
        const size = Buffer.byteLength(value) + Buffer.byteLength(body);
        if (size <= MAX_BYTES) {
            rendered.set(value, { size, body });
            totalBytes += size;
        }
    }
    while (rendered.size > 500 || totalBytes > MAX_BYTES) {
        const first = rendered.keys().next().value;
        if (first === undefined)
            break;
        totalBytes -= rendered.get(first).size;
        rendered.delete(first);
    }
    return text;
}
export function isRenderedOutput(text) {
    const value = text.trim();
    if (rendered.has(value))
        return true;
    // O prefixo de ler mais pode preceder um menu já composto.
    for (const known of rendered.keys())
        if (value.endsWith(known))
            return true;
    return false;
}
export function renderedOutputBody(text) {
    const value = text.trim();
    if (rendered.has(value))
        return rendered.get(value).body;
    for (const [known, metadata] of rendered)
        if (value.endsWith(known))
            return metadata.body;
    return text;
}
//# sourceMappingURL=rendered-output.js.map