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

/** A blank form with one row of wool, which is what the page starts as. */
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
	assert.equal(strandsToReach(r.woolEquivalent, cat(5)), '2 strands — about 125 m/100 g.');
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

test('380 m/100 g, 46% alpaca / 20% merino / 34% polyamide → 362 → 1 Super Fine; 2 strands ≈ 181 → 4 Medium', () => {
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
	assert.equal(strandsToReach(r.woolEquivalent, cat(4)), '2 strands — about 181 m/100 g.');
	assert.equal(r.summary, '46% alpaca, 20% merino, 34% polyamide at 380 m / 100 g.');
});

test('1402 m/100 g, 100% cashmere → 1391 → 0 Lace; 3 strands ≈ 464 → 1 Super Fine', () => {
	const r = answer(form({ m100: '1402', rows: [{ fibre: 'Cashmere', pct: '100' }] }));
	assert.equal(r.woolEquivalent, 1391);
	assert.equal(r.category.n, 0);
	assert.equal(strandsToReach(r.woolEquivalent, cat(1)), '3 strands — about 464 m/100 g.');
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
	assert.equal(
		answer(form({ m100: '380', millA: '2', millB: '28' })).check?.message,
		'Count gives 1400 m/100 g, label says 380. Check the divisor.'
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

test('an empty blend is refused, not divided by zero', () => {
	const r = calculate(form({ m100: '250', rows: [{ fibre: 'Wool', pct: '' }] }));
	assert.deepEqual(r, { ok: false, message: MESSAGES.needsTotal });
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
	assert.equal(r.check?.message, 'Count gives 300 m/100 g, label says 380. Check the divisor.');
	assert.equal(r.metres, 380);
});

test('count only → a caution, worded by whether a divisor was applied', () => {
	const guessed = answer(form({ millB: '2500' }));
	assert.equal(guessed.check?.tone, 'caution');
	assert.match(guessed.check!.message, /^No stated m\/100 g, so the divisor is a guess/);

	const plain = answer(form({ millA: '2', millB: '48' }));
	assert.equal(plain.check?.tone, 'caution');
	assert.match(plain.check!.message, /^No stated m\/100 g — this comes from the count alone/);
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
	assert.equal(strandsToReach(r.woolEquivalent, cat(5)), '2 strands — about 105 m/100 g.');
});
