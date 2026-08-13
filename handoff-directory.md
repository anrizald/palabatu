# Directory & All Problems — design handoff

Status: **design only, nothing built.** Companion to `handoff.md` (the
crags/boulders/problems restructure and the add sheet), which stays the
source of truth for everything on the *write* side. This file covers the two
*read* surfaces that restructure left behind: `/directory` (`Directory.tsx`)
and `/directory/all` (`ProblemList.tsx`).

Read `handoff.md`'s "UX principles" section first — every principle there
applies here unchanged and is not repeated below. `PRODUCT.md` and
`DESIGN.md` carry the positioning and the visual system; `DESIGN.md`'s
Sentence Rule (2026-08-09) is binding on every string this document adds.

Continue editing this file directly as the design changes.

---

## Why now

Phase 1.5 changed what a problem *is* (`crags -> boulders -> problems`) and
what a photo *belongs to* (the rock, not the problem), then revision (h)
rebuilt every write surface on top of it: the add sheet, the crag page, the
rock page, the problem page, approach guides, re-parenting, the merge queue.

The two browse surfaces were not rebuilt. They were **rejoined** — a small
client-side helper (`palabatu-fe/src/lib/cragCache.ts`'s `enrichProblems`)
hands each problem card its crag's coordinates and its boulder's first photo
so nothing renders blank — and otherwise still express the flat model they
were designed against: one problem, one photo, one pin, one free-text
location. That was the correct move at the time (it unblocked the
restructure without a backend change), and it is now the thing standing
between the directory and the model underneath it.

The gap is not cosmetic. Three of the findings below are cases where a
decision from `handoff.md` produces a *worse* browse experience than before
the restructure, because the read surfaces never absorbed it.

---

## Findings — what the restructure broke or left behind

Evidence-backed, in rough severity order. These are observations about the
shipped code, not proposals; the proposals are the Decisions section.

1. **There is no way to browse spots.** A crag has a detail page
   (`/crags/:id`) and a map pin, and no index anywhere. The app's top-level
   entity — the thing a person actually decides on, "where am I going this
   weekend" — cannot be listed. `/directory` lists problems; `/directory/all`
   lists problems; the nav has no third option. The only route into a crag
   page is the map or a lucky click, and the crag's name on a card is not
   even a link (finding 7). A climbing directory that cannot list its places
   is missing its primary axis.

2. **Every card in a row can be the same photograph.** A problem's card
   thumbnail is now *its rock's* photo (`cragCache.ts:109`), and a rock holds
   many problems by design. So the eight lines someone documented on one boulder
   in one session — the exact behaviour `handoff.md` decision 20's repeat-add
   exists to encourage — render as eight identical brown rectangles filling
   the Recent row end to end. Pre-restructure each problem carried its own
   photo and a grid of cards was a grid of different pictures. This is a
   direct, unexamined consequence of decision 2, and it hits hardest exactly
   where the product is working best.

3. **The grade badge renders empty for ungraded problems.**
   `ProblemCard.tsx:64-66` and `Directory.tsx:249-251` both render the badge
   unconditionally, but `grade` is `string | null` (`types/problem.ts:68`) and
   the add sheet now actively invites skipping it — "Grade — skip it if it's
   still a project" (`add-sheet/ProblemFields.tsx:55`). The result is a bare
   accent-bordered pill with nothing in it. The single most encouraged new
   state in the add flow has no representation on the read side.

4. **The Type filter guesses from the grade string.** `ProblemList.tsx:71-73`
   derives boulder-vs-rope by scanning the grade token through
   `detectGradeScale`, falling back to `boulder`/`V-Scale` for anything
   unrecognised. But since decision 1, the rock's `type` column
   (`boulder | wall`) is the authoritative answer, and it is already on
   `BoulderListItem` (`types/boulder.ts:21`) — `enrichProblems` simply
   doesn't carry it through. Today an ungraded wall route files itself under
   Type = Boulder, and a wall with a Font-graded problem on it does too.

5. **Filters know nothing about the hierarchy.** No filter by spot, none by
   rock, none for ungraded, none for wall-vs-boulder that actually works
   (finding 4). Search is an unranked substring match over name + crag_name +
   boulder_name (`ProblemList.tsx:174-176`). "Everything at Citatah" is
   reachable only by typing the name and hoping it isn't spelled "Citatah 125"
   — which is the same failure mode `handoff.md` open item 8 worries about on
   the write side, showing up on the read side.

6. **Near You is problem-granular, so one rock crowds out every other
   place.** `Directory.tsx:148-156` sorts problems by distance and takes ten.
   A rock with eight documented lines 400 m away consumes eight of the ten
   slots, and the second-nearest *spot* never appears. The row's question is
   "where can I climb near here", and it is answered at the wrong level.

7. **Crag and rock names are dead text.** `ProblemCard.tsx:87` renders
   `<MapPin/> {problem.crag_name}` as plain text inside a card that navigates
   to the problem. Now that crags and boulders have real pages, that string is
   the most obvious navigation affordance on the card and it does nothing.
   `boulder_name` isn't shown at all, so a card cannot say which rock it's on.

8. **The primary CTA doesn't do what it says.** Directory's "Add a problem"
   button links to `/map` (`Directory.tsx:171-176`, and again in the empty
   state at `:203-208`), which drops you on the map with no sheet open; you
   then have to find the FAB. There is no URL that opens the sheet cold
   either — `Map.tsx:311` only opens it when `addToCrag` or `addToBoulder` is
   present, so `/map?addIntent=problem` is silently ignored. The same
   detour applies to every context entry point: "add a rock" on a crag page
   navigates to the map, loads Leaflet and a screen of satellite tiles to
   show a form, and leaves you on the map afterwards instead of back on the
   page you were documenting.

9. **The stat bar undercounts spots.** `Directory.tsx:159` counts distinct
   `crag_id`s *among problems*, so every empty spot — the dimmed-pin
   population that `handoff.md` open item 1 deliberately made a first-class
   state — is invisible. The directory says "12 spots" while the map shows
   15 pins. The crag list is already fetched (`cragCache.getAllCrags`), so
   the correct number is free.

10. **Nothing surfaces the entities the restructure added.** Approaches
    ("jalan masuk") are the single most product-defining feature to ship in
    (h) — decision 21 calls the reading view "the actual deliverable" — and
    they appear nowhere outside a crag page you have to already be on. Same
    for empty spots, rocks with photos and no lines, and rocks with lines and
    no photo. Decision 21's own reasoning says the tenth visitor is the right
    author of an approach, not the creator; nothing in the app ever asks the
    tenth visitor.

11. **The catalog is one unpaginated fetch plus a fan-out.** Both pages call
    `GET /api/problems` for the entire table, then `enrichProblems`
    (`cragCache.ts:93-114`) fetches one boulder list per distinct crag. The
    module-level cache makes navigation between the two pages cheap, but a
    cold load of `/directory/all` at 40 crags is 41 requests to render one
    screen. Fine today (tens of problems); the wrong shape for the surface
    that is supposed to *be* the browse experience. This is a threshold to
    name, not a fire to put out.

12. **Three ProblemCards exist.** The shared one (`components/ProblemCard.tsx`),
    a second local one inside `Landing.tsx:120`, and the Spotlight hero's
    inline markup (`Directory.tsx:212-285`). Every fix below otherwise has to
    be made three times — and finding 3 (the empty grade pill) is already
    present in at least two of them.

---

## Decisions

1. **The directory has two axes, and places come first.** A climbing
   directory answers two questions and they are not the same question:
   *where should I go* and *what should I climb*. The shipped pages only
   answer the second. `/directory` becomes the hub that leads with places;
   `/directory/spots` is the place index (new); `/directory/all` stays the
   climb catalog. Places first because that is the order a trip is planned
   in, and because it is the axis the restructure created and nothing
   currently reads.

2. **Every row is deduplicated at the level its own question is asked at.**
   Finding 2 and finding 6 are the same bug with two faces, and the fix is
   not "hide duplicates" — it is to ask each row at the right level:
   - **Near you → spots.** "Citatah · 800 m · 14 lines on 3 rocks."
   - **Recent → rocks.** One card per rock, "3 new lines this week". A
     session's worth of documentation becomes one legible event instead of
     eight identical cards, and the card links to the rock, which is where
     someone actually wants to land after seeing it.
   - **Hot → problems.** A single hard line genuinely is the unit here;
     leave it alone.
   - **Spotlight → one problem.** Also correct as-is.

   The rule to hold onto: **never show the same photograph twice in one row.**
   If a row would, it is asking its question one level too low.

3. **The topo line is what makes a card about *this* climb.** Decision 2 gave
   the photo to the rock, which is right, and it cost every problem its own
   picture. The thing that gives it back is already built and already stored
   per problem: the drawn line (`topo_annotations`, and
   `components/topo-annotations/TopoAnnotationOverlay.tsx`, which
   `BoulderDetailPage` already renders over a photo). Draw it on the card.

   Eight cards of one rock stop being eight identical rectangles and become
   eight different lines on one familiar rock — which is not a workaround, it
   is the clearest possible statement of what the restructure bought. Use it
   on the Spotlight hero without question (one problem, one extra request);
   on grid cards it depends on the data cost — see Backend work, tier 1.

   Where a problem has no line drawn, the card shows the bare rock photo,
   and that absence is itself worth surfacing (decision 8).

4. **Ungraded is a state called "Project", never an empty pill.** Render the
   grade badge only when there is a grade; otherwise render a visually
   distinct "Project" chip — outlined, Weathered Stone, not accent, because
   it is information rather than an achievement. It is also a first-class
   filter chip in All Problems, alongside the grade chips rather than buried:
   ungraded lines are the ones most in need of somebody going and grading
   them, which makes this the most useful filter on the page for exactly the
   contributors this product needs.

5. **Type comes from the rock, never from the grade string.** Carry
   `boulder_type` through `enrichProblems` onto `EnrichedProblem` and filter
   on it. Keep `detectGradeScale` for what it's actually good at — deciding
   *which grade chips to offer* once a type is chosen. This also makes the
   noun switch (decision 9) mechanical rather than a second guess.

6. **Every crag and rock name in the directory is a link.** Crag name → the
   crag page. Rock name → the rock page. Both appear on a problem card: the
   spot on the first line (it answers "can I get there"), the rock on the
   second (it answers "what else is on it"). This is the cheapest possible
   fix for finding 1's symptom while decision 1 fixes its cause.

7. **A card must answer "should I go there", not just "what is this".** The
   read-surface counterpart to `handoff.md`'s UX principles, and the test to
   apply to every field on a card. Distance, whether there's a way in mapped,
   how many lines, and whether there's a photo all pass. Creator name, exact
   creation date, and internal ids do not — keep them, but never at the cost
   of the four that do.

8. **One contribution-gap row, chosen by what's missing nearest you.**
   Finding 10 is an opportunity, not just an omission: the directory is the
   only high-traffic browse surface, and `handoff.md` decision 21 argues that
   the *right* author of an approach is the tenth visitor, who is exactly the
   person reading this page. So the directory asks — but asks **once**, not
   as a chore list:

   > **Nobody's mapped the way in to Citatah.** You've been. 8 photos and
   > ten minutes at home is the difference between someone finding it and
   > giving up at a junction. → *Add the way in*

   Rotate the single slot across the three real gaps, preferring whichever is
   nearest: a spot with no approach, a rock with lines but no photo, a spot
   with no lines at all. Each CTA opens the correct surface pre-seeded.

   **This does not close `handoff.md` open item 9.** That item wants an admin
   view of loosely-filed contributions (the unnamed, photoless rock holding
   exactly one problem); this is a community-facing invitation with different
   copy, different placement, and no moderation semantics. Related surfaces,
   different jobs — build both, don't merge them.

9. **Aggregate counts say "lines"; a single item says problem or route.**
   Open item 10 settled that the noun follows the rock's type. A count that
   spans several rocks can't do that, and inventing a third noun for the
   mixed case ("climbs", "entries") adds vocabulary for nothing. "Lines" is
   already the app's own word — the add sheet says "draw the line", "the next
   line" — it is type-neutral, and it reads as plain climber speech, which is
   UX principle 6 exactly. So: *"14 lines on 3 rocks"* for a spot; *"Add
   route"* / *"a route on this wall"* for one item on a wall.

10. **The Add CTA opens the sheet, from wherever it is.** Mount `AddSheet`
    once at the app level rather than inside `Map.tsx`, and drive it from a
    small piece of shared state (context or a URL param handled at the route
    root). Then the directory's button opens the sheet in place, and — the
    larger win — `CragDetailPage`'s "Add a rock" and `BoulderDetailPage`'s
    "Add a problem" stop bouncing the user through a full map load and
    stranding them there afterwards (finding 8). This is scoped here because
    the directory needs it, but it fixes the add flow's worst navigational
    tax at the same time; see `handoff.md` UX principle 1 on context entry
    points.

11. **All Problems keeps its job and gains the filters the model now has.**
    It is the "I know what I want" surface and should stay dense and fast.
    Add: a **spot** filter (the missing hierarchy axis, and the fix for
    finding 5), a **Project/ungraded** chip (decision 4), a **type** filter
    that works (decision 5), and a rock line under each card's name
    (decision 6). Remove nothing.

12. **Sort defaults to nearest when location is on, newest otherwise.**
    Alphabetical is a filing-cabinet default; nobody browsing a climbing
    catalog wants A-Z first. Keep A-Z as an option — it's the right sort once
    you're searching for a name you already know.

13. **The enrichment moves to the backend, once — and not before it's
    earned.** `cragCache` was the right call while the shape was in flux; the
    shape has settled. See Backend work for the tiered version: tier 1 is the
    one change worth making now, tier 2 is deferred until finding 11's
    threshold is actually crossed.

---

## Proposed surfaces

Mobile-first (installable PWA; verify at 360 px before desktop). Layout
sketches, not styling specs — the visual execution comes from `DESIGN.md`,
and this work should go through the `impeccable` skill for the same reason
`handoff.md`'s add flow did.

### `/directory` — the hub

```
  Directory                                    [ + Add ]   <- opens the sheet
  15 spots · 62 lines · 9 with a way in mapped                (decision 10)

  ┌──────────────────────────────────────────┐
  │  SPOTLIGHT                               │  <- one problem, the rock's
  │  [ rock photo + THIS problem's line ]    │     photo with its line drawn
  │  V6 · Slab Mantap                        │     (decision 3)
  │  Citatah · 3 rocks · by Rizal            │
  └──────────────────────────────────────────┘

  Near you                                    see all >    <- SPOTS, not
  [ Citatah   ] [ Gunung Hawu ] [ Sanghyang ]                 problems
   800 m · 14 lines   3 km · 6 lines                          (decision 2)
   way in mapped      no way in yet

  ┌──────────────────────────────────────────┐
  │ Nobody's mapped the way in to Citatah.   │  <- ONE gap row, nearest
  │ You've been. → Add the way in            │     first (decision 8)
  └──────────────────────────────────────────┘

  Recently documented                         see all >    <- ROCKS
  [ the one with the crack ] [ Batu Kalong ]                  (decision 2)
   Citatah · 3 new lines      Sanghyang · 1 new line

  Hot                                         see all >    <- problems
  [ card ] [ card ] [ card ]                                  (unchanged)

           [ See all lines ]  [ Browse spots ]
```

Empty states distinguish the three real cases, because they now differ:
no spots at all / spots but no lines yet (link the spot index, don't say
"nothing here") / spots and lines but no location permission.

### `/directory/spots` — the place index (new)

The page finding 1 says is missing. One row per crag, distance-sorted when
location is on, name-searchable always (`handoff.md` UX principle 1: never
proximity-only).

```
  Spots                                        [ + Add a spot ]
  [ search spots                            ]
  Nearest first.

  ┌────────┬─────────────────────────────────┐
  │ photo  │ Citatah                  800 m  │  <- crag.image_urls[0], the
  │        │ 14 lines on 3 rocks             │     approach shot; falls back
  │        │ way in mapped · patokan         │     to a rock's photo, then
  └────────┴─────────────────────────────────┘     to the map-pin placeholder

  ┌────────┬─────────────────────────────────┐
  │        │ Gunung Hawu              3.1 km │  <- dimmed, same treatment as
  │ (dim)  │ nothing documented yet          │     the map's empty pins
  │        │ → Add the first one             │     (open item 1)
  └────────┴─────────────────────────────────┘
```

Empty spots stay **visible and dimmed with a CTA**, exactly as `handoff.md`
open item 1 resolved for the map — same reasoning applies verbatim here: a
hidden spot is indistinguishable from a spot that doesn't exist, and invites
the duplicate.

### `/directory/all` — the catalog

Keeps its current density. Filter rows become:

```
  [ search name, spot or rock                  ] [ Sort v ] [ Reset ]
  Spot    All · Citatah · Gunung Hawu · ...              <- NEW (decision 11)
  Type    All · Batu · Tebing                            <- from the rock now
  Grade   All · Project · V0 · V1 · ...                  <- Project is a chip
  Status  All · Unsent · Sent                            <- unchanged
```

### Card anatomy (one shared component, three call sites)

```
  ┌────────────────────────────────┐
  │ [ rock photo, this line drawn ]│  <- decision 3
  │  V6                        (↗) │  <- or "Project" chip (decision 4)
  ├────────────────────────────────┤
  │  Slab Mantap                   │
  │  ⌾ Citatah · the one with the  │  <- both LINKS (decision 6)
  │    crack                       │
  │  by Rizal            🔥 4 sends│
  └────────────────────────────────┘
```

Fold `Landing.tsx`'s local copy and the Spotlight's inline markup into this
one component (finding 12) — Spotlight as a `variant="hero"`, not a fourth
implementation.

---

## Backend work

**Tier 0 — no backend change needed** for: the spot index (`GET /api/crags`
already returns `boulder_count`/`problem_count`/`image_urls`), the spot
filter, the Project chip, decision 2's regrouping, decision 6's links,
decision 9's counts, decision 10's sheet mounting, and the fixed spot count.
Do all of that client-side first; it is most of this document.

**Tier 1 — the one change worth making now.** `ProblemListItem` gains three
joined fields, killing the client-side guesswork the decisions above
otherwise have to work around:

- `boulder_type` — decision 5 needs it and it cannot be derived correctly
  (finding 4).
- `topo_url` — the rock's first photo; `cragCache` already fakes this join
  client-side with a per-crag fan-out.
- `topo_line` (or a `has_topo_line` boolean, if shipping the shapes on a list
  response feels heavy) — decision 3 needs it, and the boolean alone is
  enough for decision 8's "rocks with lines but no photo" gap row.

Follow `CLAUDE.md`'s API contract rules: named types, swag annotations,
`.\scripts\gen-api-docs.ps1`, then `npm run gen:types`, then update the
hand-written mirror in `src/types/problem.ts`. With `topo_url` on the wire,
`enrichProblems` shrinks to a coordinates lookup, and `/directory/all` goes
from 1 + N requests to 2.

**Tier 2 — deferred until finding 11's threshold is crossed.** Pagination and
server-side search/filter on `GET /api/problems`. Name the threshold now so
it isn't argued about later: **when a cold `/directory/all` exceeds ~300
problems or the response exceeds ~250 KB.** Below that, client-side filtering
is faster (no round-trip per keystroke) and simpler. Don't pre-build it.

---

## Blast radius

- `palabatu-fe/src/pages/Directory.tsx` — rewritten (rows regrouped, gap row,
  stats, CTA).
- `palabatu-fe/src/pages/ProblemList.tsx` — filters extended, type filter
  fixed, sort default changed.
- `palabatu-fe/src/pages/SpotList.tsx` — **new**, plus a route in `App.tsx`
  and a nav entry.
- `palabatu-fe/src/components/ProblemCard.tsx` — grade/Project, links, rock
  line, optional annotation overlay, `variant="hero"`.
- **New**: a spot card and a rock card component, or one card with variants —
  decide when building; don't create a single-use abstraction per row.
- `palabatu-fe/src/pages/Landing.tsx` — its local `ProblemCard` (`:120`) is
  deleted in favour of the shared one; its Near You row inherits decision 2.
- `palabatu-fe/src/lib/cragCache.ts` — `enrichProblems` gains `boulder_type`
  (and shrinks once tier 1 lands); a spot-level aggregate helper for the
  Near You row.
- `palabatu-fe/src/pages/Map.tsx` — `AddSheet` moves out to the app root
  (decision 10); `Map.tsx` keeps its FAB and drives the shared state.
- `palabatu-fe/src/pages/CragDetailPage.tsx` / `BoulderDetailPage.tsx` — the
  `/map?addTo...` navigations become in-place sheet opens.
- `palabatu-fe/src/types/problem.ts` — `EnrichedProblem` gains
  `boulderType`; `NewProblem` (`:8`) is dead since `components/add-flow/`
  was deleted and should go with this pass.
- Backend, tier 1 only: `internal/problems/repository.go` (the list query),
  `docs/swagger.json`, `src/types/api.d.ts`.

Untouched: schema, the add sheet's own components, approaches, the merge
flow, authz.

---

## Sequencing

Ordered so every step is shippable on its own and nothing is blocked on the
backend.

1. **Card unification + the two content bugs.** One `ProblemCard`, delete
   `Landing.tsx`'s copy, fold in the Spotlight hero; grade→Project
   (decision 4); crag/rock links (decision 6). Smallest diff, fixes the most
   visible defect, and everything after it builds on one component.
2. **`AddSheet` to the app root** (decision 10). Independent of the rest, and
   the CTA fixes on every page depend on it.
3. **`/directory/spots`** (decision 1). Entirely tier 0; the highest-value
   single addition in this document.
4. **Regroup the directory rows** (decision 2) + the stat-bar count
   (finding 9) + empty states.
5. **All Problems' filters** (decision 11) — spot filter and Project chip
   ship now; the type filter waits on tier 1's `boulder_type`.
6. **Tier 1 backend**, then the type filter and the annotation overlay on
   cards (decisions 3 and 5).
7. **The gap row** (decision 8), last — it wants the spot index and real
   approach counts in place to pick its subject well.

`tsc`, `eslint`, and `go vet` clean at every step; smoke-test live against
the local Docker DB, at 360 px first, per `CLAUDE.md`.

---

## Open items

1. **Does the Spotlight survive?** It's a nice hero, but it is a deterministic
   daily pick over a table of tens — with the spot index and a regrouped Near
   You row above it, it may be the least useful screenful on the page. Decide
   after step 4, when the rest of the page has changed around it; don't
   pre-emptively delete something people may like.
2. **Where the spot index lives in the nav.** Options: a third nav item
   ("Spots"), a tab inside `/directory`, or a segmented control at the top of
   the hub. A third top-level nav item is the clearest but the nav is already
   at its width budget on mobile. Open.
3. **Whether "Recently documented" groups by rock or by session.** Grouping by
   rock is proposed (decision 2) and is simple. Grouping by *contributor
   session* ("Rizal added 6 lines at Citatah on Tuesday") is a stronger social
   signal and closer to Phase 3's Crew work — but it needs a definition of a
   session and probably a backend query. Deferred, deliberately: revisit when
   Crew is designed, not before.
4. **Whether the gap row should be personalised.** "Spots you've sent at that
   have no way in mapped" is a much sharper ask than "spots near you", and the
   `sends` data already exists. It also means the row is empty for a new user,
   who is the person most likely to have time to contribute. Probably: nearest
   first, personalised as a tiebreak. Needs a call when building step 7.
5. **Whether `/directory/all` should be able to list rocks too.** Once spots
   have an index and problems have a catalog, rocks are the one level with
   neither. Argument for: the merge flow and open item 9 both want a way to
   see rocks in bulk. Argument against: nobody browses for a rock — you find
   it through its spot. Currently leaning against, as a community surface;
   an *admin* rock list is a different question and belongs with open item 9.

---

## Explicitly not decided here

- **Anything on the write side.** The add sheet, approach capture,
  re-parenting, and the merge flow are `handoff.md`'s, unchanged by this
  document — except decision 10, which moves where the sheet is mounted and
  changes nothing about what it does.
- **Search relevance ranking.** Substring matching stays until tier 2; a real
  ranked search (typo tolerance, Indonesian spelling variants like
  Citatah/Citata) is a genuine future need and a genuine project.
- **Follow-a-crag** (ROADMAP Phase 2) — the spot index is the obvious home for
  a follow control, and the design should leave room for one on the spot card
  without building it.
- **Sensitive/approximate spot locations** — still deferred (see the
  `sensitive-crag-locations` memory). Note that a spot index makes exact
  coordinates one step *more* discoverable than the map alone did, which is
  worth remembering whenever that decision gets made.
