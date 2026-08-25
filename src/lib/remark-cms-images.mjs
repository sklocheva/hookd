import { visit } from 'unist-util-visit';
import { relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));

/**
 * Rewrite CMS image paths in markdown bodies so Astro optimizes them.
 *
 * Sveltia writes `![alt](/src/assets/photo.webp)` because its `public_folder` must be
 * an absolute path. Astro only runs *relative* markdown image paths through its asset
 * pipeline — an absolute one is treated as a public URL and passed through untouched,
 * so it 404s and the image silently does not appear.
 *
 * src/lib/images.ts solves the same mismatch for `heroImage` in frontmatter. This is
 * the other half: the body. Both exist because Sveltia and Astro disagree about what a
 * path means, and the author should not have to know that.
 *
 * Rewriting to a path relative to the entry file is what lets Astro resolve it, and it
 * gets the same processing as any hand-written relative image.
 */
export function remarkCmsImages() {
	return (tree, file) => {
		visit(tree, 'image', (node) => {
			if (!node.url?.startsWith('/src/assets/')) return;

			const target = fileURLToPath(new URL(`.${node.url.slice('/src'.length)}`, `file://${ASSETS}../`));
			const from = dirname(file.path ?? file.history?.[0] ?? '');
			let rel = relative(from, target).split('\\').join('/');
			if (!rel.startsWith('.')) rel = `./${rel}`;
			node.url = rel;
		});
	};
}
