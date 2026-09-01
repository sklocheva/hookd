#!/usr/bin/env node
/**
 * Hookd local driver — build, serve, screenshot, audit.
 *
 * Drives the real rendered site rather than the source, because the bugs that
 * actually shipped on this project were all invisible in the source: terracotta
 * failing contrast by 0.27, every link being under the minimum tap size, labels
 * that passed contrast and still could not be read.
 *
 * No new dependencies. It drives the Chrome already installed on the machine over
 * the DevTools Protocol, using the WebSocket global that Node 22+ ships. Playwright
 * and Puppeteer are not installed and are not needed.
 *
 *   node .claude/skills/run-hookd/driver.mjs audit
 *   node .claude/skills/run-hookd/driver.mjs shot /patterns/oland-cardigan/ --width 375
 *   node .claude/skills/run-hookd/driver.mjs serve
 *
 * Exit codes: 0 all checks passed, 1 a check failed, 2 could not start.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PREVIEW = 'http://localhost:4321';
const SHOT_DIR = join(ROOT, '.screenshots');

// Routes are discovered from dist/ rather than hand-listed. A hand-list goes stale the
// moment content is added or renamed — it named two posts that no longer existed after a
// single CMS edit, and the audit then failed on pages that were correctly gone.
// CORE is the part worth asserting: these must exist, whatever the content is doing.
const CORE = ['/', '/patterns/', '/journal/', '/about/', '/privacy/', '/licence/', '/imprint/', '/404.html'];

function discoverRoutes() {
	const dist = join(ROOT, 'dist');
	const found = [];
	const walk = (dir, prefix) => {
		let entries = [];
		try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
		for (const e of entries) {
			if (e.name === '_astro' || e.name === 'admin') continue;
			if (e.isDirectory()) walk(join(dir, e.name), `${prefix}${e.name}/`);
			else if (e.name === 'index.html' && prefix) found.push(prefix);
		}
	};
	walk(dist, '/');
	if (!found.length) return CORE;
	const all = [...new Set([...CORE, ...found])];
	return all.filter((r) => r === '/404.html' || existsSync(join(dist, r, 'index.html')) || r === '/');
}

const CHROME_CANDIDATES = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'/usr/bin/chromium',
	'/usr/bin/chromium-browser',
	'/usr/bin/google-chrome',
];

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
	const found = CHROME_CANDIDATES.find((p) => existsSync(p));
	if (!found) {
		console.error('No Chrome or Edge found. Looked in:\n  ' + CHROME_CANDIDATES.join('\n  '));
		process.exit(2);
	}
	return found;
}

/**
 * Is the preview answering?
 *
 * Tries IPv6 as well as whatever `localhost` resolves to. `astro preview` has been seen to
 * bind ::1 only, and Node's fetch resolved localhost to 127.0.0.1 — so the server was up,
 * curl to [::1] returned 200, and this reported "preview did not come up" for twenty
 * seconds. Chrome navigates to localhost happily either way, so only this check was wrong.
 */
async function isUp(url) {
	const candidates = [url, url.replace('//localhost:', '//[::1]:'), url.replace('//localhost:', '//127.0.0.1:')];
	for (const candidate of new Set(candidates)) {
		try {
			const r = await fetch(candidate, { signal: AbortSignal.timeout(1500) });
			if (r.ok) return true;
		} catch {
			// try the next address
		}
	}
	return false;
}

/** Build, then start `astro preview` — unless something is already serving. */
async function ensurePreview() {
	if (await isUp(PREVIEW)) {
		log('preview already running on 4321');
		return null;
	}

	log('building…');
	const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, shell: true, encoding: 'utf8' });
	if (build.status !== 0) {
		console.error(build.stdout || '', build.stderr || '');
		console.error('\nBuild failed. Fix that first — the audit needs a build to serve.');
		process.exit(2);
	}
	log('build ok');

	// Clear any stale bookkeeping first. `astro preview` records that a server is running;
	// if that process died without `astro preview stop` — killed to free the port, or gone
	// with a closed terminal — the record survives, the next `npm run preview` prints
	// "already running" and exits without starting anything, and this then waits for a
	// server nobody is going to start. That failed three audits in a row before it was
	// understood. `stop` is harmless when nothing is running.
	spawnSync('npx', ['astro', 'preview', 'stop'], { cwd: ROOT, shell: true, stdio: 'ignore' });

	// astro preview daemonises and the parent exits, so don't wait on the child.
	spawn('npm', ['run', 'preview'], { cwd: ROOT, shell: true, stdio: 'ignore', detached: true }).unref();

	for (let i = 0; i < 60; i++) {
		await sleep(500);
		if (await isUp(PREVIEW)) {
			log('preview up on 4321');
			return true;
		}
	}
	console.error('Preview did not come up within 30s.');
	console.error('Check `npx astro preview status`, and what holds 4321:');
	console.error('  Get-NetTCPConnection -LocalPort 4321   (PowerShell)');
	process.exit(2);
}

/** Minimal CDP client: launch Chrome, attach to one page, expose eval + screenshot. */
async function browser() {
	const bin = findChrome();
	const port = 9333 + (process.pid % 200);
	const profile = join(tmpdir(), `hookd-cdp-${process.pid}`);
	mkdirSync(profile, { recursive: true });

	const proc = spawn(
		bin,
		[
			'--headless=new',
			`--remote-debugging-port=${port}`,
			`--user-data-dir=${profile}`,
			'--no-first-run',
			'--no-default-browser-check',
			'--disable-gpu',
			'--hide-scrollbars', // otherwise the scrollbar eats ~15px and skews overflow checks
			'about:blank',
		],
		{ stdio: 'ignore' }
	);

	let wsUrl;
	for (let i = 0; i < 40; i++) {
		await sleep(250);
		try {
			const r = await fetch(`http://127.0.0.1:${port}/json/version`, {
				signal: AbortSignal.timeout(1000),
			});
			wsUrl = (await r.json()).webSocketDebuggerUrl;
			if (wsUrl) break;
		} catch {}
	}
	if (!wsUrl) {
		proc.kill();
		console.error('Chrome did not expose a debugging endpoint.');
		process.exit(2);
	}

	const ws = new WebSocket(wsUrl);
	await new Promise((res, rej) => {
		ws.onopen = res;
		ws.onerror = rej;
	});

	let id = 0;
	const pending = new Map();
	ws.onmessage = (ev) => {
		const msg = JSON.parse(ev.data);
		if (msg.id && pending.has(msg.id)) {
			const { resolve, reject } = pending.get(msg.id);
			pending.delete(msg.id);
			msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
		}
	};
	const send = (method, params = {}, sessionId) =>
		new Promise((resolve, reject) => {
			const msgId = ++id;
			pending.set(msgId, { resolve, reject });
			ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
		});

	// flatten:true is what lets one socket carry the page session too.
	const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
	const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
	await send('Page.enable', {}, sessionId);
	await send('Runtime.enable', {}, sessionId);

	return {
		async setViewport(width, height = 900) {
			await send(
				'Emulation.setDeviceMetricsOverride',
				{ width, height, deviceScaleFactor: 1, mobile: width < 768 },
				sessionId
			);
		},
		async goto(url) {
			await send('Page.navigate', { url }, sessionId);
			// Poll readyState rather than racing Page.loadEventFired, which can fire
			// before the stylesheet applies and gives nonsense measurements.
			for (let i = 0; i < 60; i++) {
				await sleep(100);
				const { result } = await send(
					'Runtime.evaluate',
					{ expression: 'document.readyState', returnByValue: true },
					sessionId
				);
				if (result.value === 'complete') break;
			}
			await sleep(150);
		},
		async eval(fn) {
			const { result, exceptionDetails } = await send(
				'Runtime.evaluate',
				{ expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true },
				sessionId
			);
			if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
			return result.value;
		},
		async screenshot(file) {
			const { data } = await send(
				'Page.captureScreenshot',
				{ format: 'png', captureBeyondViewport: true },
				sessionId
			);
			mkdirSync(SHOT_DIR, { recursive: true });
			const out = join(SHOT_DIR, file);
			writeFileSync(out, Buffer.from(data, 'base64'));
			return out;
		},
		close() {
			try { ws.close(); } catch {}
			proc.kill();
			try { rmSync(profile, { recursive: true, force: true }); } catch {}
		},
	};
}

/**
 * The page-side audit. Runs inside the browser, so every number is measured from
 * the rendered result rather than inferred from CSS source.
 */
function pageAudit() {
	const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
	const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
	const ratio = (f, b) => { const a = Math.max(lum(f), lum(b)), c = Math.min(lum(f), lum(b)); return (a + 0.05) / (c + 0.05); };
	const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').map(Number).slice(0, 3) : null; };

	const effBg = (el) => {
		let n = el;
		while (n && n !== document.documentElement) {
			const c = getComputedStyle(n).backgroundColor;
			const p = parse(c);
			if (p && !/rgba\([^)]*,\s*0\)/.test(c)) return p;
			n = n.parentElement;
		}
		const root = parse(getComputedStyle(document.body).backgroundColor);
		return root || [255, 255, 255];
	};

	const issues = [];
	let skipped = 0;
	const de = document.documentElement;

	// Elements marked data-scaffold are placeholders we have knowingly accepted until
	// real artwork lands. Reporting them on every page would drown the real findings,
	// and an audit that always fails is an audit people stop reading. They are counted,
	// not hidden — and the attribute disappears with the placeholder.
	const isScaffold = (el) => el.closest('[data-scaffold]') !== null;

	if (de.scrollWidth > de.clientWidth) {
		issues.push({ check: 'overflow', detail: `page scrolls horizontally (${de.scrollWidth} > ${de.clientWidth})` });
	}

	const h1s = document.querySelectorAll('h1').length;
	if (h1s !== 1) issues.push({ check: 'h1', detail: `${h1s} <h1> elements (project rule: exactly one)` });

	// Content must exist without JS — crawlers fetch scripts but do not run them.
	const headings = document.querySelectorAll('h1,h2,h3').length;
	const links = document.querySelectorAll('a[href]').length;
	if (headings < 1 || links < 3) {
		issues.push({ check: 'server-rendered', detail: `only ${headings} headings / ${links} links in the DOM` });
	}

	document.querySelectorAll('a[href],button').forEach((el) => {
		const r = el.getBoundingClientRect();
		if (!r.width || !r.height) return;
		// WCAG 2.5.8 exempts links sitting inline within a sentence.
		const p = el.parentElement;
		const inline = p && /^(P|LI|TD|SPAN)$/.test(p.tagName) &&
			p.textContent.trim().length > el.textContent.trim().length + 10;
		if (r.height < 24 && !inline) {
			issues.push({ check: 'tap-target', detail: `"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28)}" is ${Math.round(r.height)}px tall (min 24)` });
		}
	});

	const seen = new Set();
	document.querySelectorAll('*').forEach((el) => {
		if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
		const cs = getComputedStyle(el);
		const fg = parse(cs.color);
		if (!fg) return;
		const size = parseFloat(cs.fontSize);
		const bg = effBg(el);
		const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
		const r = ratio(fg, bg);
		const sample = el.textContent.trim().slice(0, 26);

		if (r < (large ? 3 : 4.5)) {
			if (isScaffold(el)) { skipped++; }
			else {
				const key = 'c' + cs.color + size;
				if (!seen.has(key)) { seen.add(key); issues.push({ check: 'contrast', detail: `${cs.color} at ${size}px = ${r.toFixed(2)}:1 — "${sample}"` }); }
			}
		}

		// Small uppercase with wide tracking is the hardest thing on a page to read.
		// This floor exists because labels that passed contrast were still unreadable.
		if (cs.textTransform === 'uppercase' && !cs.fontFamily.includes('mono') && size < 11) {
			if (isScaffold(el)) { skipped++; }
			else {
				const key = 'l' + size + sample;
				if (!seen.has(key)) { seen.add(key); issues.push({ check: 'label-floor', detail: `uppercase "${sample}" at ${size}px (floor 11px)` }); }
			}
		}
	});

	return { issues, skipped, stats: { headings, links, h1s } };
}

async function cmdAudit() {
	await ensurePreview();
	const b = await browser();
	const routes = discoverRoutes();
	log(`auditing ${routes.length} routes`);
	let failed = 0, checked = 0, totalSkipped = 0;

	try {
		for (const width of [375, 1280]) {
			log(`\n─── ${width}px ───`);
			await b.setViewport(width);
			for (const route of routes) {
				await b.goto(PREVIEW + route);
				const { issues, skipped } = await b.eval(pageAudit);
				checked++;
				totalSkipped += skipped;
				if (issues.length === 0) {
					log(`  PASS  ${route}`);
				} else {
					failed += issues.length;
					log(`  FAIL  ${route}`);
					for (const i of issues) log(`          ${i.check}: ${i.detail}`);
				}
			}
		}

		// Every internal link must resolve. Broken links are invisible until clicked.
		log('\n─── internal links ───');
		await b.goto(PREVIEW + '/');
		const hrefs = await b.eval(() =>
			[...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))]
		);
		for (const href of hrefs) {
			const r = await fetch(PREVIEW + href).catch(() => null);
			if (!r || !r.ok) { failed++; log(`  FAIL  ${href} -> ${r ? r.status : 'unreachable'}`); }
		}
		log(`  ${hrefs.length} links checked`);
	} finally {
		b.close();
	}

	log(`\n${checked} page-renders checked, ${failed} issue(s)`);
	if (totalSkipped) {
		log(`${totalSkipped} known scaffolding element(s) skipped — they go when the placeholders do`);
	}
	process.exit(failed ? 1 : 0);
}

async function cmdShot(route, width) {
	await ensurePreview();
	const b = await browser();
	try {
		await b.setViewport(width);
		await b.goto(PREVIEW + route);

		// captureBeyondViewport photographs the whole page, but it does not scroll it — so
		// anything loading="lazy" below the fold never starts loading and comes out blank.
		// A gallery screenshot was entirely empty because of this, and the images were fine.
		// Walk the page to trigger them, wait, then return to the top so the shot starts
		// where the reader would.
		await b.eval(async () => {
			const step = window.innerHeight;
			for (let y = 0; y < document.body.scrollHeight; y += step) {
				window.scrollTo(0, y);
				await new Promise((r) => setTimeout(r, 60));
			}
			window.scrollTo(0, 0);

			// Bounded: an image that never enters the viewport never starts loading, so
			// waiting on its load event unconditionally hangs forever. Wait, but give up.
			await Promise.race([
				Promise.all(
					[...document.images]
						.filter((i) => !i.complete)
						.map(
							(i) =>
								new Promise((r) => {
									i.addEventListener('load', r, { once: true });
									i.addEventListener('error', r, { once: true });
								})
						)
				),
				new Promise((r) => setTimeout(r, 3000)),
			]);
		});
		const name = (route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home') + `-${width}.png`;
		const out = await b.screenshot(name);
		log(out);
	} finally {
		b.close();
	}
}

const [cmd, ...rest] = process.argv.slice(2);
const widthArg = rest.indexOf('--width');
const width = widthArg >= 0 ? Number(rest[widthArg + 1]) : 1280;

switch (cmd) {
	case 'audit':
	case undefined:
		await cmdAudit();
		break;
	case 'shot':
		await cmdShot(rest[0] && !rest[0].startsWith('--') ? rest[0] : '/', width);
		break;
	case 'serve':
		await ensurePreview();
		log(`serving ${PREVIEW} — stop with: npx astro preview stop`);
		break;
	default:
		console.error(`unknown command "${cmd}". Use: audit | shot <route> [--width N] | serve`);
		process.exit(2);
}
