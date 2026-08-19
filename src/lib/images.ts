import type { ImageMetadata } from 'astro';

/**
 * Resolve an image path stored in frontmatter to a real asset that <Image> can optimize.
 *
 * Why this exists: Astro's `image()` schema helper wants a path relative to the entry
 * file (`../../assets/x.webp`), but Sveltia CMS rejects a relative `public_folder` —
 * it requires an absolute path starting with "/". Those two requirements cannot both
 * be satisfied by the stored string, so entries store `/src/assets/x.webp` and this
 * maps it back to the imported asset.
 *
 * import.meta.glob with eager:true is resolved at build, so nothing here reaches the
 * browser and the images are still processed by Astro's pipeline.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>(
	'/src/assets/**/*.{jpeg,jpg,png,gif,webp,avif}',
	{ eager: true }
);

/**
 * Missing images fail the build rather than rendering a broken page. That matches how
 * the SEO fields behave: the error arrives while you can still fix it, not after a
 * deploy has silently shipped a hole where a photo should be.
 */
export function resolveImage(path: string | undefined): ImageMetadata | undefined {
	if (!path) return undefined;

	const key = path.startsWith('/') ? path : `/${path}`;
	const mod = assets[key];

	if (!mod) {
		const known = Object.keys(assets);
		throw new Error(
			`Image not found: "${path}".\n` +
				`Entries store the path the CMS writes, e.g. /src/assets/photo.webp.\n` +
				(known.length
					? `Available: ${known.join(', ')}`
					: `There are currently no files in src/assets/.`)
		);
	}

	return mod.default;
}
