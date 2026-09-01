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

/**
 * The number counterpart of `optionalString`.
 *
 * Sveltia writes `null` — not an empty string, not a missing key — for a number field the
 * author left blank, and `z.number().optional()` rejects null. Sophia's first real review
 * failed the build on exactly this, in two fields she had never touched.
 */
const optionalNumber = z.preprocess(
	(v) => (v === '' || v === null ? undefined : v),
	z.number().optional()
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

/**
 * Extra photographs, shown as a swap gallery on the entry page.
 *
 * Additional to `heroImage`, never a replacement — the hero stays what cards and shares
 * use. Alt text is required per image for the same reason it is on the hero: it is the
 * only description a blind reader gets, and it never gets added retrospectively.
 */
const galleryField = z
	.array(
		z.object({
			image: z.string(),
			alt: z.string().min(1, { error: 'every gallery image needs alt text' }),
			/**
			 * The line under the thumbnails, which changes with the selected shot. It carries
			 * information the photo cannot — "Size M, worn with 12 cm ease" — so it is not a
			 * second copy of the alt text, which describes what is visible.
			 */
			caption: z.string().optional(),
		})
	)
	.default([]);

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
			/**
			 * When the pattern was last corrected. Patterns get errata in a way posts do not
			 * — a wrong stitch count matters years after publication — and this is what
			 * JSON-LD reports as dateModified. Absent means it has not been revised.
			 */
			updated: optionalDate,
			summary: z.string(),
			/** Optional: absent triggers the designed "photography still to come" state. */
			heroImage: optionalString,
			/** Shown on the no-photo card, e.g. "Shoot booked · September". */
			heroImagePending: optionalString,
			/** Caption for the hero, which is the gallery's first frame. See `caption` above. */
			heroImageCaption: optionalString,

			/**
			 * Extra photographs, shown as a swap gallery below the instructions.
			 *
			 * Additional to `heroImage`, never a replacement — the hero stays required and
			 * is what cards and shares use. Alt text is required per image for the same
			 * reason it is on the hero: it is the only description a blind reader gets, and
			 * it never gets added retrospectively.
			 */
			gallery: galleryField,

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
				.array(z.enum(['clothing', 'accessories', 'pets', 'home']))
				.min(1, {
					error: 'category needs at least one of: clothing, accessories, pets, home',
				}),
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
			gallery: galleryField,
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

/**
 * One five-bar judgement plus the sentence that explains it.
 *
 * The bar is comparable across reviews; the sentence is what actually helps. Neither is
 * useful alone — a score with no reason is an opinion with a number stuck on it.
 */
const rated = z.object({
	score: z.number().int().min(1).max(5),
	note: z.string().min(1),
});

const reviews = defineCollection({
	loader: glob({ base: './src/content/reviews', pattern: '**/*.{md,mdx}' }),
	schema: z
		.object({
			title: z.string().min(1),
			date: z.coerce.date(),
			updated: optionalDate,
			draft: z.boolean().default(false),

			/**
			 * One or two sentences giving the answer, set in italic serif under the title. It
			 * replaces a verdict section: someone who reads only this should know whether to
			 * buy the yarn.
			 */
			standfirst: optionalString,

			/**
			 * Both photographs are optional, and a review with neither is a finished page, not
			 * a broken one — early reviews publish before anything is shot. Nothing is
			 * substituted in their place: no placeholder art, no empty frame.
			 */
			heroImage: optionalString,
			heroImageCaption: optionalString,
			swatchImage: optionalString,
			swatchImageAlt: optionalString,
			swatchImageCaption: optionalString,

			/**
			 * Ball-band and shop facts. Everything here is transcribed, not judged.
			 *
			 * Every field is optional so a half-filled draft can be saved. A row whose value
			 * is missing is simply not rendered, which is the same rule the design already
			 * uses for measurements that were never taken.
			 */
			yarn: z
				.object({
					brand: optionalString,
					line: optionalString,
					content: optionalString,
					/**
					 * The weight exactly as the band prints it — "Worsted", "DK / 8 ply".
					 *
					 * The CYC number used to be here and is gone. Bands disagree with the CYC
					 * scale and with each other, so recording a category number meant deciding
					 * which of them was right; quoting the label states what the label says.
					 */
					weightLabel: optionalString,
					/**
					 * Wraps per inch — the thickness measured rather than claimed.
					 *
					 * This is the objective counterpart to the label's word, and the reason it
					 * earns a row: the same yarn is sold as DK by one shop and worsted by
					 * another, and WPI settles it without arguing with either.
					 */
					wpi: optionalNumber,
					ballWeightG: optionalNumber,
					ballLengthM: optionalNumber,
					/** As printed on the band. */
					ballBandGauge: optionalString,
					hookMm: optionalNumber,
					hookNote: optionalString,
					/** Measured, not calculated: what one 10 × 10 cm square actually ate. */
					gramsPer10cm: optionalNumber,
					metresPer10cm: optionalNumber,

					/**
					 * How the strand is built. The type is a short fixed list so two reviews can
					 * be compared on it; the note carries what you actually see when you untwist
					 * a length, which no category can express.
					 */
					construction: z
						.object({
							type: z.enum(['Singles', 'Plied', 'Cabled', 'Chainette', 'Roving']),
							note: optionalString,
						})
						.optional(),

					care: optionalString,
					/** Where it was spun and milled. */
					madeIn: optionalString,
					/** Where the fibre itself came from, which is often not where it was spun. */
					fibreOrigin: optionalString,

					/**
					 * OEKO-TEX STANDARD 100 product class, 1–4, read from the band.
					 *
					 * 1 = babies and children to 3 · 2 = direct skin contact · 3 = no direct skin
					 * contact · 4 = decoration. It certifies the finished article was tested for
					 * harmful substances. It is **not** an organic or environmental label, and is
					 * routinely read as one — so the page says what it means rather than just
					 * showing a badge.
					 */
					oekoTexClass: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.number().int().min(1).max(4).optional()),
					/** Certificate number or institute, if the band prints one. */
					oekoTexNote: optionalString,

					/**
					 * Animal fibres only, and only what the band or maker actually states.
					 * "Not stated" is the honest and most common answer — most labels are silent,
					 * and silence is not the same as a claim either way.
					 */
					mulesing: z.enum(['Mulesing-free', 'Not stated']).optional(),
				})
				.default({}),

			/**
			 * Where the yarn sits in the market, 1–5, never a currency figure. Prices change and
			 * vary by country; the position does not, and a number would be wrong within a year.
			 */
			price: z
				.object({
					level: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.number().int().min(1).max(5).optional()),
					note: optionalString,
				})
				.default({}),

			/** Only ever unblocked vs blocked — the whole point is the comparison. */
			gauge: z
				.object({
					unblocked: optionalString,
					blocked: optionalString,
					method: optionalString,
					note: optionalString,
				})
				.default({}),

			/**
			 * The same six judgements on every review, so two reviews can be read against each
			 * other. Fixed keys rather than a free list precisely so the set cannot drift.
			 */
			inTheHand: z
				.object({
					stitchDefinition: rated,
					/**
					 * Named so that more bars are always better. "Splitting" scored the
					 * opposite way round from its neighbours, so five bars meant "excellent"
					 * on one row and "awful" on the next, with only the sentence to tell them
					 * apart.
					 */
					splitResistance: rated,
					/** How it feels in the hand. */
					softness: rated,
					/**
					 * Whether it prickles, which is a different question from softness — the
					 * itch comes from the small proportion of coarse fibre ends, not from
					 * average fineness, so a yarn can feel soft to squeeze and still scratch.
					 */
					nextToSkin: rated,
					drape: rated,
					frogging: rated,
				})
				.partial()
				.default({}),
			inTheHandBasis: optionalString,

			metaDescription: z
				.string()
				.max(160, 'metaDescription must be 160 characters or fewer')
				.optional(),
			heroImageAlt: optionalString,
			socialImage: optionalString,
		})
		/**
		 * Required only at publish.
		 *
		 * A draft has to be saveable with whatever exists so far — half a ball band and
		 * nothing else. The build gate is about what reaches a reader, so it applies when
		 * `draft` is unticked, not while the work is in progress.
		 */
		.superRefine((d, ctx) => {
			if (d.draft) return;

			const miss = (path: (string | number)[], message: string) =>
				ctx.addIssue({ code: 'custom', path, message });

			if (!d.standfirst) miss(['standfirst'], 'standfirst is required to publish');
			if (!d.metaDescription) miss(['metaDescription'], 'metaDescription is required to publish');
			if (!d.heroImageAlt) miss(['heroImageAlt'], 'heroImageAlt is required to publish');

			if (!d.socialImage) {
				miss(['socialImage'], 'socialImage is required to publish — use /og-default.png');
			} else if (!existsSync(fileURLToPath(new URL(`../public${d.socialImage}`, import.meta.url)))) {
				miss(['socialImage'], `socialImage "${d.socialImage}" does not exist in public/`);
			}

			for (const [key, label] of [
				['brand', 'brand'],
				['line', 'line'],
				['content', 'fibre content'],
				['ballWeightG', 'ball weight'],
				['ballLengthM', 'ball length'],
				['hookMm', 'the hook you used'],
				['care', 'care'],
			] as const) {
				if (d.yarn[key] == null || d.yarn[key] === '') {
					miss(['yarn', key], `yarn ${label} is required to publish`);
				}
			}

			if (d.price.level == null) miss(['price', 'level'], 'a price level is required to publish');
			if (!d.gauge.blocked) miss(['gauge', 'blocked'], 'a blocked gauge is required to publish');

			// The six are the comparison. A review missing one cannot be read against another.
			for (const key of [
				'stitchDefinition',
				'splitResistance',
				'softness',
				'nextToSkin',
				'drape',
				'frogging',
			] as const) {
				if (!d.inTheHand[key]) {
					miss(['inTheHand', key], `"${key}" is required to publish — all six, or none compare`);
				}
			}
		}),
});

export const collections = { patterns, posts, reviews };
