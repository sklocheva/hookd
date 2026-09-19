#!/usr/bin/env node
/**
 * Every link that leaves the site still resolves.
 *
 * Internal links are the audit's job and run on every commit. External ones rot on their
 * own schedule — a page moves, a shop closes — with no commit here to catch it, so this
 * runs weekly (.github/workflows/weekly.yml) against the built site.
 *
 * Checks what a reader or the page actually fetches: <a href>, stylesheets, scripts and
 * images. Not `preconnect` or `dns-prefetch` hints: fonts.gstatic.com is an origin to warm
 * up, not a page, and fetching its root 404s every time.
 *
 * **Fails only on link rot** — 404, 410, or a host that does not resolve at all. Plenty of
 * sites answer a script with 403 (bot blocking), 429 (rate limit) or a passing 5xx, and a
 * weekly email about any of those would teach you to ignore the email. Those are printed as
 * warnings instead. A connection failure is retried once before it counts.
 *
 * Run after a build: node scripts/check-external-links.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

// The site's own host, from astro.config.mjs, so a domain change needs no edit here.
const config = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
const OWN_HOST = new URL(config.match(/site:\s*'([^']+)'/)[1]).host;

const DEAD = new Set([404, 410]);

function* htmlFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* htmlFiles(p);
		else if (e.name.endsWith('.html')) yield p;
	}
}

/** url -> the pages it appears on */
const found = new Map();
const note = (url, page) => {
	if (!found.has(url)) found.set(url, new Set());
	found.get(url).add(page);
};

for (const file of htmlFiles(DIST)) {
	const page = '/' + file.slice(DIST.length + 1).replaceAll('\\', '/').replace(/index\.html$/, '');
	const html = readFileSync(file, 'utf8');

	for (const [tag] of html.matchAll(/<(a|link|script|img|source)\b[^>]*>/gi)) {
		if (/^<link\b/i.test(tag) && /\brel="[^"]*\b(preconnect|dns-prefetch)\b/i.test(tag)) continue;
		for (const [, url] of tag.matchAll(/\b(?:href|src)="(https?:\/\/[^"]+)"/gi)) {
			const decoded = url.replaceAll('&amp;', '&');
			let host;
			try {
				host = new URL(decoded).host;
			} catch {
				continue;
			}
			if (host !== OWN_HOST) note(decoded, page);
		}
	}
}

async function probe(url) {
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			// GET, not HEAD: a surprising number of servers answer HEAD with 405 or 404.
			const r = await fetch(url, {
				redirect: 'follow',
				signal: AbortSignal.timeout(20_000),
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; hookd-link-check; +https://github.com/sklocheva/hookd)',
					Accept: 'text/html,text/css,*/*;q=0.8',
				},
			});
			r.body?.cancel();
			return { status: r.status };
		} catch (e) {
			if (attempt === 2) return { error: e.cause?.code ?? e.name ?? String(e) };
			await new Promise((res) => setTimeout(res, 3000));
		}
	}
}

const dead = [];
const warn = [];

for (const [url, pages] of found) {
	const r = await probe(url);
	const where = [...pages].slice(0, 3).join(', ') + (pages.size > 3 ? ` +${pages.size - 3} more` : '');
	if (r.error) dead.push(`${url}\n      unreachable (${r.error}) — on ${where}`);
	else if (DEAD.has(r.status)) dead.push(`${url}\n      ${r.status} — on ${where}`);
	else if (r.status >= 400) warn.push(`${url} — ${r.status}, not treated as rot`);
	else console.log(`  ok  ${r.status}  ${url}`);
}

for (const w of warn) console.log(`  ?   ${w}`);

console.log(`\n${found.size} external link(s) checked, ${dead.length} dead, ${warn.length} warning(s)`);

if (dead.length) {
	console.log('\nDEAD:');
	for (const d of dead) console.log(`  - ${d}`);
	process.exit(1);
}
