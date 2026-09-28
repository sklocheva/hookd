---
name: ship-it
description: Use when work on Hookd is ready to go live — asked to "push", "deploy", "ship it", "put it live", "push to main", or when a task is finished and the change should reach the live site. Also use before saying a change is live, since a push is not a deploy here. Not for pushing someone else's branch or opening a PR; this is the push-to-main release this repo actually uses.
---

# Shipping a change to Hookd

Pushing `main` is the deploy: Cloudflare rebuilds and the live site follows about a minute
later. There is no deploy command, no staging, and nothing that emails you when a deploy goes
wrong, so everything below runs **before** the push, in this order.

**Push only when the author has asked for it.** Deploying is outward-facing; her pattern is
to test on the live site, but she says when.

## The gates

```bash
npm run check
```

```bash
npm test
```

```bash
node .claude/skills/run-hookd/driver.mjs audit
```

`check` is the only type-check — `astro build` does not type-check, so a type error ships
without it. The audit builds the site itself, so a passing audit covers `npm run build`. CI
runs all three after the push as well, but by then the deploy has already happened.

Stop a dev server on 4321 first, or the audit's preview server cannot start.

## Write down the why

Before committing, put anything that will not be obvious from the code into `CLAUDE.md` — a
decision the author made, a failure that caused the change, wording that must not drift back.
That file is the reason a later session does not re-litigate settled things. Decisions she
has made about a tool also belong in the session memory notes.

## Commit

Write the message to a file in the scratchpad and commit with `-F`:

```bash
git commit -F <scratchpad>/commitmsg.txt
```

PowerShell here-strings break on the quotes and dashes these messages contain, and `-m`
chains lose the structure. End every message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Say what changed and **why**, one bullet per decision, in the author's plain register — no
jargon she would not use herself.

## Push, from PowerShell

```
git push origin main
```

**Git Bash cannot push this repo.** The credential helper is `gh`, which is not on Git Bash's
PATH, so it fails with `gh: command not found` and then an invalid-token error. Use the
PowerShell tool.

## Then prove it is live

```bash
bash .claude/skills/verify-deploy/scripts/verify-deploy.sh --sha HEAD
```

Cloudflare's green check means its build finished, nothing more, and a failed build leaves the
old version serving — so "I pushed and the site still works" is exactly what a failed deploy
looks like. Use the `verify-deploy` skill when it reports anything. A single asset failing
with `HTTP 000` is usually a network blip; re-request that URL before treating it as a
failure.

Finish by checking the live page for something that actually differs — the new text, the new
attribute — not just a 200.

## Common mistakes

| Mistake | What happens |
| --- | --- |
| Pushing before the audit | Contrast and tap-target failures reach the live site; CI tells you afterwards |
| `git push` from Git Bash | Fails on credentials, mid-release |
| Saying "it's live" after a green push | Cloudflare green only means the build finished |
| Leaving a dev server running | The audit cannot start its preview server |
| Deleting `wrangler.jsonc` or its `assets.directory` | Cloudflare builds in server mode and every image 404s |
| Reporting the deploy verified when a check failed | Say which check failed, and what it said |
