import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
	const [patterns, posts] = await Promise.all([
		getCollection('patterns'),
		getCollection('posts'),
	]);

	// One feed for the whole site — the homepage mixes both, so the feed should too.
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
	].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

	return rss({
		title: 'Hookd',
		description:
			'Free crochet patterns, and write-ups of yarn, fibre and stitch tests.',
		site: context.site!,
		items,
	});
}
