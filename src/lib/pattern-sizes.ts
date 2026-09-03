import type { CollectionEntry } from 'astro:content';

/**
 * Per-size numbers inside instruction text.
 *
 * A graded pattern's instructions read "Ch {neckCh}, loosely" — one sentence, written once,
 * with the number supplied by whichever size the reader picked. The alternative is writing
 * the row out per size, which is how a corrected number ends up fixed in one copy and not
 * the other six.
 *
 * The reader sees exactly one set of figures. Nothing is crossed out, nothing is bracketed,
 * and there is no "(84, 92, 100, 108)" to count along. That is the whole point of the size
 * picker in the design.
 *
 * **This module substitutes; it never calculates.** The design's own garment derives its
 * counts from a raglan formula, and that formula is a fact about that cardigan, not about
 * patterns — a beanie or a blanket shares none of it. So the author does the arithmetic in
 * the grading spreadsheet and stores the answers, and the site stays a template rather than
 * a calculator that is wrong for every pattern but one.
 */
type Pattern = CollectionEntry<'patterns'>;
type Sizes = Pattern['data']['sizes'];

/** `{key}` — a brace-wrapped key, matching the names authors give in `sizes[].values`. */
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/** One size's values, flattened from the authored list into a lookup. */
export type SizeValues = Record<string, string>;

export function valuesFor(size: Sizes[number]): SizeValues {
	const out: SizeValues = {};
	for (const { key, value } of size.values) out[key] = value;
	return out;
}

/** Every size's values, keyed by size name — serialised into the page for the picker. */
export function allSizeValues(sizes: Sizes): Record<string, SizeValues> {
	const out: Record<string, SizeValues> = {};
	for (const size of sizes) out[size.name] = valuesFor(size);
	return out;
}

/**
 * Which size renders in the HTML.
 *
 * With JavaScript off this is the pattern the reader gets, so it has to be a usable one —
 * the middle of the range rather than the smallest, which is why this defaults to the
 * middle rather than to index 0.
 */
export function defaultSizeIndex(sizes: Sizes, named?: string): number {
	if (named) {
		const i = sizes.findIndex((s) => s.name === named);
		if (i >= 0) return i;
	}
	return Math.floor((sizes.length - 1) / 2);
}

/** A run of instruction text: either literal prose, or one substituted per-size number. */
export type TextPart = { text: string; key?: string };

/**
 * Split instruction text into literals and substitutions.
 *
 * Each substitution is rendered inside `<span data-size-field="key">` so the picker can
 * rewrite it in place without touching the sentence around it. An unknown key renders as
 * the brace text it came from — visible, so a typo in a key shows up on the page instead of
 * silently printing nothing where a stitch count should be.
 */
export function textParts(text: string, values: SizeValues): TextPart[] {
	const parts: TextPart[] = [];
	let last = 0;

	for (const match of text.matchAll(PLACEHOLDER)) {
		const [whole, key] = match;
		const at = match.index ?? 0;
		if (at > last) parts.push({ text: text.slice(last, at) });
		parts.push({ text: values[key] ?? whole, key });
		last = at + whole.length;
	}

	if (last < text.length) parts.push({ text: text.slice(last) });
	return parts;
}

/** Every placeholder key used anywhere in the instructions. */
export function keysUsed(pattern: Pattern['data']): Set<string> {
	const keys = new Set<string>();
	for (const section of pattern.instructions?.sections ?? []) {
		for (const row of section.rows) {
			// Labels carry them too: "Rnds 2–{yokeRnds}" is a range that moves with the size.
			for (const text of [row.label, row.text]) {
				for (const m of text.matchAll(PLACEHOLDER)) keys.add(m[1]);
			}
		}
	}
	return keys;
}

/**
 * The one-line summary beside the size picker: "104 cm finished bust · 62 cm long · 1290 m".
 *
 * Built from the size's own finished measurements rather than authored again, so it cannot
 * disagree with the size table above it.
 */
export function sizeSummary(size: Sizes[number]): string {
	return [
		...size.measurements.map((m) => `${m.value} ${m.unit} ${m.label.toLowerCase()}`),
		`${size.yardageM} m`,
	].join(' · ');
}
