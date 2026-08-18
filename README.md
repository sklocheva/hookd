# Hookd

A personal crochet blog: free patterns, and write-ups of yarn, fibre and stitch tests.
Static site, no database and no server. Selling happens on Ravelry, never here.

Live at **https://hookd.pages.dev**

## Stack

- [Astro](https://astro.build) with TypeScript, static output
- `@astrojs/sitemap` for `/sitemap-index.xml`
- Astro's built-in image optimization (`<Image>` from `astro:assets`, backed by sharp)
- Hosted on Cloudflare Pages, free tier

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

Cloudflare Pages is connected to this repo's `main` branch. **Pushing to `main` builds and
deploys automatically** — there is no manual deploy step.

Cloudflare build settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |

Pull requests get their own preview deployment.

If the site's hostname ever changes, update `site` in `astro.config.mjs` and the `Sitemap:`
line in `public/robots.txt` together — the sitemap's absolute URLs come from `site`.

## Conventions

Project rules — content model, SEO requirements, image handling — live in `CLAUDE.md`.
Read it before adding content or components.
