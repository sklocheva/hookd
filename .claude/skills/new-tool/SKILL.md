---
name: new-tool
description: Use when a second tool is being added under /tools/ on Hookd, or an existing one is being extended — a calculator, converter, chart or anything else a reader types into and gets an answer from. Also use before designing one, since several of the rules below decide the shape of the thing rather than its finish.
---

# Adding a tool

`/tools/` is a plain list; each tool is a page under `src/pages/tools/` plus one entry in that
list. Everything below was paid for by the yarn weight calculator, whose own decisions are in
`docs/yarn-weight-calculator.md`.

## The shape

| Part | Where | Why |
| --- | --- | --- |
| The arithmetic | `src/lib/<tool>.ts` — no DOM, no Astro | So a test can call it |
| Its specification | `src/lib/<tool>.test.ts` | The tests *are* the spec; a refactor that breaks one is wrong |
| The form and the answer | `src/components/<Tool>.astro` | Server-rendered markup, one plain `<script>` |
| The page | `src/pages/tools/<tool>/index.astro` | Intro, a full-width rule, the tool, the source line |

**Not a `client:load` island.** This site has no UI framework, and crawlers fetch scripts but
do not run them. The script reads the form, calls the library, and shows or hides. Without
JavaScript the page says it cannot do its sums — it never renders a control that does nothing.

## Rules that decide the design

- **It answers as you type. No button.** A button means the form behaves one way before the
  first press and another after, which the author rejected outright. Render on a pause (450 ms
  in the calculator), so a figure being typed does not flash three wrong answers on the way.
- **Refuse an impossible input before presenting an answer.** Every figure has *some* answer,
  so a wrong one prints as confidently as a right one. Guard the input range, and word the
  refusal by the most likely cause.
- **Say when an answer is only just an answer.** Near a boundary, or outside what the model
  really covers, say so rather than rounding the doubt away.
- **The answer region is `aria-live="polite"`**, and text is written only when it changes, or
  every keystroke is announced.
- **The words in the answer panel do not follow the typing.** A handful of fixed states, no
  running figures. Progress belongs beside the fields as a quiet tick, not in the panel.
- **Warnings wait for focus to leave the part of the form they are about**; a deliberate click
  (a chip, a dropdown) speaks at once. Group the form with `data-yw-group`-style markers and
  judge each group on its own, so one problem cannot hide another.
- **Nothing moves when a warning appears.** Each warning shares a grid cell with the hint it
  replaces, plus a never-shown sizer holding the longest warning that cell can carry. The
  exception is a warning with nothing below it but the answer and the small print.
- **On a phone, pin the answer while it is out of view** — one line that never wraps, gone
  once the foot of the form is nearly on screen, and it must never cover the field being
  typed into or the message it points at.

## Wording, spacing, colour

Read the `house-voice` skill before writing a single label. The spacing scale is 8 / 16 / 24 /
40 and nothing else; the tokens for it are defined on the tool's own root, so anything outside
that root (small print under the tool, for instance) uses literal sizes or silently gets
nothing. Colour comes from `src/styles/global.css` — no literals — and uppercase labels have a
12px floor the audit enforces on the rendered page.

## Before it ships

Tests first: put the brief's own worked examples in `<tool>.test.ts` and make them pass. Then
`npm run check`, `npm test`, the audit, and the `ship-it` skill for the release. Afterwards,
the `cold-read` skill: three readers who have never seen it, each in its own tab.

Add the tool to `/tools/`, to the nav if it earns a place, and to `TODO.md`'s index.

## Common mistakes

| Mistake | What happens |
| --- | --- |
| Arithmetic in the component | Nothing can test it, and the tests stop being the spec |
| A calculate button | The form behaves two ways; this was built and reverted |
| Presenting whatever the maths returns | A wrong answer is printed as confidently as a right one |
| A panel that rewords itself as the reader types | The eye leaves the form, which is where the work is |
| Spacing tokens used outside the tool's root | They resolve to nothing, and the page runs together on a phone |
