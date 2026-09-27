import type { CommandAccessDecision } from '../../../src/commands/access-policy.js';
export type MenuAccessResolver = (command: string, entry?: MenuTextEntry) => CommandAccessDecision;

export interface MenuTextEntry {
    readonly command: string;
    readonly arguments?: string;
    readonly description?: string;
    readonly unavailableReason?: string;
    readonly liteExcluded?: boolean;
}

export interface MenuTextSection {
    readonly title: string;
    readonly entries: readonly MenuTextEntry[];
    readonly notes?: readonly string[];
    readonly optionKey?: string;
}

export function sanitizeMenuDisplayName(value: unknown): string;
export function selectMenuEntries(entries: readonly MenuTextEntry[], accessFor?: MenuAccessResolver): readonly MenuTextEntry[];
export function prepareMenuSections(
    sections: readonly MenuTextSection[],
    options?: Readonly<Record<string, unknown>>,
    context?: { readonly isLiteMode?: boolean },
): readonly MenuTextSection[];
export function renderShogunMenu(input: {
    readonly title: string;
    readonly prefix: string;
    readonly userName: string;
    readonly sections: readonly MenuTextSection[];
    readonly accessFor?: MenuAccessResolver;
}): string;
