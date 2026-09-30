const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
export function isValidReaction(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    return [...graphemes.segment(value)].length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(value);
}
