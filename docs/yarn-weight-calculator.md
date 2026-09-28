# The yarn weight calculator

Why `/tools/yarn-weight/` behaves as it does, and what it cost to find out. `CLAUDE.md` keeps
the few facts about it that bind other files; everything else is here.

Read this before changing the tool's behaviour, its arithmetic, or its wording. Most of it was
decided after a cold usability read or the author's own testing — the `cold-read` skill says
how those are run, and the `house-voice` skill owns the wording rules this tool shares with
the rest of the site.

## What is not obvious from the code

- **The arithmetic lives in `src/lib/yarn-weight.ts` and nowhere else.** It has no DOM and no
  Astro, so `src/lib/yarn-weight.test.ts` can call it — and that file *is* the specification:
  the values in the design brief (`6 / 15000` wool → 250 m/100 g → 3 Light, and the rest) are
  its first block. If a refactor breaks one, the refactor is wrong. The numbers themselves
  come from the author's spreadsheet (`yarn_weight_calculator.xlsx`); the tables are copied
  from it, not rounded, so change the spreadsheet and this together.
- **It is not a `client:load` island, because there is no UI framework here.** The form, every
  counting system's field and the four caveats are server-rendered and the script only reads
  the form, calls `calculate` and shows or hides — the same arrangement as the quiz, and for
  the same no-JS rule. Without JavaScript it says it cannot do its sums instead of showing
  a button that does nothing. The caveats stay either way.
- **It answers as you type, and there is no button.** There was one: nothing was worked out
  until it was pressed, and everything followed each edit afterwards, so the same form
  behaved two ways depending on whether you had pressed it once. The author found that
  inconsistent and it went. Keystrokes render after a 450 ms pause, so "380" does not flash
  through 3 m/100 g (refused) and 38 (Super Bulky) on the way, or announce them. The result
  region is `aria-live="polite"`, which the design file lacks. Wool-equivalent and blend
  density are deliberately never shown.
- **When the form stops describing a yarn, two things happen on two clocks.** *The answer
  stops claiming to be current at once*: the category dims and, in the place where the yarn
  is read back, a line says what it is waiting for. *The reader is told something is wrong
  only when focus leaves the part of the form it is about* — the metres box, the yarn count
  section, or the blend as a whole (`data-yw-group`, `settled`) — or at once for a deliberate
  click such as a divisor chip or a counting system. The metres box and the count were once
  one part, and a bad length went unremarked while the reader tabbed on to the count toggle.
  Leaving one percentage box for the next is still not leaving the blend: 46 / 20 / 34
  passes through 46 and 66.
- **The length and the blend are judged separately** — `lengthProblem` and `blendProblem` in
  the library, each asked on its own. `calculate` returns one refusal, and when that was the
  page's only source a wrong length hid a wrong blend: a reader fixed the length and was then
  surprised by a percentage problem the page had stopped showing.
- **The words in the answer panel do not follow the typing.** The waiting panel is one
  sentence — "Fill in how long a ball of it is, and what it is made of." — until there is an
  answer, and an out-of-date reason names the problem without a running figure ("Waiting for
  the percentages to add up to 100", not "they come to 66% now"). A panel that reworded
  itself at every step pulled the author's eye away from the form, which is where it belongs.
  Progress shows as a small ochre tick **beside the part of the form that is done** — the
  "Metres per 100 g" label, "The count" label, and the blend's total — not in the answer
  panel, where the author found it in the wrong place. Kept deliberately quiet (her words:
  "not too in your face"), held in place by `visibility` so it appearing moves nothing, and
  hidden from screen readers.
  **An out-of-date reason names every problem, not the first** ("The length looks wrong, and
  the percentages do not add up to 100"): naming one let the other ambush the reader after
  she fixed it. "Waiting for a length a yarn could have" read as a riddle and went. The
  reason names the box it came from: a count with the divisor forced says "the count gives a
  length no yarn has — try the divisor on Automatic", where "the length looks wrong" had
  sent a reader to a metres box she had left empty.
- **Step 2 starts empty, and there is no answer until a fibre is chosen.** It was pre-filled
  as 100% wool, and readers who typed a length saw an answer at once and never looked at
  step 2 — every cotton and alpaca was being worked out as wool. Two rules keep it from being
  a chore, both in `effectiveRows`: a row with neither fibre nor percentage is not there, and
  **one fibre with no percentage is all of it** — the box shows that 100 as its placeholder,
  and step 2's note says so in words. **With two fibres a blank is not assumed** — not even
  the one missing share of "Wool 60 + Nylon". A cold read expected the 40 filled in; the
  author ruled it out: the reader checks and types it, and the page makes no assumptions.
  The same fibre twice is read back once ("100% wool"), and a percentage may carry its `%`.
- **On a phone the answer is pinned to the foot of the screen while it is out of view** —
  `.peek`, one line, driven by two IntersectionObservers. The button used to scroll the answer
  into view; without it, a reader typing at the top of a phone screen had an answer changing
  a screen below them with nothing to say so. It shows while there is an answer, the form is
  on screen and the answer panel is not — so on a desktop, where the panel is sticky beside
  the form, it never appears — and says "out of date" when the answer is. It does not scroll
  the page itself: moving the page under someone's thumb while they type is worse than the
  problem.
- **Strand counts are chosen on the wool-equivalent and shown in the reader's own
  m/100 g.** The page says the length divides by the number of strands; a reader with
  380 m/100 g checks that two strands make 190, and the wool-equivalent version said 181. The
  band chosen is the same either way (the fibre correction is a multiplier, so it commutes
  with the division), so only the display changed — and the brief's §8 figures for strands
  are pinned in the tests in the reader's terms, with a note.
- **The strands answer is set as an answer**: `strandsToReach` returns a headline ("2
  strands", "No exact fit") shown in the serif, and a detail line, in a small panel of its
  own — smaller than the category, since it answers a follow-up. It was one line of 15px
  body text under a select that was better dressed than it, and read as a footnote. **When
  no count lands in the band it names the categories either side *and* their m/100 g**, and
  every answer ends with the target band in the reader's own m/100 g ("For this yarn, 3 Light
  (DK) is about 220–283 m/100 g"). Figures alone ("2 strands give 400 m/100 g, 3 give 267")
  said nothing about weight; categories alone could not be checked. A crocheter who knows
  "two strands of fingering make DK" was told her 190 m/100 g alpaca blend was not DK, and
  only the band — shifted by the fibre — shows why. **Nothing the result already says is said
  again**: one strand *is* the answer above, so "No exact fit" between one and two strands
  names only the two ("2 strands already make 4 Medium…"), and only heavier categories
  can be picked: the yarn's own ("— this yarn") and every finer one are listed but greyed
  out, rather than answered "1 strand, held together" or "None — already heavier". Several strands landing in the yarn's own band only matters for very fine lace,
  and is not worth the arithmetic. Ranges read low to high ("about 218 to 267"), and
  "No exact fit" names what to swatch ("Swatch 1 strand and 2 strands…").
- **Every message says which figure was used and what to do.** The cross-check used to end
  "Check the divisor", and a reader whose real problem was a leftover length from the
  previous yarn went looking for a setting she could not name. It now says the answer uses the
  metres box and to clear it if the count is the one to trust. A divisor set by hand is never
  called "a guess". The divisor chips are labelled "Divisor" on screen, and the toggle keeps
  the name "The count looks wrong" when open — it used to become "Hide", so the messages
  pointing at it pointed at nothing.
- **The yarn count section is shut by default and its fields are ignored while it is.** A
  reader with a ball band has metres and needs none of it; a reader with a cone does. Open, it
  was more than twice the height of the field above it, so the fallback path looked like the
  main one. Shutting it means "this does not apply to me", so a value left inside cannot
  contradict the label from somewhere the reader cannot see it.

## Step 1: the length, and what a box will take

**Step 1 asks for the length a ball is sold at, and the ball weight beside it.** The box was
"Metres per 100 g", and a cold read pointed out that most balls say "50 g / 125 m": nothing
said to double it, and 125 typed as it stands made a DK wool Bulky. The unit is now a
dropdown — per 100 g, per 50 g, per 25 g — which the author chose over a grams box because
balls come in those three and a choice needs no arithmetic. `statedPer100` in the library
does the scaling, and the summary says it was done ("250 m/100 g (125 m per 50 g)").

**Every number box is a text box with `inputmode="decimal"`, never `type="number"`.** Italian
cones print "Nm 2,5". A number box silently threw the comma away and kept 25, and the page
said Lace, with no warning, for a DK. `parseNumber` has always read a decimal comma; the
boxes were throwing it away before it got there. The number pad still comes up on a phone.

**Something typed that is no length says so.** 0 or −200 used to read as blank and send the
panel back to "Fill in how long…" with the reader's figure still in the box; now it is
`notALength` / `notACount`, flagged like any other length problem.

**A half-typed ply pair is not a count.** "2" on its own is Nm 2 — Worsted — and it
flashed up as a confident answer on the way to 2 / 28, which is Lace. While focus is in the
pair and one box is still empty, `read` withholds the pair; a single figure in either box
(which the hint allows) counts once focus leaves the pair. **"In the pair" is tracked from
focusin/focusout (`inPair`), not read from `document.activeElement`**: the first version did
that, passed a scripted test, and failed a real one — leaving the first box fires its
`change` while focus is between the two boxes, so the half-typed pair was read as whole.

**A box holds a number or nothing.** `parseNumber` refuses anything else, so "220 yds" is
refused rather than read as 220 metres (yards are for later; the box says metres). A comma or
space before exactly three digits groups thousands — "1,200", "10 000" — and any other comma
is a decimal one, so "2,5" is still 2.5. "1,200" read as 1.2 had been refused as "1 m/100 g".

**Every figure is written the same way**: "m/100 g", never "m / 100 g"; thousands with a
comma everywhere (`grouped`); and the page joins a number to its unit with no-break spaces
(`keepUnits` in the script), because on a phone "250 m/100 g" wrapped as "250 / m / 100 g".
Strand bands never share an edge — a band ends one below the next one's floor, "270–349",
because "270–350" and "350–550" left 350 in both.

## Naming

**It is a "yarn count", never a "mill count"** — see the `house-voice` skill.

## What it refuses, and what it answers with a note

**A length no yarn has is refused before the category lookup.** Every figure has *some*
category — `categoryFor` returns Super Bulky for anything down to zero and Lace for anything
above 550 — so a wrong answer was printed as confidently as a right one, in 86px type. A
first-time reader forced the divisor to ÷ 1 on a cone marked `NM 2000`, got 200,000 m/100 g,
and was told **0 Lace**: six categories from the truth. The guard is on the *length*, between
10 and 30,000 m/100 g, which is wide enough to pass the finest thread the tool claims to
handle and narrow enough to catch a divisor off by a power of ten. It blames the divisor on
`input.divisor !== 'auto'`, **not** on `divisor !== 1` — the case that prompted it is a
divisor forced *to* 1.

## Hooks

**Lace starts at the top of its range (2.25 mm) on purpose.** A cold read called it a
mistake; the author kept it — what a reader does with lace yarn varies too much, and the
smaller steel hooks are for thread.

**The hook is a size to start with, then the usual range — in the site's own words.** The
Craft Yarn Council's table is the reference for correctness, not for wording (the author's
call). Each category's `hook` holds a starting size (roughly the middle of the range,
rounded to a hook people own), the range, and the US sizes; `hookAdvice` words it as "Start
with 5 mm (US H-8)" over "Usual range 4.5–5.5 mm (US size 7 to I-9)". A reader shown only the
range asked which end to begin at. **Every starting size has a US equivalent** — Super Fine
starts at 2.75 mm (C-2) and Super Bulky at 10 mm (N/P-15), not 3 and 12, which have none —
and US 7, which has no letter, is written "size 7" so it does not read as a count. Ranges run low to high — CYC writes Lace's steel sizes
largest first, which read as a typo. US sizes are stored rather than derived through
`src/lib/hooks.ts`, which would give "M/N-13" and "P/Q" where CYC has M-13 and Q. CYC's
gauge column is deliberately not shown: gauge is the input the brief rules out, and CYC
gives Lace's gauge in double crochet and every other category's in single crochet.

**The result says that ball bands disagree with it.** One quiet line under the hook:
"Ball bands often name a weight either side of this. This goes by length and fibre alone."
A reader whose Paintbox Cotton DK came out Sport simply distrusted the tool.

**Mohair and angora carry the brushed-yarn caveat beside the answer**, as a "Worth
confirming" note: the reader has just told the page the fibre, and kid-silk mohair was
otherwise answered "0 Lace" with the halo's bulk unmentioned outside the caveats below.

**Nylon and polyamide, viscose and rayon are one entry each, with both names** — "Nylon
(polyamide)", "Viscose (rayon)" — so a reader looking for either finds it. Two cold reads
running wondered whether the pairs behaved differently. The author's call.

**A figure finer than any yarn is answered, with a note.** Above 4,000 m/100 g (the finest
lace on a cone is about 2,800) the answer carries a caution that it is more like sewing
thread — a reader who typed an extra zero was otherwise told "Lace" and nothing else.

## What is tested, and against what

**The published mill data is a test; the author's stash is not.** The ten ColourMart and
JaggerSpun yarns from the spreadsheet's Reference tab are pinned in `yarn-weight.test.ts`.
They are public product data, and the two lofty cashmeres are pinned at the calculator's
answer rather than the seller's. The Yarn Stash Tracker comparison was run separately on
21 Sep 2026 and kept out of this public repo: 25 yarns, 14 agree. The three largest misses
were all brushed yarns, which the first caveat already covers. Two of the others were
contradictions in the tracker itself: Snorre and Karisma have identical inputs but different
recorded categories, and Safran and Catona are recorded in the wrong order. A beaded yarn is
refused, and the author decided to keep it that way.

## The divisor

**A stated m/100 g picks the divisor, but only when it reconciles the count.** With one, the
divisor is whichever power of ten brings the two together — which is right in both places the
flat "printed ≥ 300 → ÷ 1000" rule fails, namely yarn under 30 m/100 g and thread finer than
Nm 300. The catch is that rounding a logarithm always yields *some* power of ten, so a count
and a label that genuinely disagree get one anyway and the cross-check then reports a figure
bent toward the label: `2 / 28` against a stated 380 was divided by 10 and reported as 140
rather than its honest 1400. The inferred divisor is therefore adopted only when it brings
the two within the same 5% the cross-check uses. **The flat rule is the fallback, not the
default.**

## Alerts, colour and contrast

**A message that needs attention gets a heading, a mark and a tint — never colour alone.**
The cross-check and "Not yet" panels shipped as a white fill with a 3px bar and read as one
more note beside the result. They now carry an uppercase heading naming the problem ("These
two do not agree" / "Worth confirming" / "Not yet"), a small ringed `!`, a 4px bar and
`--alert-warning` or `--alert-caution` — the site's own accents at about 12%. No red banner:
the type is unchanged and the tints are the existing hues. `--ochre-text` exists because
`--ochre` is 4.15:1 on the warning tint and 4.45:1 on the caution one, so both missed AA;
this one value clears it on the tints, the paper and the panel alike.

The "Total N%" warning is `--ochre-text`, the same colour as the warning box beneath it:
it was terracotta over an ochre box, one problem in two colours. A box the reader needs to
fix is outlined all the way round — a bar on its left edge alone looked like the text
cursor — on the wrapper where the border lives (the metres field, the percentage box). `--field` and `--field-border` are new: the input fill and edge the brief lists as
literals.

## Layout and spacing

**The form has one left edge, one spacing scale, and columns that do not resize.** All three
came out of a cold usability read, and all three are easy to undo by accident:

- **Step numbers sit above their headings, not beside them.** Inline, the numeral held the
  x=0 slot and pushed the heading 21px right of every other element in the column — and since
  the heading is the heaviest thing there, it read as a misaligned heading rather than as a
  numeral in a gutter. There is no room to hang one properly at 375px.
- **The gaps are 8 / 16 / 24 / 40 and nothing else.** They were 6, 19, 8, 6, 24, 22, 8, 6, 13,
  38, 6, 19, 12, 38 — nine values, no two of which meant anything different to a reader.
- **`--pct-w` and `--rm-w` are shared** by the fibre row, the percentage box and the total
  beneath them, so the three cannot drift. The remove button keeps its column even when
  invisible (`.is-hidden` is `visibility`, not `hidden`): removing it from the layout resized
  the row beside it, and at 375px the fibre select dropped 215px → 155px the instant a second
  fibre was added, clipping "Bamboo viscose" to "Bamboo visco" in a row already filled in.
  **Both values are as tight as their contents allow** — every pixel taken comes off the
  fibre name, which needs 127px at 375px.

## The answer panel, and the phone bar

**A problem keeps the last good answer on screen, dimmed, with the reason inside it.** The
category and hook fade; the reason takes the place of "The yarn you entered", so it is
beside the figures it explains. It used to be a line above the card, which pushed the card
down on every invalid keystroke and was scrolled off screen while the reader worked in
step 2 — leaving a pale card describing a yarn she had not typed. **The check and strands
panels are hidden while out of date**: they described the old input, and one went on saying
the count "was read as 2000 ÷ 1000" after the reader had just set ÷ 1. Clearing the length
or emptying the blend is a fresh start rather than a mistake, so it goes back to the waiting
panel.

**A warning appears twice, deliberately: under the fields it is about, and in full beside the
answer.** On a phone the answer is a screen away. **Nothing moves when a warning appears.**
Each warning shares a `.slot` with the hint it replaces — one grid cell, the one not showing
kept by `visibility`, not removed — plus a never-shown `.slot__sizer` holding the longest
warning that slot can carry, so the slot is always tall enough for any of them. Without the
sizer a warning box, with its padding, was 20px taller than the hint and still pushed the
next field down just as focus reached it. The count's working line holds its place the
same way from the moment the section opens; it used to appear with the first figure and push
the section down 48px. **The blend's warning is the exception and holds no space**: only the
answer and the caveats sit below it, never a field in use, and the space it held was a 100px
hole at the foot of the form on a phone. The box concerned is outlined as well, but never as
the only signal: the words name the field.

**The working line is one sum, true as read** — "Printed 2500 ÷ 1000 × 100 = 250 m/100 g".
It had an Nm step ("→ Nm 2.5 →") that said the same thing twice and made the line change
length; the × 100 is the step that turns metres per gram into metres per 100 g, so it is
written rather than implied. A ply pair shows its division ("Nm 28 ÷ 2 × 100"): "Nm 14"
was a figure the reader could not find on her label. Before there is a count the tile says
"The sum appears here once there is a count." in the quieter label ink, and "The count looks wrong" is
not shown at all — under empty boxes it read as a warning, above a gap that looked broken.

**On a phone the pinned answer bar keeps the focused field clear of itself** — it sets
`scroll-padding-bottom` while it shows and scrolls a covered field up. A cold read found it
covering the fibre dropdown being filled in. It is one line that never wraps: out of date it
reads "Out of date · See why", and when the count and the label disagree its link reads
"Check the figures" — the panel that explains it is a screen away. It shows the familiar
name only — "1 Fingering/Sock", "4 Worsted/Aran" — with no "Answer" label: the full name
was cut to "1 Super Fine (Fingeri…", losing the very words a crocheter knows. **It also goes once the foot of the form is nearly on screen**
(a third observer, on the row holding "Add a fibre", with a 72px bottom margin): there the
answer is a short way below anyway, and the bar was sitting over "Add a fibre". Opening the
yarn count section leaves focus on its toggle; it used to jump to the system select.

**A rule separates the page intro from step 1.** Without it, the intro's last line, "Step 1"
and the first question stacked into a single column of text, and the heading read as though
it ran on into the form. It is full width so it spans the answer column too. It is the same
rule the quiz page uses between its title block and the quiz.

**The caveats sit beneath the whole tool, full width, and there are three.** The brief put
four beside the result. That made the answer column nearly as tall as the form, so the sticky
answer barely moved, and the author found the column cramped and cluttered. She asked for
them underneath instead. "Where the divisor gives up" moved into the divisor panel, the only
place it applies. At the top of the page, "thread finer than Nm 300" was the most
intimidating line a ball-band reader met before typing anything. The section lives outside
`.yw`, so it cannot use the `--s1`–`--s4` spacing tokens defined there. It uses literal sizes;
with the tokens they silently resolved to nothing, and the caveats ran together on a phone.
