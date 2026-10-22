import { CATEGORIES } from './yarn-weight';

/**
 * Craft Yarn Council weight names, by number.
 *
 * A pattern stores the number only. It used to store the name as well, typed by hand
 * beside it, so the same fact could disagree with itself — one pattern said "Light", the
 * next "Light (DK)" — and readers asked which was meant. The names come from the yarn
 * weight calculator's table, so the two can never differ. That table stops at 6 because
 * the calculator has no use for 7; Jumbo is added here.
 */
export const CYC_WEIGHTS: readonly { n: number; name: string }[] = [
	...CATEGORIES.map((c) => ({ n: c.n, name: c.name })),
	{ n: 7, name: 'Jumbo' },
];

/** e.g. 3 → "Light (DK)". */
export function cycWeightName(n: number): string {
	return CYC_WEIGHTS.find((w) => w.n === n)?.name ?? `CYC ${n}`;
}

/** e.g. 3 → "Light", 1 → "Super Fine". For tight spaces. */
export function cycWeightShort(n: number): string {
	return cycWeightName(n).split(' (')[0];
}
