// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	// Absolute URL of the deployed site. @astrojs/sitemap needs this at build time
	// to emit absolute <loc> entries. Keep in sync with public/robots.txt.
	site: 'https://hookd-blog.sklocheva.workers.dev',

	// Static output, stated explicitly. The host's build system must not turn this
	// into a server build: there is no server process, so any runtime route 404s.
	output: 'static',

	image: {
		// Optimize images at build time into static files. Without this pinned, a
		// server-mode build emits /_image?href=... URLs, which 404 on a static host
		// and leave every image on the site broken.
		service: { entrypoint: 'astro/assets/services/sharp' },
	},

	integrations: [sitemap()],
});
