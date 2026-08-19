# Failures that have already happened on this project

Each of these cost real time. They're recorded with the evidence that actually identified the
cause, because in every case the first plausible explanation was wrong.

## Broken images that look fine locally

**Symptom.** Page renders, HTML is correct, images don't appear. Local `npm run build`
produces working images.

**Evidence.** The live `<img>` carried
`src="/_image?href=%2F_astro%2Fplaceholder-hero.aRYK9wIt.jpg&w=1200&h=630&f=webp"`, and
fetching that URL returned 404. The same commit built locally produced
`src="/_astro/placeholder-hero.aRYK9wIt_1Ol83K.webp"`, which served 200.

**Cause.** `/_image` is Astro's *runtime* image endpoint, used in dev and in server output. The
repo had no `wrangler.jsonc`, so Cloudflare generated its own config — taking the Worker name
from `package.json` and auto-detecting a framework setup that built Astro in **server mode**.
The deployment is static assets with no server, so nothing answered the endpoint.

**Fixed** in commit `1f7691c` by declaring the Worker explicitly — `name`,
`compatibility_date`, and `assets.directory: ./dist` — so nothing is inferred. Verified: all
image variants serve 200 `image/webp`. If this recurs, check `wrangler.jsonc` still exists.

**What actually found it:** a **warning on a successful build**, saying the config's Worker
name (`hookd`, from `package.json`) didn't match the project (`hookd-blog`). It read as
cosmetic. It was the root cause. Read warnings on green builds.

**How to spot it fast.** If images render locally but not live, look at the `src` attribute
before anything else. `/_image` means server-mode output on a static host.

## A verification check that matched its own failure mode

**Symptom.** A poll for "images are fixed now" reported success instantly, while the images
were still broken.

**Cause.** The check was `grep _astro`. The broken URL is `/_image?href=%2F_astro%2F...` — it
contains `_astro` inside its URL-encoded query string. The check matched the failure it was
written to detect.

**Lesson.** Anchor patterns to structure, not to a substring that can appear anywhere:
`src="/_astro/` rejects the broken form, bare `_astro` does not. A check that passes
suspiciously fast deserves distrust, not celebration. Before relying on a check, state what
the failure looks like and confirm the check rejects it.

## Concluding "the build failed" from a site that didn't change — wrongly

**Symptom.** Pushed a commit, site never changed. After 11 minutes against a 62s baseline, it
was declared a failed build and the commit was reverted.

**The build had succeeded.** The log showed no errors. The change simply had *no effect on the
output*, so the deployed HTML was byte-identical and there was nothing to observe. The revert
was unnecessary and undid a harmless change.

**Lesson — the important one on this project.** "Nothing changed" has two causes that look
identical from outside: the build failed, or the build succeeded and produced the same output.
Do not guess between them. A config-level change often can't be seen in the HTML at all, so
absence of change is not evidence of failure.

Before treating an unchanged site as a failure, ask: *would this change actually alter a byte
of the response?* If it wouldn't, you have no signal either way and must get the build log
instead of inferring. Cloudflare reports nothing to GitHub — `repos/.../deployments` is empty
and `commits/main/status` returns `state: pending, count: 0` — so the log is the only source
of truth, and only the user can reach it. Ask early; guessing cost several cycles and one
needless revert.

## Predicting a hostname and baking it into config

**Symptom.** `site` was set to `https://hookd.pages.dev` before the host existed, on the
assumption the project name would be free. It wasn't — that name is registered to another
account and returns 522. The real host turned out to be a `*.workers.dev` subdomain, so the
value was wrong twice.

**Lesson.** The deployed hostname is a fact to be observed, not predicted. `site` feeds the
canonical link and every sitemap `<loc>`, and `public/robots.txt` repeats the host by hand, so
a wrong guess propagates into three files. When the host isn't known yet, say so and fix it
once it is — and change all three together.

## Misreading DNS and HTTP errors during setup

Two traps, both of which produced confident wrong conclusions:

**Negative DNS caching.** `hookd-blog.pages.dev` was probed while it didn't exist, and the
NXDOMAIN was cached. Later lookups kept failing after the site existed. Query a public
resolver directly (`Resolve-DnsName ... -Server 1.1.1.1`) to bypass the local cache.

**522 does not mean "doesn't exist".** A nonexistent `pages.dev` name returns NXDOMAIN and
doesn't resolve at all. `hookd.pages.dev` resolving to Cloudflare IPs *and* returning 522 meant
the name was claimed by someone else's misconfigured project — the opposite of available. When
probing name availability, calibrate against a known-free control name so you know what "free"
actually looks like.

## Environment traps on this machine

**`git push` fails in Git Bash.** The gh credential helper (`!gh auth git-credential`) is
configured local to this repo, and `gh` resolves in PowerShell but not in Git Bash. In Bash the
push fails with `gh: command not found` then "Invalid username or token. Password
authentication is not supported". Push from PowerShell.

**Node isn't on the inherited PATH.** Fresh tool shells inherit a stale environment. Prepend in
PowerShell:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
```

**`create-astro` writes agent files by default.** It generates `CLAUDE.md`/`AGENTS.md`, which
would overwrite the project spec. Scaffold into a temp directory with `--no-ai` and copy in,
then verify the existing `CLAUDE.md` hash is unchanged.
