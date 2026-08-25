---
name: verify-deploy
description: Verify that a push to main actually reached the live Hookd site, and catch the static-hosting failures that look fine locally. Use this whenever you push to main, change astro.config.mjs, change the site URL or domain, touch anything under src/assets/ or an <Image>, or are asked "is it live yet", "did the deploy work", "why is the image broken", or "the site looks wrong". Also use it before telling the user a deploy succeeded — on this project a failed build is silent and the old version keeps serving, so a push that appears to work is not evidence that it did.
---

# Verifying a deploy of Hookd

This site is static assets on Cloudflare Workers, deployed by pushing to `main`. There is no
deploy command and no CI to watch. That makes deploys feel effortless and makes failures
invisible, which is the whole problem this skill exists to solve.

Read `references/failures.md` when you hit something confusing — it records the specific
failures that have already happened here, with the evidence that identified each one.

## The two things that are actually true here

**A failed build is silent.** Cloudflare reports nothing back to GitHub — no commit status,
no deployment record, no notification. When a build fails, the previous version keeps serving
happily. So "I pushed and the site still works" is exactly what a failed deploy looks like.
The only way to know a deploy landed is to find something in the live response that differs
from what was there before.

**The host does not necessarily build what you build.** The same commit has produced different
output locally and on Cloudflare. A green local `npm run build` tells you your source is
valid. It does not tell you what the live site will contain. Verify against the deployed URL,
never against `dist/`.

## Workflow

Run `npm run build` locally first. It's the cheapest way to catch a broken commit, and pushing
something that can't build wastes a deploy cycle.

Then capture a **marker** — something in the live response that will visibly change once your
commit deploys. Pick something the change *creates*, anchored to structure rather than a loose
substring. `--expect` refuses markers the built page does not contain, so a bad one fails in a
second instead of at timeout — see `references/failures.md` for why that guard exists.

Without a marker you cannot distinguish "deployed" from "build failed, old
version still up". The canonical URL, a heading, a piece of copy, an asset filename hash all
work. If your change is invisible in the HTML (a config-only change, for instance), pick the
thing it should affect — an image `src`, a sitemap `<loc>` — and check that.

```bash
curl -s https://hookd-blog.sklocheva.workers.dev/ | grep -o 'rel="canonical" href="[^"]*"'
```

Push, then poll. A normal deploy lands in about 60 seconds. Use the bundled script:

```bash
bash .claude/skills/verify-deploy/scripts/verify-deploy.sh
```

It polls until the site responds, then runs every check below and prints a pass/fail table.
Pass `--expect <string>` to make it wait for your marker to appear rather than just checking
current state. Read the script before trusting it on a new failure mode; it encodes the traps
listed here, not every possible one.

**If the marker hasn't appeared after roughly three minutes, ask for the Cloudflare build
log.** Do not conclude the build failed — that mistake has already been made here. A build
that succeeds but produces identical output is indistinguishable from one that failed, and a
config-only change often alters nothing in the response. Before reading "unchanged" as
"failed", check whether your change would alter a byte of the output at all. If it wouldn't,
you have no signal, and only the log can tell you. Ask early; it is dashboard-only and the
user is the only one who can fetch it.

Read the **warnings** on a successful build too, not just errors. The root cause of the
long-running image bug here was a warning on a green build.

## What to check, and why each one exists

**Images resolve.** This is the failure most likely to recur and the least visible. In server
mode Astro emits `/_image?href=...&w=375&f=webp` for `<Image>`. That is a runtime endpoint. On
static hosting nothing answers it, so it returns 404 and every image on the site is broken
while the HTML still looks perfect.

This was fixed by `wrangler.jsonc`, which declares the Worker name and
`assets.directory: ./dist` so Cloudflare doesn't infer a server-mode build. **If `/_image`
URLs come back, check that `wrangler.jsonc` still exists and still points at `./dist`** before
investigating anything else — `references/failures.md` has the full history.

Check that image `src` values start with `/_astro/` and end in a real extension, then fetch
each one and confirm a 200 with an image content-type.

**The canonical host matches the real host.** `site` in `astro.config.mjs` feeds both the
sitemap `<loc>` entries and the canonical `<link>`. `public/robots.txt` repeats the host by
hand. These drift apart easily, and nothing in the build catches it. Confirm all three agree
with the URL you actually fetched.

**Sitemap and robots.txt serve.** `/sitemap-index.xml`, `/sitemap-0.xml`, `/robots.txt`, all
200.

**The page still meets the project's rules.** Exactly one `<h1>`, and the content is present
in the raw HTML.

The rule is *no client-side-only content*, which is not the same as *no JavaScript*. The
pinned rotator on the homepage is a legitimate script: all three entries render server-side
and it only toggles which is visible. What breaks the promise is content that does not exist
until JS runs, because AI crawlers fetch JavaScript but do not execute it.

Since `curl` never executes anything, whatever the fetched HTML contains is exactly what a
non-executing crawler sees — so checking for real headings and links in that HTML tests the
actual requirement. Counting `<script>` tags does not, and an earlier version of this skill
got that wrong and failed on a correct page.


## Reporting honestly

Report what you observed, not what you expect follows from it. "The canonical flipped to the
new host 62 seconds after the push" is a verified deploy. "I pushed and it should be live" is
not, and on this project it's frequently wrong.

If the site is partly broken, say which part and give the status codes. A working page with
404ing images is not "deployed successfully".

## Environment notes

`git push` needs the gh credential helper, which is configured local to this repo. It resolves
in **PowerShell** but not in Git Bash, where the push fails with `gh: command not found`
followed by "Invalid username or token". Push from PowerShell; `curl` checks are fine in Bash.

Node is not on the inherited PATH in fresh tool shells. In PowerShell, prepend:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
```
