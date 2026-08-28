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

## Environment traps on this machine

**Reading the wrong config key, twice, to produce two wrong conclusions.** These notes said a
`gh` credential helper was configured local to this repo. That was correct. I checked it with
`git config --local --get-all credential.helper`, got nothing, and rewrote the docs to say the
helper was Git Credential Manager. The real setting is URL-scoped —
`credential.https://github.com.helper = !gh auth git-credential`, with an empty first value to
clear the inherited helper — and the bare key is empty by design. **Query
`credential.https://github.com.helper`, or `git config --list` and read, before concluding
anything about how this repo authenticates.**

Then, on one `gh auth status` failure, I recorded "gh is not logged in" as fact. It was logged
in; the command had failed once coming out of sleep. Two documented "corrections" were pushed
before either was checked a second time. The pattern is the one this file exists for: a single
observation, treated as settled, built on immediately.

**`gh auth refresh` is unusable on this machine.** It reports "not logged in to any hosts" while
`gh auth status` shows a valid login, because the token lives in the Windows keyring rather than
inline in `hosts.yml`. `gh auth login --hostname github.com --git-protocol https --web --scopes
workflow` works instead, and git picks the new token up with no config change — the helper is
already pointed at gh.

**A push touching `.github/workflows/` is rejected**: "refusing to allow an OAuth App to create
or update workflow ... without `workflow` scope". Nothing else about pushing is affected, so it
only bites when adding CI.

**Do not try to fix that scope again.** It was attempted at length: `gh auth refresh` is unusable
here (keyring storage), `gh auth login --scopes workflow` completed and the GitHub CLI app grant
was confirmed on github.com to include "Update github action workflows" — and the issued token
still came back `gist, read:org, repo` from GitHub's own `X-Oauth-Scopes` header, twice, after a
full logout and re-login. Cause unknown. **If CI is ever wanted, add the file through the GitHub
web UI**, which uses the browser session rather than the token, and pull it down.

**A push touching `.github/workflows/` is rejected.** GitHub returns "refusing to allow an
OAuth App to create or update workflow ... without `workflow` scope". GCM's stored token lacks
that scope. Nothing else about pushing is affected, so this only bites when adding CI.

**Node isn't on the inherited PATH.** Fresh tool shells inherit a stale environment. Prepend in
PowerShell:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
```

**`create-astro` writes agent files by default.** It generates `CLAUDE.md`/`AGENTS.md`, which
would overwrite the project spec. Scaffold into a temp directory with `--no-ai` and copy in,
then verify the existing `CLAUDE.md` hash is unchanged.
