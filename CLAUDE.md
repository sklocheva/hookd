# Hookd — personal crochet blog

A static site publishing free crochet patterns and write-ups of yarn, fibre and stitch tests.
Not a shop. Selling happens on Ravelry, never here.

## Stack — decided, do not substitute

- Astro, TypeScript
- Sveltia CMS at /admin for browser-based publishing
- Cloudflare Pages hosting, free tier
- No database, no server, no auth

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build; must pass before pushing
- `npm run preview` — preview the build

## Content model

Two collections, both with Zod schemas in `src/content.config.ts`.

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
- Server-rendered HTML only. No client-side-only content — AI crawlers fetch JavaScript
  but do not execute it.

## Out of scope

- Ecommerce, carts, payments
- User accounts or auth
- Comments (decided against at launch)
- Anything requiring a database or a server process