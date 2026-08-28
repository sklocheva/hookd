# Writing for Hookd

What you can put in the body box in `/admin`, and how. Everything here is plain Markdown —
type it into the same box you type paragraphs into.

The body box has no toolbar for most of this. That is normal: Markdown is text, and the
formatting is the punctuation around it.

---

## The basics

```markdown
## A section heading

A normal paragraph. Leave a blank line between paragraphs, or they run together.

**Bold** for a term that matters. *Italic* for emphasis or a yarn name.

- A bullet
- Another bullet

1. A numbered step
2. The next step

> A quote, or a caveat you want set apart.

[A link to something](https://example.com), or [to a page here](/patterns/oland-cardigan/).
```

**Start headings at `##`, never `#`.** The page already has one `#` — the article title —
and a second breaks the page structure. The build checks this.

`##` is a section, `###` a step within it, `####` a small aside. All three are styled.
**Don't bold a heading** — `## **What you need**` — the heading is already styled, and the
bold does nothing but clutter the source.

---

## Images

Insert one with the image button, or type it:

```markdown
![Describe the photo for someone who cannot see it](/src/assets/photo.webp)
```

The part in `[square brackets]` is the alt text. **Always write it properly** — it is what a
blind reader hears and what Google reads. "Photo" is not alt text.

### Sizing

Add a size in quotes after the path:

```markdown
![alt](/src/assets/photo.webp)            aligned with the text — the default
![alt](/src/assets/photo.webp "wide")     full width of the content column
![alt](/src/assets/photo.webp "narrow")   about half width, for a detail or a swatch
```

Use `wide` for anything with detail to read — a step-by-step grid, a comparison, a chart.
Use `narrow` for a single small object. Default suits most photos.

### Before you upload

The panel converts to WebP and caps the long edge at 2000px in your browser, so **upload
the full-size file** — it handles the rest. Nothing oversized reaches the repository.

---

## Tables

Plain Markdown tables work and are styled to match the site:

```markdown
| Yarn | Dry | After wash | Change |
| --- | ---: | ---: | ---: |
| Hillesvåg Vestlandsgarn | 20.0 | 19.6 | −2.0% |
| Drops Karisma | 20.1 | 21.2 | +5.5% |
```

The `---:` on a column right-aligns it. **Right-align numbers, left-align text** — it makes a
column of figures readable down its edge.

Wide tables scroll sideways on a phone rather than squashing, so you do not have to keep
them narrow.

---

## Pattern instructions

Only in patterns, and only in `.mdx` files. Add this line once at the top of the body:

```
import Row from '../../components/Row.astro';
```

Then for each row or round:

```markdown
<Row label="Row 1" side="RS" counts={{ XS: 62, M: 79, "3X": 115 }}>
  Ch 2, hdc in the 3rd ch from hook and in each ch to end, turn.
</Row>

<Row label="Rows 2–4" counts={{ XS: 62, M: 79, "3X": 115 }}>
  Ch 2, hdc in each st to end, turn.
</Row>
```

- `label` — "Row 1", "Rnds 4–8", whatever you would say
- `side` — `RS` or `WS`, optional, only when it matters
- `counts` — stitch count per size, optional. One number works too: `counts={62}`

---

## Data tables in journal posts

For a results table you want to keep tidy, the `DataTable` component takes the rows as data
so the formatting stays out of your hands. Import once:

```
import DataTable from '../../components/DataTable.astro';
```

```markdown
<DataTable
  columns={['Yarn', 'Drape', 'Pilling']}
  align={['left', 'left', 'left']}
  rows={[
    ['Hillesvåg Vestlandsgarn', 'Firm, holds a shape', 'None visible'],
    ['Drops Karisma', 'Soft, a little limp', 'Moderate'],
  ]}
/>
```

A plain Markdown table (above) is easier and looks the same. Use `DataTable` when you want
column alignment controlled, or the table is long enough that Markdown pipes get unwieldy.

---

## Saving and publishing

**There is no publish button — Save is publish.** Saving commits to the site and it goes
live in about a minute.

To work on something without publishing it, tick **Draft** before saving. A draft:

- still saves, so nothing is lost
- is kept out of Google, the sitemap and the RSS feed
- **is still visible on the site** — it appears in the journal or patterns list and on the
  homepage, exactly like anything else

So "draft" here means *not findable*, not *not visible*. Nobody will stumble on it through
a search engine or a feed reader, but a person browsing the site will see it. If you want
drafts hidden from the listings as well, that is a change worth making deliberately — ask.

Untick Draft and save again when it is ready. That is the "save now, publish later" flow.

---

## Filling in a pattern's sizes

**Name the measurements yourself.** A sweater wants Finished bust and Finished length; a hat
wants Circumference and Depth; a blanket wants nothing at all — leave the list empty and the
table still shows sizes and yarn.

Use the **same label in every size**. "Finished bust" in one row and "Bust" in another makes
two columns with holes in them, because the labels are what the columns are built from.

**Fits body** is the body measurement the size is cut for, e.g. `76–81`. It sits next to the
finished numbers so a maker can see the ease rather than doing the subtraction. If you state
an ease, make the two agree — finished minus body should land in the range you claim.

**You do not type the US hook size.** Enter the mm and the US size is added for you. Some
sizes — 2.5, 7 and 12 mm — have no US equivalent, and those correctly show nothing.

**Gauge is measured on the blocked piece**, not on a swatch pinned flat. Use the note field
to say where on the piece you measured: that is what lets someone else swatch to match it.

---

## More photographs

Both patterns and journal posts have a **More photographs** list. On a pattern it sits at the
very top of the page, because the photographs are what sell a free pattern.

The **hero is the first frame** — the same photo cards and shares use — and these follow it,
with a row of thumbnails that swap the big image. It exists so you do not have to decide where
every photo belongs in the article.

Each photo takes an optional **caption**, the line under the thumbnails. Say something the photo
cannot — "Size M, worn with 12 cm ease" — rather than repeating the alt text.

**Alt text is required on each one**, for the same reason it is on the hero: it is the only
description a blind reader gets, and it never gets added later. With JavaScript off every
photo is still shown, stacked, so nobody misses one.

---

## The fields that are required, and why

The panel will not let you save without these, and the build fails without them:

| Field | Why |
| --- | --- |
| **Meta description**, max 160 chars | What Google shows under your title. Written by you, or written badly by Google |
| **Hero image alt text** | Required even before the photo exists, so it is never forgotten afterwards |
| **Social share image** | Leave as `/og-default.png` until the post has its own — otherwise every share and pin renders blank |

This is deliberate. It replaces an SEO plugin nagging you with an error you cannot ignore.

---

## Common mistakes

| Symptom | Cause |
| --- | --- |
| Editing an existing post by accident | Use **New Journal post**, not a click on an entry in the list |
| Image does not appear | Check the path starts `/src/assets/` — that is what the panel writes |
| Table is not a table | Every row needs leading and trailing `|`, and the `| --- |` separator line |
| Post saved but not on the site | The build failed. Ask Claude to check — Cloudflare does not report failures anywhere |
