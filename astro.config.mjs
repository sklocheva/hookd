// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { remarkCmsImages } from './src/lib/remark-cms-images.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The slugs of every **published** entry in one collection.
 *
 * Read straight from the frontmatter rather than from the content collections, because
 * the sitemap integration is configured before those exist.
 *
 * This is an allowlist, not a blocklist, and deliberately so. Drafts are built at an
 * unguessable preview address (see src/lib/drafts.ts), and an earlier blocklist here
 * listed the *real* slugs of drafts — which stopped matching the moment the address
 * changed, and had never covered the reviews collection at all. Two draft yarn notes
 * were live in the sitemap carrying `noindex`, which is the exact contradiction this
 * code exists to prevent. Listing what may appear means an address this file does not
 * recognise is dropped rather than published.
 */
function publishedSlugs(/** @type {string} */ dir) {
	const slugs = new Set();
	const base = fileURLToPath(new URL(`./src/content/${dir}/`, import.meta.url));

	let files = [];
	try {
		files = readdirSync(base);
	} catch {
		return slugs; // collection not created yet
	}

	for (const file of files) {
		if (!/\.mdx?$/.test(file)) continue;
		const frontmatter = readFileSync(base + file, 'utf8').split('---')[1] ?? '';
		if (/^draft:\s*true/m.test(frontmatter)) continue;
		slugs.add(file.replace(/\.mdx?$/, ''));
	}
	return slugs;
}

const live = {
	patterns: publishedSlugs('patterns'),
	posts: publishedSlugs('posts'),
	reviews: publishedSlugs('reviews'),
};

/**
 * Whether a built page belongs in the sitemap.
 *
 * Anything that is not an entry page — the indexes, the category and kind routes, the
 * legal pages — passes through. An entry page is admitted only if its slug belongs to a
 * published entry, so both a draft's preview address and the /go/ links are excluded
 * without this file having to know how either is spelled.
 */
function inSitemap(/** @type {string} */ pathname) {
	if (pathname.startsWith('/go/')) return false;

	const yarn = pathname.match(/^\/journal\/yarn\/([^/]+)\/$/);
	if (yarn) return live.reviews.has(yarn[1]);

	const journal = pathname.match(/^\/journal\/([^/]+)\/$/);
	if (journal) return journal[1] === 'c' || live.posts.has(journal[1]);

	const pattern = pathname.match(/^\/patterns\/([^/]+)\/$/);
	if (pattern) return pattern[1] === 'c' || live.patterns.has(pattern[1]);

	return true;
}

// https://astro.build/config
export default defineConfig({
	// Absolute URL of the deployed site. @astrojs/sitemap needs this at build time
	// to emit absolute <loc> entries. Keep in sync with public/robots.txt.
	site: 'https://hookd-blog.sklocheva.workers.dev',
	// The CMS writes body images as /src/assets/… ; Astro only optimizes relative
	// markdown paths, so this rewrites them before the asset pipeline runs.
	markdown: { remarkPlugins: [remarkCmsImages] },
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => inSitemap(new URL(page).pathname),
		}),
	],
});
