# TODO

## Start here if you are new to this repo

| To find out | Read |
| --- | --- |
| What this project is, and the rules that are decided | `CLAUDE.md` |
| How to build, preview, screenshot and audit it | `.claude/skills/run-hookd/SKILL.md` |
| How to check a deploy actually landed | `.claude/skills/verify-deploy/SKILL.md` |
| How to write and format an article | `WRITING.md` |
| What has already gone wrong, and why | `.claude/skills/verify-deploy/references/failures.md` |

The planning documents — `PLAN.md`, `OVERVIEW.md`, `RESEARCH.md` — live outside the repo in
`D:\_Sophie\_docs\_Crochet blog\`. They are deliberately not committed: this repo is public
and they hold domain research, costs and personal notes. Where this file says "step N", it
means a step in that `PLAN.md`.

Steps 1, 2, 3 and 5 are done; 6 is nearly done.

## Next up

- [ ] **Decide whether drafts should be hidden from listings.** `draft: true` currently keeps
      an entry out of Google, the sitemap and RSS, but it still shows on the homepage and the
      indexes. Filtering them out is a few lines — but every entry is a draft today, so doing
      it now would empty the site. Worth doing once real content exists.
---

## Blocked on Sophia

- [ ] **Decision 9 — the site name.** Blocks buying the domain (step 4) and nothing else.
      Front-runner in PLAN.md is `hookdlab.com`.
- [ ] **Decision 10 — the address for the Austrian §25 disclosure.** Home, Postfach, or a
      service address. Blocks the legal page content, not the page itself.
- [ ] **Step 0 — dictate the Y2K skinny shawl stitch post.** Ten minutes, messy, no structure.
      The method is: you dictate, Claude tidies the wording, your words and caveats stay.

---

## Step 6 — Implement the design (nearly done)

- [ ] Legal pages exist (`/privacy/`, `/licence/`, `/imprint/`) but need Sophia's review, and
      the §25 disclosure needs the address decision.
- [ ] Pattern **instructions and charts** were explicitly not designed. `<Row>` exists and the
      example pattern uses it, but the surrounding section needs a design. Written first,
      chart repeated after.
- [ ] Wire "Print / save as PDF" and "Add to Ravelry queue" on the pattern page, or remove them.
- [ ] Empty states for `/patterns/` and `/journal/` when a collection is empty.

## Step 7 — SEO, legal, analytics (mostly not started)

Already in place: canonical URLs, unique title and meta description per page, Open Graph and
Twitter Card including `og:image` with explicit width and height (which is what Pinterest Rich
Pins read), robots.txt, sitemap, one `<h1>` per page.
- [ ] **JSON-LD**: BlogPosting for journal posts, Article for patterns, BreadcrumbList
      site-wide, Person for Sophia. Skip HowTo — Google deprecated those rich results in 2023.
- [ ] **robots.txt: name the AI crawlers explicitly** — Googlebot, GPTBot, ClaudeBot,
      PerplexityBot, Google-Extended. Currently only a blanket `User-agent: *`.
- [ ] **Cloudflare Web Analytics.** Cookieless, so no consent banner.
- [ ] **Per-entry share images.** Everything currently uses the branded `/og-default.png` card.
      That works, but Pinterest performs far better with the actual photograph, so each entry
      should get its own once photos exist. `socialImage` is validated to exist at build, so a
      wrong path fails the build rather than shipping a blank pin.

## Step 8 — Launch

- [ ] Publish the Y2K stitch post
- [ ] Submit the sitemap in Google Search Console
- [ ] Pinterest business account — Rich Pins validate automatically once Open Graph is live

## Step 9 — Fill it out

- [ ] Three more write-ups from findings that already exist: moss 3 mm vs 4 mm · Karisma vs
      Snorre · swatch gauge vs piece gauge. Four posts is where the site stops looking empty.
- [ ] **Photo session.** Side light at 90° to a window, matte mid-tone background, stills
      separate from video, vertical framing for Pinterest. Aspect ratios are baked into the
      layouts:
      | Screen | Slot | Ratio |
      | --- | --- | --- |
      | Homepage | pinned hero | 4:5 |
      | Homepage | feed thumbs | 1:1 |
      | Patterns | cards | 4:5 |
      | Pattern page | hero | 16:10 |
      | Journal | rows | 3:2 |
- [ ] First free pattern — the fingerless gloves. Write the pattern first, then make the second
      of the pair as the test.
- [ ] Ravelry listings, Instagram link, newsletter signup.
- [ ] Replace the three example patterns and two example posts. They exist to exercise the
      schemas, not to be published.

## Step 10 — The calculator

- [ ] Port the grading toolkit to one page: inputs for gauge, target measurements and ease;
      outputs for stitch and row counts per size. One component, no backend. Do it after there
      is content — it is likely the best traffic page on the site.

---

## Assets still missing

- [ ] **Wordmark artwork.** Currently italic Lora in a dashed box — delete the box and its
      monospace caption in `Header.astro` and `Footer.astro` when real artwork lands.
- [ ] **Social icons** for Instagram, YouTube, Pinterest, Ravelry. Currently text stubs in
      circles, with a caption to delete alongside them.
- [ ] All photography. `PhotoPlaceholder.astro` is scaffolding and should eventually be
      deleted; `PhotoPending.astro` is a real state and stays.

## Housekeeping

- [ ] **The image pipeline is unverified in CI** — there are no real images yet, so nothing
      exercises `<Image>`. The `/_image` bug that cost a day can only recur once a real photo
      lands, so run `verify-deploy` the moment the first upload happens.
- [ ] When a placeholder is deleted, delete its `data-scaffold` attribute too — otherwise the
      audit keeps ignoring an element that now ships.
- [ ] Decide whether drafts should become pull requests (`publish_mode: editorial_workflow`).
      Currently saving in the CMS commits straight to `main` and publishes in about a minute.
- [ ] Run the skill-creator eval loop and description optimizer against the two skills,
      `verify-deploy` and `run-hookd` (needs subagents — ask first).
- [ ] The audit's route list in `driver.mjs` is hand-maintained. Add new routes to it, or they
      go unchecked.

## Ground rules — split between tooling and agreement

**Now enforced by tooling** — these were rules on paper and are now checks that fail:

- [x] Build locally before pushing — `run-hookd audit` builds first and refuses to continue
      on a broken build
- [x] Write tests where feasible — the audit is the test layer: overflow, one `<h1>`,
      server-rendered content, tap targets, contrast, label floor, internal links, across 13
      routes at 375px and 1280px
- [x] Check at 375px — every audit run does both widths
- [x] Verify against the live site, not `dist/` — `verify-deploy`
- [x] CMS form and schema stay in step — `scripts/check-cms-config.py`

**Still a working agreement, still deferred** — these are decisions about how we collaborate,
not things a script can check:

- [ ] Work on a branch rather than straight on `main`
- [ ] Merge to `main` only with Sophia's consent, once a page is reviewed and finished
- [ ] One change per branch; keep diffs reviewable
- [ ] Don't change decided stack choices without asking
- [ ] **GitHub Action to catch failed builds.** Publishing from `/admin` pushes straight from
      the browser, so nothing runs locally and a failed build is silent — a post can save fine
      and never appear. An Action that builds on push and emails on failure is the only
      "validation before publishing" that is actually possible; the CMS cannot run Astro.
      This would also enforce the build gate the checks currently only offer.

- [ ] Optional image captions. The markdown title slot now carries the size hint
      (`"wide"`, `"narrow"`); captions would need a `<figure>` wrapper.
