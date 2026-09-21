# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hookd — personal crochet blog

A static site publishing crochet patterns and write-ups of yarn, fibre and stitch tests.
Not a shop: no cart, no payments, no accounts. Anything sold is sold off-site, on Ravelry.

**The site does not call its patterns free.** It used to — in the nav, in every page title,
and in an eyebrow reading "free, always" on every pattern page. That was removed once the
author decided some larger patterns may later be sold as PDFs: a promise printed on every
page is expensive to walk back, and "free patterns" as a label read cheap besides. Individual
patterns are still free, and the licence block says so per pattern; the *site* no longer
makes the claim on their behalf.

## Stack — decided, do not substitute

- Astro, TypeScript
- Sveltia CMS at /admin for browser-based publishing
- Cloudflare hosting, free tier
- No database, no server, no auth

The Cloudflare project is a **Workers** project (`hookd-blog.sklocheva.workers.dev`), not
Pages. The dashboard flow now steers new projects to Workers; the decision was to stay there
because push-to-deploy works and nothing here needs what Pages does differently. Hosting is
still static assets only — there is no server process, and that constraint is load-bearing
(see Deployment).

## Commands

- `npm install` — first run only
- `npm run dev` — local dev server at http://localhost:4321
- `npm run check` — `astro check`; type-checks what the build does not. Must pass before pushing
- `npm run build` — production build into `dist/`; must pass before pushing
- `npm run preview` — serve the built `dist/` locally

There is no linter. The checks that exist are:

- `npm test` — Node's built-in runner over `src/**/*.test.ts`, no dependency. It covers the
  yarn weight calculator's arithmetic and nothing else; see Architecture. CI runs it after
  the build.
- `node .claude/skills/run-hookd/driver.mjs audit` — builds, serves, and drives all routes
  in headless Chrome at 375px and 1280px: overflow, one `<h1>`, content present without JS,
  tap targets, contrast, the label floor, internal links. **Run this before pushing.** CI
  runs it too, so an `/admin` commit meets it — but CI only reports afterwards.
- `python scripts/check-cms-config.py` — the CMS form and the Zod schemas have not drifted.
- `node scripts/check-image-sizes.mjs` — no committed image is over 2000px on the long edge.
- `node scripts/check-external-links.mjs` — links that leave the site still resolve. Run after
  a build; weekly in CI. Fails only on 404, 410 or a host that does not resolve — a 403 from a
  bot-blocking site is a warning, or the weekly email would cry wolf.
- `verify-deploy` skill — the deployed site, after a push.

Note that `astro build` does **not** type-check — `npm run check` is what does. `tsconfig.json`
extends `astro/tsconfigs/strict`, but nothing enforced it until that script existed, and its
first run found four real errors on a green build. Errors are the gate; the ~65 *hints* are
mostly `z is deprecated` noise from Zod 4 and are not worth chasing.

**A cleared field is not an absent one.** Emptying something in `/admin` writes `null` or
`''` rather than dropping the key, so a schema that requires the value rejects the entry — and
a save from the browser can break the whole build. It has happened: clearing one judgement on
a review failed the build, Cloudflare deployed nothing, and the old site kept serving. Every
optional field must accept blank as absent. **The Action caught that one** — it is the only
thing that does.

**The CMS writes blank three different ways, and every one of them has broken a build.**
`''` for an untouched text field, `null` for a number, and `null` for an *object* the author
never opened. `optionalString`, `optionalNumber`, `optionalUrl` and `blankToUndefined` in
`src/content.config.ts` normalise all of them to undefined. The rule that generalises them:
**if the panel can leave a field blank, the schema has to accept blank** — a required field
in front of unfinished work does not protect the data, it stops the site building.

This has now happened five times. The fifth was a **reference**: clearing the related-post
picker writes `relatedPost: ''`, which satisfies `reference()` — it only checks the value is
a string — and then the resolver looks for an entry whose id is the empty string and logs
"Invalid content reference" during the build. `blankToUndefined` fixes it, and `dropBlanks`
does the same for a cleared row inside a list of references.

Before that it was `ravelryUrl` and `pdfUrl`: `.url()` rejects
`''` just as `.date()` and `.number()` do, and publishing the first real pattern failed on two
fields nobody had touched. **A `.default()` does not save you** — a default fills in for
`undefined` only, so `bodyChartUrl: ''` was validated as a URL and failed while carrying a
perfectly good default. Every optional field has been swept; the wrappers are the only
correct way to add another.

**Zod here is version 4, and its API differs from the Zod 3 examples in the wild.** A custom
message is `.refine(check, { error: (issue) => '...' })`. The Zod 3 form — a second *function*
argument — still type-checks as a params object, silently drops the message, and the author
gets `Invalid input` instead. That defeats the point of the required-SEO-field errors, which
exist to tell the author exactly what to fix.

## Architecture

Small by design. The parts that matter are the ones that span files:

**`src/layouts/Base.astro` is the single SEO chokepoint.** It owns `<head>`, and its `Props`
interface makes `title` and `description` required, so a page cannot render without them.
Every page goes through it. Meta description, canonical and the sitemap link live here and
nowhere else.

**`site` in `astro.config.mjs` is the source of truth for absolute URLs.** `@astrojs/sitemap`
reads it to emit `<loc>` entries, and `Base.astro` derives the canonical `<link>` from it via
`Astro.site`. It is duplicated by hand in one place — the `Sitemap:` line in
`public/robots.txt`. **Changing the domain means editing both files together**, and this will
have to happen again when a custom domain is attached.

**`wrangler.jsonc` is what keeps the deploy static.** It declares the Worker name and
`assets.directory: ./dist`. Without it Cloudflare infers a config and builds Astro in server
mode, which breaks every image. Do not delete it. See Deployment.

**The gallery is the top of the pattern page**, because the photographs are what sell a free
pattern. `heroImage` is frame one — the same image cards and shares use — and `gallery` follows
it, with a five-column thumbnail strip exactly as wide as the frame. Every photo renders in the
HTML and the script only *hides* the inactive ones, so with JavaScript off the reader still sees
all of them. Posts carry the same field; the design only specifies it for patterns.

**Photography is placeholder apart from the cat-toy post**, which carries five real photographs
and is the only end-to-end proof that the image pipeline works on real files.
`PhotoPlaceholder.astro` draws the striped stand-in and
its caption doubles as the shot list — it is scaffolding, to be deleted when real images land.
`PhotoPending.astro` is different: it is the *designed* state for a pattern that is written but
not yet shot, triggered by omitting `heroImage`, and it ships. Same for the dashed wordmark box
in `Header.astro` and the social stubs in `Footer.astro`, both marked in the source.

**A comma inside `- { key: value }` silently eats the rest of the line.** That is a YAML
flow mapping: the comma ends the entry and the remainder parses as a further key, which Zod
strips as unknown. No error anywhere. A yarn quantity read "666 g in all" on the page while
the file said "666 g in all, measured — 11 g per block", and 26 rows across three
hand-written patterns had lost text this way. Entries written from `/admin` are safe because
Sveltia quotes what it writes; this only bites hand-authored files. Write those as block
mappings with quoted values, and `check-cms-config.py` now fails on the flow form.

**An entry file must carry the extension its collection declares.** `patterns` and `posts`
are `extension: mdx`, `reviews` is `md`. Astro's glob loader takes `.md` and `.mdx` alike, so
a mismatched file builds, renders and goes live perfectly — and Sveltia never lists it, because
it only shows files matching the declared extension. Three entries were invisible in `/admin`
this way, two of them whole patterns, with nothing to report it but the author noticing she had
fewer entries than she had written. `check-cms-config.py` now fails on a mismatch.

**The CMS and Astro disagree about paths, and two files reconcile them.** Sveltia requires an
absolute `public_folder`, so it writes `/src/assets/photo.webp` — which Astro treats as a
public URL and leaves alone, so the image 404s. `src/lib/images.ts` translates that for
`heroImage` in frontmatter; `src/lib/remark-cms-images.mjs` does the same for images in the
body. Both exist for one reason and break the same way. **`@astrojs/markdown-remark` is a
direct dependency for the second one alone** — nothing imports it by name, so it looks
removable, and it is not: since Astro 7.3 the default Markdown processor is Sätteri, and
`remarkPlugins` only runs on the unified processor that package provides. Without it the
build fails in config validation, before a page is rendered. Sveltia also formats dates with
**Day.js** tokens (`YYYY-MM-DD`) — date-fns style silently writes garbage like `yyyy-08-We`.

**A draft says so on the page.** `DraftNotice.astro` renders at the top of any entry still
marked draft, with the time the page was built. That timestamp is what makes a draft usable as
a preview: save in `/admin`, follow the link to the page, and the stamp says whether the build
has caught up with the save yet.

**A draft is unlisted, and is not served at its real URL.** `src/lib/drafts.ts` is the single
place this lives. A draft is absent from the homepage, both indexes, the filter routes, the
related strip, the feed and the sitemap; and it is built at its `previewId` — a UUID the CMS
generates on creation — so the URL it will eventually own returns 404 until it is published.
Publishing moves it to its real slug, which is the point: a published pattern is meant to be
found, and a random string is not what belongs in a search result. Nothing links to the
preview address, so nothing breaks when it stops resolving.

**This hides drafts from readers, not from the world.** The repository is public — the
frontmatter, the `previewId` and the unfinished prose are all readable on GitHub. What it
defends against is someone browsing the site or trying the obvious URL. A draft that genuinely
must not be seen has to stop being built at all, which means a second Worker or a branch, not
a schema change.

**`/go/<previewId>/` is the address `/admin` links to**, not the page itself.
`preview_path` is one template per collection and cannot ask whether an entry is a draft, so a
link to either address would break in one of the two states. The `/go/` page forwards to
whichever is live — a meta refresh, because static hosting has no server to issue a 3xx. It is
keyed on the preview id and never on the slug: a guessable address that redirects to a draft
would leak exactly what the id exists to hide.

**The sitemap filter is an allowlist.** `astro.config.mjs` reads frontmatter and admits only
the slugs of *published* entries under the three entry routes. It was a blocklist of draft
slugs, which silently stopped matching when the addresses changed and had never covered the
reviews collection at all — two draft yarn notes went live in the sitemap carrying `noindex`,
which is the exact contradiction that code exists to prevent. An address it does not
recognise is now dropped rather than published.

**Nothing may link to an entry by a hand-typed URL.** The homepage's pinned slots did, and
two of the three pointed at a 404 the moment drafts moved. They are keyed on the entry now and
resolved against the published set, so an unpublished or renamed pick drops out of the
rotation instead of breaking it.

**A pattern's instructions are structured data, and one template serves both designed
variants.** `PatternInstructions.astro` renders how-it-is-written, abbreviations, special
stitches, the sections, and finishing. Nothing declares which variant a pattern is: **more
than one size gets the sticky size picker, one size gets a static band.** An accessory that
later gains sizes needs no change.

**`categoryMax` reads `CATEGORIES` backwards if you use `find`.** The list runs thinnest
first, so the band *above* a category is the last entry with a higher floor, not the first —
`find` returns Lace for everything. It is a `reduce` for that reason. This is what
`strandsToReach` depends on, and getting it wrong made every answer plausible and wrong.

**No schematic, no stitch chart, no photo tutorial — ever.** Those are the paid PDF on
Ravelry, and this is the free page. Adding a chart block "for completeness" gives away the
thing being sold.

**Per-size numbers are substituted, never calculated.** Instruction text writes `{neckCh}`
once and each size supplies its value in `sizes[].values`; `src/lib/pattern-sizes.ts` does
the substitution and the picker rewrites the spans in place. The reader sees exactly one set
of figures — nothing crossed out, no `(84, 92, 100, 108)` to count along. **The site owns no
pattern maths.** The design derives its garment's counts from a raglan formula, and that is
a fact about that cardigan, not about patterns: a beanie shares none of it. The arithmetic
belongs in the author's grading spreadsheet; this stores the answers. A `{key}` with no value
in some size **fails the build at publish**, naming the size and the key, because otherwise a
maker reads a brace where a stitch count should be.

The picker is progressive enhancement on the same terms as the homepage rotator: one whole
size renders server-side — the middle one, so a reader with no JavaScript gets a usable
pattern rather than the smallest — every size ships as JSON, and `?size=L` deep-links.

**A pattern with one size gets no size table.** There is nothing to choose between, and a
one-row table under a heading asking "Choosing your size" asks a question that does not
apply — accessories and home pieces do not have to fit anyone. The dimensions move into the
spec block as **Finished size**, in plain text, with `sizeNote` (or the ease, as a fallback)
as the line beneath. Keyed on the size count rather than on the category, so a one-size
garment is handled too: it still states its ease, it just has no chart.

**A quiz question can carry a photo** — `image` and `imageAlt` on the question, for
questions about something you can see ("which fibre is this?"). Resolved through
`src/lib/images.ts` like every other photo, so a wrong path fails the build. **The alt text
must describe what is visible, never name the answer** — alt text for a guess-the-fibre
question that says "mohair" reads the answer to a screen-reader user before they have
chosen. It is required at publish, not at save. The photo's height is capped so a
four-option question still fits a phone screen.

**Tools are a section of their own, and the yarn weight calculator is the first.** `/tools/`
is a plain list and `/tools/yarn-weight/` is the calculator; a second tool is a page under
`src/pages/tools/` plus one entry in the list. The reader types a label or a yarn count and
a fibre blend and gets the Craft Yarn Council category. Three things about it are not
obvious from the code:

- **The arithmetic lives in `src/lib/yarn-weight.ts` and nowhere else.** It has no DOM and no
  Astro, so `src/lib/yarn-weight.test.ts` can call it — and that file *is* the specification:
  the values in the design brief (`6 / 15000` wool → 250 m/100 g → 3 Light, and the rest) are
  its first block. If a refactor breaks one, the refactor is wrong. The numbers themselves
  come from the author's spreadsheet (`yarn_weight_calculator.xlsx`); the tables are copied
  from it, not rounded, so change the spreadsheet and this together.
- **It is not a `client:load` island, because there is no UI framework here.** The form, every
  counting system's field and the four caveats are server-rendered and the script only reads
  the form, calls `calculate` and shows or hides — the same arrangement as the quiz, and for
  the same no-JS rule. Without JavaScript it says it cannot do its sums instead of showing
  a button that does nothing. The caveats stay either way.
- **It answers as you type, and there is no button.** There was one: nothing was worked out
  until it was pressed, and everything followed each edit afterwards, so the same form
  behaved two ways depending on whether you had pressed it once. The author found that
  inconsistent and it went. Keystrokes render after a 350 ms pause, so "380" does not flash
  through 3 m/100 g (refused) and 38 (Super Bulky) on the way, or announce them. The result
  region is `aria-live="polite"`, which the design file lacks. Wool-equivalent and blend
  density are deliberately never shown.
- **When the form stops describing a yarn, two things happen on two clocks.** *The answer
  stops claiming to be current at once*: the last good answer dims and a neutral line says
  what it is waiting for ("Out of date — waiting for the percentages to add up to 100").
  *The reader is told something is wrong only when focus leaves the group it is about* — the
  length fields, or the blend as a whole (`data-yw-group`, `settled`) — or at once for a
  deliberate click such as a divisor chip or a counting system. The first version waited on
  both, and a cold read found an undimmed, confident answer for a yarn the reader was no
  longer describing, which was the worst thing on the page. The second clock is what the
  button used to protect: 46 / 20 / 34 passes through 46 and 66, and leaving one percentage
  box for the next is not leaving the blend.
- **Step 2 starts empty, and there is no answer until a fibre is chosen.** It was pre-filled
  as 100% wool, and readers who typed a length saw an answer at once and never looked at
  step 2 — every cotton and alpaca was being worked out as wool. The waiting panel says what
  is still missing ("Now choose what it is made of, in step 2"). Two rules keep it from
  being a chore, both in `effectiveRows`: a row with neither fibre nor percentage is not
  there, and **one fibre with no percentage is all of it** — the box shows that 100 as its
  placeholder. With two fibres a blank is not assumed.
- **On a phone the answer is pinned to the foot of the screen while it is out of view** —
  `.peek`, one line, driven by two IntersectionObservers. The button used to scroll the answer
  into view; without it, a reader typing at the top of a phone screen had an answer changing
  a screen below them with nothing to say so. It shows while there is an answer, the form is
  on screen and the answer panel is not — so on a desktop, where the panel is sticky beside
  the form, it never appears — and says "out of date" when the answer is. It does not scroll
  the page itself: moving the page under someone's thumb while they type is worse than the
  problem.
- **Strand counts are chosen on the wool-equivalent and shown in the reader's own
  m/100 g.** The page says the length divides by the number of strands; a reader with
  380 m/100 g checks that two strands make 190, and the wool-equivalent version said 181. The
  band chosen is the same either way (the fibre correction is a multiplier, so it commutes
  with the division), so only the display changed — and the brief's §8 figures for strands
  are pinned in the tests in the reader's terms, with a note.
- **Every message says which figure was used and what to do.** The cross-check used to end
  "Check the divisor", and a reader whose real problem was a leftover length from the
  previous yarn went looking for a setting she could not name. It now says the answer uses the
  metres box and to clear it if the count is the one to trust. A divisor set by hand is never
  called "a guess". The divisor chips are labelled "Divisor" on screen, and the toggle keeps
  the name "The count looks wrong" when open — it used to become "Hide", so the messages
  pointing at it pointed at nothing.
- **The yarn count section is shut by default and its fields are ignored while it is.** A
  reader with a ball band has metres and needs none of it; a reader with a cone does. Open, it
  was more than twice the height of the field above it, so the fallback path looked like the
  main one. Shutting it means "this does not apply to me", so a value left inside cannot
  contradict the label from somewhere the reader cannot see it.

**It is a "yarn count", never a "mill count".** The latter was a coinage and is not a term of
art, so a reader who searched for it found nothing. *Yarn count* (or just *count*) is what the
trade, weavers, machine knitters and cone sellers all say; Nm is the *metric count*, and the
count is also what `tit.` means on an Italian cone.

**A length no yarn has is refused before the category lookup.** Every figure has *some*
category — `categoryFor` returns Super Bulky for anything down to zero and Lace for anything
above 550 — so a wrong answer was printed as confidently as a right one, in 86px type. A
first-time reader forced the divisor to ÷ 1 on a cone marked `NM 2000`, got 200,000 m/100 g,
and was told **0 Lace**: six categories from the truth. The guard is on the *length*, between
10 and 30,000 m/100 g, which is wide enough to pass the finest thread the tool claims to
handle and narrow enough to catch a divisor off by a power of ten. It blames the divisor on
`input.divisor !== 'auto'`, **not** on `divisor !== 1` — the case that prompted it is a
divisor forced *to* 1.

**The result states CYC's recommended hook, quoted rather than derived.** Each entry in
`CATEGORIES` carries its hook as one string copied from the CYC yarn weight table. Deriving
the US range from the mm range through `src/lib/hooks.ts` very nearly works and is wrong in
two places: "M/N-13" where CYC prints "M-13", and "P/Q" where it prints "Q". Lace isn't a plain
range either (steel hooks plus a regular 2.25 mm), which is why it is a string. The author
asked for it plainly, as a spec row with no swatch wording. The caveats already say the
category is a starting point, so the hook is one too. CYC's gauge column is deliberately not
shown: gauge is the input the brief rules out, and CYC gives Lace's gauge in double crochet
and every other category's in single crochet.

**The published mill data is a test; the author's stash is not.** The ten ColourMart and
JaggerSpun yarns from the spreadsheet's Reference tab are pinned in `yarn-weight.test.ts`.
They are public product data, and the two lofty cashmeres are pinned at the calculator's
answer rather than the seller's. The Yarn Stash Tracker comparison was run separately on
21 Sep 2026 and kept out of this public repo: 25 yarns, 14 agree. The three largest misses
were all brushed yarns, which the first caveat already covers. Two of the others were
contradictions in the tracker itself: Snorre and Karisma have identical inputs but different
recorded categories, and Safran and Catona are recorded in the wrong order. A beaded yarn is
refused, and the author decided to keep it that way.

**A stated m/100 g picks the divisor, but only when it reconciles the count.** With one, the
divisor is whichever power of ten brings the two together — which is right in both places the
flat "printed ≥ 300 → ÷ 1000" rule fails, namely yarn under 30 m/100 g and thread finer than
Nm 300. The catch is that rounding a logarithm always yields *some* power of ten, so a count
and a label that genuinely disagree get one anyway and the cross-check then reports a figure
bent toward the label: `2 / 28` against a stated 380 was divided by 10 and reported as 140
rather than its honest 1400. The inferred divisor is therefore adopted only when it brings
the two within the same 5% the cross-check uses. **The flat rule is the fallback, not the
default.**

**A message that needs attention gets a heading, a mark and a tint — never colour alone.**
The cross-check and "Not yet" panels shipped as a white fill with a 3px bar and read as one
more note beside the result. They now carry an uppercase heading naming the problem ("These
two do not agree" / "Worth confirming" / "Not yet"), a small ringed `!`, a 4px bar and
`--alert-warning` or `--alert-caution` — the site's own accents at about 12%. No red banner:
the type is unchanged and the tints are the existing hues. `--ochre-text` exists because
`--ochre` is 4.15:1 on the warning tint and 4.45:1 on the caution one, so both missed AA;
this one value clears it on the tints, the paper and the panel alike.

The "Total N%" warning is `--terracotta` on the paper, which measures 4.61:1. The brief asks
for a darker `--terracotta-text` because it measured 4.32:1 *on the panel fill* — but that
readout does not sit on the panel, so no new token was added. Move it onto a panel and it
needs one. `--field` and `--field-border` are new: the input fill and edge the brief lists as
literals.

**The form has one left edge, one spacing scale, and columns that do not resize.** All three
came out of a cold usability read, and all three are easy to undo by accident:

- **Step numbers sit above their headings, not beside them.** Inline, the numeral held the
  x=0 slot and pushed the heading 21px right of every other element in the column — and since
  the heading is the heaviest thing there, it read as a misaligned heading rather than as a
  numeral in a gutter. There is no room to hang one properly at 375px.
- **The gaps are 8 / 16 / 24 / 40 and nothing else.** They were 6, 19, 8, 6, 24, 22, 8, 6, 13,
  38, 6, 19, 12, 38 — nine values, no two of which meant anything different to a reader.
- **`--pct-w` and `--rm-w` are shared** by the fibre row, the percentage box and the total
  beneath them, so the three cannot drift. The remove button keeps its column even when
  invisible (`.is-hidden` is `visibility`, not `hidden`): removing it from the layout resized
  the row beside it, and at 375px the fibre select dropped 215px → 155px the instant a second
  fibre was added, clipping "Bamboo viscose" to "Bamboo visco" in a row already filled in.
  **Both values are as tight as their contents allow** — every pixel taken comes off the
  fibre name, which needs 127px at 375px.

**A problem keeps the last good answer on screen, dimmed.** The whole answer block dims —
category, cross-check and strands — not just the top panel. Blanking it on every keystroke
punished the reader for typing, because 34 cannot become 50 without passing some wrong
number. Clearing the length or emptying the blend is different: that is a fresh start rather
than a mistake, so it goes back to the waiting panel.

**A warning appears twice, deliberately: under the fields it is about, and in full beside the
answer.** On a phone the answer is a screen away. The metres box and the count each have a
`.field-error` that **takes the place of that field's hint** rather than appearing beneath it:
beneath, it arrived just as focus reached the first fibre and pushed that menu 57px down under
the pointer. The blend has its own line too. It used to rely on the total alone ("Total 96% —
needs 100"), which wrapped to three lines in the 96px percentage column. The box concerned is
outlined as well, but never as the only signal: the words name the field.

**A rule separates the page intro from step 1.** Without it, the intro's last line, "Step 1"
and the first question stacked into a single column of text, and the heading read as though
it ran on into the form. It is full width so it spans the answer column too. It is the same
rule the quiz page uses between its title block and the quiz.

**The caveats sit beneath the whole tool, full width, and there are three.** The brief put
four beside the result. That made the answer column nearly as tall as the form, so the sticky
answer barely moved, and the author found the column cramped and cluttered. She asked for
them underneath instead. "Where the divisor gives up" moved into the divisor panel, the only
place it applies. At the top of the page, "thread finer than Nm 300" was the most
intimidating line a ball-band reader met before typing anything. The section lives outside
`.yw`, so it cannot use the `--s1`–`--s4` spacing tokens defined there. It uses literal sizes;
with the tokens they silently resolved to nothing, and the caveats ran together on a phone.

**Routes.** `/`, `/patterns/`, `/patterns/[slug]`, `/journal/`, `/journal/[slug]`, plus
`/patterns/c/[category]` and `/journal/c/[kind]` behind the index filters. The filters are real
static routes rather than client-side filtering, because of the no-JS rule. Both indexes use
the **same text-link treatment** — pill toggles with counts were tried and reverted, because
two index pages with two different filter treatments is worse than the thing it solved.

**`Base.astro` also owns JSON-LD.** Pages pass `jsonLd` (Article, BlogPosting); breadcrumbs are
derived from the path there. Anything `noindex` emits none, so a draft never ships structured
data describing a page crawlers are told to ignore. Builders live in `src/lib/schema.ts`.

**They are yarn *notes*, never reviews.** The author is writing down what a yarn did, not
scoring it. `YARN_KIND` in `src/lib/taxonomy.ts` is the single place that word lives.

**Yarn notes are a third collection and a second journal template.** A test note is an
essay with tables in it; a review is a spec sheet with a short essay at the end, so almost
none of the fields overlap and it gets its own schema at `/journal/yarn/[slug]`. Both list
together on `/journal/` — `src/lib/journal.ts` normalises the two into one row shape, which
is why `JournalList` takes entries rather than a collection. Yarn notes have no `kind` field
but file under `YARN_KIND`, so they group like everything else; `allJournalEntries` is the one
function both the index and the kind routes read, so they cannot disagree about what the
journal contains.

## Content model

Two collections, both with Zod schemas in `src/content.config.ts`. Example entries live in
`src/content/` — they exist to exercise the schemas and should be replaced by real ones.

**patterns** carries structured data, not prose: yarn (brand, line, fibre content, ball
weight and length, CYC weight category), hook size in mm only, one gauge, difficulty
(Basic/Easy/Intermediate/Complex), sizes with free-form finished measurements and the body
measurement each size is cut for, yardage per size, US/UK terms.

**posts** is looser: title, date, summary, hero image, tags.

### Rules

- **SEO fields are required on both collections**: meta description (max 160 chars), hero
  image alt text, social share image. The build MUST fail if any is missing. This is
  deliberate — it replaces an SEO plugin with an error.
- **One gauge, measured on the actual piece after blocking.** This was two fields — swatch
  and piece — on the grounds that they genuinely differ, which they do. But only the piece
  number is ever measured here, and a field filled in by copying the other one is worse than
  no field. What the pair was carrying is a *warning*, not data: a 10 cm square held flat
  behaves nothing like a panel hanging off a shoulder. That now lives in the gauge `note` and
  in the callout on the pattern page. **Keep the warning.** A maker cannot measure a piece
  they have not made yet, so the pattern has to tell them how to swatch to match the number.
- **A review states the hook twice: what the band says, and what the author used.** They
  differ often and the difference is the useful part, so they are two rows rather than one
  with a parenthesis.
- **Hook size is typed in mm only; the US size is derived** in `src/lib/hooks.ts` from the
  Craft Yarn Council table. US letters vary by manufacturer, and 2.5, 7 and 12 mm have **no
  US equivalent at all** — an input field for it invites an invented answer. `usHook` returns
  undefined for those and the page shows just the mm. **3 mm is one of them**: CYC's table
  jumps 2.75 → 3.125 → 3.25, so a 3 mm hook correctly shows no US letter. It is listed in the
  map as an explicit null, because otherwise its absence looks like a gap in the map.
- **A pattern has several categories, stored as lowercase slugs** (`clothing`, `accessories`,
  `pets`, `home`). A hooded scarf is genuinely both clothing and an accessory, and a single-select
  field files it wrong either way. Display labels live in `src/lib/taxonomy.ts`, never in
  content, so renaming one touches no entry and no URL. Unused values are hidden from the
  filter row on both indexes, so a section is offered only when there is something behind it.
  `pets` and `home` stay in the enum and appear the moment a pattern is filed under them.
- **Finished measurements are author-named label/value pairs, not fixed bust/length columns.**
  A hat needs circumference and depth; a blanket needs nothing. The size table builds its
  columns from the labels used, so keep a label spelled identically across every size or it
  becomes two columns. Each size also carries `fitsBodyCm`, the body it is cut for, shown
  next to the finished numbers so a maker sees the ease instead of calculating it.

### Yarn reviews

- **A review's judgements are six fixed keys, not a free list** (stitch definition, split
  resistance, softness, next to skin, drape, frogging), each a 1–5 score *and* a sentence.
  Fixed so two reviews can be read against each other; the sentence is required because a
  score with no reason is an opinion with a number stuck on it.
- **More bars is always better** — the one exception is drape, which runs structured to fluid.
  The rows were named "Splitting" and "Itch" and scored the opposite way from their
  neighbours, so five bars meant excellent on one row and awful on the next with only the
  sentence to tell them apart. **Renaming a row inverts its meaning: migrate the scores
  (6 − n) at the same time**, or every existing review silently starts lying.
- **Softness and "next to skin" are different questions.** Softness is the hand; prickle comes
  from the small proportion of coarse fibre ends, not from average fineness, so a yarn can feel
  soft to squeeze and still scratch a neck. Merging them was considered and rejected.
- **Price is a 1–5 position, never a currency figure.** Prices change and vary by country; the
  position in the market does not.
- **A review's gauge is only ever unblocked vs blocked.** Washed and hung figures were tried and
  cut — they duplicate the blocked number and bury the comparison, which is the whole point.
- **A review's required fields are required to *publish*, not to save.** The CMS marks
  nothing required; a `superRefine` on the reviews schema enforces the list only when
  `draft` is false. A half-transcribed ball band saves and renders; unticking Draft fails
  the build with a line naming each gap. Rows with no value are simply absent from the
  page, which is the same rule the design already used for measurements never taken.
- **Provenance is two facts, not one.** `fibreOrigin` is where the fibre grew, `madeIn`
  where it was spun — frequently different countries. Both live on `origin`, its own object,
  because five provenance fields at the bottom of a twenty-field `yarn` block could not be
  found.
- **The badge list is fixed and ordered** in `src/lib/taxonomy.ts` — OEKO-TEX class, then
  GOTS, RWS, Mulesing-free, Recycled, Undyed — so two notes list them the same way whatever
  order they were ticked in. **Only OEKO-TEX, GOTS and RWS carry a footnote**: those three
  are routinely read as covering more than they do. The rest say what they mean.
- **Certifications are badges, and only ever positive ones.** OEKO-TEX and mulesing-free sit
  with the lede at the top; "Not stated" earns nothing, so silence on the label is silence on
  the page and a missing badge never reads as an accusation. The OEKO-TEX explanation sits at
  the foot of the page — badge as signal, fine print as fine print — and says what the mark
  covers rather than listing what it does not. A reader who wants the caveats can look it up.
- **`content` is the fibres and nothing else.** Ply belongs to the construction row, and
  superwash is implied by the care line; saying either twice invites them to disagree.
- **A review records the weight the label claims, plus WPI — no CYC number.** Bands disagree
  with the CYC scale and with each other (the first real review was sold as DK and printed
  "Worsted"), so storing a category meant deciding which was right. `weightLabel` quotes the
  band; `wpi` is the thickness measured rather than claimed, and settles it. Patterns still
  carry `cycWeight` — that is a pattern's own requirement, not a transcription.
- **Strand construction is a fixed type plus a free line.** The type (Singles, Plied,
  Cabled, Chainette, Roving) is what lets two reviews be compared; the line carries what
  the author sees on untwisting a length, which no category expresses.
- **A review with no photographs is a finished page**, not a broken one. Both image blocks drop
  out and nothing else moves. No placeholder art, no empty frame. **Alt text is therefore
  required for a photograph, not in advance of one** — the publish gate asked for
  `heroImageAlt` unconditionally and blocked a complete note that simply had no hero. Patterns
  are the opposite and require it either way, because there a missing photo is `PhotoPending`,
  a designed state that ships.
- US crochet terms throughout.

## Conventions

- Images go in `src/assets/` and use Astro's `<Image>` component. Never plain `<img>`.
- Nothing above 2000px on the long edge gets committed — git keeps every version of every
  binary forever. `/admin` uploads are resized in the browser; anything committed by hand is
  caught by `scripts/check-image-sizes.mjs` in CI.
- One `<h1>` per page.
- Mobile first. Check at 375px.
- **Colour and type come from the tokens in `src/styles/global.css`.** No colour
  literals in components — there are currently zero outside the token definitions, and
  that is worth keeping. Sizes used in more than one place get a `--type-*` token, so a
  change is one edit rather than seven.
- **There is one uppercase label size, 14px**, and it is a token — `--type-label` on one
  line, `--type-label-sm` where it wraps. **Size is only half of it: a label is `--ink-2` at
  0.06em tracking, never `--muted` at 0.09em.** The instructions section shipped with the
  artboard's lighter, wider setting and read noticeably smaller than the spec block at the
  identical size — light grey plus uppercase plus tracking is what does it, not the pixels. Eleven components had drifted to their own value
  between 11 and 12.5px, so a badge, a difficulty level and a spec label were three sizes
  of the same thing. Only two uppercase roles may differ, because they are not labels:
  `--type-nav` and `--type-prose-label`, both 14px too. Column heads are `--type-table-head`
  at 13px — a shade smaller on purpose, because they sit directly above their own data.
  **Raising the token is not enough on its own**: the eyebrow, the footer links and the
  social labels were 11px, 12.5px and 9.5px set by hand in their own components, and three
  successive raises of the token never touched them. Measure the computed sizes on a
  rendered page rather than grepping for a declaration — the audit's floor is 12px and it
  checks the render.
  Small uppercase with wide tracking is the hardest thing on a page to read, and passing
  contrast does not make it legible; anything below 11px is scaffolding that gets deleted.
- **The wordmark is live text, and it is `hookd.`** — Space Grotesk 500, all lowercase,
  tracked at −0.05em, with the full stop in `--terracotta`. Never another typeface, never
  sentence case, never without the stop. Tracking loosens to −0.04em at 19px and below,
  where −0.05em collides; the footer is set at 19px for that reason. Space Grotesk is loaded
  for this one purpose and `--wordmark` is the only place it may be used. Lora was here for
  the same single purpose and came out with it — nothing else on the site used it.
- Class naming is BEM-ish: `block__element`, `block--modifier`.
- Server-rendered HTML only. No client-side-only content — AI crawlers fetch JavaScript
  but do not execute it.

## Deployment

Pushing to `main` triggers a Cloudflare build and redeploy. It takes **roughly 60 seconds**.
There is no manual deploy step and no deploy command.

Things that have already gone wrong here, and cost real time:

- **A failed build is quiet, and a green one proves less than it looks.** Cloudflare *does*
  report to GitHub: every commit carries a `Workers Builds: hookd-blog` check run. It is a
  *check run*, not a commit *status*, so `commits/<sha>/status` shows a count of 0 and
  `deployments` is empty — which is how this file came to say, wrongly, that Cloudflare
  reported nothing at all. Read `commits/<sha>/check-runs`. It **does** go red on a failed
  build — first seen 19 Sep 2026, on three Dependabot PRs at once. Its limits: nothing emails you about
  it; and **green only means the build finished** — the `/_image` bug below came from a green
  build. A failed build leaves the previous version serving. The only proof a deploy is
  *right* is the live response; verify against something in it that actually differs.
- **Whether a commit is live has an answer now: `/version.txt`.** It carries the commit
  Cloudflare built from (`WORKERS_CI_COMMIT_SHA`; a local build says `local build`), so it
  changes on every deploy. `.github/workflows/deploy.yml` waits for each pushed commit to appear
  there, then smoke-tests the live site — a red `deploy` check means the commit never went
  live or went live broken, and GitHub emails you. By hand: `verify-deploy.sh --sha HEAD`.
- **Never trust that the host builds what this machine builds.** The same commit has produced
  different output locally and on Cloudflare. A green local `npm run build` is necessary, not
  sufficient.
- **Never let Cloudflare infer its own config — this cost the most time of anything here.**
  With no `wrangler.jsonc` in the repo, Cloudflare generates one: it takes the Worker name
  from `package.json` and auto-detects a framework setup that builds Astro in **server mode**.
  Server mode emits `/_image?href=...` URLs for `<Image>`, a runtime endpoint that 404s on
  static hosting — so every image breaks while the HTML still looks perfect, and the identical
  commit keeps building correctly on this machine. `wrangler.jsonc` now pins the name and
  `assets.directory`, which fixed it (commit `1f7691c`). If images render locally but 404
  live, check the `src` attribute for `/_image` first, then check that `wrangler.jsonc` is
  still there.
- **Read the build warnings, not just the errors.** The line that identified the above was a
  *warning* on a **successful** build: a Worker name mismatch between `package.json` and the
  project. It looked cosmetic and was the root cause.
- **Node version.** `.nvmrc` pins 24 so local and CI agree. Astro requires >= 22.12 and
  rejects odd-numbered majors (23, 25).
- **Pushing to GitHub uses `gh`, per-repo.** `credential.https://github.com.helper` is set
  locally to `!gh auth git-credential` (preceded by an empty value, which clears the inherited
  helper). Everything else on this machine goes through Git Credential Manager, the *system*
  helper. Check the URL-scoped key, not bare `credential.helper` — the bare key is empty here,
  and reading only that produced a confidently wrong conclusion once.
- **Push from PowerShell.** `gh` is not on Git Bash's PATH, so the helper cannot run there and
  the push fails with `gh: command not found` then "Invalid username or token".
- **The gh token now carries `workflow`**, so `.github/workflows/` can be pushed. It did not
  before, and a push touching CI is rejected without it: "refusing to allow an OAuth App to
  create or update workflow". Nothing else about pushing needs it.
- **`gh auth refresh` does not work here** — it reports "not logged in to any hosts" even
  though `gh auth status` shows a valid login, because the token is in the Windows keyring
  rather than in `hosts.yml`. Use `gh auth login ... --scopes workflow` instead. **The grant
  and the token are separate**: github.com can show the permission granted while the current
  token still lacks it, because scopes are frozen when a token is issued. Re-check
  `gh api -i user` a minute later rather than concluding it cannot be done — that mistake
  deleted a working CI workflow once.
- **CI runs `npm run check`, `npm run build`, the CMS parity script, the image-size check
  and the full audit** on every push and pull request, in `.github/workflows/build.yml`. It
  cannot stop Cloudflare; it puts a red X on the commit and **emails you**, which
  Cloudflare's own check does not — and it is the only guard on entries published from
  `/admin`, which reach `main` with nobody watching a terminal. The audit runs Chrome with
  `--no-sandbox` on CI only: Ubuntu 24.04 blocks the user namespaces Chrome's sandbox needs.
- **`.github/workflows/weekly.yml` checks what breaks without a commit** — Mondays 06:00 UTC:
  the live site serves the tip of `main`, the audit, and external links (Google Fonts, the
  unpkg script `/admin` loads, links in posts). Failure emails whoever last edited its
  `cron:` line. **Dependabot** batches updates into a PR a month per ecosystem (npm, Actions),
  with an npm *major* on its own; every one runs the full CI, so green is safe to merge.

## Out of scope

- Ecommerce, carts, payments
- User accounts or auth
- Comments (decided against at launch)
- Anything requiring a database or a server process
