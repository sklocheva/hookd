import { readFileSync } from 'node:fs';

/**
 * Make a brace typed into an article mean a brace.
 *
 * Patterns and posts are `.mdx`, and in MDX `{` opens a JavaScript expression. So an
 * author who types "Ch {neckCh}" into a pattern's Introduction — which the form's own
 * hint teaches her to write in the instruction rows — or "{sic}" into a post, has written
 * code. The build fails with "neckCh is not defined", names the page by its preview
 * address, and Cloudflare deploys nothing. A `<` in front of a figure ("<20 cm", "<3")
 * does the same, because MDX reads it as the start of a tag.
 *
 * /admin's editor is a plain text box to the person using it, and the site should treat
 * what she types there as text. This escapes those characters before MDX sees them, so
 * `{neckCh}` in prose renders as the eight characters it is.
 *
 * What is deliberately left alone, because there a brace is MDX and is meant:
 *
 * - **frontmatter** — YAML, never MDX. `{key}` in an instruction row is handled by
 *   src/lib/pattern-sizes.ts and must reach it untouched.
 * - **`import` and `export` lines** — how a hand-written entry pulls in a component.
 * - **any line that opens a component** (`<Row counts={{ XS: 62 }}>`, `<QuizCallout … />`).
 *   A capital letter after `<` is the test: HTML tags are lowercase, components are not.
 *   The whole opening tag has to sit on one line for this to hold — every one in the
 *   repo does. Spread across several, its attribute braces would be escaped and the
 *   build would fail on that line, loudly.
 * - **code**, fenced or inline — a backslash there is printed, not consumed.
 * - **anything already escaped** — `\{` stays `\{`.
 *
 * The file on disk is never changed; this only alters what the compiler is handed.
 *
 * @param {string} source The whole `.mdx` file, frontmatter included.
 * @returns {string}
 */
export function escapeProse(source) {
	const fm = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
	const head = fm ? fm[0] : '';
	const body = source.slice(head.length);

	let fence = null;
	const lines = body.split('\n').map((line) => {
		const mark = line.match(/^\s*(`{3,}|~{3,})/);
		if (mark) {
			// A fence closes on the same character it opened with.
			if (!fence) fence = mark[1][0];
			else if (mark[1][0] === fence) fence = null;
			return line;
		}
		if (fence) return line;
		if (/^(import|export)\s/.test(line)) return line;
		if (/<[A-Z]/.test(line)) return line;

		// Odd-numbered pieces are inline code spans; the text is everything between them.
		return line
			.split(/(`+[^`]*`+)/)
			.map((piece, i) =>
				i % 2
					? piece
					: piece.replace(/(?<!\\)[{}]/g, '\\$&').replace(/(?<!\\)<(?![A-Za-z/!])/g, '\\<')
			)
			.join('');
	});

	return head + lines.join('\n');
}

/**
 * The Vite plugin that applies it to every entry under src/content/.
 *
 * A `load` hook rather than a `transform`: the MDX plugin compiles in `transform`, and
 * load always runs before any transform, so this cannot end up behind it however the
 * plugins are ordered. Requests carrying a query are Astro's own and are left to it.
 */
export function mdxProse() {
	return {
		name: 'hookd:mdx-prose',
		enforce: /** @type {const} */ ('pre'),
		/** @param {string} id */
		load(id) {
			if (id.includes('?') || !id.endsWith('.mdx')) return null;
			if (!id.split('\\').join('/').includes('/src/content/')) return null;
			return escapeProse(readFileSync(id, 'utf8'));
		},
	};
}
