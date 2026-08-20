import type { CollectionEntry } from 'astro:content';
import { slugify } from './format';

/**
 * The canonical order of categories and kinds, defined once.
 *
 * Filters previously derived their order from the content — `[...new Set(...)]` follows
 * whatever order the files happened to load in — while the index pages used a hand-written
 * array. The two disagreed, so the filter row reordered itself as you clicked through.
 * Everything now reads from here, so the order is the same on every page and changing it
 * is a one-line edit.
 *
 * These must stay in step with the enums in src/content.config.ts.
 */
export const PATTERN_CATEGORIES = ['Garments', 'Accessories', 'Home'] as const;
export const POST_KINDS = ['Yarn test', 'Stitch test', 'Fibre note'] as const;

export type PatternCategory = (typeof PATTERN_CATEGORIES)[number];
export type PostKind = (typeof POST_KINDS)[number];

export const categoryHref = (c: string) => `/patterns/c/${slugify(c)}/`;
export const kindHref = (k: string) => `/journal/c/${slugify(k)}/`;

/** Journal filters read as plurals: "Yarn tests", "Fibre notes". */
export const kindLabel = (k: string) => `${k}s`;

/** Newest first. The sort every listing uses. */
export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
	return b.data.date.valueOf() - a.data.date.valueOf();
}

/**
 * Keep only the values that actually have entries, in canonical order.
 * An offered filter that leads to an empty page is a dead end, so unused ones are hidden.
 */
function present<T extends string>(
	canonical: readonly T[],
	used: Iterable<string>
): T[] {
	const seen = new Set(used);
	return canonical.filter((value) => seen.has(value));
}

export const patternCategoriesInUse = (patterns: CollectionEntry<'patterns'>[]) =>
	present(PATTERN_CATEGORIES, patterns.map((p) => p.data.category));

export const postKindsInUse = (posts: CollectionEntry<'posts'>[]) =>
	present(POST_KINDS, posts.map((p) => p.data.kind));
