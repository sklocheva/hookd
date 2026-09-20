/**
 * The yarn weight calculator's arithmetic, and nothing else.
 *
 * No DOM in here, and no Astro: the page renders the form, the client script reads it and
 * calls `calculate`, and `yarn-weight.test.ts` calls it with the values the design brief
 * lists as its specification. The component is a shell around this — if an answer is wrong,
 * it is wrong here.
 *
 * The source of truth for the numbers is the author's own spreadsheet
 * (yarn_weight_calculator.xlsx); the tables below are copied from it exactly, not rounded.
 *
 * **Everything goes through Nm.** Nm is metres per gram, the same quantity as m/100 g scaled
 * by 100, which is why one unit covers every fibre and every counting system converts to it
 * and to nothing else.
 */

/** Fibre densities in g/cm³. Order is the dropdown's order: animal, plant, synthetic. */
export const FIBRES = [
	['Wool', 1.31],
	['Merino', 1.31],
	['Alpaca', 1.31],
	['Angora', 1.16],
	['Silk', 1.25],
	['Cotton', 1.54],
	['Linen', 1.5],
	['Polyamide', 1.14],
	['Nylon', 1.14],
	['Acrylic', 1.16],
	['Polyester', 1.38],
	['Mohair', 1.32],
	['Cashmere', 1.3],
	['Yak', 1.3],
	['Camel', 1.3],
	['Viscose', 1.52],
	['Rayon', 1.52],
	['Modal', 1.52],
	['Lyocell', 1.5],
	['Bamboo viscose', 1.52],
	['Hemp', 1.48],
	['Ramie', 1.52],
	['Acetate', 1.32],
	['Elastane', 1.21],
	['Polypropylene', 0.91],
] as const;

export type FibreName = (typeof FIBRES)[number][0];

const DENSITY = new Map<string, number>(FIBRES);

/** Every other density is measured against this one: 100% wool passes through unchanged. */
const WOOL_DENSITY = 1.31;

/** The fibre added when a reader presses "Add a fibre". */
export const DEFAULT_ADDED_FIBRE: FibreName = 'Cotton';

/** A blend can hold this many fibres, as the spreadsheet does. */
export const MAX_FIBRES = 4;

export interface Category {
	n: number;
	name: string;
	/** Lower bound in wool-equivalent m/100 g. A category owns [min, the next one's min). */
	min: number;
}

/**
 * The top of a category's band, or Infinity for Lace, which is open-ended.
 *
 * Derived rather than stored: a band's ceiling is the next band's floor by definition, and
 * writing both invites the two to disagree.
 */
export const categoryMax = (category: Category): number =>
	// CATEGORIES runs thinnest first, so the band above is the *last* one with a higher
	// floor, not the first. `find` reads the right way round and returns the wrong band.
	CATEGORIES.reduce((lowest, c) => (c.min > category.min ? Math.min(lowest, c.min) : lowest), Infinity);

/** Heaviest yarn last, so `find` on a descending list returns the first band it clears. */
export const CATEGORIES: readonly Category[] = [
	{ n: 0, name: 'Lace', min: 550 },
	{ n: 1, name: 'Super Fine (Fingering/Sock)', min: 350 },
	{ n: 2, name: 'Fine (Sport)', min: 270 },
	{ n: 3, name: 'Light (DK)', min: 210 },
	{ n: 4, name: 'Medium (Worsted/Aran)', min: 150 },
	{ n: 5, name: 'Bulky (Chunky)', min: 90 },
	{ n: 6, name: 'Super Bulky', min: 0 },
];

/** The category a wool-equivalent m/100 g falls in. Expects an already-rounded integer. */
export const categoryFor = (woolEquivalent: number): Category | undefined =>
	CATEGORIES.find((c) => woolEquivalent >= c.min);

export type SystemId = 'nm' | 'nec' | 'worsted' | 'lea' | 'tex' | 'dtex' | 'denier';

interface SystemBase {
	id: SystemId;
	label: string;
	unit: string;
	/** A plausible value, shown as the placeholder in a single-figure field. */
	example: string;
	hint: string;
}

/**
 * How a count system reaches Nm.
 *
 * `count` is length per weight, like Nm itself, so it converts by a factor and may be
 * printed as a ply pair (2/28). `linear` is weight per length — bigger means thicker — so
 * it converts by `constant ÷ value`, and a pair has no meaning for it.
 */
export type CountSystem = SystemBase & { mode: 'count'; factor: number };
export type LinearSystem = SystemBase & { mode: 'linear'; constant: number };
export type System = CountSystem | LinearSystem;

export const SYSTEMS: readonly System[] = [
	{
		id: 'nm',
		label: 'Nm — metric',
		mode: 'count',
		factor: 1,
		unit: 'Nm',
		example: '28',
		hint: 'Written as 2 / 28, 6 / 15000, or a single figure like NM 2000. A single figure goes in either box — it makes no difference which.',
	},
	{
		id: 'nec',
		label: 'NeC — cotton count',
		mode: 'count',
		factor: 1.6934,
		unit: 'NeC',
		example: '20',
		hint: 'Cotton count. Ply pairs like 2 / 20 work here too; it is converted to Nm for you (× 1.6934).',
	},
	{
		id: 'worsted',
		label: 'Worsted count',
		mode: 'count',
		factor: 1.1289,
		unit: 'NeK',
		example: '16',
		hint: 'English worsted count, converted to Nm for you (× 1.1289).',
	},
	{
		id: 'lea',
		label: 'Linen lea',
		mode: 'count',
		factor: 0.6048,
		unit: 'lea',
		example: '14',
		hint: 'Linen lea, converted to Nm for you (× 0.6048).',
	},
	{
		id: 'tex',
		label: 'Tex',
		mode: 'linear',
		constant: 1000,
		unit: 'tex',
		example: '40',
		hint: 'Grams per 1000 m. One figure only — for a plied tex, enter the total.',
	},
	{
		id: 'dtex',
		label: 'dtex',
		mode: 'linear',
		constant: 10000,
		unit: 'dtex',
		example: '400',
		hint: 'Grams per 10 000 m. One figure only — for a plied dtex, enter the total.',
	},
	{
		id: 'denier',
		label: 'Denier',
		mode: 'linear',
		constant: 9000,
		unit: 'den',
		example: '360',
		hint: 'Grams per 9000 m. One figure only — for a plied denier, enter the total.',
	},
];

export const systemFor = (id: string): System => SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0];

export type DivisorMode = 'auto' | '1' | '1000';

export interface FibreRow {
	fibre: string;
	/** As typed. Blank, or anything that is not a positive number, counts as nothing. */
	pct: string;
}

/**
 * What the form holds. Everything is a string, exactly as a text field gives it back, so
 * the rules about blank fields and decimal commas live here where they can be tested rather
 * than in the script that reads the form.
 */
export interface Input {
	m100: string;
	system: SystemId;
	millA: string;
	millB: string;
	divisor: DivisorMode;
	rows: readonly FibreRow[];
}

/** A positive number, or null. Accepts a decimal comma. */
export function parseNumber(text: string): number | null {
	const value = parseFloat(String(text).replace(',', '.'));
	return Number.isFinite(value) && value > 0 ? value : null;
}

/** Three decimals is enough to show a working and never enough to disagree with it. */
const tidy = (value: number) => Math.round(value * 1000) / 1000;

export interface CountResult {
	system: System;
	/** The count as printed: larger ÷ smaller for a pair, otherwise the single figure. */
	printed: number;
	/** What `printed` was divided by. 1 unless the ×1000 printing convention applied. */
	divisor: number;
	nm: number;
	metres: number;
	/** The sum written out, for the tile under the inputs. */
	working: string;
}

/** How far the count and a stated m/100 g may differ before they are called a disagreement. */
const AGREEMENT = 0.05;

/**
 * The divisor to assume, when the reader has not chosen one.
 *
 * Without a stated m/100 g, all there is to go on is the ×1000 printing convention, which is
 * an **Nm habit** — Italian mills print Nm 2.5 as NM 2500. NeC, worsted and lea have no such
 * convention, so their automatic divisor is 1. This is the flat rule, and it is wrong in two
 * places the caveats name: a yarn under 30 m/100 g, whose ×1000 count lands below 300, and
 * thread finer than Nm 300.
 *
 * A stated m/100 g fixes both, because the divisor is then just whichever power of ten
 * reconciles the count with it — which is what the spreadsheet does.
 *
 * **But only if it does reconcile them.** Rounding a logarithm always yields *some* power of
 * ten, so a count and a label that genuinely disagree would get one anyway, and the
 * cross-check would then report a figure bent toward the label instead of what the count
 * actually says: `2 / 28` against a stated 380 was being divided by 10 and reported as 140
 * rather than its honest 1400. So the inferred divisor is adopted only when it brings the
 * two within the same 5% the cross-check uses, and otherwise the flat rule stands and the
 * warning gets to state the real reading.
 *
 * Never below 1 either: that would mean the printed count is smaller than the true Nm, which
 * no mill convention does, and the manual chips do not offer it.
 */
function autoDivisor(system: CountSystem, printed: number, stated: number | null): number {
	const flat = system.id === 'nm' && printed >= 300 ? 1000 : 1;
	if (stated === null || stated <= 0) return flat;

	const power = Math.round(Math.log10((printed * 100) / stated));
	if (!Number.isFinite(power)) return flat;

	const inferred = Math.max(1, 10 ** power);
	const metres = (printed / inferred) * system.factor * 100;
	return Math.abs(metres - stated) / stated <= AGREEMENT ? inferred : flat;
}

/**
 * Printed count → Nm → metres per 100 g.
 *
 * Linear systems have no divisor at all; for the rest see `autoDivisor`.
 */
export function countToMetres(input: Input): CountResult | null {
	const system = systemFor(input.system);
	const a = parseNumber(input.millA);
	const b = parseNumber(input.millB);

	if (system.mode === 'linear') {
		if (!b) return null;
		const nm = system.constant / b;
		const metres = nm * 100;
		return {
			system,
			printed: b,
			divisor: 1,
			nm,
			metres,
			working: `${system.constant} ÷ ${tidy(b)} ${system.unit} → Nm ${tidy(nm)} → ${Math.round(metres)} m/100 g.`,
		};
	}

	if (!a && !b) return null;
	const printed = a && b ? Math.max(a, b) / Math.min(a, b) : (a ?? b)!;
	const divisor =
		input.divisor === 'auto'
			? autoDivisor(system, printed, parseNumber(input.m100))
			: Number(input.divisor);
	const nm = (printed / divisor) * system.factor;
	const metres = nm * 100;

	// "Printed", not "Nm": once a divisor has been applied, calling the figure Nm 2500 would
	// assert the very thing the divisor is correcting.
	const steps = [divisor !== 1 ? `Printed ${tidy(printed)}` : `${system.unit} ${tidy(printed)}`];
	if (divisor !== 1) steps.push(`÷ ${divisor}`);
	if (system.factor !== 1) steps.push(`× ${system.factor}`);

	return {
		system,
		printed,
		divisor,
		nm,
		metres,
		working: `${steps.join(' ')} → Nm ${tidy(nm)} → ${Math.round(metres)} m/100 g.`,
	};
}

/** Percentages may drift this far from 100 before the blend is refused. */
const TOTAL_TOLERANCE = 0.5;

export interface BlendTotal {
	total: number;
	/** Whether the total is close enough to 100 to use. */
	ok: boolean;
	/** "Total 100%", or "Total 90% — needs 100". Words as well as colour: see the component. */
	label: string;
}

export function blendTotal(rows: readonly FibreRow[]): BlendTotal {
	const total = rows.reduce((sum, row) => sum + (parseNumber(row.pct) ?? 0), 0);
	const ok = Math.abs(total - 100) <= TOTAL_TOLERANCE;
	const shown = Math.round(total * 10) / 10;
	return { total, ok, label: ok ? `Total ${shown}%` : `Total ${shown}% — needs 100` };
}

/**
 * 1 ÷ Σ(fraction ÷ density) — densities blend by mass this way, not by averaging.
 *
 * Fractions are taken over the entered total rather than over 100, so a blend that is
 * inside the tolerance (99.6%) still uses the proportions the reader typed. For a total of
 * exactly 100 the two are the same.
 */
export function blendDensity(rows: readonly FibreRow[]): number | null {
	const used = rows
		.map((row) => ({ pct: parseNumber(row.pct) ?? 0, density: DENSITY.get(row.fibre) ?? WOOL_DENSITY }))
		.filter((row) => row.pct > 0);
	const total = used.reduce((sum, row) => sum + row.pct, 0);
	if (total <= 0) return null;
	return 1 / used.reduce((sum, row) => sum + row.pct / total / row.density, 0);
}

export type CheckTone = 'warning' | 'caution';

export interface Check {
	message: string;
	/** `warning` means the two figures disagree; `caution` means only one exists. */
	tone: CheckTone;
}

export type Outcome =
	| { ok: false; message: string }
	| {
			ok: true;
			category: Category;
			/** The figure the category was chosen from, rounded before the lookup. */
			woolEquivalent: number;
			/** m/100 g as used: the stated one if there is one, else the count's. */
			metres: number;
			/** "46% alpaca, 20% merino at 380 m / 100 g." */
			summary: string;
			/** Silence means agreement; only a disagreement or a guess speaks. */
			check: Check | null;
			/**
			 * Whether holding several strands together can reach a heavier category at all.
			 * False only for Super Bulky, which nothing is heavier than — the page uses it to
			 * drop the strands panel rather than offer a picker every answer to which is
			 * "one strand is already heavier than that".
			 */
			canHoldStrands: boolean;
			/** The count's working, whether or not the result ended up using it. */
			working: string | null;
	  };

export const MESSAGES = {
	needsLength: 'Enter metres per 100 g, or a yarn count from a cone.',
	needsTotal: 'Percentages must total 100.',
	outOfRange: 'Result out of range.',
} as const;

/**
 * The range a real yarn's length per 100 g falls in.
 *
 * Wide on purpose — this is not a plausibility opinion about yarn, it is a trap for a
 * divisor set to the wrong power of ten. The floor sits below the heaviest roving and the
 * ceiling above the finest machine thread (Nm 300, which the caveats already name as the
 * end of the automatic divisor's range), so nothing anyone crochets with is near either.
 *
 * It exists because of the one failure the cold read found: a cone marked `NM 2000` with
 * the divisor forced to ÷ 1 yields 200,000 m/100 g, and the category lookup happily called
 * that Lace and printed it in 86px type. Every figure has *some* category — that is what
 * made the wrong answer look as confident as the right one — so the guard has to be on the
 * length, before the lookup, rather than on the category.
 */
const PLAUSIBLE_MIN = 10;
const PLAUSIBLE_MAX = 30000;

/**
 * The refusal for a length no yarn has, worded by whatever is most likely to have caused it.
 *
 * The divisor is blamed on `manualDivisor`, not on `divisor !== 1`: the case that prompted
 * all this is a count of 2000 with the divisor forced *to* 1, where the automatic value
 * would have been 1000. Reading the divisor itself would let the one setting that causes
 * this go unnamed.
 */
function implausible(metres: number, stated: number | null, manualDivisor: boolean): string {
	const figure = `${Math.round(metres).toLocaleString('en-GB')} m/100 g`;
	if (stated !== null) return `${figure} is not a length any yarn has — check the metres per 100 g.`;
	if (manualDivisor) {
		return `${figure} is not a length any yarn has. Set the divisor back to Automatic.`;
	}
	return `${figure} is not a length any yarn has — check the count, and which system it is in.`;
}

/**
 * How many strands of this yarn land in a chosen category — the spreadsheet's last block.
 *
 * A range, not a number, because a category is a band: any strand count whose share of the
 * wool-equivalent falls inside it will do. Four things can come back, and each is a real
 * answer rather than an error:
 *
 * - one strand is already heavier than the target, so no number of them will help;
 * - the band is too narrow at this yarn's thickness and every count steps over it;
 * - Super Bulky, which has no ceiling, so it is "N or more";
 * - a single count, or a range.
 *
 * Returns the sentence ready to show, because every branch words itself differently.
 */
export function strandsToReach(woolEquivalent: number, target: Category): string {
	const max = categoryMax(target);
	// Thinner is a larger figure, so the band's ceiling gives the fewest strands.
	const fewest = Number.isFinite(max) ? Math.floor(woolEquivalent / max) + 1 : 1;
	const most = target.min > 0 ? Math.floor(woolEquivalent / target.min) : Infinity;
	const label = `${target.n} ${target.name}`;
	const strands = (n: number) => (n === 1 ? '1 strand' : `${n} strands`);
	const give = (n: number) => (n === 1 ? 'gives' : 'give');

	if (most < 1) return `One strand is already heavier than ${label}.`;

	if (fewest > most) {
		return `Nothing lands in ${label}: ${strands(most)} ${give(most)} ${Math.round(woolEquivalent / most)} m/100 g, ${strands(fewest)} ${give(fewest)} ${Math.round(woolEquivalent / fewest)}.`;
	}

	if (!Number.isFinite(most)) return `${strands(fewest)} or more.`;

	if (fewest === most) {
		return `${strands(fewest)} — about ${Math.round(woolEquivalent / fewest)} m/100 g.`;
	}

	return `${fewest} to ${most} strands — about ${Math.round(woolEquivalent / fewest)} to ${Math.round(woolEquivalent / most)} m/100 g.`;
}

/** "46% alpaca, 20% merino, 34% polyamide" — the label, read back. */
function describeBlend(rows: readonly FibreRow[]): string {
	return rows
		.map((row) => ({ fibre: row.fibre, pct: parseNumber(row.pct) ?? 0 }))
		.filter((row) => row.pct > 0)
		.map((row) => `${Math.round(row.pct * 10) / 10}% ${row.fibre.toLowerCase()}`)
		.join(', ');
}

export function calculate(input: Input): Outcome {
	const stated = parseNumber(input.m100);
	const count = countToMetres(input);

	// A stated m/100 g is always the figure used; the count only cross-checks it.
	const metres = stated ?? count?.metres ?? null;
	if (metres === null) return { ok: false, message: MESSAGES.needsLength };

	// Before the blend and before the lookup: every figure has some category, so a length
	// this wrong would otherwise be reported as confidently as a right one.
	if (metres < PLAUSIBLE_MIN || metres > PLAUSIBLE_MAX) {
		return { ok: false, message: implausible(metres, stated, input.divisor !== 'auto') };
	}

	if (!blendTotal(input.rows).ok) return { ok: false, message: MESSAGES.needsTotal };
	const density = blendDensity(input.rows);
	if (density === null) return { ok: false, message: MESSAGES.needsTotal };

	// Rounded before the lookup, so the category always agrees with any figure shown.
	const woolEquivalent = Math.round(metres * (density / WOOL_DENSITY));
	const category = Number.isFinite(woolEquivalent) ? categoryFor(woolEquivalent) : undefined;
	if (!category) return { ok: false, message: MESSAGES.outOfRange };

	let check: Check | null = null;
	if (count && stated !== null) {
		if (Math.abs(count.metres - stated) / stated > AGREEMENT) {
			check = {
				tone: 'warning',
				message: `Count gives ${Math.round(count.metres)} m/100 g, label says ${Math.round(stated)}. Check the divisor.`,
			};
		}
	} else if (count) {
		check = {
			tone: 'caution',
			message:
				count.divisor !== 1
					? 'No stated m/100 g, so the divisor is a guess. Confirm by weighing a measured length.'
					: 'No stated m/100 g — this comes from the count alone. Confirm by weighing a measured length.',
		};
	}

	const source = stated !== null ? '' : ' (worked out from the count)';

	return {
		ok: true,
		category,
		woolEquivalent,
		metres,
		summary: `${describeBlend(input.rows)} at ${Math.round(metres)} m / 100 g${source}.`,
		check,
		canHoldStrands: category.n !== 6,
		working: count?.working ?? null,
	};
}
