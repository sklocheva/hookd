# TODO

Bullet points for now — we expand these into real commands and skills later.

## Ground rules (to formalise)

**Branching and deploys**

- [ ] Work changes on a branch, never straight on `main`
- [ ] `main` is the deploy branch — pushing to it publishes, so merging is the publish decision
- [ ] Merge to `main` only with Sophia's explicit consent, once the page is reviewed and finished
- [ ] No auto-merge, no "while I was in there" commits to `main`
- [ ] Preview the branch before merging — decide how (local `npm run preview`, or Cloudflare preview deployments)

**Making changes**

- [ ] Always build locally first — `npm run build` must pass before anything is pushed
- [ ] Write tests where feasible; decide what "feasible" means here, since there is no test runner yet
- [ ] Verify the deployed result against the live site, not against `dist/` — see the `verify-deploy` skill
- [ ] Check at 375px before calling a change done
- [ ] One change per branch; keep diffs reviewable
- [ ] Don't touch decided stack choices without asking

**Still to work out**

- [ ] Pick a test approach: schema//content validation is the obvious first target (the SEO
      required-fields rule is already effectively a test), plus link checking and the
      `verify-deploy` script as a smoke test
- [ ] Decide whether a pre-push hook or a GitHub Action enforces the build gate
- [ ] Turn these rules into a skill or slash command so they are applied, not just written down

## Blocked on Sophia

- [ ] **Sveltia CMS browser login.** The panel is built and served at `/admin`, but signing in
      needs one of: a GitHub Personal Access Token (works today, no setup), or an OAuth app
      plus an auth worker for proper "Sign in with GitHub". See README.
- [ ] The site name — blocks buying the domain
- [ ] The address for the Austrian legal page: home, Postfach, or service address

## Content and assets

- [ ] **Real photography.** Everything is placeholder. Aspect ratios are baked into the layouts:
      | Screen | Slot | Ratio | Subject |
      | --- | --- | --- | --- |
      | Homepage | pinned hero | 4:5 | cowl styled / blanket folded / yarn haul, autumn tones |
      | Homepage | feed thumbs ×4 | 1:1 | crop of each post's hero |
      | Patterns | cards | 4:5 | cardigan worn · cowl styled · mitts flat lay · blanket folded · tote held |
      | Pattern page | hero | 16:10 | cardigan, worn, outdoors |
      | Journal | rows ×4 | 3:2 | six swatches · ball bands top-down · four stitch swatches in raking light · blocked vs unblocked |
- [ ] **Social share images don't exist yet.** `socialImage` is required and every entry points
      at a path under `/social/` that isn't there, so `og:image` currently 404s. Either add the
      files or point them at a default.
- [ ] **Wordmark artwork.** Currently italic Lora in a dashed box — delete the box and its
      caption in `Header.astro` and `Footer.astro` when real artwork lands.
- [ ] **Social icons** for Instagram, YouTube, Pinterest, Ravelry. Currently text stubs.
- [ ] Replace the example entries. They exist to exercise the schemas, not to be published.
- [ ] Dictate the Y2K skinny shawl stitch post, and the two-colour fingerless gloves pattern.

## Site

- [ ] **About page.** Not designed; currently `href="#"` in both navs.
- [ ] Pattern **instructions and charts** are not designed. `<Row>` exists and the example
      pattern uses it; the surrounding section still needs a design. Written first, chart after.
- [ ] Wire "Print / save as PDF" and "Add to Ravelry queue", or remove them.
- [ ] Empty states: `/patterns/` and `/journal/` with nothing in them.
- [ ] Cloudflare Web Analytics.
- [ ] Custom domain. When it lands, update `site` in `astro.config.mjs` **and** the `Sitemap:`
      line in `public/robots.txt` together.

## Tooling

- [ ] Run the skill-creator **eval loop** against `.claude/skills/verify-deploy` (needs
      subagents — ask first).
- [ ] Run the skill-creator **description optimizer** to tune when `verify-deploy` triggers.
