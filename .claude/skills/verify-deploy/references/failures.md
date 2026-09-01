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

## Markers that cannot tell you anything — four times

**Symptom.** A deploy check either passes instantly while the bug is still live, or polls to
timeout while the deploy already landed. Either way the result means nothing.

**Four causes, one mistake — treating a marker as fact when it is a guess about output:**

1. `_astro` also matched the *broken* URL, `/_image?href=%2F_astro%2F…`, so the check
   passed while the thing it checked was still broken.
2. `font:600 12px` — the minifier splits that shorthand, so the string never exists.
3. `--type-page-title` — Astro tree-shakes unused custom properties per page.
4. `How-tos` existed in the build, but on `/journal/`, while the poll only fetched `/`.

**Now enforced, not remembered.** `--expect` checks the built page it would poll, and says
which case it is: absent from the build entirely, or present elsewhere (use `--path`).

**Still your judgement:** anchor to structure, not substrings — `src="/_astro/` rejects the
broken form, bare `_astro` does not — and prefer something the change *creates*.


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

## Trusting the wrong evidence

**A required field that blocks a draft gets filled with lies, not skipped.** The review form
demanded alt text, a gauge and a meta description before it would save. The first real review
came back with `heroImageAlt: no`, `ballBandGauge: no` and all four gauge fields `"0"` — typed
only to get past validation, and rendered on the page as a literal "no" and a gauge reading
0 / 0 / 0. **Validate at publish, not at save.** A gate in front of unfinished work does not
protect the data, it corrupts it.

**The built HTML can be right while the page is wrong.** A gallery's main photograph vanished
at runtime: the caption element and every slide shared a `data-caption` attribute, so
`querySelector` matched slide 0 and writing to it replaced the image with text. `npm run build`,
`npm run check` and the audit all passed, and the markup in `dist/` was correct. It took reading
the live DOM to see. **When something looks wrong on the page, inspect the page** — not the file
that generated it.

## Environment traps on this machine

**GitHub auth — three wrong conclusions in one thread, none of them checked twice.**

1. `git config --local --get-all credential.helper` returned nothing, so the docs were rewritten
   to say the helper was Git Credential Manager. The setting is **URL-scoped**:
   `credential.https://github.com.helper = !gh auth git-credential`, preceded by an empty value
   that clears the inherited helper. The bare key is empty by design. **Read `git config --list`
   before concluding anything about how this repo authenticates.**
2. `gh auth status` failed once coming out of sleep, and "gh is not logged in" went into two
   files as fact. It was logged in.
3. `X-Oauth-Scopes` was read three times over a few minutes, still lacked `workflow`, and
   "cannot be fixed, cause unknown" was written down and the CI workflow deleted. It attached
   shortly after. **The OAuth grant and the token are separate** — a token's scopes are frozen
   when it is issued, so the grant page can show a permission the current token does not carry.

`gh auth refresh` does not work here at all: the token lives in the Windows keyring rather than
in `hosts.yml`, so it reports "not logged in to any hosts". Use
`gh auth login --hostname github.com --git-protocol https --web --scopes workflow`. A push
touching `.github/workflows/` is refused without that scope; nothing else about pushing is.

**The pattern, and the reason this file exists:** one observation, treated as settled, built on
immediately. Every entry above is the same shape.

**Node isn't on the inherited PATH.** Fresh tool shells inherit a stale environment. Prepend in
PowerShell:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
```

**`create-astro` writes agent files by default.** It generates `CLAUDE.md`/`AGENTS.md`, which
would overwrite the project spec. Scaffold into a temp directory with `--no-ai` and copy in,
then verify the existing `CLAUDE.md` hash is unchanged.
