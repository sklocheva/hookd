import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * SEO fields are required on both collections and the build MUST fail without them.
 * This is deliberate — it replaces an SEO plugin's nagging with a build error.
 */
const seoFields = {
	metaDescription: z.string().max(160, 'metaDescription must be 160 characters or fewer'),
	/** Alt text for the hero image. Required even when the image itself is not yet shot. */
	heroImageAlt: z.string().min(1, 'heroImageAlt is required'),
	/** Social share image, as a root-relative path under public/. */
	socialImage: z.string().min(1, 'socialImage is required'),
};

/** Gauge is measured twice and the two numbers genuinely differ. Never collapse them. */
const gauge = z.object({
	stitches: z.number(),
	rows: z.number(),
	/** Measured over this square, in cm. Almost always 10. */
	overCm: z.number().default(10),
	stitchPattern: z.string(),
	blocked: z.boolean(),
	/** How and where it was measured — shown as the muted second line. */
	note: z.string().optional(),
});

const yarn = z.object({
	brand: z.string(),
	line: z.string(),
	fibreContent: z.string(),
	ballWeightG: z.number(),
	ballLengthM: z.number(),
	/** Craft Yarn Council weight category, 0–7. */
	cycWeight: z.number().int().min(0).max(7),
	cycWeightName: z.string(),
	colourName: z.string().optional(),
	/** Colour-blocked work uses several yarns, so each needs a role. */
	role: z.string().default('main'),
});

const size = z.object({
	name: z.string(),
	finishedBustCm: z.number().optional(),
	finishedLengthCm: z.number().optional(),
	yardageM: z.number(),
});

const patterns = defineCollection({
	loader: glob({ base: './src/content/patterns', pattern: '**/*.{md,mdx}' }),
	// heroImage is the path the CMS writes, e.g. "/src/assets/photo.webp". Astro's
	// image() helper is not used here because it needs a path relative to the entry
	// file, while Sveltia requires an absolute public_folder — src/lib/images.ts
	// bridges the two and still runs the file through Astro's image pipeline.
	schema:
		z.object({
			title: z.string(),
			date: z.coerce.date(),
			summary: z.string(),
			/** Optional: absent triggers the designed "photography still to come" state. */
			heroImage: z.string().optional(),
			/** Shown on the no-photo card, e.g. "Shoot booked · September". */
			heroImagePending: z.string().optional(),

			yarns: z.array(yarn).min(1),

			hookMm: z.number(),
			hookUs: z.string(),
			/** Bands and cuffs often use a smaller hook. */
			secondHookMm: z.number().optional(),
			secondHookUs: z.string().optional(),
			secondHookFor: z.string().optional(),

			swatchGauge: gauge,
			pieceGauge: gauge,

			difficulty: z.enum(['Basic', 'Easy', 'Intermediate', 'Complex']),
			sizes: z.array(size).min(1),
			/** e.g. "worn with 10–15 cm ease" */
			ease: z.string().optional(),
			terms: z.enum(['US', 'UK']).default('US'),

			category: z.enum(['Garments', 'Accessories', 'Home']),
			tags: z.array(z.string()).default([]),

			ravelryUrl: z.string().url().optional(),
			pdfUrl: z.string().url().optional(),

			/** Patterns cite the test behind their yarn advice. Load-bearing cross-link. */
			relatedPost: reference('posts').optional(),

			...seoFields,
		}),
});

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema:
		z.object({
			title: z.string(),
			date: z.coerce.date(),
			updated: z.coerce.date().optional(),
			summary: z.string(),
			heroImage: z.string().optional(),
			/** Drives the eyebrow and the journal filters. */
			kind: z.enum(['Yarn test', 'Stitch test', 'Fibre note']),
			/** The muted line under the excerpt, e.g. "6 yarns · 32 sts × 24 rows hdc". */
			method: z.string().optional(),
			tags: z.array(z.string()).default([]),
			...seoFields,
		}),
});

export const collections = { patterns, posts };
