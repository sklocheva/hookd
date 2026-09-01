/**
 * The Craft Yarn Council's Standard Yarn Weight System, number to category name.
 *
 * The name follows from the number, so only the number is typed. Having both invited the
 * contradiction it immediately produced: the first real review entered "CYC 3" and
 * "Worsted", which is category 4's name. Same reasoning as the hook sizes in hooks.ts —
 * a second field for a derivable value is a place to disagree with yourself.
 *
 * CYC has announced a Size 8 but has not published its specification, so it is absent
 * here rather than guessed at.
 *
 * Source: Craft Yarn Council, https://www.craftyarncouncil.com/standards/yarn-weight-system
 */
const CYC_WEIGHT_NAMES: Record<number, string> = {
	0: 'Lace',
	1: 'Super Fine',
	2: 'Fine',
	3: 'Light',
	4: 'Medium',
	5: 'Bulky',
	6: 'Super Bulky',
	7: 'Jumbo',
};

/** e.g. 3 → "Light". Undefined for anything outside the published table. */
export function cycWeightName(n: number | undefined): string | undefined {
	return n == null ? undefined : CYC_WEIGHT_NAMES[n];
}
