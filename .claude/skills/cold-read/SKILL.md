---
name: cold-read
description: Use when a page or tool on Hookd needs judging by someone who has never seen it — after a round of UI or copy changes, before calling a design finished, or when asked "is this understandable", "test it with fresh eyes", "would a first-time visitor get this", "run a usability check". Also use before agreeing that a reported usability problem is real, since a finding can come from how the page was driven rather than from the page.
---

# A cold read of a Hookd page

A cold read is one subagent, playing a visitor who has never seen the site, using the **live**
page and nothing else. Six of these shaped `/tools/yarn-weight/`, and every one of them found
something the people who built it could not see.

**The tester must know nothing.** No repo, no source, no design brief, no explanation of how
the thing is meant to work — that last one is the test. A brief that says "check the divisor
handles the ×1000 convention" only ever proves the agent can read the brief back.

## Running one

Dispatch a `general-purpose` agent in the background, with:

- **a persona and a page**: "You are a hobby crocheter who has never seen this website
  before" plus the live URL;
- **the ban**: do not read any files on disk or any source code; use only the live page;
- **their own yarns**: ask them to try what they would plausibly own, not a list you supply;
- **both widths**: desktop, then `resize_window` preset `mobile`, reload, reset to `desktop`;
- **the two questions**: what confused you, and what is broken;
- **the form of the answer**: concise list, most important first, what they did, what they
  saw, why it was a problem, quoting on-screen text exactly; what worked in a few lines at
  the end; no code suggestions.

One tip belongs in the brief, because the tool's browser cannot always type into a page:
values can be set with `javascript_tool` and `input` / `change` / `focusout` events
dispatched by hand.

## Running three

**Prefer three at once to one at a time.** Six rounds of one reader took a week, and each
round found what that reader happened to care about: the phone reader found the pinned bar
covering a field, the cone reader found the divisor, and neither looked at what the other did.
The reads are independent — no shared state, no order between them — so dispatch all three in
a single message and let them run in the background.

Vary the **persona and what they are holding**, never the instructions. Everything else in the
brief stays identical, or the reports cannot be read against each other.

| Persona | What they bring | What it tends to catch |
| --- | --- | --- |
| A ball-band reader on a phone | A 50 g European band with metres on it | Layout, anything pinned or covering a field, tap targets |
| A cone buyer at a desk | A mill cone with a count and no length | The count section, the divisor, the working |
| A US pattern follower | Yards, ounces, US hook letters | Units, conversions, anything that assumes metric |

A fourth earns its place when a change is about one thing: someone who only ever types the
wrong thing — a zero, a word, an extra digit — finds refusals, and someone using a keyboard
alone finds focus order.

**Merge before you act.** The same defect arrives worded three ways, and three reports of one
problem is still one problem. Group them, drop what only one reader saw and you cannot
reproduce, and sort what survives by whether it changes an answer. Say how many readers hit
each thing: what all three met is what to fix first.

## Reading the report

**Verify a defect before fixing it.** Findings arrive with equal confidence, and some are
artefacts of how the agent drove the page. Reproduce it yourself first — the built-in browser
is enough — and only then decide.

**Scripted input is not typing.** The most expensive miss here came from a fix that passed
when values were set through JavaScript and failed with real keystrokes: leaving a field
fires its `change` event while focus is between two fields, so anything reading
`document.activeElement` sees something different than it does under a scripted test. When a
fix is about focus, verify it with `computer` `type` and `key`, not with dispatched events.

**A hidden browser pane changes behaviour.** `IntersectionObserver` never fires and `blur()`
may not, so anything driven by scrolling or focus cannot be judged there. Say so rather than
reporting it as working.

Sort what is left by whether it changes an answer. A yarn that comes out a category wrong
beats any amount of wording.

## Do not re-fix these

They are deliberate, and each was a decision made after a previous cold read. `CLAUDE.md`
carries the reasoning.

| Reported as a problem | Why it stays |
| --- | --- |
| Warning boxes taller than their text; a gap under a dimmed card | Reserved space, so nothing moves when a warning appears |
| A missing percentage is not filled in | The author's call: the reader checks and types it |
| Lace starts at the top of its hook range | What a reader does with lace yarn varies too much |
| The caveats sit below the tool, not beside the answer | The answer column was cramped |

## Then take it to the author

Report the findings, say which you would fix and which you would not, and ask — she triages,
and several rounds have ended with her keeping something an agent disliked. **A cold read
never overrides a decision she has already made.** If a finding contradicts one, name the
conflict and let her decide.

## Common mistakes

| Mistake | What happens |
| --- | --- |
| Explaining how the tool works in the brief | The agent reports the brief back to you |
| Pointing it at `localhost` | You test something no visitor can see; ship first, or say why not |
| Giving it the yarns to try | You get your own test cases, not a stranger's |
| Fixing everything reported | Settled decisions get silently reverted |
| Skipping phone width | Half the findings here have been phone-only |
