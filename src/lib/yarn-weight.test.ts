/**
 * The calculator's specification, as tests.
 *
 * The first block is the table of values the design brief says "must reproduce exactly"
 * (yarn-weight-calculator.md §8). If a refactor breaks one of them the refactor is wrong,
 * not the test. The rest pin the behaviours the brief describes in prose.
 *
 * Runs on Node's built-in runner — `npm test` — so it adds no dependency. Node 22.18+
 * strips the types itself; hence the explicit `.ts` on the import.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	blendDensity,
	blendStarted,
	blendTotal,
	calculate,
	CATEGORIES,
	categoryFor,
	categoryMax,
	countToMetres,
	MESSAGES,
	parseNumber,
	strandsToReach,
	type Input,
} from './yarn-weight.ts';

/** The category with this CYC number, for the tests that name one. */
const cat = (n: number) => CATEGORIES.find((c) => c.n === n)!;

/** A form with one row of 100% wool — a convenience here; the page itself starts with the blend empty. */
const form = (over: Partial<Input> = {}): Input => ({
	m100: '',
	system: 'nm',
	millA: '',
	millB: '',
	divisor: 'auto',
	rows: [{ fibre: 'Wool', pct: '100' }],
	...over,
});

/** `calculate`, narrowed: a test that expects an answer fails loudly if it got a refusal. */
function answer(input: Input) {
	const outcome = calculate(input);
	assert.ok(outcome.ok, outcome.ok ? '' : outcome.message);
	return outcome;
}

// ---- §8: the test values --------------------------------------------------------------

test('6 / 15000, 100% wool → 250 m/100 g, 3 Light (DK); 2 strands ≈ 125 → 5 Bulky', () => {
	const r = answer(form({ millA: '6', millB: '15000' }));
	assert.equal(r.metres, 250);
	assert.equal(r.woolEquivalent, 250);
	assert.equal(r.category.n, 3);
	assert.equal(r.category.name, 'Light (DK)');
	// The brief's strand figure, now reached through the picker rather than a line the page
	// printed unasked: two strands of this land at 125 m/100 g, which is 5 Bulky.
	assert.equal(strandsToReach(r.woolEquivalent, cat(5), r.metres), '2 strands — about 125 m/100 g.');
});

test('2 / 48 count only, wool → 2400 → 0 Lace', () => {
	const r = answer(form({ millA: '2', millB: '48' }));
	assert.equal(r.metres, 2400);
	assert.equal(r.category.n, 0);
	assert.equal(r.category.name, 'Lace');
});

test('NM 2000 count only, cotton → 200 → wool-equivalent 235 → 3 Light (DK)', () => {
	const r = answer(form({ millB: '2000', rows: [{ fibre: 'Cotton', pct: '100' }] }));
	assert.equal(r.metres, 200);
	assert.equal(r.woolEquivalent, 235);
	assert.equal(r.category.n, 3);
});

test('380 m/100 g, 46% alpaca / 20% merino / 34% polyamide → 362 → 1 Super Fine; 2 strands ≈ 190 → 4 Medium', () => {
	const r = answer(
		form({
			m100: '380',
			rows: [
				{ fibre: 'Alpaca', pct: '46' },
				{ fibre: 'Merino', pct: '20' },
				{ fibre: 'Polyamide', pct: '34' },
			],
		})
	);
	assert.equal(r.woolEquivalent, 362);
	assert.equal(r.category.n, 1);
	// The brief gives 181 here, which is the wool-equivalent halved. The page shows the
	// reader's own figure instead — 380 ÷ 2 — because that is the sum she will check; the
	// band chosen is the same either way.
	assert.equal(strandsToReach(r.woolEquivalent, cat(4), r.metres), '2 strands — about 190 m/100 g.');
	assert.equal(r.summary, '46% alpaca, 20% merino, 34% polyamide at 380 m / 100 g.');
});

test('1402 m/100 g, 100% cashmere → 1391 → 0 Lace; 3 strands ≈ 467 → 1 Super Fine', () => {
	const r = answer(form({ m100: '1402', rows: [{ fibre: 'Cashmere', pct: '100' }] }));
	assert.equal(r.woolEquivalent, 1391);
	assert.equal(r.category.n, 0);
	assert.equal(strandsToReach(r.woolEquivalent, cat(1), r.metres), '3 strands — about 467 m/100 g.');
});

test('NeC 24, wool → Nm 40.642 → 4064 m/100 g', () => {
	const c = countToMetres(form({ system: 'nec', millB: '24' }))!;
	assert.equal(Math.round(c.nm * 1000) / 1000, 40.642);
	assert.equal(Math.round(c.metres), 4064);
});

test('Tex 40, wool → Nm 25 → 2500 m/100 g', () => {
	const c = countToMetres(form({ system: 'tex', millB: '40' }))!;
	assert.equal(c.nm, 25);
	assert.equal(c.metres, 2500);
});

test('Denier 360, wool → Nm 25 → 2500 m/100 g', () => {
	const c = countToMetres(form({ system: 'denier', millB: '360' }))!;
	assert.equal(c.nm, 25);
	assert.equal(c.metres, 2500);
});

// ---- checked against published mill data ----------------------------------------------

/**
 * The ten yarns on the spreadsheet's "Reference & Notes" tab, section 5.
 *
 * All of it is public product data — ColourMart's and JaggerSpun's own listings — which is
 * why it can live in a public repo. The author's own stash comparison is not here for that
 * reason; it was run separately and is recorded in the spreadsheet.
 *
 * Two of the ten disagree with what the seller calls the yarn, and **both are expected**:
 * they are lofty cashmeres, and the calculator reads them one category light, which is the
 * direction section 6 of that tab predicts. They are pinned here at the calculator's answer,
 * not the seller's, so that a change in either direction shows up as a failed test rather
 * than as a quietly different answer.
 */
const MILL = [
	// yarn,                    count,          fibre,      stated m/100 g, category
	['ColourMart cashmere 2/28', ['2', '28'], 'Cashmere', 1402, 0],
	['ColourMart cashmere 3/28', ['3', '28'], 'Cashmere', 945, 0],
	// Seller calls this UK 4 ply; the calculator says lace.
	['ColourMart cashmere 2/14', ['2', '14'], 'Cashmere', 701, 0],
	['ColourMart cashmere 3/14', ['3', '14'], 'Cashmere', 469, 1],
	// Seller calls this DK; the calculator says sport.
	['ColourMart cashmere 4/14', ['4', '14'], 'Cashmere', 347, 2],
	['ColourMart cashmere 8/14', ['8', '14'], 'Cashmere', 174, 4],
	['ColourMart cashmere 12/14', ['12', '14'], 'Cashmere', 116, 5],
] as const;

for (const [name, [a, b], fibre, stated, expected] of MILL) {
	test(`${name}: the count and the stated yardage agree, and give ${expected}`, () => {
		const rows = [{ fibre, pct: '100' }];

		// The count alone reproduces the seller's stated yardage within 5% — which is what
		// makes the count trustworthy when a cone carries no length at all.
		const c = countToMetres(form({ millA: a, millB: b }))!;
		const drift = Math.abs(c.metres - stated) / stated;
		assert.ok(drift <= 0.05, `${name}: count gives ${Math.round(c.metres)}, label says ${stated}`);

		// And both routes land on the same category.
		assert.equal(answer(form({ m100: String(stated), rows })).category.n, expected, 'from yardage');
		assert.equal(answer(form({ millA: a, millB: b, rows })).category.n, expected, 'from the count');
	});
}

/** JaggerSpun Maine Line, in worsted count — the one test of that system on real data. */
const JAGGER = [
	['JaggerSpun Maine Line 2/8', ['2', '8'], 451, 1],
	['JaggerSpun Maine Line 3/8', ['3', '8'], 300, 2],
	['JaggerSpun Maine Line 2/20', ['2', '20'], 1128, 0],
] as const;

for (const [name, [a, b], stated, expected] of JAGGER) {
	test(`${name}: worsted count reproduces ${stated} m/100 g and gives ${expected}`, () => {
		const input = form({ system: 'worsted', millA: a, millB: b });
		const c = countToMetres(input)!;
		const drift = Math.abs(c.metres - stated) / stated;
		assert.ok(drift <= 0.05, `${name}: count gives ${Math.round(c.metres)}, listing says ${stated}`);
		assert.equal(answer(input).category.n, expected);
	});
}

test('a cashmere yarn reads lighter than its yardage, because cashmere is less dense than wool', () => {
	// The correction is small but it is the whole reason fibre is asked for: the same 347
	// m/100 g would be 2 Fine in cashmere and 2 Fine in wool here, but the wool-equivalent
	// differs, and at a band edge that is what decides it.
	const cashmere = answer(form({ m100: '347', rows: [{ fibre: 'Cashmere', pct: '100' }] }));
	const wool = answer(form({ m100: '347' }));
	assert.equal(cashmere.woolEquivalent, 344);
	assert.equal(wool.woolEquivalent, 347);
	assert.ok(cashmere.woolEquivalent < wool.woolEquivalent);
});

// ---- the working under the inputs -----------------------------------------------------

test('the working reads the way the brief writes it', () => {
	assert.equal(countToMetres(form({ millA: '2', millB: '28' }))!.working, 'Nm 14 → Nm 14 → 1400 m/100 g.');
	assert.equal(countToMetres(form({ millB: '28' }))!.working, 'Nm 28 → Nm 28 → 2800 m/100 g.');
	assert.equal(
		countToMetres(form({ millB: '2500' }))!.working,
		'Printed 2500 ÷ 1000 → Nm 2.5 → 250 m/100 g.'
	);
	assert.equal(
		countToMetres(form({ system: 'nec', millB: '20' }))!.working,
		'NeC 20 × 1.6934 → Nm 33.868 → 3387 m/100 g.'
	);
	assert.equal(
		countToMetres(form({ system: 'tex', millB: '40' }))!.working,
		'1000 ÷ 40 tex → Nm 25 → 2500 m/100 g.'
	);
});

// ---- the count -----------------------------------------------------------------------

test('a pair divides the larger by the smaller, whichever box it is in', () => {
	assert.equal(countToMetres(form({ millA: '15000', millB: '6' }))!.printed, 2500);
	assert.equal(countToMetres(form({ millA: '6', millB: '15000' }))!.printed, 2500);
});

test('either field alone is enough', () => {
	assert.equal(countToMetres(form({ millA: '2000' }))!.metres, 200);
	assert.equal(countToMetres(form({ millB: '2000' }))!.metres, 200);
	assert.equal(countToMetres(form()), null);
});

test('the automatic ×1000 rule is Nm-only', () => {
	// 400 is over the 300 line, but NeC has no such convention.
	assert.equal(countToMetres(form({ system: 'nec', millB: '400' }))!.divisor, 1);
	assert.equal(countToMetres(form({ system: 'nm', millB: '400' }))!.divisor, 1000);
	assert.equal(countToMetres(form({ system: 'nm', millB: '299' }))!.divisor, 1);
	assert.equal(countToMetres(form({ system: 'nm', millB: '300' }))!.divisor, 1000);
});

test('a stated m/100 g picks the divisor, so the ×1000 rule is not needed', () => {
	// Thick yarn: the ×1000 count is under 300, which is exactly where the flat rule fails.
	// 250 printed against a stated 25 m/100 g implies ÷ 1000, not ÷ 1.
	const thick = countToMetres(form({ m100: '25', millB: '250' }))!;
	assert.equal(thick.divisor, 1000);
	assert.equal(thick.metres, 25);

	// Fine thread: Nm 400 is over 300 and is a real count, not a ×1000 printing.
	const fine = countToMetres(form({ m100: '40000', millB: '400' }))!;
	assert.equal(fine.divisor, 1);
	assert.equal(fine.metres, 40000);
});

test('a divisor that does not reconcile the two is not used, so the warning stays honest', () => {
	// Nm 14 is 1400 m/100 g and the label says 380. Rounding the logarithm would hand back
	// ÷ 10 and report 140 — a figure bent toward the label and true of neither.
	const c = countToMetres(form({ m100: '380', millA: '2', millB: '28' }))!;
	assert.equal(c.divisor, 1);
	assert.equal(c.metres, 1400);
	assert.match(
		answer(form({ m100: '380', millA: '2', millB: '28' })).check!.message,
		/^The metres box says 380 m\/100 g but the count gives 1400/
	);
});

test('the inferred divisor is never below 1', () => {
	// A stated figure this far out is a typo; the cross-check is what should say so.
	assert.equal(countToMetres(form({ m100: '2500', millB: '2.5' }))!.divisor, 1);
	// And the stated figure still wins, so the answer is not affected either way.
	assert.equal(answer(form({ m100: '2500', millB: '2.5' })).metres, 2500);
});

test('a manual divisor overrides the automatic one', () => {
	assert.equal(countToMetres(form({ millB: '2500', divisor: '1' }))!.metres, 250000);
	assert.equal(countToMetres(form({ millB: '25', divisor: '1000' }))!.divisor, 1000);
});

test('a linear system takes only the single field', () => {
	// A stray value in the other field, left over from switching systems, is ignored.
	const c = countToMetres(form({ system: 'tex', millA: '3', millB: '40' }))!;
	assert.equal(c.metres, 2500);
	assert.equal(countToMetres(form({ system: 'tex', millA: '40' })), null);
});

test('a decimal comma is a decimal point', () => {
	assert.equal(parseNumber('2,5'), 2.5);
	assert.equal(countToMetres(form({ millB: '2,5' }))!.metres, 250);
});

test('blank, zero, negative and non-numbers count as nothing', () => {
	for (const text of ['', ' ', '0', '-3', 'abc']) assert.equal(parseNumber(text), null, text);
});

// ---- the blend -----------------------------------------------------------------------

test('100% wool passes through unchanged', () => {
	assert.equal(blendDensity([{ fibre: 'Wool', pct: '100' }]), 1.31);
	assert.equal(answer(form({ m100: '333' })).woolEquivalent, 333);
});

test('the total tolerates half a point either way, and says so in words', () => {
	assert.equal(blendTotal([{ fibre: 'Wool', pct: '100.4' }]).ok, true);
	assert.equal(blendTotal([{ fibre: 'Wool', pct: '99.5' }]).ok, true);
	assert.equal(blendTotal([{ fibre: 'Wool', pct: '99.4' }]).ok, false);
	assert.equal(blendTotal([{ fibre: 'Wool', pct: '100' }]).label, 'Total 100%');
	// Words as well as colour: a wrong total must not be signalled by colour alone.
	assert.equal(blendTotal([{ fibre: 'Wool', pct: '90' }]).label, 'Total 90% — needs 100');
});

test('a total inside the tolerance still uses the proportions typed', () => {
	// 99.6 of wool is still all wool: the density must not drift toward zero.
	assert.equal(blendDensity([{ fibre: 'Wool', pct: '99.6' }]), 1.31);
});

test('rows with no percentage take no part', () => {
	const r = answer(
		form({
			m100: '250',
			rows: [
				{ fibre: 'Wool', pct: '100' },
				{ fibre: 'Cotton', pct: '' },
			],
		})
	);
	assert.equal(r.woolEquivalent, 250);
	assert.equal(r.summary, '100% wool at 250 m / 100 g.');
});

// ---- refusals ------------------------------------------------------------------------

test('no length at all → asks for one, before it looks at the blend', () => {
	const r = calculate(form({ rows: [{ fibre: 'Wool', pct: '10' }] }));
	assert.deepEqual(r, { ok: false, message: MESSAGES.needsLength });
});

test('a blend that does not total 100 → says so', () => {
	const r = calculate(form({ m100: '250', rows: [{ fibre: 'Wool', pct: '90' }] }));
	assert.deepEqual(r, { ok: false, message: MESSAGES.needsTotal });
});

test('an untouched blend waits rather than warns, and is never divided by zero', () => {
	// The page starts like this: one row, no fibre, no percentage.
	const r = calculate(form({ m100: '250', rows: [{ fibre: '', pct: '' }] }));
	assert.deepEqual(r, { ok: false, message: MESSAGES.needsBlend });
	assert.equal(blendStarted([{ fibre: '', pct: '' }]), false);
});

test('one fibre with no percentage is all of it', () => {
	const r = answer(form({ m100: '200', rows: [{ fibre: 'Cotton', pct: '' }] }));
	assert.equal(r.woolEquivalent, 235);
	assert.equal(r.summary, '100% cotton at 200 m / 100 g.');
	assert.equal(blendTotal([{ fibre: 'Cotton', pct: '' }]).ok, true);
});

test('empty extra rows are not 0% rows', () => {
	// Pressing "Add a fibre" and changing your mind must not break a finished blend.
	const r = answer(form({ m100: '250', rows: [{ fibre: 'Wool', pct: '' }, { fibre: '', pct: '' }] }));
	assert.equal(r.summary, '100% wool at 250 m / 100 g.');
});

test('with two fibres, a blank percentage is not assumed', () => {
	// "Cotton, then Silk" with no figures is not 50/50 or 100/0 — it is unfinished.
	const r = calculate(form({ m100: '250', rows: [{ fibre: 'Cotton', pct: '' }, { fibre: 'Silk', pct: '' }] }));
	assert.deepEqual(r, { ok: false, message: MESSAGES.needsTotal });
});

test('a percentage with no fibre asks for the fibre', () => {
	const r = calculate(form({ m100: '250', rows: [{ fibre: 'Wool', pct: '60' }, { fibre: '', pct: '40' }] }));
	assert.deepEqual(r, { ok: false, message: MESSAGES.needsFibre });
});

// ---- the plausibility guard ----------------------------------------------------------

test('a cone count with the divisor forced to 1 is refused, not called Lace', () => {
	// The exact failure a first-time reader hit: NM 2000, divisor ÷ 1, 200,000 m/100 g —
	// reported as 0 Lace in 86px type, six categories from the right answer.
	const r = calculate(form({ millB: '2000', divisor: '1', rows: [{ fibre: 'Cotton', pct: '100' }] }));
	assert.equal(r.ok, false);
	assert.equal(
		r.ok ? '' : r.message,
		'200,000 m/100 g is not a length any yarn has. Set the divisor back to Automatic.'
	);

	// And on Automatic the same cone still answers.
	assert.equal(answer(form({ millB: '2000', rows: [{ fibre: 'Cotton', pct: '100' }] })).category.n, 3);
});

test('an absurd stated length blames the stated length', () => {
	const r = calculate(form({ m100: '900000' }));
	assert.equal(r.ok, false);
	assert.match(r.ok ? '' : r.message, /check the metres per 100 g\.$/);
});

test('an absurd count on Automatic blames the count and the system', () => {
	// Tex is weight per length, so a tex value entered as though it were a count goes tiny.
	const r = calculate(form({ system: 'tex', millB: '0.01' }));
	assert.equal(r.ok, false);
	assert.match(r.ok ? '' : r.message, /check the count, and which system it is in\.$/);
});

test('the guard is wide enough to pass every real yarn in the test set', () => {
	// The heaviest and finest things this tool is meant to answer for.
	for (const metres of ['25', '250', '1402', '2400', '4064', '30000']) {
		assert.equal(calculate(form({ m100: metres })).ok, true, metres);
	}
});

// ---- categories ----------------------------------------------------------------------

test('every category quotes a hook, and the answer carries its own', () => {
	// Quoted from CYC, so the values are pinned rather than pattern-matched: deriving them
	// from src/lib/hooks.ts gives "M/N-13" and "P/Q" where the standard prints "M-13" and
	// "Q", which would misquote a standard this page cites by name.
	assert.equal(cat(1).hook, '2.25–3.5 mm · US B-1 to E-4');
	assert.equal(cat(3).hook, '4.5–5.5 mm · US 7 to I-9');
	assert.equal(cat(4).hook, '5.5–6.5 mm · US I-9 to K-10½');
	assert.equal(cat(6).hook, '9–15 mm · US M-13 to Q');
	// Lace is not a plain range — steel hooks and a regular hook.
	assert.match(cat(0).hook, /^Steel /);
	for (const c of CATEGORIES) assert.ok(c.hook.length > 0, `category ${c.n} has no hook`);

	// The hook shown is always the one belonging to the category shown.
	const r = answer(form({ m100: '250' }));
	assert.equal(r.category.n, 3);
	assert.equal(r.category.hook, '4.5–5.5 mm · US 7 to I-9');
});

test('a category owns [min, the next one up)', () => {
	assert.equal(categoryFor(549)?.n, 1);
	assert.equal(categoryFor(550)?.n, 0);
	assert.equal(categoryFor(350)?.n, 1);
	assert.equal(categoryFor(349)?.n, 2);
	assert.equal(categoryFor(210)?.n, 3);
	assert.equal(categoryFor(209)?.n, 4);
	assert.equal(categoryFor(90)?.n, 5);
	assert.equal(categoryFor(89)?.n, 6);
	assert.equal(categoryFor(0)?.n, 6);
});

test('the wool-equivalent is rounded before the lookup, so the category matches the figure', () => {
	// 209.6 m/100 g rounds to 210 and is DK; truncating it would call it Worsted.
	assert.equal(answer(form({ m100: '209.6' })).category.n, 3);
	assert.equal(answer(form({ m100: '209.4' })).category.n, 4);
});

// ---- the cross-check -----------------------------------------------------------------

test('count and label agree within 5% → silence', () => {
	assert.equal(answer(form({ m100: '380', millB: '3800' })).check, null);
	assert.equal(answer(form({ m100: '370', millB: '3800' })).check, null);
});

test('count and label disagree by more than 5% → a warning, and the label wins', () => {
	const r = answer(form({ m100: '380', millB: '3000' }));
	assert.equal(r.check?.tone, 'warning');
	// It says which figure was used and what to do about the other — not just "check the
	// divisor", which sent a reader with a leftover length hunting for the wrong setting.
	assert.equal(
		r.check?.message,
		'The metres box says 380 m/100 g but the count gives 300, and the answer uses the 380. ' +
			'If the count is the one to trust, clear the metres box; if neither looks right, check the divisor under “The count looks wrong”.'
	);
	assert.equal(r.metres, 380);
});

test('count only → a caution that says what the divisor did', () => {
	const assumed = answer(form({ millB: '2500' }));
	assert.equal(assumed.check?.tone, 'caution');
	assert.match(assumed.check!.message, /^No metres per 100 g given, so the printed 2500 was read as 2500 ÷ 1000\./);

	const plain = answer(form({ millA: '2', millB: '48' }));
	assert.equal(plain.check?.tone, 'caution');
	assert.match(plain.check!.message, /^No metres per 100 g given — this comes from the count alone/);
});

test('a divisor set by hand is never called a guess', () => {
	const r = answer(form({ millB: '2500', divisor: '1000' }));
	assert.match(r.check!.message, /the divisor was set by hand to ÷ 1000/);
	assert.doesNotMatch(r.check!.message, /guess|assumed/);
});

test('a stated length alone → silence', () => {
	assert.equal(answer(form({ m100: '380' })).check, null);
});

test('the summary says when the figure was worked out from a count', () => {
	assert.match(answer(form({ millB: '2500' })).summary, /\(worked out from the count\)\.$/);
	assert.doesNotMatch(answer(form({ m100: '250' })).summary, /worked out/);
});

// ---- strands to reach a chosen category ----------------------------------------------

test('Super Bulky cannot be made heavier, so it gets no strands panel', () => {
	assert.equal(answer(form({ m100: '60' })).canHoldStrands, false);
	assert.equal(answer(form({ m100: '250' })).canHoldStrands, true);
});

test("a band's ceiling is the next band's floor, and Lace has none", () => {
	assert.equal(categoryMax(cat(6)), 90);
	assert.equal(categoryMax(cat(3)), 270);
	assert.equal(categoryMax(cat(0)), Infinity);
});

test('a range, because a category is a band', () => {
	// 2400 m/100 g of lace-weight: 9 strands give 267, 11 give 218 — both DK.
	assert.equal(
		strandsToReach(2400, cat(3)),
		'9 to 11 strands — about 267 to 218 m/100 g.'
	);
});

test('one strand where only one lands in the band', () => {
	assert.equal(strandsToReach(250, cat(3)), '1 strand — about 250 m/100 g.');
});

test('Super Bulky has no ceiling, so it is "or more"', () => {
	assert.equal(strandsToReach(2400, cat(6)), '27 strands or more.');
});

test('one strand already heavier than the target', () => {
	assert.equal(strandsToReach(120, cat(0)), 'One strand is already heavier than 0 Lace.');
});

test('a band too narrow to land in is said so, with the two counts that straddle it', () => {
	// 380: two strands give 190 (Medium), three give 127 (Bulky). Nothing is DK.
	assert.equal(
		strandsToReach(380, cat(3)),
		'Nothing lands in 3 Light (DK): 1 strand gives 380 m/100 g, 2 strands give 190.'
	);
});

test('a yarn exactly on a lower bound still takes two strands to leave its band', () => {
	const r = answer(form({ m100: '210' }));
	assert.equal(r.category.n, 3);
	assert.equal(strandsToReach(r.woolEquivalent, cat(5), r.metres), '2 strands — about 105 m/100 g.');
});
