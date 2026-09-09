import type { CollectionEntry } from 'astro:content';

/**
 * Scoring, in one place because two code paths compute it.
 *
 * The page renders every question and every outcome server-side; the client script then
 * hides all but the current question and scores the answers as they are picked. Both
 * paths call `scoreQuiz`, so the answer a reader is shown can never depend on which one
 * ran. The client copy is this same source, bundled into the island — not a second
 * implementation kept in step by hand.
 */
export type QuizData = CollectionEntry<'quizzes'>['data'];
export type QuizOutcome = QuizData['outcomes'][number];

/**
 * The outcome an answer set produces.
 *
 * Points are summed per outcome id across every answered question — the maps are sparse,
 * so an option contributes only to what it names. Highest total wins.
 *
 * **Ties resolve to whichever outcome is declared first**, which is why the order in the
 * content file is part of the content and not an accident of authoring. Declare the least
 * drastic outcome at the top: a quiz that cannot make up its mind should not be the thing
 * recommending the irreversible option.
 *
 * `answers[i]` is the index of the option picked for question `i`, or `-1`/undefined
 * where it has not been answered yet — an unanswered question simply scores nothing, so
 * a partial set still resolves.
 */
export function scoreQuiz(quiz: QuizData, answers: readonly number[]): QuizOutcome {
	const totals = new Map<string, number>(quiz.outcomes.map((o) => [o.id, 0]));

	answers.forEach((choice, i) => {
		const option = quiz.questions[i]?.options[choice];
		if (!option) return;
		for (const [id, points] of Object.entries(option.score)) {
			// Unknown ids cannot reach here — the schema fails the build on a score key
			// that names no outcome — but reading through the map keeps this total-safe.
			if (totals.has(id)) totals.set(id, totals.get(id)! + points);
		}
	});

	return quiz.outcomes.reduce((best, o) =>
		totals.get(o.id)! > totals.get(best.id)! ? o : best
	);
}

/** The eyebrow's second line, e.g. "6 questions · about a minute". */
export const questionCountLabel = (quiz: QuizData) =>
	`${quiz.questions.length} question${quiz.questions.length === 1 ? '' : 's'} · about a minute`;

/**
 * The answer tags down the left of the options.
 *
 * Letters rather than numbers so they never read as a ranking, and capped at five
 * because the schema caps a question at five options.
 */
export const ANSWER_TAGS = ['A', 'B', 'C', 'D', 'E'] as const;
