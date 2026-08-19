import type { CollectionEntry } from 'astro:content';

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

/** e.g. "81–152 cm" from finished bust, falling back to length for non-garments. */
export function finishedMeasurements(p: Pattern['data']): string {
	const busts = p.sizes.map((s) => s.finishedBustCm).filter((n): n is number => n != null);
	if (busts.length) {
		const [lo, hi] = range(busts);
		return lo === hi ? `${lo} cm` : `${lo}–${hi} cm`;
	}
	const first = p.sizes[0];
	if (first.finishedLengthCm && first.finishedBustCm) {
		return `${first.finishedBustCm} × ${first.finishedLengthCm} cm`;
	}
	if (first.finishedLengthCm) return `${first.finishedLengthCm} cm`;
	return '—';
}

/** e.g. "4.5 mm · US 7" */
export function hook(p: Pattern['data']): string {
	return `${p.hookMm} mm · US ${p.hookUs}`;
}

/** The main yarn drives the card's Yarn row. */
export function mainYarn(p: Pattern['data']) {
	return p.yarns.find((y) => y.role === 'main') ?? p.yarns[0];
}

/** e.g. "16 sts × 11 rows = 10 × 10 cm" */
export function gaugeLine(g: Pattern['data']['swatchGauge']): string {
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
