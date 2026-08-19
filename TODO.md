# TODO

Deferred work, roughly in the order it will matter.

## Content and assets

- [ ] **Real photography.** Every image on the site is a placeholder. Shot list, with the
      aspect ratios the layouts depend on:
      | Screen | Slot | Ratio | Subject |
      | --- | --- | --- | --- |
      | Homepage | pinned hero | 4:5 | cowl styled / blanket folded / yarn haul, autumn tones |
      | Homepage | feed thumbs ×4 | 1:1 | crop of each post's hero |
      | Patterns | cards ×5 | 4:5 | cardigan worn · cowl styled · mitts flat lay · blanket folded · tote held |
      | Pattern page | hero | 16:10 | cardigan, worn, outdoors |
      | Journal | rows ×4 | 3:2 | six swatches · ball bands top-down · four stitch swatches in raking light · blocked vs unblocked |
- [ ] **Wordmark artwork.** Currently italic Lora inside a dashed placeholder box. Dropping in
      real artwork means deleting the dashed box and its monospace caption in `Header.astro`
      and `Footer.astro`.
- [ ] **Social icons** for Instagram, YouTube, Pinterest, Ravelry. Currently text stubs in
      38px circles, with a placeholder caption to delete alongside them.
- [ ] Replace the example pattern and journal entries with real ones. They exist to exercise
      the schemas, not to be published.
- [ ] Dictate the Y2K skinny shawl stitch post (first real post) and the two-colour
      fingerless gloves (first real pattern).

## Site

- [ ] **About page.** Not designed. Currently `href="#"` in the header and footer nav.
- [ ] Pattern **instructions and charts** are not designed. `CLAUDE.md` says written
      instructions first, chart repeated after. The `<Row>` component exists and is used by
      the example pattern; the surrounding section still needs a design.
- [ ] Wire "Print / save as PDF" and "Add to Ravelry queue" on the pattern page, or remove
      them. Currently inert, per the design.
- [ ] Empty states: what `/patterns/` and `/journal/` show when a collection is empty, and
      what a category page shows with no matches.
- [ ] Sveltia CMS at `/admin` — in the stack, not built.
- [ ] Cloudflare Web Analytics.
- [ ] Custom domain. When it lands, update `site` in `astro.config.mjs` **and** the `Sitemap:`
      line in `public/robots.txt` together — see `CLAUDE.md`.

## Tooling

- [ ] Run the skill-creator **eval loop** against `.claude/skills/verify-deploy` (needs
      subagents — ask before running).
- [ ] Run the skill-creator **description optimizer** to tune when `verify-deploy` triggers,
      against ~20 test queries.

## Still to decide (from OVERVIEW.md)

- [ ] The site name — blocks buying the domain.
- [ ] The address for the Austrian legal page: home, Postfach, or service address.
