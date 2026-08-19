# Hookd

A personal crochet blog: free patterns, and write-ups of yarn, fibre and stitch tests.
Static site, no database and no server. Selling happens on Ravelry, never here.

Live at **https://hookd-blog.sklocheva.workers.dev**

## Stack

- [Astro](https://astro.build) with TypeScript, static output
- `@astrojs/sitemap` for `/sitemap-index.xml`
- Astro's built-in image optimization (`<Image>` from `astro:assets`, backed by sharp)
- Hosted on Cloudflare Workers (static assets), free tier

## Requirements

Node.js **22.12.0 or newer**. Astro does not support odd-numbered Node majors (23, 25, …),
so use an LTS release. This repo pins the version in `.nvmrc`.

## Getting started

```sh
npm install
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server at http://localhost:4321 |
| `npm run build` | Production build into `dist/`. Must pass before pushing. |
| `npm run preview` | Serve the built `dist/` locally |

## Deploying

Cloudflare (Workers, connected via git integration) is wired to this repo's `main` branch.
**Pushing to `main` builds and deploys automatically** — there is no manual deploy step.

Cloudflare build settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |

Currently live at `https://hookd-blog.sklocheva.workers.dev` — there is no custom domain yet.
**When a custom domain is attached, `site` in `astro.config.mjs` and the `Sitemap:` line in
`public/robots.txt` must be updated to the new domain** — the sitemap's absolute URLs and the
canonical `<link>` both derive from `site`, and both files need to change together.

## Publishing from the browser

Sveltia CMS is served at **`/admin`**. It writes Markdown straight into this repo, so
publishing from the panel is a commit to `main`, which deploys like any other push.

The form fields mirror the Zod schemas in `src/content.config.ts`. The required SEO fields
are marked required in the panel too, so it asks while you're writing rather than failing
the build afterwards. **If you change a schema, change `public/admin/config.yml` to match.**

Uploaded images land in `src/assets/` and are resized in the browser before upload —
converted to WebP and capped at 2000px on the long edge, so an oversized original never
enters the repo.

### Signing in — needs setting up once

Two options:

**Personal Access Token** — works immediately, nothing to deploy. On the sign-in screen
choose *Sign In with Token* and paste a GitHub fine-grained token with read/write access to
this repo. Fine for one person; the token lives in your browser.

**Sign in with GitHub** — the nicer flow, but it needs two things that only you can create:

1. A **GitHub OAuth App** (GitHub → Settings → Developer settings → OAuth Apps). It issues a
   client ID and secret.
2. An **auth worker**, because the OAuth flow needs a server-side step to exchange the code
   for a token, and this site has no server. Cloudflare's free tier runs
   [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) for this.

Then uncomment `base_url` in `public/admin/config.yml` and point it at the worker.

Keep the client secret in the worker's environment. It must never be committed here — this
repo is public.

## Conventions

Project rules — content model, SEO requirements, image handling — live in `CLAUDE.md`.
Read it before adding content or components.
