/**
 * JSON-LD structured data.
 *
 * Search engines already have the title, description and canonical from `Base.astro`.
 * What they cannot infer is the *relationships* — that a pattern is an article by a named
 * person, published on a date, sitting two levels down a path. That is what this adds.
 *
 * Deliberately not HowTo: Google withdrew HowTo rich results for desktop and mobile in
 * 2023, so marking patterns up as HowTo buys nothing and constrains the wording.
 *
 * Everything here is derived from data the page already has. Nothing is hand-maintained,
 * so it cannot drift from what the page actually says — which is the usual way structured
 * data turns into a lie.
 */

const AUTHOR_NAME = 'Sophia';

export interface JsonLd {
	'@context'?: string;
	'@type': string;
	[key: string]: unknown;
}

/** The person behind the site. Referenced by every article rather than repeated inline. */
export function personSchema(site: URL): JsonLd {
	return {
		'@type': 'Person',
		'@id': new URL('/about/', site).href + '#person',
		name: AUTHOR_NAME,
		url: new URL('/about/', site).href,
	};
}

/** Human labels for path segments that would otherwise render as bare slugs. */
const SEGMENT_LABELS: Record<string, string> = {
	patterns: 'Patterns',
	journal: 'Journal',
	about: 'About',
	c: '',
};

const titleCase = (slug: string) =>
	slug.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

/**
 * Breadcrumbs from the URL path.
 *
 * `leafName` matters: the last crumb should read as the thing's title, not its slug —
 * "Öland Cardigan", not "Oland Cardigan". Everything above it is structural and safe to
 * derive. Returns undefined at the site root, where a one-item breadcrumb is noise.
 */
export function breadcrumbSchema(
	pathname: string,
	site: URL,
	leafName?: string
): JsonLd | undefined {
	const segments = pathname.split('/').filter(Boolean);
	if (!segments.length) return undefined;

	const items: JsonLd[] = [
		{ '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', site).href },
	];

	let path = '';
	for (const [i, segment] of segments.entries()) {
		path += `/${segment}`;
		// Route-only segments like /c/ are real URL structure but meaningless to a reader,
		// so they are skipped rather than shown as a crumb nobody can interpret.
		if (SEGMENT_LABELS[segment] === '') continue;

		const isLeaf = i === segments.length - 1;
		items.push({
			'@type': 'ListItem',
			position: items.length + 1,
			name: isLeaf && leafName ? leafName : (SEGMENT_LABELS[segment] ?? titleCase(segment)),
			item: new URL(`${path}/`, site).href,
		});
	}

	return { '@type': 'BreadcrumbList', itemListElement: items };
}

interface ArticleInput {
	type: 'Article' | 'BlogPosting';
	url: URL;
	site: URL;
	headline: string;
	description: string;
	datePublished: Date;
	dateModified?: Date;
	image?: string;
	keywords?: string[];
}

export function articleSchema(input: ArticleInput): JsonLd {
	const { type, url, site, headline, description, datePublished, dateModified, image, keywords } =
		input;

	return {
		'@type': type,
		headline,
		description,
		url: url.href,
		mainEntityOfPage: url.href,
		datePublished: datePublished.toISOString(),
		dateModified: (dateModified ?? datePublished).toISOString(),
		author: personSchema(site),
		publisher: personSchema(site),
		...(image ? { image: new URL(image, site).href } : {}),
		...(keywords?.length ? { keywords: keywords.join(', ') } : {}),
	};
}

/**
 * Serialise for a <script type="application/ld+json"> block.
 *
 * `<` is escaped because a `</script>` appearing inside any string — a title, a summary —
 * would close the block early and spill the rest of the JSON into the page as text.
 */
export function jsonLdToString(graph: JsonLd[]): string {
	return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
		/</g,
		'\\u003c'
	);
}
