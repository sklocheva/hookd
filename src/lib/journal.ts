import type { CollectionEntry } from 'astro:content';
import { readTime } from './format';
import { QUIZ_KIND, YARN_KIND } from './taxonomy';

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
	/** The coloured eyebrow: a post's kind. Yarn entries file under YARN_KIND. */
	kind: string;
	title: string;
	summary: string;
	date: Date;
	heroImage?: string;
	heroImageAlt: string;
	/** Only test notes carry one — the method line under the excerpt. */
	method?: string;
	readMinutes: number;
	/**
	 * What the eyebrow says instead of "N min".
	 *
	 * Read time is computed from a body, and a quiz does not have one — running the word
	 * counter over its JSON would produce a number that means nothing. A quiz sets this
	 * to "1 min" instead of pretending to have prose.
	 */
	metaLabel?: string;
	/**
	 * The designed stand-in for a row that will never have a photograph.
	 *
	 * Distinct from a missing `heroImage`, which means the picture has not been taken yet
	 * and gets the striped placeholder. A quiz has nothing to photograph, so its row shows
	 * a tile built out of the quiz itself — see PlaceholderTile.astro.
	 */
	tile?: { symbol: string; caption?: string };
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
		kind: YARN_KIND,
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

/**
 * A quiz row.
 *
 * No photograph, and no read time — see `tile` and `metaLabel`. The outcome names go on
 * the tile because they are the most honest preview a quiz can offer: they say what kind
 * of answer you are going to get without giving away which one you will get.
 */
export function fromQuiz(q: CollectionEntry<'quizzes'>): JournalEntry {
	return {
		href: `/journal/quiz/${q.id}/`,
		kind: QUIZ_KIND,
		title: q.data.title,
		summary: q.data.teaser,
		date: q.data.date,
		heroImageAlt: '',
		method: `${q.data.questions.length} questions · nothing saved · no email`,
		readMinutes: 1,
		metaLabel: '1 min',
		tile: {
			symbol: '?',
			caption:
				q.data.tileCaption ?? q.data.outcomes.map((o) => o.name.replace(/\.$/, '')).join(' · '),
		},
	};
}

/** Newest first, across both collections. */
export const newestFirst = (a: JournalEntry, b: JournalEntry) =>
	b.date.valueOf() - a.date.valueOf();

/**
 * Every journal entry, from both collections, newest first.
 *
 * One function so the index and the kind routes cannot disagree about what the journal
 * contains — which they did while yarn entries were listed only under "All".
 */
export function allJournalEntries(
	posts: CollectionEntry<'posts'>[],
	reviews: CollectionEntry<'reviews'>[],
	quizzes: CollectionEntry<'quizzes'>[] = []
): JournalEntry[] {
	return [...posts.map(fromPost), ...reviews.map(fromReview), ...quizzes.map(fromQuiz)].sort(
		newestFirst
	);
}
