# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hookd — personal crochet blog

A static site publishing free crochet patterns and write-ups of yarn, fibre and stitch tests.
Not a shop. Selling happens on Ravelry, never here.

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

There is no linter, and no unit-test runner. The checks that exist are:

- `node .claude/skills/run-hookd/driver.mjs audit` — builds, serves, and drives all routes
  in headless Chrome at 375px and 1280px: overflow, one `<h1>`, content present without JS,
  tap targets, contrast, the label floor, internal links. **Run this before pushing.**
- `python scripts/check-cms-config.py` — the CMS form and the Zod schemas have not drifted.
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
body. Both exist for one reason and break the same way. Sveltia also formats dates with
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
  binary forever.
- One `<h1>` per page.
- Mobile first. Check at 375px.
- **Colour and type come from the tokens in `src/styles/global.css`.** No colour
  literals in components — there are currently zero outside the token definitions, and
  that is worth keeping. Sizes used in more than one place get a `--type-*` token, so a
  change is one edit rather than seven.
- **There is one uppercase label size, 13px**, and it is a token — `--type-label` on one
  line, `--type-label-sm` where it wraps. **Size is only half of it: a label is `--ink-2` at
  0.06em tracking, never `--muted` at 0.09em.** The instructions section shipped with the
  artboard's lighter, wider setting and read noticeably smaller than the spec block at the
  identical size — light grey plus uppercase plus tracking is what does it, not the pixels. Eleven components had drifted to their own value
  between 11 and 12.5px, so a badge, a difficulty level and a spec label were three sizes
  of the same thing. Only two uppercase roles may differ, because they are not labels:
  `--type-nav` and `--type-prose-label`, both 13px. Column heads are `--type-table-head`
  at 11.5px — a shade smaller on purpose, because they sit directly above their own data.
  Small uppercase with wide tracking is the hardest thing on a page to read, and passing
  contrast does not make it legible; anything below 11px is scaffolding that gets deleted.
- Class naming is BEM-ish: `block__element`, `block--modifier`.
- Server-rendered HTML only. No client-side-only content — AI crawlers fetch JavaScript
  but do not execute it.

## Deployment

Pushing to `main` triggers a Cloudflare build and redeploy. It takes **roughly 60 seconds**.
There is no manual deploy step and no deploy command.

Things that have already gone wrong here, and cost real time:

- **A failed build is silent.** Cloudflare reports nothing back to GitHub — no commit status,
  no deployment record, no notification. The previous version keeps serving. The only way to
  know a deploy landed is to fetch the live site and look for the change. Never assume a push
  deployed; verify against something in the response that actually differs.
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
- **CI runs `npm run check`, `npm run build` and the CMS parity script** on every push, in
  `.github/workflows/build.yml`. It cannot stop Cloudflare; it puts a red X on the commit,
  which is the notification Cloudflare never sends — and it is the only guard on entries
  published from `/admin`, which reach `main` with nobody watching a terminal.

## Out of scope

- Ecommerce, carts, payments
- User accounts or auth
- Comments (decided against at launch)
- Anything requiring a database or a server process
