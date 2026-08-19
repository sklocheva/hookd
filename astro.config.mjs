// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
	// Absolute URL of the deployed site. @astrojs/sitemap needs this at build time
	// to emit absolute <loc> entries. Keep in sync with public/robots.txt.
	site: 'https://hookd-blog.sklocheva.workers.dev',
	integrations: [mdx(), sitemap()],
});
