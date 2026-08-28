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
/**
 * Pattern categories are stored as these lowercase slugs and displayed via the label map
 * below, so renaming what a reader sees never touches a content file or a URL.
 *
 * A pattern carries **several** of these. A hooded scarf is genuinely both clothing and an
 * accessory, and making the author pick one files it wrong whichever they choose.
 *
 * Unused values are hidden from the filter row by `present`, so a category with no patterns
 * can never become a dead end — which is why the full set can live here from the start.
 */
export const PATTERN_CATEGORIES = ['clothing', 'accessories', 'pets', 'home'] as const;
export const POST_KINDS = ['Garment making', 'Yarn and fibres', 'How-tos'] as const;

export type PatternCategory = (typeof PATTERN_CATEGORIES)[number];
export type PostKind = (typeof POST_KINDS)[number];

/** What a reader sees. Edit here, not in content. */
export const CATEGORY_LABELS: Record<PatternCategory, string> = {
	clothing: 'Clothing',
	accessories: 'Accessories',
	pets: 'Pets',
	home: 'Home',
};

export const categoryLabel = (c: string) =>
	CATEGORY_LABELS[c as PatternCategory] ?? c;

// Already a slug, so unlike kinds it needs no slugify.
export const categoryHref = (c: string) => `/patterns/c/${c}/`;
export const kindHref = (k: string) => `/journal/c/${slugify(k)}/`;



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
	present(PATTERN_CATEGORIES, patterns.flatMap((p) => p.data.category));

export const postKindsInUse = (posts: CollectionEntry<'posts'>[]) =>
	present(POST_KINDS, posts.map((p) => p.data.kind));
