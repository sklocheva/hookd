// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Slugs of entries marked `draft: true`, read straight from the frontmatter.
 *
 * Drafts carry noindex, but a noindex page listed in the sitemap is contradictory and
 * Search Console reports it as an error — so they are dropped from the sitemap too.
 * Read here rather than passed in because the sitemap integration is configured before
 * the content collections exist.
 */
function draftPaths() {
	const collections = { patterns: 'patterns', posts: 'journal' };
	const paths = [];

	for (const [dir, route] of Object.entries(collections)) {
		const base = fileURLToPath(new URL(`./src/content/${dir}/`, import.meta.url));
		let files = [];
		try {
			files = readdirSync(base);
		} catch {
			continue; // collection not created yet
		}
		for (const file of files) {
			if (!/\.mdx?$/.test(file)) continue;
			const body = readFileSync(base + file, 'utf8');
			const frontmatter = body.split('---')[1] ?? '';
			if (/^draft:\s*true/m.test(frontmatter)) {
				paths.push(`/${route}/${file.replace(/\.mdx?$/, '')}/`);
			}
		}
	}
	return paths;
}

const drafts = new Set(draftPaths());

// https://astro.build/config
export default defineConfig({
	// Absolute URL of the deployed site. @astrojs/sitemap needs this at build time
	// to emit absolute <loc> entries. Keep in sync with public/robots.txt.
	site: 'https://hookd-blog.sklocheva.workers.dev',
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => {
				const path = new URL(page).pathname;
				return !drafts.has(path);
			},
		}),
	],
});
