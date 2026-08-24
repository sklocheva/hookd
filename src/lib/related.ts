import type { CollectionEntry } from 'astro:content';

type Pattern = CollectionEntry<'patterns'>;
type Post = CollectionEntry<'posts'>;

/** One card in the "read next" strip. Both collections normalise to this. */
export interface RelatedItem {
	id: string;
	href: string;
	title: string;
	summary: string;
	heroImage?: string;
	heroImageAlt: string;
	/** Coloured eyebrow: "Pattern", or the post's kind. */
	kind: string;
	tone: 'pattern' | 'journal';
	date: Date;
	/** Whether this was hand-picked or matched automatically. Used for the section note. */
	picked: boolean;
}

function fromPattern(p: Pattern, picked: boolean): RelatedItem {
	return {
		id: p.id,
		href: `/patterns/${p.id}/`,
		title: p.data.title,
		summary: p.data.summary,
		heroImage: p.data.heroImage,
		heroImageAlt: p.data.heroImageAlt,
		kind: 'Pattern',
		tone: 'pattern',
		date: p.data.date,
		picked,
	};
}

function fromPost(p: Post, picked: boolean): RelatedItem {
	return {
		id: p.id,
		href: `/journal/${p.id}/`,
		title: p.data.title,
		summary: p.data.summary,
		heroImage: p.data.heroImage,
		heroImageAlt: p.data.heroImageAlt,
		kind: p.data.kind,
		tone: 'journal',
		date: p.data.date,
		picked,
	};
}

/**
 * How strongly two entries relate.
 *
 * Shared tags dominate because they are the only signal an author sets deliberately
 * about subject matter. Same category or kind is a weaker nudge — two garments are
 * more alike than a garment and a blanket, but not by much. Recency breaks ties, so a
 * dormant post does not outrank a fresh one on an equal score.
 */
function score(
	source: { tags: string[]; category?: string; kind?: string },
	candidate: { tags: string[]; category?: string; kind?: string; date: Date }
): number {
	const tags = new Set(source.tags);
	let n = candidate.tags.filter((t) => tags.has(t)).length * 3;

	if (source.category && source.category === candidate.category) n += 1;
	if (source.kind && source.kind === candidate.kind) n += 1;

	// Tiny recency nudge — never enough to beat a single shared tag.
	n += Math.min(candidate.date.valueOf() / 1e15, 0.5);
	return n;
}

/**
 * Build the "read next" list for one entry.
 *
 * Hand-picked entries come first, in the order the author set them. Anything still
 * missing is filled by score, so the strip is always full and an author who picks
 * nothing still gets sensible links. Cross-type links are the point: a pattern should
 * be able to send you to the yarn test behind it, and back again.
 */
export function getRelated(
	source:
		| { type: 'pattern'; entry: Pattern }
		| { type: 'post'; entry: Post },
	all: { patterns: Pattern[]; posts: Post[] },
	limit = 3
): RelatedItem[] {
	const d = source.entry.data;
	const selfHref =
		source.type === 'pattern' ? `/patterns/${source.entry.id}/` : `/journal/${source.entry.id}/`;

	const chosen: RelatedItem[] = [];
	const taken = new Set<string>([selfHref]);

	const add = (item: RelatedItem) => {
		if (taken.has(item.href) || chosen.length >= limit) return;
		taken.add(item.href);
		chosen.push(item);
	};

	// 1. Explicit picks, in the author's order.
	for (const ref of d.relatedPatterns ?? []) {
		const match = all.patterns.find((p) => p.id === ref.id);
		if (match) add(fromPattern(match, true));
	}
	for (const ref of d.relatedPosts ?? []) {
		const match = all.posts.find((p) => p.id === ref.id);
		if (match) add(fromPost(match, true));
	}

	// A pattern's yarn-test citation is a strong relation already stated — use it
	// before falling back to guessing from tags.
	if (source.type === 'pattern' && d.relatedPost) {
		const match = all.posts.find((p) => p.id === (d.relatedPost as { id: string }).id);
		if (match) add(fromPost(match, true));
	}

	if (chosen.length >= limit) return chosen;

	// 2. Fill the rest by score, best first.
	const src = {
		tags: d.tags,
		category: source.type === 'pattern' ? (d as Pattern['data']).category : undefined,
		kind: source.type === 'post' ? (d as Post['data']).kind : undefined,
	};

	const scored = [
		...all.patterns.map((p) => ({
			item: fromPattern(p, false),
			n: score(src, { tags: p.data.tags, category: p.data.category, date: p.data.date }),
		})),
		...all.posts.map((p) => ({
			item: fromPost(p, false),
			n: score(src, { tags: p.data.tags, kind: p.data.kind, date: p.data.date }),
		})),
	]
		.filter(({ item, n }) => !taken.has(item.href) && n >= 1)
		.sort((a, b) => b.n - a.n);

	for (const { item } of scored) add(item);

	if (chosen.length >= limit) return chosen;

	// 3. Still short. On a site this size an unrelated page still beats a dead end, so
	//    fill with the newest entries — preferring the *other* collection, because the
	//    round trip between a pattern and the test behind it is the point of the strip.
	const otherFirst =
		source.type === 'pattern'
			? [...all.posts.map((p) => fromPost(p, false)), ...all.patterns.map((p) => fromPattern(p, false))]
			: [...all.patterns.map((p) => fromPattern(p, false)), ...all.posts.map((p) => fromPost(p, false))];

	for (const item of otherFirst.sort((a, b) => b.date.valueOf() - a.date.valueOf())) add(item);

	return chosen;
}
