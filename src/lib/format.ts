import type { CollectionEntry } from 'astro:content';
import { hookLabel } from './hooks';

type Pattern = CollectionEntry<'patterns'>;
type Post = CollectionEntry<'posts'>;

export function formatDate(date: Date): string {
	return date.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

const M_PER_YD = 1.09361;

function range(values: number[]): [number, number] {
	return [Math.min(...values), Math.max(...values)];
}

/** e.g. "980–1640 m" — yardage across every size. */
export function yardageRange(p: Pattern['data']): string {
	const [lo, hi] = range(p.sizes.map((s) => s.yardageM));
	return lo === hi ? `${lo} m` : `${lo}–${hi} m`;
}

/** e.g. "980–1640 m / 1070–1795 yd" */
export function yardageRangeBoth(p: Pattern['data']): string {
	const [lo, hi] = range(p.sizes.map((s) => s.yardageM));
	const y = (m: number) => Math.round(m * M_PER_YD);
	return lo === hi
		? `${lo} m / ${y(lo)} yd`
		: `${lo}–${hi} m / ${y(lo)}–${y(hi)} yd`;
}

/** e.g. "XS–3X", or "One size". */
export function sizeRange(p: Pattern['data']): string {
	if (p.sizes.length === 1) return p.sizes[0].name;
	return `${p.sizes[0].name}–${p.sizes[p.sizes.length - 1].name}`;
}

/**
 * The headline measurement across every size, e.g. "81–152 cm".
 *
 * Measurement labels are free text now, so there is no fixed "bust" field to reach for.
 * The first label a pattern lists is the one it considers primary — bust for a sweater,
 * circumference for a hat — so that is the row summarised here.
 */
export function finishedMeasurements(p: Pattern['data']): string {
	const primary = p.sizes.find((s) => s.measurements.length)?.measurements[0]?.label;
	if (!primary) return '—';

	const values = p.sizes
		.map((s) => s.measurements.find((m) => m.label === primary))
		.filter((m): m is NonNullable<typeof m> => m != null);
	if (!values.length) return '—';

	const [lo, hi] = range(values.map((m) => m.value));
	const unit = values[0].unit;
	return lo === hi ? `${lo} ${unit}` : `${lo}–${hi} ${unit}`;
}

/** e.g. "4.5 mm · US 7", or just "7 mm" where no US size exists. */
export function hook(p: Pattern['data']): string {
	return hookLabel(p.hookMm);
}

/** The main yarn drives the card's Yarn row. */
export function mainYarn(p: Pattern['data']) {
	return p.yarns.find((y) => y.role === 'main') ?? p.yarns[0];
}

/** e.g. "16 sts × 11 rows = 10 × 10 cm" */
export function gaugeLine(g: Pattern['data']['gauge']): string {
	return `${g.stitches} sts × ${g.rows} rows = ${g.overCm} × ${g.overCm} cm`;
}

/** The muted one-liner under a pattern in the homepage feed. */
export function patternSpecLine(p: Pattern['data']): string {
	const y = mainYarn(p);
	return [y.cycWeightName, `${p.hookMm} mm hook`, sizeRange(p), yardageRange(p)].join(' · ');
}

/** Journal posts state their method instead of a spec. */
export function postSpecLine(p: Post['data']): string | undefined {
	return p.method;
}

/**
 * Read time is displayed on the journal index. Computing it at build keeps it off
 * the author — one less field to remember, and it can never drift from the text.
 */
export function readTime(body: string | undefined): number {
	const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}

/**
 * Slug for category/kind routes. Lives here rather than in a page because Astro
 * hoists getStaticPaths above module-level consts, which would put a local
 * `const slugify` in the temporal dead zone. Imports are hoisted; consts are not.
 */
export function slugify(s: string): string {
	return s.toLowerCase().replace(/\s+/g, '-');
}
