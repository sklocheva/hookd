/**
 * Crochet hook sizes, millimetres to US.
 *
 * The mm size is the only one an author should type. US letters and numbers vary between
 * manufacturers — the Craft Yarn Council's own advice is to rely on the mm marking — so a
 * second input field for the US size is a place to make a mistake, not a place to add
 * information. This table derives it instead.
 *
 * Three sizes in common use have **no US equivalent at all**: 2.5 mm, 7 mm and 12 mm.
 * That is the interesting case, and the reason `usHook` returns undefined rather than
 * guessing: a hand-typed field invites someone to invent "US 7" for a 7 mm hook.
 *
 * Source: Craft Yarn Council, https://www.craftyarncouncil.com/standards/hooks-and-needles
 */
const US_BY_MM = new Map<number, string | null>([
	[2.25, 'B-1'],
	[2.5, null],
	[2.75, 'C-2'],
	[3.125, 'D'],
	[3.25, 'D-3'],
	[3.5, 'E-4'],
	[3.75, 'F-5'],
	[4, 'G-6'],
	[4.25, 'G'],
	[4.5, '7'],
	[5, 'H-8'],
	[5.25, 'I'],
	[5.5, 'I-9'],
	[5.75, 'J'],
	[6, 'J-10'],
	[6.5, 'K-10½'],
	[7, null],
	[8, 'L-11'],
	[9, 'M/N-13'],
	[10, 'N/P-15'],
	[11.5, 'P-16'],
	[12, null],
	[15, 'P/Q'],
	[15.75, 'Q'],
	[16, 'Q'],
	[19, 'S'],
	[25, 'T/U/X'],
	[30, 'T/X'],
]);

/**
 * The US size for a hook in mm, or undefined when there isn't one.
 *
 * Undefined covers both "this size has no US equivalent" and "this isn't a standard size",
 * because the caller does the same thing in either case: say nothing rather than guess.
 */
export function usHook(mm: number): string | undefined {
	return US_BY_MM.get(mm) ?? undefined;
}

/** e.g. "4.5 mm · US 7", or just "7 mm" for a size with no US equivalent. */
export function hookLabel(mm: number): string {
	const us = usHook(mm);
	return us ? `${mm} mm · US ${us}` : `${mm} mm`;
}
