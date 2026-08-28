import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * SEO fields are required on both collections and the build MUST fail without them.
 * This is deliberate — it replaces an SEO plugin's nagging with a build error.
 */
const seoFields = {
	metaDescription: z.string().max(160, 'metaDescription must be 160 characters or fewer'),
	/** Alt text for the hero image. Required even when the image itself is not yet shot. */
	heroImageAlt: z.string().min(1, 'heroImageAlt is required'),
	/**
	 * Social share image, as a root-relative path under public/.
	 *
	 * Required *and* checked to exist. It was required but unvalidated before, so three
	 * entries happily pointed at files that were never created — the tag rendered, the
	 * image 404'd, and every share and pin came out blank. A required field that is
	 * never verified is not a guarantee.
	 *
	 * Use /og-default.png until the entry has its own artwork.
	 */
	socialImage: z
		.string()
		.min(1, 'socialImage is required')
		.refine((p) => existsSync(fileURLToPath(new URL(`../public${p}`, import.meta.url))), {
			// Zod 4 takes the message as `error`, not a second function. Passing a function
			// here is the Zod 3 signature: it type-checks as a params object, silently
			// discards the text, and the author gets "Invalid input" instead.
			error: (issue) =>
				`socialImage "${issue.input}" does not exist in public/. Use /og-default.png until this entry has its own artwork.`,
		}),
};

/**
 * The CMS writes an empty string for an optional field the author never touched, and
 * `z.coerce.date()` rejects `''` outright — a post saved with no "updated" date failed
 * the build even though the field is optional. These normalise empty to undefined so
 * the schema accepts what the panel actually produces.
 */
const optionalDate = z.preprocess(
	(v) => (v === '' || v === null ? undefined : v),
	z.coerce.date().optional()
);

const optionalString = z.preprocess(
	(v) => (v === '' || v === null ? undefined : v),
	z.string().optional()
);

/**
 * One gauge, measured on the actual piece after blocking.
 *
 * This used to be two fields — swatch and piece — on the grounds that they genuinely
 * differ. They do, but only one of them is a number this author ever measures, and a
 * field that gets filled in by copying the other one is worse than no field. What the
 * pair was really carrying is a warning, not data: a 10 cm square held flat behaves
 * nothing like a panel hanging off a shoulder. That belongs in `note` and in the
 * callout on the pattern page, where a maker will actually read it.
 */
const gauge = z.object({
	stitches: z.number(),
	rows: z.number(),
	/** Measured over this square, in cm. Almost always 10. */
	overCm: z.number().default(10),
	stitchPattern: z.string(),
	blocked: z.boolean(),
	/**
	 * How and where it was measured — shown as the muted second line.
	 *
	 * Load-bearing now that there is only one gauge: a maker cannot measure a piece
	 * they have not made yet, so this is what tells them how to swatch to match it.
	 */
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

/**
 * One finished measurement. The label is free text because different garments need
 * different measurements — bust and length for a sweater, circumference and depth for a
 * hat, nothing at all for a blanket. Fixed `finishedBustCm` / `finishedLengthCm` columns
 * forced every pattern through a sweater-shaped hole.
 *
 * Labels are matched across sizes to build the table's columns, so keep them identical
 * from one size to the next — "Finished bust" in every row, not "Bust" in one of them.
 */
const measurement = z.object({
	label: z.string(),
	value: z.number(),
	/** Defaults to cm. Only set this for the rare measurement that is not a length. */
	unit: z.string().default('cm'),
});

const size = z.object({
	name: z.string(),
	/** Empty is fine: an accessory that comes in one size has nothing to tabulate. */
	measurements: z.array(measurement).default([]),
	/**
	 * The body this size is cut for, e.g. "76–81". Free text because it is nearly always
	 * a range. Shown beside the finished measurements so a maker can see the ease rather
	 * than having to work it out.
	 */
	fitsBodyCm: optionalString,
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
			heroImage: optionalString,
			/** Shown on the no-photo card, e.g. "Shoot booked · September". */
			heroImagePending: optionalString,

			yarns: z.array(yarn).min(1),

			// US sizes are derived from the mm — see src/lib/hooks.ts. They vary between
			// manufacturers, and three common sizes have no US equivalent, so a second
			// input field only creates a chance to type something untrue.
			hookMm: z.number(),
			/** Bands and cuffs often use a smaller hook. */
			secondHookMm: z.number().optional(),
			secondHookFor: z.string().optional(),

			gauge: gauge,

			difficulty: z.enum(['Basic', 'Easy', 'Intermediate', 'Complex']),
			sizes: z.array(size).min(1),
			/** e.g. "worn with 10–15 cm ease" */
			ease: z.string().optional(),
			/**
			 * How to pick a size, in the author's words — which measurement to go by, and
			 * what to do when someone falls between two. Sits above the size table, because
			 * that is the point in the process where a maker has to decide.
			 */
			sizeNote: optionalString,
			/**
			 * Where to look up body measurements. Defaults to the Craft Yarn Council's chart,
			 * which is the industry reference and includes an ease table. Overridable so a
			 * pattern can point somewhere more specific.
			 */
			bodyChartUrl: z
				.string()
				.url()
				.default('https://www.craftyarncouncil.com/standards/body-sizing'),
			terms: z.enum(['US', 'UK']).default('US'),

			/**
			 * Several per pattern — a hooded scarf is both clothing and an accessory, and
			 * forcing one files it wrong either way. Stored as lowercase slugs; the labels
			 * a reader sees live in src/lib/taxonomy.ts.
			 */
			category: z
				.array(z.enum(['clothing', 'accessories', 'pets']))
				.min(1, { error: 'category needs at least one of: clothing, accessories, pets' }),
			tags: z.array(z.string()).default([]),

			ravelryUrl: z.string().url().optional(),
			pdfUrl: z.string().url().optional(),

			/** Patterns cite the test behind their yarn advice. Load-bearing cross-link. */
			relatedPost: reference('posts').optional(),

			/**
			 * Hand-picked "read this next" links, shown at the foot of the page.
			 *
			 * Explicit picks always win and appear in the order given. When fewer than
			 * three are set, the rest are filled by shared tags — see src/lib/related.ts.
			 * That way the section is never half-empty, and never needs maintaining.
			 */
			relatedPatterns: z.array(reference('patterns')).default([]),
			relatedPosts: z.array(reference('posts')).default([]),

			/**
			 * Example/scaffolding content. Draft entries still render and are still linked, so
			 * the site does not look empty, but they are kept out of the sitemap and the RSS
			 * feed and carry noindex — invented patterns must never reach Google or a
			 * subscriber's reader.
			 */
			draft: z.boolean().default(false),

			...seoFields,
		}),
});

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema:
		z.object({
			title: z.string(),
			date: z.coerce.date(),
			updated: optionalDate,
			summary: z.string(),
			heroImage: optionalString,
			/** Drives the eyebrow and the journal filters. */
			kind: z.enum(['Garment making', 'Yarn and fibres', 'How-tos']),
			/** The muted line under the excerpt, e.g. "6 yarns · 32 sts × 24 rows hdc". */
			method: optionalString,
			tags: z.array(z.string()).default([]),

			/**
			 * Hand-picked "read this next" links, shown at the foot of the page.
			 *
			 * Explicit picks always win and appear in the order given. When fewer than
			 * three are set, the rest are filled by shared tags — see src/lib/related.ts.
			 * That way the section is never half-empty, and never needs maintaining.
			 */
			relatedPatterns: z.array(reference('patterns')).default([]),
			relatedPosts: z.array(reference('posts')).default([]),
			/**
			 * Example/scaffolding content. Draft entries still render and are still linked, so
			 * the site does not look empty, but they are kept out of the sitemap and the RSS
			 * feed and carry noindex — invented patterns must never reach Google or a
			 * subscriber's reader.
			 */
			draft: z.boolean().default(false),

			...seoFields,
		}),
});

export const collections = { patterns, posts };
