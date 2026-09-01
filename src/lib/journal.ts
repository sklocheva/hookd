import type { CollectionEntry } from 'astro:content';
import { readTime } from './format';

/**
 * One row in the journal list, whichever collection it came from.
 *
 * Test notes and yarn reviews are separate collections because their field sets have
 * almost nothing in common — one is an essay, the other a spec sheet. But they are the
 * same thing to a reader browsing the journal, and the review page's own back link says
 * "All journal entries", so the list has to show both. Normalising here keeps that
 * decision in one place instead of teaching the list component about two shapes.
 */
export interface JournalEntry {
	href: string;
	/** The coloured eyebrow: a post's kind, or "Yarn review". */
	kind: string;
	title: string;
	summary: string;
	date: Date;
	heroImage?: string;
	heroImageAlt: string;
	/** Only test notes carry one — the method line under the excerpt. */
	method?: string;
	readMinutes: number;
}

export function fromPost(p: CollectionEntry<'posts'>): JournalEntry {
	return {
		href: `/journal/${p.id}/`,
		kind: p.data.kind,
		title: p.data.title,
		summary: p.data.summary,
		date: p.data.date,
		heroImage: p.data.heroImage,
		heroImageAlt: p.data.heroImageAlt,
		method: p.data.method,
		readMinutes: readTime(p.body ?? ''),
	};
}

export function fromReview(r: CollectionEntry<'reviews'>): JournalEntry {
	return {
		href: `/journal/yarn/${r.id}/`,
		kind: 'Yarn review',
		title: r.data.title,
		// The standfirst is the review's summary — it is written to be the answer on its own.
		// It can be absent on a draft, which still lists; the row just carries no excerpt.
		summary: r.data.standfirst ?? '',
		date: r.data.date,
		heroImage: r.data.heroImage,
		heroImageAlt: r.data.heroImageAlt ?? '',
		method: [r.data.yarn.brand, r.data.yarn.line].filter(Boolean).join(' · ') || undefined,
		readMinutes: readTime(r.body ?? ''),
	};
}

/** Newest first, across both collections. */
export const newestFirst = (a: JournalEntry, b: JournalEntry) =>
	b.date.valueOf() - a.date.valueOf();
