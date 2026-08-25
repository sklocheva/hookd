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
- `npm run build` — production build into `dist/`; must pass before pushing
- `npm run preview` — serve the built `dist/` locally

There is no linter, and no unit-test runner. The checks that exist are:

- `node .claude/skills/run-hookd/driver.mjs audit` — builds, serves, and drives all routes
  in headless Chrome at 375px and 1280px: overflow, one `<h1>`, content present without JS,
  tap targets, contrast, the label floor, internal links. **Run this before pushing.**
- `python scripts/check-cms-config.py` — the CMS form and the Zod schemas have not drifted.
- `verify-deploy` skill — the deployed site, after a push.

Note that `astro build` does **not** type-check. `tsconfig.json` extends
`astro/tsconfigs/strict`, but nothing enforces it at build time — a type error in a `.astro`
frontmatter block will build clean and only surface in the editor.

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

**All photography is placeholder.** `PhotoPlaceholder.astro` draws the striped stand-in and
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

**Drafts are hidden from search, not from visitors.** `draft: true` keeps an entry out of the
sitemap, the RSS feed, and adds `noindex` — but it still renders and is still listed on the
homepage and the indexes. No listing filters drafts.

**Routes.** `/`, `/patterns/`, `/patterns/[slug]`, `/journal/`, `/journal/[slug]`, plus
`/patterns/c/[category]` and `/journal/c/[kind]` behind the index filters. The filters are real
static routes rather than client-side filtering, because of the no-JS rule.

## Content model

Two collections, both with Zod schemas in `src/content.config.ts`. Example entries live in
`src/content/` — they exist to exercise the schemas and should be replaced by real ones.

**patterns** carries structured data, not prose: yarn (brand, line, fibre content, ball
weight and length, CYC weight category), hook size in mm and US, gauge as TWO separate
objects — swatch gauge and piece gauge — difficulty (Basic/Easy/Intermediate/Complex),
size range, yardage per size, US/UK terms.

**posts** is looser: title, date, summary, hero image, tags.

### Rules

- **SEO fields are required on both collections**: meta description (max 160 chars), hero
  image alt text, social share image. The build MUST fail if any is missing. This is
  deliberate — it replaces an SEO plugin with an error.
- **Swatch gauge and piece gauge are separate fields and both matter.** They differ in
  reality and almost no published pattern says so. Never collapse them into one.
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
- **Pushing needs the gh credential helper**, configured local to this repo. It resolves in
  PowerShell but **not** in Git Bash, where `git push` fails with "Invalid username or
  token". Push from PowerShell.

## Out of scope

- Ecommerce, carts, payments
- User accounts or auth
- Comments (decided against at launch)
- Anything requiring a database or a server process
