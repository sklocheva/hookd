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

**The CMS writes `''` for a blank text field and `null` for a blank number.** `optionalString`
and `optionalNumber` in `src/content.config.ts` normalise both to undefined. Without the
number one, `z.number().optional()` rejects `null` and the entry fails to build — which is
how Sophia's first real review broke, on two fields she had never touched.

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

**The CMS and Astro disagree about paths, and two files reconcile them.** Sveltia requires an
absolute `public_folder`, so it writes `/src/assets/photo.webp` — which Astro treats as a
public URL and leaves alone, so the image 404s. `src/lib/images.ts` translates that for
`heroImage` in frontmatter; `src/lib/remark-cms-images.mjs` does the same for images in the
body. Both exist for one reason and break the same way. Sveltia also formats dates with
**Day.js** tokens (`YYYY-MM-DD`) — date-fns style silently writes garbage like `yyyy-08-We`.

**A draft says so on the page.** `DraftNotice.astro` renders at the top of any entry still
marked draft, with the time the page was built. That timestamp is what makes a draft usable as
a preview: save in `/admin`, follow the link to the page, and the stamp says whether the build
has caught up with the save yet. It also stops a half-finished entry looking published, which
matters because drafts are visible.

**Drafts are hidden from search, not from visitors.** `draft: true` keeps an entry out of the
sitemap, the RSS feed, and adds `noindex` — but it still renders and is still listed on the
homepage and the indexes. No listing filters drafts.

**Routes.** `/`, `/patterns/`, `/patterns/[slug]`, `/journal/`, `/journal/[slug]`, plus
`/patterns/c/[category]` and `/journal/c/[kind]` behind the index filters. The filters are real
static routes rather than client-side filtering, because of the no-JS rule. Both indexes use
the **same text-link treatment** — pill toggles with counts were tried and reverted, because
two index pages with two different filter treatments is worse than the thing it solved.

**`Base.astro` also owns JSON-LD.** Pages pass `jsonLd` (Article, BlogPosting); breadcrumbs are
derived from the path there. Anything `noindex` emits none, so a draft never ships structured
data describing a page crawlers are told to ignore. Builders live in `src/lib/schema.ts`.

**Yarn reviews are a third collection and a second journal template.** A test note is an
essay with tables in it; a review is a spec sheet with a short essay at the end, so almost
none of the fields overlap and it gets its own schema at `/journal/yarn/[slug]`. Both list
together on `/journal/` — `src/lib/journal.ts` normalises the two into one row shape, which
is why `JournalList` takes entries rather than a collection. Reviews carry no `kind`, so they
appear under "All" and not under a kind filter.

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
- **Hook size is typed in mm only; the US size is derived** in `src/lib/hooks.ts` from the
  Craft Yarn Council table. US letters vary by manufacturer, and 2.5, 7 and 12 mm have **no
  US equivalent at all** — an input field for it invites an invented answer. `usHook` returns
  undefined for those and the page shows just the mm.
- **A pattern has several categories, stored as lowercase slugs** (`clothing`, `accessories`,
  `pets`, `home`). A hooded scarf is genuinely both clothing and an accessory, and a single-select
  field files it wrong either way. Display labels live in `src/lib/taxonomy.ts`, never in
  content, so renaming one touches no entry and no URL. Unused values are hidden from the filter
  row, so a category with no patterns can never be a dead end.
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
  where it was spun — frequently different countries. **OEKO-TEX is named, never badged**:
  it certifies the article was tested for harmful substances, not that it is organic or
  environmentally made, and it is widely misread as the latter, so the row spells out what
  the class covers. **`mulesing` records only what the label states**, and "Not stated" is
  the honest and most common answer — silence is not a claim either way.
- **A review records the weight the label claims, plus WPI — no CYC number.** Bands disagree
  with the CYC scale and with each other (the first real review was sold as DK and printed
  "Worsted"), so storing a category meant deciding which was right. `weightLabel` quotes the
  band; `wpi` is the thickness measured rather than claimed, and settles it. Patterns still
  carry `cycWeight` — that is a pattern's own requirement, not a transcription.
- **Strand construction is a fixed type plus a free line.** The type (Singles, Plied,
  Cabled, Chainette, Roving) is what lets two reviews be compared; the line carries what
  the author sees on untwisting a length, which no category expresses.
- **A review with no photographs is a finished page**, not a broken one. Both image blocks drop
  out and nothing else moves. No placeholder art, no empty frame.
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
- **Uppercase labels have an 11px floor**, in `--ink-2` rather than `--muted`, with
  letter-spacing at 0.06–0.08em. Small uppercase with wide tracking is the hardest thing
  on a page to read, and passing contrast does not make it legible. Anything smaller is
  scaffolding that gets deleted.
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
