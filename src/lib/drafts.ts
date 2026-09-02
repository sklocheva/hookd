import type { CollectionEntry } from 'astro:content';

/**
 * Where a draft lives on the live site, and why it is not where you would expect.
 *
 * Drafts used to render at their real URL and sit in every listing, kept out of search
 * only by `noindex`. That made the site usable while everything was unfinished, but it
 * also meant a reader browsing the journal saw half-transcribed ball bands. Now:
 *
 * - a draft is **absent from every listing** — homepage, both indexes, the filter routes,
 *   related links, the feed and the sitemap;
 * - a draft **renders at an unguessable address** instead of its real one, so the URL it
 *   will eventually own returns 404 until it is published.
 *
 * The address is the entry's `previewId`, a UUID the CMS generates when the entry is
 * created. Publishing moves the page to its real slug — which is the point, because a
 * published pattern is meant to be found, and `/patterns/halland-cowl/` is what belongs
 * in a search result. Nothing links to the preview address, so nothing breaks when it
 * stops resolving.
 *
 * **This hides drafts from readers, not from the world.** The repository is public: the
 * frontmatter, the `previewId` and the unfinished prose are all readable on GitHub by
 * anyone who looks. What this defends against is the realistic case — someone browsing
 * the site, or trying the obvious URL — not a determined reader of the source. If a draft
 * ever genuinely needs to be secret, it has to stop being built at all.
 */
type AnyEntry =
	| CollectionEntry<'patterns'>
	| CollectionEntry<'posts'>
	| CollectionEntry<'reviews'>;

/** URL prefix per collection, matching the routes under src/pages. */
export const ROUTE_BASE = {
	patterns: '/patterns',
	posts: '/journal',
	reviews: '/journal/yarn',
} as const;

export type DraftCollection = keyof typeof ROUTE_BASE;

export const isDraft = (entry: AnyEntry): boolean => entry.data.draft === true;

/** Everything a reader is allowed to see listed. */
export function published<T extends AnyEntry>(entries: T[]): T[] {
	return entries.filter((e) => !isDraft(e));
}

/**
 * A stand-in address for a draft whose `previewId` is missing.
 *
 * The CMS generates the id on creation, and every existing entry has been backfilled, so
 * this should never fire. It exists because the alternative failure — falling back to the
 * real slug — publishes the draft at the exact URL this module exists to keep empty. An
 * ugly address is a much better failure than a visible one.
 *
 * FNV-1a over four seeds rather than node:crypto, so this stays a plain module with no
 * platform imports. It is deterministic from the slug and the code is public, which is no
 * weaker than the id it replaces: both are readable in the repository.
 */
function fallbackId(slug: string): string {
	const hash = (seed: number) => {
		let h = seed;
		for (let i = 0; i < slug.length; i++) {
			h ^= slug.charCodeAt(i);
			h = Math.imul(h, 0x01000193) >>> 0;
		}
		return h.toString(16).padStart(8, '0');
	};
	return [0x811c9dc5, 0x7ee3a1b9, 0x2f1e4c07, 0x9b5d3f21].map(hash).join('');
}

/** The URL segment an entry is built at: its real slug, or its preview id while draft. */
export function segment(entry: AnyEntry): string {
	if (!isDraft(entry)) return entry.id;
	return entry.data.previewId || fallbackId(entry.id);
}

/** The full path an entry is built at, draft or published. */
export function entryPath(collection: DraftCollection, entry: AnyEntry): string {
	return `${ROUTE_BASE[collection]}/${segment(entry)}/`;
}

/**
 * The stable address for an entry, whatever state it is in.
 *
 * `/admin` links here rather than to the page itself, because `preview_path` is one
 * template per collection and cannot be conditional — a link straight to the preview
 * address would 404 the moment the entry was published, and a link to the real slug
 * would 404 while it was still a draft. This one follows the entry across that line.
 */
export const goPath = (previewId: string): string => `/go/${previewId}/`;
