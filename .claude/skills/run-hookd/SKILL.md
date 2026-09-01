---
name: run-hookd
description: Build, serve, screenshot and audit the Hookd site locally. Use this to run or start the site, preview it, take a screenshot of any page, check a change before pushing, or answer "how does it look", "does this still build", "check it at 375px", "is this accessible". Run `npm run check` and the audit before every push — together they catch the type errors and the contrast, tap-target, layout-overflow and broken-link failures that this project has actually shipped, none of which `astro build` reports. For checking the *deployed* site after a push, use verify-deploy instead.
---

# Running Hookd locally

Static Astro site. Paths below are relative to the repo root.

Everything goes through one driver: **`.claude/skills/run-hookd/driver.mjs`**. It builds,
starts the preview server, and drives the result in headless Chrome over the DevTools
Protocol. There are no new dependencies — it uses the Chrome already installed and the
`WebSocket` global that Node 22+ ships. Playwright and Puppeteer are **not** installed and
are not needed.

Drive the rendered page, not the source. Every design bug that reached production here was
invisible in the CSS: terracotta failing contrast by 0.27, every link being under the minimum
tap size, labels that passed contrast and still could not be read.

## Prerequisites

Node 24 (`.nvmrc` pins it; Astro needs >= 22.12 and rejects odd majors) and Chrome or Edge
installed at a standard path. First run only:

```bash
npm install
```

## Run the audit — do this before every push

```bash
node .claude/skills/run-hookd/driver.mjs audit
```

Builds, serves, then loads **every route it finds in `dist/`** at **375px and 1280px** — so new entries are covered the moment they build — and checks each render for:

| Check | Why it exists |
| --- | --- |
| Horizontal overflow | The house rule is mobile-first, verified at 375px |
| Exactly one `<h1>` | Project rule |
| Content present without JS | Crawlers fetch scripts but do not run them |
| Tap targets >= 24px tall | WCAG 2.5.8. Inline links in a sentence are exempt and skipped |
| Contrast vs the real background | Computed, not guessed at from tokens |
| Uppercase labels >= 11px | Small uppercase with wide tracking is unreadable even when contrast passes |
| Every internal link resolves | Broken links are invisible until clicked |

Exit code 0 clean, 1 on findings, 2 if it could not start. Output ends with:

```
34 page-renders checked, 0 issue(s)
68 known scaffolding element(s) skipped — they go when the placeholders do
```

Both counts move as content is added — two renders per route — so read them as a shape, not
a target. What matters is the issue count, and that the skipped count is not silently rising.

The skipped count is real. Elements marked `data-scaffold` — the dashed wordmark caption,
the social-stub caption, the striped photo placeholders — fail contrast on purpose and are
counted rather than reported. **When you delete a placeholder, delete its `data-scaffold`
attribute too**, or the audit will stop watching something that now ships.

## Take a screenshot

```bash
node .claude/skills/run-hookd/driver.mjs shot / --width 375
MSYS_NO_PATHCONV=1 node .claude/skills/run-hookd/driver.mjs shot /patterns/oland-cardigan/ --width 1280
```

**In Git Bash, prefix with `MSYS_NO_PATHCONV=1`.** A route argument starting with `/` gets
rewritten into a Windows path before Node sees it, and the driver fails with
`Cannot navigate to invalid URL` — which reads like a driver bug and is not one. PowerShell
does not need the prefix.

Full-page PNG into `.screenshots/` (gitignored), path printed on stdout. **Then open it and
look.** Reading a screenshot found the duplicated `"cowl styled, 4:5, 4:5"` caption that no
measurement would ever have flagged.

## Just serve it

```bash
node .claude/skills/run-hookd/driver.mjs serve   # build + preview, leaves it running
npx astro preview status                         # is one already up, and since when?
npx astro preview stop                           # stop it
```

Or the plain human path: `npm run dev` → http://localhost:4321, Ctrl-C to stop. Useful for
hot reload while editing; useless for anything an agent needs to observe.

## Type-check — the gate `astro build` does not give you

```bash
npm run check
```

`astro build` does **not** type-check, so a type error in `.astro` frontmatter builds clean
and ships. `tsconfig.json` extends `astro/tsconfigs/strict` and nothing enforced it until
this script existed; the first run found four real errors, including a Zod 3 `.refine`
signature that type-checked as a params object and silently threw away every custom
validation message — authors saw `Invalid input` instead of the text written for them.

Errors are the gate. **Hints are not** — there are ~65, mostly `z is deprecated` from Zod 4,
and chasing them is not the point. Read them when you touch a file, ignore them otherwise.

## The rest, in order

```bash
npm run check                        # types — fails on things the build ignores
npm run build                        # required; a missing SEO field fails here by design
node .claude/skills/run-hookd/driver.mjs audit
python scripts/check-cms-config.py   # CMS form vs Zod schema parity
```

`check` before `build` because it is faster and its errors are more specific. Run
`check-cms-config.py` whenever `src/content.config.ts` changes — the CMS form and the schema
drift apart silently otherwise, and the author finds out from a failed deploy rather than
from the form.

## Gotchas

- **`astro preview` daemonises.** The npm process exits immediately while the server keeps
  running, so never wait on the child — poll the port. Stop it with `npx astro preview stop`,
  not Ctrl-C. The driver handles this; you will hit it if you spawn preview yourself.
- **"Preview did not come up" can be a lie.** `astro preview` has been seen to bind **::1
  only**: `curl http://[::1]:4321/` returns 200 while `127.0.0.1` refuses, and Node's `fetch`
  resolved `localhost` to IPv4 — so the driver reported the server missing while it was
  serving. `isUp` now tries both stacks. If this recurs, check
  `npx astro preview status` before believing the driver.
- **A stale listener can hold 4321 without serving.** `astro preview stop` did not clear it and
  no `node` process was listed; the port showed LISTEN under a pid that answered nothing.
  `Get-NetTCPConnection -LocalPort 4321` finds the owner, then stop that process.
- **Reuse the running preview.** The driver skips build+serve if 4321 already answers. If you
  changed source and the audit looks stale, stop the preview first — otherwise you are
  auditing the previous build. `npx astro preview status` prints the pid and uptime, which is
  the quickest way to tell whether what you are looking at predates your edit.
- **`--hide-scrollbars` is load-bearing.** Without it Chrome's scrollbar eats ~15px of the
  viewport and the overflow check reports false positives at 375px.
- **Poll `document.readyState`, don't trust `Page.loadEventFired`.** It can fire before the
  stylesheet applies, and every measurement then comes back wrong.
- **CDP needs `flatten: true`** on `Target.attachToTarget`, or page-session commands go
  nowhere on one socket.
- **The shot command scrolls the page before capturing.** `captureBeyondViewport` photographs
  the whole page but does not scroll it, so anything `loading="lazy"` below the fold never
  starts loading and comes out blank. A gallery screenshot was entirely empty while every
  image served 200. The wait for those images is capped at 3s — an image that never enters
  the viewport never fires `load`, and waiting on it unconditionally hangs forever.
- **Git Bash cannot push.** GitHub credentials come from `gh` via a URL-scoped repo-local
  helper (`credential.https://github.com.helper = !gh auth git-credential`), and `gh` is not on
  Git Bash's PATH — the push fails with `gh: command not found` then "Invalid username or
  token". Push from PowerShell. `node`, `curl` and the driver are fine in either shell.
  A push touching `.github/workflows/` is rejected whatever the shell: gh's token has no
  `workflow` scope.
- **Node is not on the inherited PATH** in fresh tool shells. In PowerShell, prepend:
  `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`
- **Verifying a deploy is `verify-deploy`'s job, not this one.** Its `--expect` guard exists
  because markers that cannot match have wasted time here four times over.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Build failed. Fix that first` | The audit needs a build. Run `npm run build` and read the error — a missing required SEO field fails here by design. |
| `Preview did not come up within 20s` | Something else holds 4321, or the build produced no `dist/`. `npx astro preview stop`, then retry. |
| `Chrome did not expose a debugging endpoint` | No Chrome/Edge at the paths in `CHROME_CANDIDATES` in the driver. Add yours to that list. |
| `No Chrome or Edge found` | Same — the driver prints every path it tried. |
| Audit fails only on `data-scaffold` elements | It should not: those are skipped. If they are reported, the attribute was lost in an edit. |
| `DeprecationWarning: Passing args ... shell option` | Harmless Node 24 warning from spawning npm on Windows. Ignore. |
| `npm run check` reports errors but `npm run build` passes | Expected. The build does not type-check; that is the whole reason `check` exists. Fix the errors. |
