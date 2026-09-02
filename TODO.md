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

- [ ] **Fill in the blocked gauge for `drops-cotton-merino`, or leave it in draft.** It was
      published with `gauge.blocked` empty, which the publish gate requires and the build
      refuses. Back to draft for now — untick Draft again once the number exists.
- [ ] **A second Worker, if unlisted stops feeling like enough.** Drafts are now unlisted and
      served at an unguessable address, but they are still built into the production site and
      the repository is public. Making them genuinely absent means a second Worker building
      the same branch with drafts on, at its own hostname. None of the current work is wasted
      if that day comes — the filtering is the same.
---

## Blocked on Sophia

- [x] ~~Decision 9 — the site name~~ — **hookdworks**, settled 1 Sep 2026.
- [ ] **Buy hookdworks.com**, then attach it to the Cloudflare Worker. Nothing in the repo
      changes until the domain actually resolves: `site` in `astro.config.mjs`, the
      `Sitemap:` line in `public/robots.txt` and `site_url` in `public/admin/config.yml` all
      carry the host and must change together, **once**. Predicting a hostname and baking it
      in cost real time before — see `failures.md`.

---

## Step 6 — Implement the design (nearly done)

- [ ] Legal pages exist (`/privacy/`, `/licence/`, `/imprint/`) and need Sophia's review.
      The Austrian §5 ECG / §§24–25 Mediengesetz duties do **not** apply — she is not resident
      in Austria — and `imprint.astro` already says so. Revisit only if that changes.
- [ ] Pattern **instructions and charts** were explicitly not designed. `<Row>` exists and the
      example pattern uses it, but the surrounding section needs a design. Written first,
      chart repeated after.
- [x] ~~Patterns have no `updated` field~~ — added as **Last corrected** in the CMS. Set it
      when you fix something in a published pattern; JSON-LD then reports it as `dateModified`
      instead of repeating the publish date. Verified: with it set, the two dates differ.

## Step 7 — SEO, legal, analytics (mostly not started)

Already in place: canonical URLs, unique title and meta description per page, Open Graph and
Twitter Card including `og:image` with explicit width and height (which is what Pinterest Rich
Pins read), robots.txt, sitemap, one `<h1>` per page.
- [ ] **Cloudflare Web Analytics.** Cookieless, so no consent banner.
- [ ] **Per-entry share images.** Everything currently uses the branded `/og-default.png` card.
      That works, but Pinterest performs far better with the actual photograph, so each entry
      should get its own once photos exist. `socialImage` is validated to exist at build, so a
      wrong path fails the build rather than shipping a blank pin.

## Step 8 — Launch

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

- [ ] **Thumbnails should be separate crops**, not the main photo scaled down — the design asks
      for ~400×500 exports cropped to each subject, because a whole garment at 100px is
      unreadable. Needs a `thumb` field once real photos exist.
- [x] ~~The image pipeline is unverified~~ — six real photographs now ship on the cat-toy post
      and the Halland Cowl, and `verify-deploy` confirms them serving as `image/webp` from
      `/_astro/` on the live host. The `/_image` bug cannot hide any more.
- [ ] When a placeholder is deleted, delete its `data-scaffold` attribute too — otherwise the
      audit keeps ignoring an element that now ships.
- [ ] Drafts as pull requests (`publish_mode: editorial_workflow`) — **not possible yet**.
      Sveltia has not built it; it is slated for 1.0, mid-2026. Saving in the CMS commits
      straight to `main`, which is now safe enough: a draft is unlisted and off its real URL.
- [ ] Run the skill-creator eval loop and description optimizer against the two skills,
      `verify-deploy` and `run-hookd` (needs subagents — ask first).

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
- [x] ~~GitHub Action to catch failed builds~~ — `.github/workflows/build.yml` runs
      `npm run check`, `npm run build` and the CMS parity script on every push to `main` and on
      pull requests. It cannot stop Cloudflare, but it puts a red X on the commit, which is the
      notification Cloudflare never sends — and it matters most for `/admin` commits, which go
      straight to `main` from the browser with nobody watching a terminal.
      **GitHub emails on a failed run by default**; change that in notification settings if you
      would rather it did not.

- [ ] Optional image captions. The markdown title slot now carries the size hint
      (`"wide"`, `"narrow"`); captions would need a `<figure>` wrapper.
