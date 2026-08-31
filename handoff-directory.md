# Directory & All Problems — design handoff

Status: **All 7 sequencing steps shipped (1-2 on 2026-08-17, 3-7 on
2026-08-31).** Step 1 (card unification, decisions 4/6, findings 3/7/12),
step 2 (`AddSheet` to the app root, decision 10, finding 8), step 3
(`/directory/spots`, decision 1, finding 1), step 4 (regrouped Directory
rows, decision 2, findings 2/6/9, the three-case empty states), step 5
(All Problems' spot filter and Project chip, decision 11), step 6 (tier 1
backend fields, the real-`boulder_type` Type filter fix, decision 5/finding
4), and step 7 (the contribution-gap row, decision 8) are all built and
verified live — see the Sequencing section below for what each covered.
Decision 3's on-card topo-line rendering (nominally step 6) was raised to
the user as a genuine tradeoff rather than decided unilaterally, and
deliberately not built; see that decision's own note. Everything else in
this document (open items, Explicitly not decided here) remains open —
"all steps shipped" means the sequencing list is clear, not that every
idea in this file is resolved.
Companion to `handoff.md` (the crags/boulders/problems restructure and the
add sheet), which stays the source of truth for everything on the *write*
side. This file covers the two *read* surfaces that restructure left behind:
`/directory` (`Directory.tsx`) and `/directory/all` (`ProblemList.tsx`).

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
   **Partially fixed 2026-08-31** (decision 1, sequencing step 3) — the
   index exists at `/directory/spots`, linked from Directory's footer.
   Still open: where it lives in the nav (open item 2) and whether the hub
   itself leads with it (decision 2, step 4).

2. **Every card in a row can be the same photograph.** A problem's card
   thumbnail is now *its rock's* photo (`cragCache.ts:109`), and a rock holds
   many problems by design. So the eight lines someone documented on one boulder
   in one session — the exact behaviour `handoff.md` decision 20's repeat-add
   exists to encourage — render as eight identical brown rectangles filling
   the Recent row end to end. Pre-restructure each problem carried its own
   photo and a grid of cards was a grid of different pictures. This is a
   direct, unexamined consequence of decision 2, and it hits hardest exactly
   where the product is working best.
   **Fixed 2026-08-31** (decision 2, sequencing step 4) — the Recent row is
   now "Recently documented", grouped by rock (`RockCard` in
   `Directory.tsx`), one card per boulder with a "N new lines" badge instead
   of one card per problem on it.

3. **The grade badge renders empty for ungraded problems.**
   `ProblemCard.tsx:64-66` and `Directory.tsx:249-251` both render the badge
   unconditionally, but `grade` is `string | null` (`types/problem.ts:68`) and
   the add sheet now actively invites skipping it — "Grade — skip it if it's
   still a project" (`add-sheet/ProblemFields.tsx:55`). The result is a bare
   accent-bordered pill with nothing in it. The single most encouraged new
   state in the add flow has no representation on the read side.
   **Fixed 2026-08-17** (decision 4, sequencing step 1) — see `GradeChip` in
   `components/ProblemCard.tsx`.

4. **The Type filter guesses from the grade string.** `ProblemList.tsx:71-73`
   derives boulder-vs-rope by scanning the grade token through
   `detectGradeScale`, falling back to `boulder`/`V-Scale` for anything
   unrecognised. But since decision 1, the rock's `type` column
   (`boulder | wall`) is the authoritative answer, and it is already on
   `BoulderListItem` (`types/boulder.ts:21`) — `enrichProblems` simply
   doesn't carry it through. Today an ungraded wall route files itself under
   Type = Boulder, and a wall with a Font-graded problem on it does too.
   **Fixed 2026-08-31** (decision 5, sequencing step 6, tier 1) —
   `ProblemListItem.boulder_type` is now on the wire directly from
   `boulders.type`; `ProblemList.tsx`'s Type filter and its `availableGrades`
   computation both switched to `boulderTypeToGradeType(p.boulder_type)`
   (the same translator `ProblemFields.tsx` already used for the add sheet's
   grade picker) instead of guessing from the grade string. Verified live
   against the local Docker DB: Type = Rope now correctly isolates the
   catalog's one wall-type problem (previously it would have been filed
   under Boulder for any ungraded or unrecognised grade).

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
   **Fixed 2026-08-31** (decision 2, sequencing step 4) — Near You now sorts
   and cards `crags`, not `problems` (`SpotCard` in `Directory.tsx`); a
   crag's lat/lng being required means the row is empty only when geo is
   off, never for lack of results.

7. **Crag and rock names are dead text.** `ProblemCard.tsx:87` renders
   `<MapPin/> {problem.crag_name}` as plain text inside a card that navigates
   to the problem. Now that crags and boulders have real pages, that string is
   the most obvious navigation affordance on the card and it does nothing.
   `boulder_name` isn't shown at all, so a card cannot say which rock it's on.
   **Fixed 2026-08-17** (decision 6, sequencing step 1) — see `SpotLine` in
   `components/ProblemCard.tsx`; the rock segment is omitted when the boulder
   has no name rather than inventing a fallback label.

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
   **Fixed 2026-08-17** (decision 10, sequencing step 2) — `AddSheetProvider`
   mounted at the app root; Directory's CTA, `CragDetailPage`'s "Add a
   rock"/"Add the first one", and `BoulderDetailPage`'s "Add a problem" all
   open the sheet in place now. Verified live: the URL no longer changes when
   opening from any of these.

9. **The stat bar undercounts spots.** `Directory.tsx:159` counts distinct
   `crag_id`s *among problems*, so every empty spot — the dimmed-pin
   population that `handoff.md` open item 1 deliberately made a first-class
   state — is invisible. The directory says "12 spots" while the map shows
   15 pins. The crag list is already fetched (`cragCache.getAllCrags`), so
   the correct number is free.
   **Fixed 2026-08-31** (sequencing step 4) — the stat bar now fetches
   `crags` directly and counts `crags.length`; the "problems" label was also
   renamed to "lines" per decision 9 while this line was already being
   touched.

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
    **The fan-out half is fixed 2026-08-31** (tier 1, sequencing step 6) —
    `enrichProblems` no longer fetches boulders at all now that
    `topo_url`/`boulder_type` are on the wire; a cold `/directory/all` is 2
    requests (problems + crags), not 1 + N. The unpaginated-fetch half is
    still open — that's tier 2, gated on the ~300-problem/~250KB threshold
    named in Backend work, not yet crossed.

12. **Three ProblemCards exist.** The shared one (`components/ProblemCard.tsx`),
    a second local one inside `Landing.tsx:120`, and the Spotlight hero's
    inline markup (`Directory.tsx:212-285`). Every fix below otherwise has to
    be made three times — and finding 3 (the empty grade pill) is already
    present in at least two of them.
    **Fixed 2026-08-17** (sequencing step 1) — one `ProblemCard` with a
    `variant?: 'grid' | 'hero'` prop; Landing's local copy and the Spotlight's
    inline markup are both gone.

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
   *(Shipped 2026-08-31, sequencing step 4 — Directory.tsx only; Landing.tsx's
   own tabbed Near You is a separate implementation and still problem-
   granular, see Blast radius.)*
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

   **Data half shipped 2026-08-31 (tier 1); on-card rendering deliberately
   deferred, not built.** `ProblemListItem.topo_line`/`.topo_url` are on the
   wire and correctly resolved end to end (verified live against a real
   drawn annotation). What blocked shipping the actual overlay: every card
   today shows its photo cropped to fill a fixed box (`object-fit: cover`),
   but `TopoAnnotationOverlay`'s coordinate math is built for an uncropped,
   letterboxed photo (the annotation editor and `BoulderDetailPage` both use
   it that way) — cropping and an accurate line don't currently coexist.
   Building crop-aware math would need the photo's natural pixel dimensions,
   which is the exact class of measurement `useContainRect`'s own doc
   comment says this codebase already got burned by once (EXIF-oriented
   photos reporting dimensions that don't match what's actually painted) —
   real risk of a subtly wrong line, worse than no line at all. Asked the
   user directly (three options: skip it / letterbox every card app-wide to
   reuse the overlay unmodified / build the crop-aware math anyway); the
   answer was to skip it. `topo_url` is already doing real work regardless —
   it's what let `enrichProblems` drop its boulder fan-out (finding 11).
   Revisit only when there's an actual safe way to reconcile crop and line
   accuracy; don't re-litigate the three options above from scratch.

4. **Ungraded is a state called "Project", never an empty pill.** *(Shipped
   2026-08-17, sequencing step 1.)* Render the
   grade badge only when there is a grade; otherwise render a visually
   distinct "Project" chip — outlined, Weathered Stone, not accent, because
   it is information rather than an achievement. It is also a first-class
   filter chip in All Problems, alongside the grade chips rather than buried:
   ungraded lines are the ones most in need of somebody going and grading
   them, which makes this the most useful filter on the page for exactly the
   contributors this product needs.

5. **Type comes from the rock, never from the grade string.** *(Shipped
   2026-08-31, sequencing step 6.)* Carry
   `boulder_type` through `enrichProblems` onto `EnrichedProblem` and filter
   on it. Keep `detectGradeScale` for what it's actually good at — deciding
   *which grade chips to offer* once a type is chosen. This also makes the
   noun switch (decision 9) mechanical rather than a second guess.
   **As built:** `boulder_type` didn't need `enrichProblems` at all in the
   end — tier 1 puts it directly on `ProblemListItem` from the backend, so
   it's already on every `EnrichedProblem` via the `&` intersection.

6. **Every crag and rock name in the directory is a link.** *(Shipped
   2026-08-17, sequencing step 1 — the problem card. `/directory/spots`
   (step 3) and `/directory/all`'s spot filter (step 5) also shipped, though
   as a page/select rather than inline links — see those steps.)* Crag name → the
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
   *(Shipped 2026-08-31, sequencing step 7 — see that entry for what
   "nearest you" ended up meaning for the search itself: bounded to the
   nearest 8 candidate crags, not a global scan, which is also what let this
   ship with zero backend changes.)*
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

   **As built, the copy paraphrases rather than quotes the example above** —
   it reuses `CragDetailPage`'s own established "Jalan masuk" empty-state
   voice ("Nobody has mapped the walk in yet... your photos are the
   difference between someone finding this place and giving up at a
   junction") instead of inventing a slightly different version of the same
   line, and drops the specific "8 photos and ten minutes" since that count
   isn't something this row actually knows.

   **This does not close `handoff.md` open item 9.** That item wants an admin
   view of loosely-filed contributions (the unnamed, photoless rock holding
   exactly one problem); this is a community-facing invitation with different
   copy, different placement, and no moderation semantics. Related surfaces,
   different jobs — build both, don't merge them.

9. **Aggregate counts say "lines"; a single item says problem or route.**
   *(Shipped 2026-08-31 — Directory's stat bar and card badges in step 4;
   `/directory/all`'s aggregate count line ("N lines found") in step 6,
   alongside that step's other `ProblemList.tsx` work.)*
   Open item 10 settled that the noun follows the rock's type. A count that
   spans several rocks can't do that, and inventing a third noun for the
   mixed case ("climbs", "entries") adds vocabulary for nothing. "Lines" is
   already the app's own word — the add sheet says "draw the line", "the next
   line" — it is type-neutral, and it reads as plain climber speech, which is
   UX principle 6 exactly. So: *"14 lines on 3 rocks"* for a spot; *"Add
   route"* / *"a route on this wall"* for one item on a wall.

10. **The Add CTA opens the sheet, from wherever it is.** *(Shipped
    2026-08-17, sequencing step 2 — also closes `handoff-add-sheet.md`'s
    B4.)* Mount `AddSheet`
    once at the app level rather than inside `Map.tsx`, and drive it from a
    small piece of shared state (context or a URL param handled at the route
    root). Then the directory's button opens the sheet in place, and — the
    larger win — `CragDetailPage`'s "Add a rock" and `BoulderDetailPage`'s
    "Add a problem" stop bouncing the user through a full map load and
    stranding them there afterwards (finding 8). This is scoped here because
    the directory needs it, but it fixes the add flow's worst navigational
    tax at the same time; see `handoff.md` UX principle 1 on context entry
    points.

    **As built:** context, not a URL param — `palabatu-fe/src/lib/
    addSheetContextInstance.ts` + `useAddSheet.ts` + `AddSheetContext.tsx`
    (split three ways the same way `AuthContext` already is, to satisfy the
    fast-refresh lint rule), `AddSheetProvider` mounted once in `App.tsx`
    above `<Routes>`. The old `?addToCrag=`/`?addToBoulder=`/`?addIntent=`
    query-param deep link is gone outright rather than kept alongside the
    context — nothing outside `Map.tsx` referenced it.

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

14. **Spotlight can pick a spot or a problem.** *(Shipped 2026-08-31,
    resolves open item 1 — the Spotlight survives, and now embodies decision
    1's two axes directly instead of being problem-only.)* `pickSpotlight`
    builds one combined pool of `{kind:'problem', problem}` and
    `{kind:'spot', crag}` candidates, prefers photographed candidates of
    either kind (falling back to the full pool only if *nothing* has a photo
    yet), then applies the exact same deterministic date-hash pick as
    before. Representation is proportional to how many of each kind have a
    photo, not a fixed 50/50 split — deliberately simple, per the request
    that reused logic was fine; revisit only if spots end up crowded out
    once the problem count grows much larger than the spot count. A spot
    pick renders `SpotHero` (new, `Directory.tsx`) — same visual language as
    `ProblemCard`'s hero (rounded photo, bottom gradient panel, locate
    button) — with a "Spot" tag instead of a grade, "N lines on M rocks"
    instead of a send count, and an unconditional locate button (a crag's
    lat/lng are always present). `ProblemCard.tsx` itself is untouched — the
    two kinds stay visually distinguishable by their tag and info line alone.

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
  │  SPOTLIGHT                               │  <- one problem OR one spot
  │  [ rock photo + THIS problem's line ]    │     (decision 14) -- shown
  │  V6 · Slab Mantap                        │     here is the problem case;
  │  Citatah · 3 rocks · by Rizal            │     a spot pick shows a "Spot"
  └──────────────────────────────────────────┘     tag + line/rock counts

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

**Tier 1 — shipped 2026-08-31 (sequencing step 6).** `ProblemListItem` gains
three joined fields, killing the client-side guesswork the decisions above
otherwise had to work around:

- `boulder_type` — decision 5 needs it and it cannot be derived correctly
  (finding 4). Non-pointer on the Go side (`boulders.type` is `NOT NULL
  DEFAULT 'boulder'`), so always present.
- `topo_url` — the rock's first photo (`b.image_urls->>0`); `cragCache`
  used to fake this join client-side with a per-crag fan-out.
- `topo_line` — shipped as the actual shape data, not the lighter
  `has_topo_line` boolean alternative this bullet originally offered:
  `(SELECT ta.data FROM topo_annotations ta WHERE ta.problem_id = p.id AND
  ta.image_url = b.image_urls->>0)`, nullable when nothing's drawn (not
  distinguished from an empty-array annotation — both render nothing on the
  frontend anyway). Passed through as an opaque `json.RawMessage` on the Go
  side, same as `auth.Profile.Title`/`.Tags`, but typed precisely as
  `Shape[] | null` on the frontend mirror since `annotation.ts` already
  knows that shape. **Swag v2.0.0-rc5 gotcha:** a `swaggertype:"array,object"`
  tag on the `json.RawMessage` field (to fix the generated spec showing it
  as "array of integer") crashes `swag init --v3.1` with a nil pointer
  dereference inside `complementSchema` — left untagged instead, matching
  `Profile.Title`/`.Tags`'s existing precedent; the cosmetic mismatch in
  `swagger.json`/`api.d.ts` was already an accepted tradeoff for those two
  fields, not a new problem.
- Decision 3's actual on-card rendering (drawing `topo_line` over the
  photo) is **not built** despite the data being ready — see decision 3's
  own note on why, and the user's explicit call to skip it for now.

Followed `CLAUDE.md`'s API contract rules: named types (no shape changes
needed — the three fields slot into the existing `ProblemListItem`/
`ProblemDetail` structs), `.\scripts\gen-api-docs.ps1` (run as the raw `swag
init` command directly — see the PowerShell note below), `npm run gen:types`,
then the hand-written mirror in `src/types/problem.ts` updated by hand
(imports `BoulderType` from `boulder.ts` and `Shape` from `annotation.ts`
rather than redeclaring either). **`gen-api-docs.ps1` itself misfires in
PowerShell 5.1**: `swag` prints a "`@host` is deprecated, use `servers`
instead" *warning* to stderr, and the script's own `$ErrorActionPreference =
"Stop"` combined with PowerShell wrapping any native-command stderr output
into a terminating `NativeCommandError` (see this repo's own PowerShell
tool notes on that exact behavior) turns a successful run into a reported
failure with `docs/swagger.json` left unregenerated. Ran the equivalent
`swag init` command directly via Bash instead, which doesn't have that
quirk; the script may be worth hardening (redirect only real failures, or
drop `$ErrorActionPreference`) if this comes up again.

With `topo_url` on the wire, `enrichProblems` shrank to a coordinates
lookup (using only the crag's lat/lng now, not "boulder's own pin, falling
back to the crag's" — see `cragCache.ts`'s own comment on that trade), and
`/directory/all` goes from 1 + N requests to 2. Verified live: restarted the
dev backend (it doesn't hot-reload), confirmed `GET /api/problems` and
`GET /api/problems/:id` both return correct `boulder_type`/`topo_url`/
`topo_line` — including a real drawn annotation on "Slab Mantao" — then
re-screenshotted Directory/All Problems against the refreshed data to
confirm no regression.

**Tier 2 — deferred until finding 11's threshold is crossed.** Pagination and
server-side search/filter on `GET /api/problems`. Name the threshold now so
it isn't argued about later: **when a cold `/directory/all` exceeds ~300
problems or the response exceeds ~250 KB.** Below that, client-side filtering
is faster (no round-trip per keystroke) and simpler. Don't pre-build it.

---

## Blast radius

Done items below shipped 2026-08-17 (steps 1-2) and 2026-08-31 (steps 3-6);
everything else is still pending.

- `palabatu-fe/src/components/ProblemCard.tsx` — **done:** grade/Project
  (decision 4), crag/rock links (decision 6), `variant="hero"` (finding 12).
  **Untouched, deliberately:** the topo-line overlay (decision 3) — data is
  ready (`topo_line` on the wire) but the user chose to skip building the
  on-card rendering, see decision 3's note.
- `palabatu-fe/src/pages/Landing.tsx` — **done:** its local `ProblemCard`
  (`:120`) is deleted in favour of the shared one. **Still pending, and
  *not* covered by step 4 as shipped:** its own three-tab Near You/Hot/
  Recent explore section is a structurally different UI (one active-tab
  card row via `activeTab`, not three parallel `RowSection`s) with its own
  duplicated `haversineKm`/`formatDistance`/`formatRelativeTime`. Step 4
  regrouped `Directory.tsx` only, per the Sequencing list's own naming
  ("Regroup the directory rows"); Landing's tab would need its own
  `SpotCard`/rock-grouping work (fetch `crags`, a spot-level Near You tab,
  a rock-level grouping for Recent) and wasn't bundled in to keep this step
  reviewable. Worth its own pass, not forgotten.
- `palabatu-fe/src/pages/Directory.tsx` — **done:** the Spotlight hero uses
  `ProblemCard variant="hero"` instead of ~90 lines of inline markup; the
  header CTA opens the sheet in place and is now unconditionally-labeled
  "+ Add" (it never carried an intent, so "Add a problem" was inaccurate —
  the sheet already lets the user pick problem/spot/rock); the footer has
  "See all lines" and "Browse spots" links. Near You now cards `crags`
  (`SpotCard`, decision 2, finding 6) and leads the page, ahead of the new
  rock-grouped "Recently documented" (`RockCard`, decision 2, finding 2) and
  unchanged problem-level Hot, matching the Proposed Surfaces mockup's row
  order. `Hot`/`Near You` gained "see all" links to `/directory/all` and
  `/directory/spots`; "Recently documented" deliberately has none — there's
  no rock catalog page to send it to (open item 5 leans against building
  one as a community surface). The stat bar now reads spots/lines/sends
  from `crags`+`problems` directly (finding 9) instead of deriving spot
  count from problems. Loading/error/empty now distinguish three cases
  (no spots at all / spots but no lines yet, linking the spot index instead
  of saying "nothing here" / the normal state, where Near You's own
  location-permission prompt is the only remaining empty sub-case) instead
  of one binary check. Spotlight itself now picks from problems and spots
  together (decision 14, `SpotHero`, new). The contribution-gap row
  (decision 8, step 7) is in too — `GapBanner`/`findContributionGap`, new,
  between Near You and Recently documented, loaded independently of the
  main page fetch and re-run when geo turns on. Nothing in this file is
  still pending as of 2026-08-31; see the top Status line.
- `palabatu-fe/src/pages/ProblemList.tsx` — **done** (steps 5 and 6):
  already rendered the shared `ProblemCard` as a side effect of step 1, so
  it inherited the grade/Project chip and crag/rock links for free —
  decision 11's "rock line under each card's name" was already satisfied.
  Step 5 added the spot filter (a `<select>`, not a pill row like Type/
  Grade/Status — deliberately, since spot count is open-ended in a way
  those bounded enums aren't; the ASCII mockup's pill-row sketch was a
  layout sketch, not a spec) and made Project a standalone always-visible
  Grade pill rather than one gated behind picking a Type first (decision 4:
  "alongside the grade chips... not buried" — picking Project now also
  resets Type/Scale, since an ungraded problem's type can't be reliably
  guessed and a stale Type=Rope would silently zero out the results).
  **Bug caught live during verification:** the Project filter initially
  matched `p.grade === null`, but some rows store `''` rather than a true
  SQL `NULL` despite the `string | null` type ("Slab Mantao"/"VCrazy" both
  have `grade: ''`) — fixed to a falsy check, matching `GradeChip`'s own
  condition. Step 6 replaced the grade-string-guessing Type filter and
  `availableGrades` computation with the real `boulder_type` field
  (`boulderTypeToGradeType`, decision 5) and renamed the aggregate count
  line "problems found" → "lines found" (decision 9).
- `palabatu-fe/src/pages/Map.tsx` — **done:** `AddSheet` moved out to the app
  root (decision 10); `Map.tsx` keeps its FAB and calls `useAddSheet()`. The
  `?addToCrag=`/`?addToBoulder=`/`?addIntent=` query-param deep link is
  removed outright (nothing outside this file referenced it).
- `palabatu-fe/src/pages/CragDetailPage.tsx` / `BoulderDetailPage.tsx` —
  **done:** the `/map?addTo...` navigations are now in-place `openAddSheet()`
  calls.
- **New, done:** `palabatu-fe/src/lib/addSheetContextInstance.ts` +
  `useAddSheet.ts` + `AddSheetContext.tsx` — the shared state decision 10
  asked for, split three ways the same way `AuthContext` already is (fast
  refresh requires a hook's file to only export the hook).
- `palabatu-fe/src/App.tsx` — **done:** `AddSheetProvider` wraps the routed
  app, above `<Routes>`.
- `palabatu-fe/src/pages/SpotList.tsx` — **done:** new page, list-per-crag
  (not the card grid other surfaces use — a list row fits the denser
  per-spot content better), distance/newest/name sort (decision 12), search,
  the dimmed-empty-crag treatment (open item 1) with an inline "Add the
  first one" CTA, entirely tier 0 (`CragListItem`'s existing
  `boulder_count`/`problem_count`/`image_urls`, no new fetch fan-out). The
  route is registered in `App.tsx`; a nav entry (open item 2: third nav
  item vs. tab vs. segmented control) is still undecided and deliberately
  not built here — discoverability for now is Directory's new "Browse
  spots" link only, per decision 1 framing `/directory` as the hub.
  `SpotRow` is a page-local function, not a shared component — only one
  call site exists yet, so extracting a shared spot/rock card component is
  still deferred to whenever a second call site (e.g. open item 5's
  possible rock list) actually needs it.
- `palabatu-fe/src/lib/cragCache.ts` — **done** (step 6): `enrichProblems`
  no longer fetches boulders at all — `thumbnailUrl` reads `p.topo_url`
  directly (tier 1), and `mapLat`/`mapLng` now come from the crag only (see
  the trade-off noted in Backend work and in this file's own comment).
  `getBoulderThumbnail` (the helper this fan-out existed for) is deleted as
  dead code; `getCragCoords` is separately unused and pre-existing — left
  alone, out of this change's scope.
- `palabatu-fe/src/types/problem.ts` — **done** (step 6): `ProblemListItem`
  gains `boulder_type`/`topo_url`/`topo_line` (imports `BoulderType` from
  `boulder.ts` and `Shape` from `annotation.ts` rather than redeclaring
  either); `EnrichedProblem` inherits all three for free via `&`.
  Correction to this bullet's older claim — there is no `NewProblem` type in
  this file to clean up; that note was stale (nothing named `NewProblem`
  exists here as of this session, in `:8` or anywhere else).
- Backend, tier 1: `internal/problems/repository.go` (the list query,
  `ProblemListItem`/`ProblemDetail` structs), `docs/swagger.json`,
  `src/types/api.d.ts` — **done** (step 6). See Backend work for the swag
  v2.0.0-rc5 crash worked around and the PowerShell `gen-api-docs.ps1`
  quirk hit along the way.

Untouched: schema, the add sheet's own components, approaches, the merge
flow, authz.

---

## Sequencing

Ordered so every step is shippable on its own and nothing is blocked on the
backend.

1. ~~**Card unification + the two content bugs.** One `ProblemCard`, delete
   `Landing.tsx`'s copy, fold in the Spotlight hero; grade→Project
   (decision 4); crag/rock links (decision 6). Smallest diff, fixes the most
   visible defect, and everything after it builds on one component.~~
   **Done 2026-08-17.** Verified live (screenshots at 360px and desktop
   against the local Docker DB, including an ungraded problem and a problem
   whose rock has a name); `tsc`/`eslint` clean. One bug caught and fixed
   during verification: a percentage `max-width` on a flex item with no
   definite width was collapsing the Spotlight's crag/rock line almost to
   nothing — replaced with `flex-1`/`min-w-0`.
2. ~~**`AddSheet` to the app root** (decision 10). Independent of the rest, and
   the CTA fixes on every page depend on it.~~ **Done 2026-08-17.** Verified
   live (scripted through all four entry points, logged in): URL stays
   unchanged opening from Directory/CragDetailPage/BoulderDetailPage, each
   pre-seeds correctly; `tsc`/`eslint` clean. Also closes
   `handoff-add-sheet.md`'s B4.
3. ~~**`/directory/spots`** (decision 1). Entirely tier 0; the highest-value
   single addition in this document.~~ **Done 2026-08-31.** Verified live
   (screenshots at 360px and desktop against the local Docker DB, including
   a throwaway empty-crag row inserted directly via SQL to confirm the
   dimmed treatment and "Add the first one" CTA, then removed); `tsc`/
   `eslint` clean. Entry point wired from Directory's footer ("Browse
   spots"); the nav-placement question (open item 2) is still open.
4. ~~**Regroup the directory rows** (decision 2) + the stat-bar count
   (finding 9) + empty states.~~ **Done 2026-08-31.** Verified live
   (screenshots at 360px and desktop against the local Docker DB): with
   geolocation granted and "Use my location" clicked (a Playwright script,
   since the CLI screenshot tool can't drive a click), Near You correctly
   shows nearest-first spot cards and Recently documented correctly groups
   several problems on one boulder into a single "3 new lines" card,
   including the `rockLabel` unnamed-rock fallback ("Tes bray, and more").
   The two new empty-state cases were verified by mocking
   `GET /api/problems`/`GET /api/crags` via Playwright route interception
   (no live data touched) rather than emptying the seeded dev DB.
   `tsc`/`eslint` clean.
5. ~~**All Problems' filters** (decision 11) — spot filter and Project chip
   ship now; the type filter waits on tier 1's `boulder_type`.~~ **Done
   2026-08-31.** Verified live against the local Docker DB: the spot filter
   (Kalibata) and the Project filter both isolate the right subset; caught
   and fixed a real bug along the way (Project matched `p.grade === null`
   but some rows store `''`, so it returned zero results until switched to
   a falsy check). `tsc`/`eslint` clean.
6. ~~**Tier 1 backend**, then the type filter and the annotation overlay on
   cards (decisions 3 and 5).~~ **Backend + type filter done 2026-08-31;
   the annotation overlay deliberately not built.** Tier 1's three fields
   shipped and were verified live end to end (restarted the dev backend,
   confirmed `boulder_type`/`topo_url`/`topo_line` on both `GET
   /api/problems` and `GET /api/problems/:id`, including a real drawn
   annotation). The Type filter now uses `boulder_type` (verified: Rope
   correctly isolates the catalog's one wall-type problem). Decision 3's
   on-card line rendering was raised to the user as a genuine three-way
   tradeoff (skip it / letterbox every card app-wide / build crop-aware
   line math) rather than decided unilaterally, given every card currently
   crops its photo in a way the existing overlay math doesn't handle safely
   — the user chose to skip it; see decision 3's note for the full
   reasoning and don't re-litigate without new information. `go build`/
   `go vet`/`tsc`/`eslint` all clean.
7. ~~**The gap row** (decision 8), last — it wants the spot index and real
   approach counts in place to pick its subject well.~~ **Done 2026-08-31.**
   Turned out not to need "real approach counts" as a new backend field —
   decision 8's own "nearest you" framing already bounds the search
   geographically, so `findContributionGap` (`Directory.tsx`) just checks
   the nearest `GAP_SCAN_LIMIT` (8) candidate crags via the existing
   per-crag `getBouldersForCrag`/`getApproachesForCrag` calls (cached, same
   ones the map and `CragDetailPage` already make) rather than needing a
   global aggregate. Zero backend changes. Verified live against the local
   Docker DB: correctly found Kalibata's photoless "Tes bray" rock (3 lines,
   no photo) as the nearest real gap, rendered the banner with the exact
   copy specified, and clicking "Add a photo" landed on that boulder's own
   page (`/boulders/:id`) with its existing upload control — confirmed at
   360px too. Open item 4 (personalisation) resolved as: nearest-first only
   for v1, no sends-based tiebreak — see that item's note.

`tsc`, `eslint`, and `go vet` clean at every step; smoke-test live against
the local Docker DB, at 360 px first, per `CLAUDE.md`.

---

## Open items

1. ~~**Does the Spotlight survive?**~~ **Resolved 2026-08-31 — yes, and it
   now spotlights spots too.** See decision 14: rather than being made
   redundant by the spot index and a regrouped Near You row, it now draws
   from both problems and crags in one pool, so it's the one surface on the
   page that can lead with either axis on a given day.
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
4. ~~**Whether the gap row should be personalised.**~~ **Resolved 2026-08-31,
   nearest-first only, no personalisation.** "Spots you've sent at that have
   no way in mapped" is a much sharper ask than "spots near you", and the
   `sends` data already exists. It also means the row is empty for a new
   user, who is the person most likely to have time to contribute. Shipped
   the plain nearest-first version (`findContributionGap`) rather than build
   the sends-cross-reference for a v1 tiebreak — still a genuine idea, just
   not built. Revisit if the plain version turns out to surface the same
   spot too often for return visitors.
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
