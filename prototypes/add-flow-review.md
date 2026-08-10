# Add flow — design review of `add-flow.html`

> **Provenance note, added after the fact.** `add-flow.html` is a static
> prototype, and roughly a third of what follows leans on evidence that
> does not transfer to the real build. Read Tier 1 as design findings —
> they are argued from `handoff.md` and hold on the document alone. Read
> **Tier 2 as things to watch during implementation, not as defects**:
> tap-target sizes, focus states, 320 px truncation, the duplicated
> success string, and the reused `.photo-drop`/`.grade` classes are the
> mock's own CSS, not design decisions. Two specific overstatements:
> finding 1's "reproduced live" was unwired JS (the real finding is that
> handoff.md states no rule), and finding 3's measurements come from the
> fake phone shell's `max-height: 600px`, not from a sheet spec — though
> its sticky-footer conclusion still holds on the general argument.
> Tier 3 is the most portable part: the prototype used DESIGN.md's tokens
> verbatim, so the contrast failures are inherited from the system.
>
> **Superseded by `add-flow-v2.html` and handoff.md revision (g)**, which
> implement the surviving findings.

Reviewed 2026-08-09 against `handoff.md` revision (f), `DESIGN.md`, and
`PRODUCT.md`. Driven live in Chromium at 390×844, 320×568, and 1280×900 —
every picker opened, every chip pressed, every state entered, with computed
geometry, contrast ratios, and hit-target sizes measured rather than
eyeballed. Numbers below are measured, not estimated.

**Verdict.** The sheet is the right replacement for the wizard, and the
three-intent split is right. The problems are not that it does the wrong
things — it's that four of its load-bearing promises don't survive contact
with the interaction, and the two most irreversible writes in the whole app
(a spot's coordinates, a rock's identity) got the weakest controls on the
sheet.

Findings are ordered by how much they cost, not by how easy they are to fix.
Tier 1 are design holes — the design has no answer, so building it as drawn
means choosing an answer by accident. Tier 2 is execution. Tier 3 is
system-level and reaches past this screen.

---

## Tier 1 — the design has no answer here

### 1. Changing the spot leaves the rock stale, and there is no rule for it

Reproduced live: set Where to Goa Agung, and the Rock row still read "the one
with the crack", the rock search box still read "Search rocks at Citatah",
and the grid still listed Citatah's rocks. The sheet cheerfully offered to
file a problem on a rock at a different spot.

This is not a prototype shortcut. Decision 14 says *"Reaching back up to
change the spot or the rock must never discard what has already been typed"*
— and the rock is a **child of the spot**, so it cannot survive its parent
changing. Two rules collide and nothing arbitrates.

**Fix: separate typed content from derived context.** Name, grade, photo,
and details are typed — never discarded, ever. The rock is derived, and
re-derives when Where changes:

| New spot has | Rock row becomes |
| --- | --- |
| 0 rocks | disappears entirely — decision 12's logic, generalised past "brand-new spot" to "no rocks yet" |
| exactly 1 rock | auto-selected, row shows it quietly (principle 4) |
| 2+ rocks | resets to unanswered **and auto-expands its picker** — it's now the only open question on the sheet |

A photo already staged for the old rock has to be re-homed with it, and said
out loud in one plain line: *"your photo comes with you."* Silently
re-parenting an upload is the kind of thing that erodes trust in a
contribution tool.

### 2. There is no map in the flow whose least-reversible output is a map pin

"Where is it?" is a dashed box reading *"pin dropped where you're standing —
tap to move"*. No map. No coordinates. No accuracy. Nothing to check it
against.

Weigh that against open item 8: duplicate spots have **no merge path, no
delete, and every rock underneath is stranded on the wrong one**. The
coordinate is the single most permanent thing this flow writes. It got the
weakest, least verifiable control on the sheet — while the photo, which is
trivially replaceable, got a large dashed dropzone of the same size and
visual weight.

Two things compound it:

- **The design's only duplicate-spot prevention is a text list.** Decision
  14 argues "Citatah · 80 m away" at the top of the picker stops someone
  creating a second pin. That's the weak form. The strong form is showing
  the two pins on a map together.
- **GPS lies outdoors.** Under limestone, on a low-end Android, on patchy
  data (PRODUCT.md's stated default case), a fix can be ±50 m or worse.
  "dropped where you're standing" asserts a precision the device does not
  have.

**Fix:** an inline mini-map, ~160 px tall, live, showing the dropped pin,
its accuracy radius, and **nearby existing spot pins with their names**.
Leaflet is already in the app and the map is literally behind this sheet.
This turns duplicate prevention from a sorted list into something you can
see: *you are about to drop a pin 200 m from Citatah.* If accuracy is poor,
say so rather than implying certainty.

### 3. The primary action is never on screen

Measured at 390×844: sheet content 711 px in a 599 px viewport, submit button
at y = 879 — **below the fold the moment the sheet opens**. Open both
pickers: 1312 px. Expand "More details": 1205 px. Nobody sees "Add problem"
until they've scrolled past everything, including a five-field section
labelled *optional*.

Decision 14 rejected the wizard partly because *"its primary button was the
visual anchor of every screen while being unable to advance two of the three
steps."* The sheet's answer is a primary button that can advance, and that
you cannot see. That's the same bug inverted.

**Fix: a sticky footer inside the sheet** holding the submit, always
visible. This also makes the disabled state honest — a permanently visible
disabled button with a one-line reason underneath (*"needs a name"*) teaches
the requirement, where a hidden one just isn't there when you reach for it.
It gives the single-scroll model a floor, so you can always see where the
scroll ends.

### 4. Inline pickers swallow the sibling row

Opening the spot picker pushes the Rock row down ~700 px, so it renders
*below* "It's a new spot" — inside the same bordered container, reading as
one more option in the spot list. The border that made the two context rows
feel like a unit is exactly what makes the expansion look like it ate one.
Everything already typed is pushed off-screen with no scroll anchoring, so
"nothing is discarded" is true in state and false in perception.

**Fix: make the pickers a sheet-over-sheet, not an inline expansion.** A
second, shallower sheet that slides over the form and returns you to the
exact scroll position. Decision 14 rejected *steps* — a chain you must walk
— not *overlays*. An overlay answering one question and handing control
straight back is more faithful to "nothing is discarded" than an inline
expansion that relayouts the page under you. It also buys the picker full
sheet width, which finding 5 needs.

### 5. "Pick the rock by photo" is defeated by the layout it got

Measured: rock tiles are 140 px wide at 390 px viewport, photo area 4:3 →
**140 × 105 px**. At 320 px: 110 × 83 px. A wide shot of a limestone boulder
at 110 px, on a cheap screen, in daylight, is a brown rectangle. The
prototype's placeholder gradients render as four near-identical brown
smudges — that's an accurate simulation of the real failure, not a
placeholder artifact. Tiles also came out ragged (174 px vs 190 px) because
captions wrap to two lines.

UX principle 3 is the entire justification for the middle level existing.
A 2-up grid trades away the one thing that paid for it.

**Fix: single-column rock rows on phones** — 16:9 photo at full sheet width
(~290 px+), caption below. Fewer per screen; each one actually recognisable.
Keep the 2-up grid only above the 640–768 band. Clamp captions to two lines
with a fixed caption height so the list stops laddering.

### 6. "Add a rock" can save a row containing nothing

Measured: the Add-a-rock submit is enabled with zero input. Type defaults to
Batu; photo, name, and stone type are all optional. So the flow will happily
write an unnamed, photoless rock.

Open item 9 identifies exactly that row — *"an unnamed, photoless rock"* —
as the signal that somebody wasn't sure, and the thing an admin queue exists
to clean up. The implicit case at least has a problem attached to identify it
by (principle 3's amended fallback: *"Slab Mantap, Sit Start"*). A standalone
"Add a rock" with everything optional has nothing at all — it is
unrecognisable in the picker, unnameable in a list, and indistinguishable
from junk.

**Fix: require a photo *or* a name.** Either, never both. Copy:
*"Give it a photo or a name, so people can find it again."* Plain words, and
honest about why. A rock with neither isn't a contribution, it's a row.

### 7. The annotation payoff is a 16 px link that vanishes when it's wanted most

Measured: "+ draw the line" is **16 px tall, 83 px wide** — the smallest
interactive target anywhere in the flow. `handoff.md` calls annotation *"the
payoff of the whole restructure."*

Worse: the success screen offers *add another / add another rock / see it on
the map* and **never mentions the line at all**. The one moment the user has
a fresh photo, knows the line, and is standing at the rock, the subject is
dropped. Drawing is perishable — you leave the rock and it's gone for
months. Adding another problem is not.

**Fix:** after submit, if a photo exists and no line was drawn, make **"Draw
the line on the photo"** the primary button and demote "Add another to this
rock" to secondary. Once a line exists, flip them back. Pre-submit, make it
a real button, not a text link. This costs the repeat-adding veteran exactly
one tap, once per photo.

### 8. Two intents produce near-identical sheets, and one of them strands you

"Add a problem at a brand-new spot" and "Add a spot" contain nearly the same
fields, in different containers, titled differently, with different
completion semantics. And the new-spot sheet has a trap: tapping **"change"
collapses the new-spot form and there is no way back** — the row still reads
"a new spot · here" while the form that would define it is gone, and the
spot list never appears.

**Fix: one spot editor, two mounting points.** "New spot" is a *state of the
Where picker*, not a separate screen. "change" always returns to the list,
with a typed spot name preserved as a draft pinned at the top (*keep "Batu
Kalong" as a new spot*). Same fields in both places.

---

## Tier 2 — execution

### 9. Three controls wear each other's clothes

- The **map-pin control** and the **photo uploader** are the same dashed box
  (`.photo-drop`). Two unrelated actions, one visual.
- **Grade chips** and the **batu/tebing choice** are the same component
  (`.grade`). One is optional single-select from many; the other is a
  required binary that arrives pre-answered. Identical appearance, opposite
  contract.
- **"more…"** sits in the grade row carrying `aria-pressed`, and clicking it
  **selects it as though it were a grade** (verified live: it takes
  `aria-pressed="true"`). A disclosure control dressed as a value.

**Fix:** the pin gets its own control (finding 2). The binary gets a real
segmented control — one bordered track, two halves, no gradient fill.
"more…" becomes a text button outside the chip row.

And **delete "no grade yet" entirely.** The label already says *"skip it if
it's still a project"*, and an unselected chip row already means exactly
that. Two ways to express one fact will store two different values and
drift — the same failure decision 10 killed `highball_flag` for.

### 10. Every tap target is under the minimum, in the worst possible input environment

Measured on the live problem sheet: context rows **38 px**, grade chips
**33 px**, close × **30 px**, "draw the line" **16 px**. WCAG 2.5.8 and both
platform HIGs land at ~44 px.

This app is used standing on uneven ground, one-handed, with chalky or wet
hands, in sunlight. That's the worst input environment a touch UI can have,
and it got the smallest targets. Grade chips (33 × 42) are the ones you'll
miss most — and a mis-tapped grade is a **silent data error** nobody
notices, unlike a mis-tapped button.

**Fix:** 44 px floor on everything interactive. Grade chips to ~44 × 48;
they'll wrap to five or six per row, which scans better anyway.

### 11. No focus states exist

Measured on `.ctx-row`: `outline: none`, `box-shadow: none`. Every control is
a `<button>` with `border: 0`. Keyboard, switch-access, and Bluetooth-keyboard
users get nothing at all, and the flow can't be tab-audited.

**Fix:** a system-level `:focus-visible` ring — 2 px Ember Orange, 2 px
offset. That's the accent doing precisely what DESIGN.md says the accent
does ("this is active"), so it costs the system nothing.

### 12. At 320 px the context rows truncate away their own content

Measured at 320 px: **"Goa Agung · 1…"** — the distance, which is the entire
reason the row is trustworthy, is the first thing cut. And "the big
overh…". A fixed 52 px key column plus a right-aligned "change" leaves
~180 px for the value.

**Fix:** drop the key labels on phones. "Citatah · 80 m away" behind a pin
glyph doesn't need the word "Where"; a rock glyph doesn't need "Rock". Make
the whole row tappable with a chevron instead of the word "change" — that
recovers ~60 px *and* removes two ember-orange words from a screen DESIGN.md
says should keep ember rare.

### 13. The success screen repeats itself, has no exit, and shows nothing

"Citatah · the one with the crack" appears **twice, 40 px apart** — once as
the subtitle, once inside the "Still here for the next one" box. There is no
Done/Close: the only ways out are three actions, one of which is a
navigation away.

**Fix:** cut the duplicate — the button copy *"Add another to this rock"*
already carries it. Add a plain Done. And show **the thing that was just
made** — the problem's card, with its photo — instead of a checkmark.
"Slab Mantap is up" plus the actual card is a far stronger confirmation for
a contribution tool, and it's the natural place to hang finding 7's
draw-the-line CTA.

### 14. The intent menu taxes 100% of users to serve a minority

Every add now opens on a blocking three-option menu. The newcomer takes
option one, always. The veteran arriving from a crag page skips it (good) —
but the veteran arriving from the map FAB still pays it.

Decision 11 justifies this as *"classification, offered rather than
demanded"*. A menu you must clear before typing anything is demanded.

**Fix:** open **directly on "Add a problem"**, which decision 11 already
names the default, and put the other two intents inside that sheet as one
quiet line under the title — *"Just adding a spot? · Just adding a rock?"*
Zero taps for the common case, one tap for the other two: strictly better
than one tap for everything. Decision 11 survives fully intact — all three
are still first-class and each still commits on its own.

### 15. Grade scale doesn't switch on rock type, and it has to

Decision 1 puts cliffs in scope and keeps the `rope` scales in
`constants.ts` deliberately. The sheet hardcodes V-scale. When the chosen
rock is type `wall`, the grade chips must become YDS/French — that's
decision 1's *"UI copy switches on that type"* applied to a **control**, not
just to strings, and the sheet as drawn has nowhere to put it.

Minor, but note the two sheets already disagree with each other: the problem
sheet offers V0–V6, the new-spot sheet offers V0–V4. Same flow, same
session, two scales.

---

## Tier 3 — system-level, reaches past this screen

### 16. Contrast fails, in an app whose stated context is sunlight on cheap screens

Measured ratios:

| Element | Ratio | Needs |
| --- | --- | --- |
| `.picker-hint` — "Nearest first…" (Faint Stone on panel) | **1.76 : 1** | 4.5 : 1 |
| `.ctx-key` — "Where" / "Rock" (Weathered Stone, 12 px) | **3.91 : 1** | 4.5 : 1 |
| `.rock-by` — "2 problems · no name yet" (11 px) | **3.91 : 1** | 4.5 : 1 |

1.76:1 is not "subtle", it's invisible. PRODUCT.md's operating context is
explicit: *outdoors, patchy data, lower-end Android*. These values assume a
dark room and a good panel — the opposite of the stated default case.

**Fix, and it belongs in DESIGN.md, not here:** *if it's a sentence, it's at
least Weathered Stone.* Retire Faint Stone (`#4a3c30`) for anything
containing words — keep it for hairlines and decoration only. Load-bearing
helper text ("Nearest first…", "The photo belongs to the rock…", "Saves on
its own…") goes to Sun-Faded Parchment. Note DESIGN.md currently *invites*
this failure: it describes Faint Stone as *"reserve for text that should
barely register"* — that sentence is the bug.

### 17. Two open handoff items this review can close

- **Open item 10 — are wall children called "routes"?** The flow answers it.
  Decision 1 already settled that copy switches on rock type ("which rock?"
  vs "which wall?"). The sheet title is the same kind of string: pick a
  wall, it says **"Add a route"**. Same rule, no new vocabulary, URL stays
  `/problems/:id`. Recommend: **switch on type.**
- **Open item 8 — do crags need a merge path?** Finding 2 changes the
  calculus. With a mini-map showing nearby pins at drop time, prevention
  gets much stronger and a full crag-merge flow is probably not worth
  building. But it isn't zero — recommend the cheap half: let an admin
  **re-parent every rock off a duplicate spot and delete the empty
  husk**, which decision 13's rock re-parenting already provides most of.
  No new merge machinery, no new tables.

---

## What I'd change first

Ordered by cost-to-fix against damage-avoided:

1. **Sticky submit footer** (3) — smallest change, most reach.
2. **Contrast + tap-target floors** (10, 16) — mechanical, and they fail
   hardest in exactly the conditions this product ships into.
3. **The stale-rock rule** (1) — no code needed to decide, and building
   without it means picking an answer by accident.
4. **Mini-map on the pin** (2) — the most expensive item here and the one
   guarding the only unrecoverable write in the app.
5. **Single-column rock picker** (5) — otherwise the middle level's whole
   justification doesn't land.
6. **Draw-the-line as a post-submit primary** (7) — the payoff is currently
   the smallest thing on screen and absent when it's most wanted.

Everything else is real but cheaper to fold in during the build.
