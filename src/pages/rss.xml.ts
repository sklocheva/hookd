import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { QUIZ_KIND, YARN_KIND } from '../lib/taxonomy';

export async function GET(context: APIContext) {
	// Drafts are unlisted everywhere, and a subscriber's reader is a listing like any
	// other — see src/lib/drafts.ts.
	const [patterns, posts, reviews, quizzes] = await Promise.all([
		getCollection('patterns', ({ data }) => !data.draft),
		getCollection('posts', ({ data }) => !data.draft),
		getCollection('reviews', ({ data }) => !data.draft),
		getCollection('quizzes', ({ data }) => !data.draft),
	]);

	// One feed for the whole site. It carries what the homepage's "Latest" carries, so a
	// quiz is in it: it was left out once, and the newest thing on the site never reached
	// anyone who subscribed.
	const items = [
		...patterns.map((p) => ({
			title: p.data.title,
			pubDate: p.data.date,
			description: p.data.summary,
			link: `/patterns/${p.id}/`,
			categories: ['Pattern', ...p.data.tags],
		})),
		...posts.map((p) => ({
			title: p.data.title,
			pubDate: p.data.date,
			description: p.data.summary,
			link: `/journal/${p.id}/`,
			categories: [p.data.kind, ...p.data.tags],
		})),
		...reviews.map((r) => ({
			title: r.data.title,
			pubDate: r.data.date,
			// The standfirst is written to work alone, which is exactly what a feed shows.
			// Published notes always have one; the fallback is only for the type.
			description: r.data.standfirst ?? '',
			link: `/journal/yarn/${r.id}/`,
			// They are yarn notes, never reviews — the word comes from the one place it lives.
			categories: [YARN_KIND, r.data.yarn.brand].filter((c): c is string => !!c),
		})),
		...quizzes.map((q) => ({
			title: q.data.title,
			pubDate: q.data.date,
			description: q.data.teaser,
			link: `/journal/quiz/${q.id}/`,
			categories: [QUIZ_KIND],
		})),
	].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

	return rss({
		title: 'Hookd',
		description:
			'Crochet patterns, and write-ups of yarn, fibre and stitch tests.',
		site: context.site!,
		items,
	});
}
