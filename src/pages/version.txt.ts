import type { APIRoute } from 'astro';

/**
 * The commit this build was made from, as plain text at /version.txt.
 *
 * This is what makes "did my push deploy?" answerable. Every other marker has to be chosen
 * per change — a heading, a class, a line of copy — and this project has picked markers
 * that could not tell it anything four times over (see the verify-deploy skill's
 * failures.md): some were already live, some were never emitted, and a config-only change
 * altered nothing in the HTML at all. This changes on every commit by construction, so the
 * deploy check can simply wait for the pushed SHA to appear here.
 *
 * Cloudflare's build sets WORKERS_CI_COMMIT_SHA. Anywhere else — a local build, the GitHub
 * CI build — it is absent and this says so, rather than printing a SHA that is not what
 * is being served. The repository is public, so the SHA reveals nothing new.
 */
export const GET: APIRoute = () =>
	new Response(`${process.env.WORKERS_CI_COMMIT_SHA ?? 'local build'}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
