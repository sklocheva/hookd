---
name: publishing
description: Use when an entry is being written, edited or published on Hookd — a pattern, post, yarn note or quiz — typed in /admin or written by hand; when adding or changing a field on a schema or on the CMS form; when a build fails after a save from the browser; when an entry does not appear in /admin, or its page 404s, or a draft is being published.
---

# Publishing an entry

Entries reach `main` from `/admin` with nobody watching a terminal, so the build is the only
thing standing between a save and a broken site. Everything below is a way that has already
gone wrong.

## The four collections

| Collection | Folder | Extension |
| --- | --- | --- |
| patterns | `src/content/patterns` | `.mdx` |
| posts | `src/content/posts` | `.mdx` |
| reviews (yarn notes) | `src/content/reviews` | `.md` |
| quizzes | `src/content/quizzes` | `.json` |

**An entry must carry the extension its collection declares.** Astro's loader takes `.md` and
`.mdx` alike, so a mismatched file builds, renders and goes live — and Sveltia never lists it,
because it only shows files matching the declared extension. Three entries were invisible in
`/admin` this way, two of them whole patterns. `python scripts/check-cms-config.py` fails on a
mismatch, and on the CMS form drifting from the Zod schemas.

## Blank is a value, and it breaks builds

Clearing a field in `/admin` writes `''` or `null` rather than dropping the key, so a schema
that requires the value rejects the entry and the whole site stops building. This has happened
five times — a number, an untouched text field, an object never opened, a `.url()`, and a
cleared `reference()` that satisfied its type and then resolved to nothing.

**Any field the panel can leave blank must accept blank.** Use the wrappers in
`src/content.config.ts` — `optionalString`, `optionalNumber`, `optionalUrl`,
`blankToUndefined`, `dropBlanks` — and never a bare `.optional()` on a string, url, date or
number. **A `.default()` does not save you**: a default fills in for `undefined` only, so a
blank string is still validated and still fails.

## Required to publish, not to save

The CMS marks nothing required. A `superRefine` on the schema enforces the list only when
`draft` is false, so a half-transcribed ball band saves and renders, and unticking Draft is
what fails the build with a line naming each gap. That is the design: a required field in
front of unfinished work does not protect the data, it stops the site building.

SEO fields are always required at publish: meta description (160 characters), hero image alt
text where there is a hero, social share image.

## Drafts

A draft is unlisted everywhere — homepage, indexes, filters, related strip, feed, sitemap —
and is built at its `previewId`, a UUID the CMS generates, so the address it will eventually
own 404s until it is published. `src/lib/drafts.ts` is the single place this lives. `/admin`
links to `/go/<previewId>/`, which forwards to whichever address is live. Publishing moves the
entry to its real slug and the preview address stops resolving; nothing links to it, so
nothing breaks.

**A draft is hidden from readers, not from the world.** The repository is public: the
frontmatter, the `previewId` and the unfinished prose are all readable on GitHub.

## Writing the file by hand

Sveltia quotes what it writes, so this bites only hand-authored entries: **a comma inside
`- { key: value }` silently eats the rest of the line.** It is a YAML flow mapping; the
remainder parses as another key and Zod strips it as unknown, with no error anywhere.
Twenty-six rows across three patterns had lost text this way. Write block mappings with
quoted values.

Dates use Day.js tokens (`YYYY-MM-DD`) — date-fns style writes garbage like `yyyy-08-We`.

## Images

`/admin` writes an absolute `/src/assets/photo.webp`; `src/lib/images.ts` translates that for
frontmatter and `src/lib/remark-cms-images.mjs` for images in the body. Both exist for the
same reason and break the same way. Images go through Astro's `<Image>`, never a plain
`<img>`, and nothing over 2000px on the long edge is committed — `/admin` resizes in the
browser, and `node scripts/check-image-sizes.mjs` catches anything added by hand.

Alt text rules live in the `house-voice` skill.

## Before it is live

```bash
python scripts/check-cms-config.py
```

```bash
node scripts/check-image-sizes.mjs
```

Then the `ship-it` skill for the build, the audit and the push. A publish gate failing is a
*build* failure, so `npm run build` is what surfaces it, with the entry and the field named.

CI runs all of this after the fact and emails on red. It is the only guard on an entry
published from the browser.

## Common mistakes

| Mistake | What happens |
| --- | --- |
| A bare `.optional()` on a new field | The next cleared value stops the site building |
| `.default()` instead of a wrapper | A blank string is validated and fails, default and all |
| Saving a pattern as `.md` | It builds and goes live, and vanishes from `/admin` |
| Linking an entry by a typed URL | It 404s the moment a draft is published or renamed |
| Treating a draft as private | The repo is public; drafts are readable on GitHub |
