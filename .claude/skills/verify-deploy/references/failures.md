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
host built this as a server app; the deployment is static assets with no server, so nothing
answers the endpoint. `astro.config.mjs` now pins `output: 'static'` and the sharp image
service against this.

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

## A silent build failure that looked like a slow deploy

**Symptom.** Pushed a commit, site never changed. No error anywhere.

**Evidence.** A previous deploy had landed in 62s. After 11 minutes the live HTML was
unchanged. GitHub showed nothing: `repos/.../deployments` was empty and
`commits/main/status` returned `state: pending, count: 0`.

**Cause.** The build failed on Cloudflare. Cloudflare's git integration reports no commit
status, no deployment record and no notification, and the previous deployment keeps serving.

**Lesson.** A failed deploy and a successful one are indistinguishable from the outside unless
you have a marker that must change. Past roughly three minutes with no change, assume failure
and ask for the build log rather than theorising — the log is only available in the dashboard,
which Claude has no access to.

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
