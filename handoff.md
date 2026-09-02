# Problem Add/Edit addendum — design handoff

Status: **schema, backend, and frontend all implemented and verified
locally (2026-08-08 (d)).** Migrations 0014/0015 are applied to the local
Docker DB, the one-off backfill has run and been hand-checked, and
`internal/crags`/`internal/boulders` (including the merge sub-flow) plus a
rewritten `internal/problems` are live and smoke-tested end to end —
crag/boulder/problem CRUD, image add/remove, per-boulder annotation
listing, and the full suggest → object → resolve merge flow (including the
48h hold and its admin override) all work against the real DB. The
frontend has been rebuilt against this API and smoke-tested live against
the local backend + DB: the multi-step add wizard (spot search/create →
photo-grid rock picker, auto-skipped when there's nothing to choose →
climb details), the map's one-pin-per-crag view with dimmed empty-crag
markers, dedicated crag/boulder pages (boulder photo grid, combined
per-boulder annotation view, "these are the same rock" suggest CTA), the
admin same-rock review queue, and every list/card surface (Directory,
ProblemList, Landing, ProblemCard) rejoined to crag/boulder data instead
of the old free-text `location_name`.

**Amended 2026-08-08 (f)** — the add flow shipped as a strict one-way
three-step wizard, which was never the intent, and decisions 11-14 replaced
it. Cliffs also came into scope (decision 1), changing vocabulary
everywhere.

**Superseding revision (g), 2026-08-09**, refined the sheet after
prototyping (decisions 15-20) and added approach guides (decision 21) and
the collaborative-contribution mechanism (decision 22).

**Built, 2026-08-10 (h).** Decisions 15-22 are implemented and smoke-tested
live against the local Docker DB — the single add sheet
(`palabatu-fe/src/components/add-sheet/`), approach guides end to end
(`internal/approaches`, `ApproachReadingPage`, `ApproachCaptureView`, the
crag page's "Jalan masuk" section), the map's three zoom layers, re-
parenting (backend + a minimal UI), and `authz.CanContribute`. See revision
(h)'s entry below for the full account, including the deliberate scope
trims and the one bug worth remembering. See `ROADMAP.md`'s Phase 1.5 entry
for status and `CLAUDE.md`'s Architecture section for the domain layout.
Continue editing this file directly as the design changes; it's the source
of truth for this effort, not the chat log.

Revision history:
- **2026-08-07 (a)** — review pass against the codebase. Reversed two
  earlier decisions: per-problem `lat`/`lng` are kept, and the UI term is
  "Problem", not "Route".
- **2026-08-07 (b)** — hierarchy went from two levels to three
  (`crags -> boulders -> problems`), confirmed. Added the UX principles
  section, which is a hard requirement on this effort, not a nice-to-have.
- **2026-08-07 (c)** — schema + backend implemented: migrations 0014
  (crags/boulders/merge tables, nullable `problems.crag_id`/`boulder_id`,
  new optional problem fields, three new notification types) and 0015
  (`NOT NULL` + drop `location`/`image_urls`/`lat`/`lng`), the one-off
  `cmd/backfill-crags` script (centroid for crag coordinates, one boulder
  per pre-existing problem, singleton crag per location-less problem — the
  two judgment calls the migration notes section left open), and the new
  `internal/crags`/`internal/boulders` domains plus a rewritten
  `internal/problems`. `internal/report`'s image-report flow was also
  updated (not called out below, but real blast radius) since it validated
  against `problems.ImageURLs`, which no longer exists. Frontend
  application code is unchanged and is the next pass.
- **2026-08-08 (d)** — frontend implemented: the add wizard
  (`components/add-flow/`), the map rewritten for crag pins
  (`Map.tsx`/`PinpointMarker.tsx`/`ClusterCardRail.tsx`), new
  `CragDetailPage`/`BoulderDetailPage` routes, `ProblemDetailPage`/
  `ProblemEditForm` rewritten for the new field set, every list/card
  surface rejoined to crag/boulder data via a small client-side
  `cragCache.ts` helper (no backend denormalization needed — "near you"
  distance and card thumbnails resolve through the existing
  crag/boulder-list endpoints), `MergeSuggestModal` plus an admin
  same-rock review page, and the three merge notification types wired
  into the existing bell/page icon maps. One small additive backend
  endpoint landed alongside it: `GET /boulders/:id/merge-requests`
  (creator-or-admin gated), needed because the admin-wide merge-request
  listing left a boulder's own creator with no way to see a request filed
  against their rock and therefore no way to exercise the objection right
  this doc describes. The old `ProblemDetails` modal and `AddProblemModal`
  were deleted outright rather than ported — both were superseded
  (`ProblemDetails` by `ProblemDetailPage`, now the only problem-detail
  surface; `AddProblemModal` by the new wizard). tsc/eslint/go vet all
  clean; smoke-tested live (not just typechecked) against the local Docker
  DB: map → crag → boulder → problem navigation, the add wizard including
  the single-rock auto-skip, and the full suggest → admin-resolve merge
  cycle.
- **2026-08-08 (e)** — accuracy pass: this document re-read against the
  shipped code, with every claim in (c)/(d) checked (routes, migrations,
  `swagger.json`, the 48h hold, notification fan-out and copy, the UX
  principles, and open item 1's dimmed empty states — all confirmed;
  `go vet`/`tsc`/`eslint` re-run clean). Corrected four things this file
  had wrong: `topo_annotations` was never re-keyed (decision 2 and the data
  model sketch), problems keep `lat`/`lng` only through 0014 and not
  "throughout" (migration notes), the merge design notes had two items
  numbered 5, and the closing line still said implementation hadn't
  started. Two genuine divergences between doc and shipped code became new
  open items 7 and 8. No design decision changed.
- **2026-08-08 (f)** — design amended after reviewing the shipped add flow
  against the original intent. Four things changed. **Cliffs are in
  scope**: the middle level is a rock *or a cliff/wall*, the `rope` grade
  scales already in `constants.ts` are deliberate, and the vocabulary
  follows (decision 1). **Adding is three intents, not one chain** — "add
  a problem", "add a spot", and "add a rock" are all first-class, and each
  saves on its own, restoring the "let people stop partway" half of open
  item 1 that the wizard dropped (decision 11). **UX principle 1 was
  rewritten** in the same pass: it was written for the newcomer only, and
  a flow tuned exclusively against confusion is tuned against the veterans
  who will actually fill the database — so the beginner path stays the
  default, and the expert path (direct classification, context entry
  points, search alongside proximity, and repeat-adding) is always
  available and never hidden behind it. **Photos live at all three levels**
  with distinct roles, and only the rock/wall's photo is annotatable
  (decision 2, amended; decision 12). **Anything can be re-parented** — a
  problem can move to another rock, a rock to another spot (decision 13),
  which is the missing inverse of "not sure" and retires the one-way
  door. The step wizard is replaced by a single scrolling sheet with a
  context header (decision 14 and the rewritten "Add flow" section);
  UX principle 8 was rewritten to match, since the sheet contradicts its
  letter while keeping its intent.
- **2026-08-09 (g)** — revision (f) was drawn as a clickable prototype
  (`prototypes/add-flow.html`), driven at phone widths, and reviewed
  against this file (`prototypes/add-flow-review.md`). Six things in (f)
  turned out to have no answer or the wrong one, and are fixed by
  decisions 15-20 below plus a second prototype
  (`prototypes/add-flow-v2.html`). Nothing structural changed: same three
  levels, same three intents, same one-sheet shape, same schema. What
  changed is **the context rows become one breadcrumb**, **the pickers
  become an overlay rather than an inline expansion**, **the spot pin gets
  a map**, **the success screen becomes a banner on an already-reset
  sheet**, and **"add a rock" can no longer save an empty row**. Open item
  10 is closed and open item 8 is narrowed. One DESIGN.md change falls out
  of it (open item 12).

  Separately, **decision 21 adds approach guides** ("jalan masuk" — the
  walk in, photographed step by step, with a start type that assumes
  angkot and ojek rather than a car), prototyped in
  `prototypes/approach-guide.html`. It is deliberately *not* an add-flow
  field: it lives on the crag page, is captured later on wifi, and its
  reading view — offline-first, one step at a time, for someone standing
  at a junction in the sun — is the actual deliverable.

  Three open items closed in the same pass. **Item 13 — what the crag pin
  means** — resolved as **three map layers chosen by zoom**: far out, one
  pin per crag meaning "there is climbing here, approximately"; zoomed in,
  the crag's individual rocks at their own coordinates; and an approach's
  start point as its own marker for parking. The pin stops pretending to a
  precision it never had. **Item 12** — the DESIGN.md contrast raise — is
  applied, as The Sentence Rule. **Decision 22** builds the collaborative
  *contribution* mechanism (additive only: photos, approaches, notes) with
  the grant policy left explicitly TBA, which unblocks item 11 without
  deciding it.
- **2026-08-10 (h)** — decisions 15-22 implemented and smoke-tested live
  against the local Docker DB (migrations 0016/0017 applied and their down
  migrations verified). `components/add-flow/` is deleted; the single sheet
  lives at `palabatu-fe/src/components/add-sheet/` (`AddSheet`,
  `LocationOverlay`, `RockPicker`/`RockList`, `SpotMiniMap`, `ProblemFields`,
  `SpotFields`, `RockFields`), wired at all four required entry points (map
  FAB, crag "add the first one"/"add a rock", rock "add a problem", each via
  `/map?addToCrag=&addToBoulder=&addIntent=`). Approach guides are new
  end to end: `internal/approaches` (backend), `ApproachReadingPage` (the
  reading view, offline via `localStorage` for step text plus the Cache
  Storage API for step photos — no service-worker registration needed) and
  `ApproachCaptureView`, plus a "Jalan masuk" section on `CragDetailPage`
  and the "Add the way in" link on the add sheet's post-new-spot banner.
  The map's three zoom layers are live (`CragDetailLayer`,
  `BoulderPinMarker`, `ApproachStartMarker`, gated behind `DETAIL_ZOOM`).
  `authz.CanContribute` shipped exactly as decision 22 specified —
  creator-or-admin today, used by every new additive endpoint (crag/
  boulder/problem photo-add, approach create) so widening later is a
  one-line change. Decision 13's re-parenting shipped both backend
  (`UpdateBoulderRequest.crag_id`, `UpdateProblemRequest.boulder_id`) and a
  minimal UI (`ProblemDetailPage`'s "Move to another rock",
  `BoulderDetailPage`'s "Move to another spot").

  One addition beyond the spec, needed to keep UX principle 3's photoless-
  rock fallback honest: `BoulderListItem` gained `sample_problem_name` (the
  oldest problem on the rock) so an unnamed, photoless tile in the rock
  picker reads "Slab Mantap, Sit Start" rather than a bare index, matching
  the principle's own wording.

  Three deliberate scope trims, none blocking: no `PUT /approaches/:id`
  (a second contributor adds a new approach alongside, per decision 21's own
  reasoning, rather than editing one); approach-step reordering in the
  capture view is up/down buttons, not drag-and-drop (no new frontend
  dependency for a short list); grade-range picking from the pre-restructure
  wizard was not carried over (not part of this spec's decisions, and the
  prototype's grade chips are single-select).

  One bug found and fixed during build, worth recording since it's easy to
  reintroduce: a `position: fixed` full-viewport sheet or reading-view
  overlay rendered as a normal descendant (inside `<main>`) can lose paint
  order to `Footer.tsx` (also `position: fixed`, no z-index, rendered later
  in `App.tsx`'s JSX) regardless of the sheet's own z-index. `AddSheet`,
  `ApproachReadingPage`, and `ApproachCaptureView`'s sticky footer all fix
  this the same way: `createPortal(..., document.body)`, the same pattern
  `InfoTooltip.tsx` already used.
- **2026-08-13 (i)** — review pass over the shipped sheet, plus the read
  surfaces this whole restructure left behind. **No decision in this file
  changes**; both outputs are separate documents so this one stays the
  design record rather than becoming a bug tracker.
  - `handoff-add-sheet.md` — 13 findings against `components/add-sheet/`.
    Three break a path this document treats as load-bearing: the
    new-spot → problem → "add another" loop (decisions 11 and 20) dead-ends
    because `submitProblem` never writes the created crag's id back to
    state; the nearest-spot default (decision 19, "the breadcrumb arrives
    answered") never fires unless a cached GPS fix already exists, because
    its once-only guard is set before the branch that needs `myLoc`; and a
    failed save re-POSTs the new crag on retry, making the app itself a
    source of the duplicate spots open item 8 has no cure for. The rest are
    friction and housekeeping, including two places where shipped copy or
    behaviour contradicts decisions 18 and 19 outright. Static review —
    nothing was reproduced live; repro steps are in the file.
  - `handoff-directory.md` — `Directory.tsx`/`ProblemList.tsx` were only
    mechanically rejoined to the hierarchy (via `cragCache.enrichProblems`)
    and still express the flat model they were designed for. Notably,
    decision 2 giving the photo to the rock means a row of problem cards
    from one boulder is now the same photograph repeated, and decision 20's
    repeat-adding makes that the common case. Adds a spots index (the top
    level of the hierarchy has a detail page and no list anywhere), regroups
    each row to the level its question is asked at, and proposes drawing the
    problem's own topo line on its card as the thing that gives a card back
    its subject. Open item 9 is explicitly *not* closed by its
    contribution-gap row — that's a community-facing invitation, not the
    admin needs-attention surface.

## Background — what existed before this effort (as of 2026-08-07)

*Historical: this section describes the state this design replaced, not the
current one. Everything below is now superseded by what shipped.*

- `problems` is flat: `name`, `grade`, `location` (free-text string),
  `lat`/`lng` (its own point per problem), `image_urls`, `created_by`.
  No `description`/beta field exists at all.
- No crag/area entity anywhere. "Location" is a string retyped on every
  problem; every problem gets its own map pin.
- Edit rights today: Founder (creator) or Council/Associate admin only
  (`authz.CanEditProblem`) — unchanged by anything below.
- Trigger: places like Goa Agung / Citatah are one name covering many
  individually-graded sub-crags/boulders, and the flat model can't express
  that (duplicated directions per problem, no canonical name, no way to
  browse "everything at this crag").

## Decisions made

1. **Three levels: `crags -> boulders -> problems`.** *(Confirmed
   2026-08-07(b); was two levels. Amended 2026-08-08(f) — cliffs.)* A crag
   is the place you drive to and park at. The middle level is one piece of
   rock you can walk up to and touch. A problem is one way up it. The
   middle level exists because **one rock hosts several problems**
   depending on where you start and finish (sit vs stand start, traverse,
   different finishes) — that's not an edge case, it's how bouldering
   works.

   **Cliffs are in scope, confirmed 2026-08-08(f).** The middle level is a
   boulder *or* a cliff/wall — a roped route on a face is the same shape of
   thing as a problem on a boulder: one line, on one piece of rock, at one
   spot. The `rope` grade scales (YDS, French) already in
   `palabatu-fe/src/lib/constants.ts` are therefore deliberate, not
   vestigial, and must not be removed. Consequences, all of them naming
   rather than structure:
   - The middle level carries a **type** (`boulder | wall`), set when it's
     created and editable after. Nothing else about the row changes — same
     table, same FKs, same photos, same merge flow.
   - **UI copy switches on that type**, never on a database word: "which
     rock?" vs "which wall?", *batu* vs *tebing*. The Go table stays
     `boulders`; the user never sees that word (see UX principle 6).
   - Where copy has to cover both before the type is known, say **"the
     rock"** — it reads as the material, not the shape, and is what an
     Indonesian climber says for both. Never invent a covering term
     ("formation", "feature", "object") — that's exactly the technical
     vocabulary UX principle 7 forbids.
   - A wall's problems are still called problems in this document for
     continuity; whether the UI says "route" for wall-type children is an
     open question, not settled here (open item 10).
2. **The boulder owns the photo.** This is the concrete payoff of the
   middle level, and it fixes something the current schema actively fights.
   Today `problems.image_urls` is a jsonb array per problem and
   `topo_annotations` is keyed `(problem_id, image_url)` — so two problems
   on the same rock mean two uploads of *the same photograph*, two
   Cloudinary URLs, and two unrelated overlays, with no way to see the
   rock's lines together (which is the one thing a printed topo always
   shows). Under the new model the photo hangs off the boulder and each
   problem draws its own line on that shared image. `topo_annotations`
   needs **no schema change at all** for this — its existing
   `(problem_id, image_url)` unique key (migrations/0005) already means one
   photo, N lines once the photo belongs to the boulder. The only thing
   that moves is which list a save is validated against: the problem's
   *boulder's* `image_urls`, not the problem's own. Note this makes the
   annotation model *simpler* than before, not more complex.

   **Amended 2026-08-08(f): photos exist at all three levels, but only the
   rock's photo is annotatable.** The thing this decision was killing was
   never "a problem has a picture" — it was *two uploads of the same wide
   shot* because two problems on one rock each needed their own base to
   draw on. That failure only ever involved the topo base. So:
   - **Crag** — the approach shot. "Park here, the trail starts at this
     tree." Pairs with `directions`/patokan, and gives Directory / Landing
     / map-popup cards a real image of the place instead of borrowing one
     of its rocks' photos through `cragCache`.
   - **Rock/wall** — the topo base, the wide shot lines get drawn on. This
     is the one that stays singular and shared, exactly as above. Unchanged.
   - **Problem** — beta and action shots: the crux hold, the start
     position, someone on it. Genuinely different content from the wide
     shot, so no duplicate-upload regression.

   **Only rock/wall photos can be annotated.** A line drawn on an action
   shot is a second, competing representation of the same route, and the
   two can then disagree — one canonical topo per rock. This also means the
   annotation model needs no further change: it is already problem-owned
   (`(problem_id, image_url)`, with the URL validated against the *rock's*
   photo list), which is precisely "the line belongs to the problem, the
   photo belongs to the rock". The combined every-line-on-this-rock view on
   the rock page is a read-side aggregation of those, not a separate thing.
3. **Map shows one pin per crag.** Tapping a crag pin opens the crag page.
   Boulders and problems don't get their own pins on the default map layer.
4. **Coordinates live at two levels: crag and boulder. Problems have
   none.** *(Settled 2026-08-07(b).)* The crag pin is the approach/parking
   point; the boulder carries its own optional `lat`/`lng`, because the
   rock is the physical thing that has a position and every problem on it
   shares that position. A problem is a line on a rock — it has no location
   of its own to record.

   This supersedes the two earlier rounds on this question and resolves
   them: the original instinct to drop `lat`/`lng` from `problems` was
   right, and the objection to dropping it (that per-boulder precision at
   sprawling crags like Citatah is genuinely useful and shouldn't be
   thrown away) is satisfied — the precision is preserved, it just lives on
   the boulder now. Nothing is lost, because the backfill gives each
   existing problem its own boulder, so every existing coordinate transfers
   one-to-one.

   Boulder coords stay optional and are not drawn on the default map layer
   (decision 3), but they make a future "zoom into a crag, see its rocks"
   view possible rather than foreclosed.
5. **`crag_id` is always required on a problem; `boulder_id` too.** A lone
   boulder that isn't part of a bigger named area is just a crag with one
   boulder in it. No separate "standalone problem" branch to maintain. See
   the UX section for how this requirement is met *without* interrogating
   the user.
6. **Anyone signed in can add.** Adding a new boulder to any crag, or a new
   problem to any boulder, is open to every signed-in user including on
   someone else's crag — that's the normal case, not an edge case. Editing
   *existing* crag/boulder/problem fields stays with the creator + admins,
   mirroring the current Founder model. Junk is handled by the existing
   report/moderation path, not by a new gate. Deliberately additive, so it
   doesn't require resolving the broader "collaborative problem editing"
   question (see `ROADMAP.md`'s deferred section). *Suggesting* a boulder
   merge follows the same rule — open to anyone, executed only by admins.
7. **"Original/known crag?" resolved without a boolean.** Separate optional
   `first_ascensionist` / `discovered_by` text fields already distinguish
   "this predates Palabatu" from "the adder found it" — blank means
   unrecorded, not an implicit claim. Deliberately not auto-filled with the
   adder's own name.
8. **FA / Discoverer**: free text, one field each, comma-separate multiple
   names. Not linked to user accounts (credited people are often not
   Palabatu users). Usually the same person in bouldering — the distinction
   mostly matters for unclimbed projects — so don't give them equal visual
   prominence.
9. **Optional structured fields**, split by the level they actually vary at
   (this split is now cleaner with three levels than it was with two):
   - Crag: `directions` (patokan), `access_notes` (land
     status/permission/parking), photos *(approach shot — added
     2026-08-08(f))*.
   - Boulder: `rock_type` (andesite, limestone/batu kapur), photos (the
     topo base), `type` (`boulder | wall` — added 2026-08-08(f),
     decision 1).
   - Problem: `landing_hazards` (pad placement, spotting, exposed
     landing), `descent`, `height_m`, photos *(beta/action shots — added
     2026-08-08(f); not annotatable, see decision 2)*.
   - A freeform `notes` field stays at the problem level for anything that
     doesn't fit a structured slot.
10. **One height field, not two.** *(Revised 2026-08-07(a) — was `height`
    plus a separate `highball_flag`.)* They encode the same fact and will
    drift the moment someone fills one and not the other. Keep optional
    `height_m`, derive the "highball" label in the UI at a threshold.
11. **Adding is three intents, and each one saves on its own.**
    *(2026-08-08(f). This was the original intent; the shipped wizard lost
    it. Extended the same day from two intents to three — see below.)*
    Tapping Add offers:

    - **"Add a spot"** — a place you can climb at
    - **"Add a rock"** — one rock or wall at a spot
    - **"Add a problem"** — a line you climbed or found

    These are the reasons a person opens this screen, and they are not the
    same errand. Someone marking a place they walked past is not doing what
    someone logging a line they just climbed is doing.

    **"Add a rock" is there for the veteran** (UX principle 1, as
    rewritten): someone who knows a crag well and is documenting a rock
    they haven't got problems for yet should not have to invent a problem
    to file the rock, any more than they should have to invent a problem to
    file a spot. It is the same argument as decision 11's spot case, one
    level down. A newcomer will never tap it, and that is fine — it costs
    them nothing to ignore.

    This is *not* a violation of UX principle 1's original wording, it is
    the other half of it. Principle 1 forbids **requiring** a database
    level from someone who doesn't think in levels. Offering the choice to
    someone who does — and defaulting to "add a problem", the common case,
    so nobody has to engage with it — is the opposite of forcing it.

    The hard requirement is that **each intent commits on its own**:
    - "Add a spot" saves a crag and stops. That is a complete
      contribution — it is the state open item 1 specced (dimmed pin, "no
      problems yet · add the first one") and the state the shipped wizard
      made unreachable, since it committed nothing until a problem name
      existed.
    - "Add a rock" saves a boulder and stops — a rock with a photo and no
      problems yet, which open item 1 already specced a dimmed treatment
      for on the crag page.
    - "Add a problem" saves the whole chain, creating the spot and the rock
      along the way if they're new.
    - Someone who came to add a problem and gets as far as the spot can
      still leave with the spot saved. Never discard work because the
      errand wasn't finished.

    The motivating case, in the user's words: *a person finds one rock or
    cliff, knows one line on it, and wants to add it the way they could
    before this restructure.* That must be name, grade, done — see the
    rewritten Add flow section for how the rock stays invisible for them.
12. **A brand-new spot never asks about rocks.** *(2026-08-08(f).)* When
    the spot is being created in the same breath, there is by definition
    nothing to choose between, so creating the rock is the app's job, not
    the user's — the strongest reading of UX principle 4, and the one the
    shipped wizard broke by pushing straight into a full new-rock form
    (photo, rock type, name) before the person could say a word about the
    climb.

    The rock is created implicitly and stays **invisible** until there is a
    second problem on it — that is the moment "which rock?" becomes a real
    question. Its optional metadata (name, type, rock type, its own
    coordinates) lives on the rock page for whoever cares later; none of it
    belongs in the path of somebody's first contribution. The photo is the
    exception and moves *into* the climb form (decision 14), because the
    person is standing in front of the rock holding a camera at exactly
    that moment.
13. **Anything can be re-parented.** *(2026-08-08(f).)* A problem can move
    to a different rock; a rock can move to a different spot. Both are
    creator-or-admin, same policy as every other edit.

    This is the missing inverse of "not sure which rock", and its absence
    was the single worst property of the shipped design: **the only
    corrective operation anywhere in the hierarchy was the boulder merge**,
    and every other misfiling was permanent short of delete-and-recreate,
    which cascades away the problem's sends, comments, and annotations. A
    merge is also the *wrong* tool for the common error — if someone files
    against the wrong rock at the right spot, those genuinely are two
    different rocks and must not be combined.

    Moving a problem between rocks must re-point or drop its annotations,
    since a line drawn on the old rock's photo means nothing on the new
    one. Dropping them (with a plain-words warning first) is acceptable;
    silently keeping a line pointed at a photo of a different rock is not.
14. **One sheet, not a step wizard.** *(2026-08-08(f). Supersedes the
    three-step modal.)* See the rewritten "Add flow" section for the
    layout. The short version: a single scrolling sheet, with the spot and
    the rock as one-line context rows at the top that arrive pre-filled and
    expand a picker inline when tapped, and the climb fields always visible
    below. Reaching back up to change the spot or the rock must never
    discard what has already been typed.

15. **The spot and the rock are one breadcrumb line, not two rows.**
    *(2026-08-09(g). Refines decision 14.)* Revision (f) drew them as two
    stacked rows inside one bordered group, each with its own inline
    picker. Prototyped, that fails: expanding the spot picker pushes the
    rock row ~700 px down, *inside the same border*, where it reads as one
    more entry in the spot list — the container that made the two rows a
    unit is exactly what makes the expansion look like it ate one.

    They are one question ("where is this climb?"), not two, so they get
    one line: **`Citatah · 80 m away` / `the one with the crack`**. A
    single line cannot be swallowed by its own picker, and it halves the
    horizontal budget problem — at 320 px the two-row version truncated
    away the distance, which is the only reason to trust the row.
16. **The picker is an overlay, not an inline expansion.**
    *(2026-08-09(g). Supersedes decision 14's "expands that row's picker
    inline".)* Decision 14 rejected **steps** — a corridor you must walk,
    committing nothing until the end. It did not reject overlays, and the
    two are not the same thing: an overlay answers one question and hands
    control straight back to the exact scroll position, which is a
    *stronger* guarantee of "nothing is discarded" than an inline
    expansion that relayouts the sheet underneath you.

    It also buys the picker full sheet width, which decision 17 needs, and
    it lets the spot list expand its rocks in place without that expansion
    landing anywhere near the form.
17. **The rock picker is one column, not a grid.** *(2026-08-09(g).
    Refines UX principle 3.)* Principle 3 says pick the rock by photo, and
    it is the entire justification for the middle level existing. A 2-up
    grid at phone width renders each photo at **140 × 105 px** (110 × 83
    at 320 px) — a wide shot of a limestone boulder at that size, on a
    cheap screen in daylight, is a brown rectangle. Full-width 16:9 rows
    show fewer at once and each one is actually recognisable. That is the
    correct trade; the grid gave away the one thing the restructure paid
    for.
18. **Changing the spot always re-derives the rock.** *(2026-08-09(g).
    Resolves a collision decision 14 left open.)* Decision 14 says
    reaching back up "must never discard what has already been typed" —
    but the rock is not typed, it is **derived**, and it cannot survive
    its parent changing. Prototyped, the unresolved version happily
    offered to file a problem on a rock at a different spot.

    Split the two explicitly. **Typed content** — name, grade, photo,
    details — is never discarded, ever. **Derived context** re-derives on
    every spot change:
    - new spot has **no rocks** → the rock question disappears entirely
      (decision 12, generalised past "brand-new spot" to "no rocks yet")
    - **exactly one** → auto-selected (UX principle 4)
    - **two or more** → resets to unanswered and the picker stays open,
      because that is now the only thing left to answer

    A stale pairing must be unreachable, not merely unlikely. A photo
    already staged against the old rock moves with it, and the sheet says
    so in one plain line rather than re-parenting an upload silently.
19. **Each intent gates on what makes it findable, and the submit never
    leaves the screen.** *(2026-08-09(g).)* Three parts:
    - **"Add a rock" requires a photo or a name** — either, never both,
      never neither. As specced in (f) every field but the spot was
      optional, so the intent could write an unnamed photoless rock: the
      exact artifact open item 9 calls the signal that somebody wasn't
      sure, and the thing an admin queue exists to clean up. Unlike the
      implicit case it has no problem attached to identify it by
      (principle 3's fallback), so it is unrecognisable in the picker
      forever. The intent as drawn was a machine for making the mess.
    - **The submit lives in a sticky footer**, with its reason underneath.
      A single scrolling sheet puts a bottom-anchored primary off-screen
      whenever content is long, which it always is once a picker or "more
      details" opens. Decision 14's own complaint about the wizard — a
      primary button that is the visual anchor while being unable to
      act — is the same bug inverted when the button that *can* act is
      the one you cannot see. A permanently visible disabled button with
      a plain-words reason teaches the requirement; a hidden one is
      simply absent when you reach for it.
    - **"Nearest spot" is only a default when it is near.** Past ~500 m
      the sheet stops asserting and says so. Auto-filing onto a spot 14 km
      away is the same un-mergeable duplicate failure as decision 14's
      motivating case, running in the other direction.
20. **The spot pin gets a map; the success screen becomes a banner.**
    *(2026-08-09(g). The banner departs from (f)'s Add flow section.)*
    - **The pin is the only thing this flow writes that cannot be
      undone** — open item 8: duplicate spots have no merge, no delete,
      and strand every rock beneath them. In (f) it was a dashed box
      reading "dropped where you're standing", styled identically to the
      photo uploader, with nothing to check it against — the least
      verifiable control on the sheet guarding the most permanent write,
      while the trivially replaceable photo got equal visual weight. It
      gets an inline map showing the dropped pin, **its accuracy radius**,
      and **nearby existing spots with their distances**. Decision 14
      called the distance-sorted list "the only duplicate-spot prevention
      in the design"; drawing the neighbours on a map is the strong form
      of that same idea, and Leaflet is already in the app. Accuracy is
      shown rather than implied — under limestone on a low-end Android a
      fix is ±30 m or worse, and "where you're standing" claims a
      precision the device does not have.
    - **The success screen becomes a banner above an already-reset form.**
      (f) specced a full takeover offering "add another to this rock".
      But repeat-adding is named the highest-value affordance in the whole
      flow, and a takeover between problem 1 and problem 2 is eight
      interruptions for eight lines. A banner on a sheet that has already
      cleared the climb fields and kept the spot and rock is the same
      offer without the round trip — and it gives **"draw the line"**
      somewhere to live after submit, which (f) gave it nowhere. Drawing
      is perishable (you leave the rock and it's gone for months) where
      adding another problem is not, so when a photo exists and no line
      has been drawn, that is the banner's primary action.

21. **Approach guides ("jalan masuk") are a crag-page surface, not an add-flow
    field.** *(2026-08-09(g). Prototyped in
    `prototypes/approach-guide.html`.)* `patokan` answers "which turning";
    it does not answer "how do I get from the angkot to the rocks", which
    is the question that actually loses people. That needs photographs of
    the walk, in order — the thing every printed guidebook has and no app
    does well.

    **It does not belong in the add flow**, for three reasons that all
    point the same way:
    - **The moment is wrong.** Decision 14 put the rock photo in the climb
      sheet because you are standing in front of the rock holding a
      camera. The approach is shot on the *way in* — by the time you are
      at the rock it is behind you.
    - **The size is wrong.** A multi-photo sequence builder inside "Add a
      spot" destroys the name-pin-done fast path decision 11 exists to
      protect.
    - **The author is usually wrong.** Whoever created the spot walked in
      once. The person who knows the directions are bad is the tenth
      visitor, standing at the junction where everyone goes wrong.
      Coupling this to creation guarantees it is written by the person
      least motivated to write it.

    So `patokan` stays exactly as it is — one line, in the sheet, under
    More details — and the crag page gets its own **"Jalan masuk"**
    section. Plain, local, and distinct from *patokan*, which is one
    landmark rather than the whole walk (UX principle 6).

    **Shape.** An approach is an ordered list of steps, each a photo plus
    one line, plus:
    - a **start type** — *turun angkot · diantar ojek · parkir motor ·
      parkir mobil · jalan kaki*. This is the local-first part and it is
      not decoration: every global climbing app assumes you arrived by
      car, and a guide that begins "get off the angkot at the warung with
      the blue roof" is something none of them will ever write. Squarely
      PRODUCT.md's positioning.
    - a rough **duration**, and an optional **coordinate per step**
    - a per-step **"careful here"** flag — slippery after rain, easy to
      miss, ask permission first. A flag survives skim-reading where a
      sentence does not.

    **A crag may have several**, and should: "from the angkot" and "from
    the village with a motor" are genuinely different walks. This also
    sidesteps the collaborative-editing deferral cleanly — a second
    contributor adds their own approach *alongside*, rather than editing
    someone else's words (see open item 11).

    **Rocks get one line, not a sequence.** Crag to rock is one or two
    hops, and the rock already has a photo and optional coordinates. If a
    rock genuinely needs six steps it is really its own crag. Do not build
    two sequencing systems.

    **The reading experience is the deliverable; capture is secondary.**
    The whole value is realised by one person, at a junction, in direct
    sun, on one bar, one-handed, possibly wet. That drives every choice in
    the prototype and these are requirements:
    - **The photo gets the screen**, portrait — phones shoot portrait, and
      portrait matches the act of holding the phone up against the
      junction in front of you.
    - **Captions never sit on the photograph.** Contrast against arbitrary
      photographic content cannot be guaranteed in sunlight, and this is
      the one screen where that failure costs somebody their afternoon.
      Solid ground, 17 px, measured at 14.4:1.
    - **One step at a time, not a scrolling article.** At a junction you
      need exactly one step; a six-photo scroll makes you find your place
      again every time you pull the phone out.
    - **Offline is stated, not assumed.** "Saved on your phone — works
      with no signal" is the most reassuring string on the screen, and the
      *unsaved* warning has to fire while signal still exists, which is
      the only moment it can be acted on. This is the strongest PWA
      argument in the product: a guide that will not load at the trailhead
      is worth nothing.
    - **If steps carry coordinates, open on the step you are nearest.**
      Pull the phone out at the fork and it is already showing the fork —
      that is the whole feature in one interaction. Hedge it ("you're
      about here"), and never auto-advance: telling someone they have
      arrived when they have not is worse than saying nothing.
    - **Write it in Indonesian.** "Turun angkot di warung Pak Asep" is the
      real sentence; translating it would be worse in every way.

    **Capture happens later, at home, on wifi** — and the UI should say
    so. Photos first, captions second (you arrive with eight shots; pick
    them all, then write), reorderable. The one add-flow hook: after
    saving a **new spot**, offer "Add the way in" from the success banner
    (decision 20), which is the one moment the photos are fresh.

22. **Build the collaborative-contribution mechanism now; leave who it
    grants to TBA.** *(2026-08-09(g). Narrows the deferral in "Explicitly
    not decided here" and supersedes open item 11's framing.)* The
    permission question has been deferred three times and is now blocking
    real features — approach guides (decision 21) and photos on someone
    else's rock (open item 11) both want it. The way out is to separate
    the **mechanism** from the **policy**: build the first, leave the
    second a one-line change.

    **The line that makes this safe is additive vs destructive:**
    - **Adding** — a photo, an approach, a beta note — creates something
      new next to what exists. Nothing anyone wrote is lost, and a bad
      contribution is removable. This is the part that opens up.
    - **Changing or removing** someone else's words — the name, the grade,
      the description, another person's photo — stays creator-or-admin,
      exactly as today. Not in scope, still deferred.

    **Shape.** A single policy function in `internal/authz`, sibling to
    `CanEditProblem` and following the same stateless "takes already-fetched
    data as args" rule that keeps the domain graph acyclic:
    `authz.CanContribute(userID, entity, kind, ownerID, titles)`, where
    `kind` distinguishes `add_photo` / `add_approach` / `add_note` from
    `edit_field` / `delete`. Ship it returning **creator-or-admin for
    everything**, i.e. today's behaviour exactly, so nothing changes on
    day one. Widening any single `kind` to "any signed-in user" is then a
    change in one function, not an audit of every call site.

    **Two things the mechanism must carry regardless of policy**, because
    retrofitting them later is expensive:
    - **Attribution on every contribution** — "photo by Wina", "approach
      by Rizal". Without it there is no way to credit, and no way to judge
      or revert a bad addition.
    - **A removal path for the owner or an admin.** Opening contribution
      without giving the rock's creator a way to remove junk is how you
      lose the creators.

    Deliberately not decided here: which `kind`s widen, and whether
    widening is global or per-crag. That is the TBA.

## UX principles — non-negotiable for this effort

Three levels of nesting is the single biggest risk in this design. It is
correct as a model and **actively hostile as an interface** if exposed
directly. A beginner should never have to understand the hierarchy to
contribute. Everything below is a requirement, not a suggestion.

*Amended 2026-08-08(f): the paragraph above is still true and is still
only half the job. It describes one user. See principle 1.*

1. **Never make the user classify — and never stop them, either.**
   *(Rewritten 2026-08-08(f). Was: "Never make the user classify. Don't
   present Crag / Boulder / Problem as a choice of what to add.")*

   The original still holds as the **default**: don't force a database
   level on someone who doesn't think in levels. Ask plain questions in the
   order a person naturally answers them, and let the app do the filing.

   But it was written for one user, and this app has two:
   - **The newcomer's failure mode is confusion.** They can't classify, so
     asking them to is a dead end. Everything above addresses this.
   - **The veteran's failure mode is friction.** They know exactly what
     they're adding — a new rock at a crag they've been to fifty times —
     and making them answer beginner questions to get there is a tax paid
     on every single contribution.

   **Optimising only for the first produces a slow app for the people who
   will actually fill it.** In every community climbing database, a small
   number of committed contributors add most of the entries; the long tail
   of one-time adders is real and worth serving, but it is not where the
   data comes from. A flow tuned exclusively against confusion is tuned
   against the majority of the contributions palabatu needs.

   So: **the beginner path is the default; the expert path is always
   available and never hidden behind it.** Concretely —
   - Someone may say directly what they're adding: a spot, a rock, or a
     problem (decision 11). That is classification, offered rather than
     demanded, and it is the veteran's shortest route in.
   - Context is a first-class entry point. "Add a rock here" on a crag
     page, "add a problem here" on a rock page — someone who navigated
     there deliberately has already classified, and must not be walked
     back through "where is it?".
   - Pickers always allow **search**, never only proximity. The nearest
     spot is the beginner's answer and the common one; it is not the
     veteran's, and a distance-sorted list with no search box is its own
     kind of dead end.
   - **Repetition is the veteran's real cost.** Someone documenting eight
     lines on one rock in a single session must not re-answer where and
     which rock eight times. See the Add flow section's "add another"
     requirement.

   The test for any screen here: *a beginner can finish it without knowing
   the model, and a veteran can finish it without being taught the model
   again.* Both, or it isn't done.
2. **Explain by example, never by definition.** Where the words do have to
   appear, one line each, concrete:
   - Crag — "the place you park and walk in from"
   - Boulder — "one rock, the thing you actually touch"
   - Wall/cliff — "one face, the thing you actually climb"
   - Problem — "one way up it"
   No paragraph explaining containment. If it needs a diagram, it's wrong.
3. **Pick the rock by photo, not by name.** Nobody recognises "Boulder 3B";
   everybody recognises a picture of the rock they're standing next to. The
   boulder picker is a photo grid, not a dropdown or a text list. This
   falls straight out of decision 2 (the boulder owns the photo) and is the
   main reason that decision pays for itself in UX and not just in schema
   tidiness.

   **The picker must degrade to something better than a name.**
   *(2026-08-08(f).)* Most rocks have no photo yet and most have no name —
   in the local data at the time of writing, 7 of 10 rocks had no photo and
   8 of 10 had no name, so the photo grid rendered as grey placeholder
   tiles labelled "Rock 1", "Rock 2", which is the precise failure this
   principle exists to prevent. A photoless tile must therefore identify
   itself **by the problems on it** — "Slab Mantap, Sit Start" — because
   somebody standing at the rock who knows one line on it can recognise
   that instantly, where a generated label tells them nothing. Falling back
   to a bare index is not acceptable.
4. **Collapse any step with nothing to choose.** If a crag has one boulder,
   don't ask which boulder — skip the step. The third level should only
   become visible when there is genuinely something to choose between. Most
   early adds will never see it.
5. **Never dead-end someone who doesn't know.** "Not sure which rock" and
   "it's a new rock" are always available, and both proceed. A beginner who
   can't confidently classify must still be able to finish — file it
   loosely and let admins tidy up later. Losing the contribution is worse
   than filing it imperfectly.

   **"Later" has to be a real operation.** *(2026-08-08(f).)* As shipped,
   "not sure" quietly created a fresh unnamed, photoless rock and nothing
   could ever move the problem off it — the promise of tidying up had no
   mechanism behind it, and the escape hatch manufactured exactly the mess
   the merge flow existed to clean up. Decision 13 (re-parenting) is what
   makes this principle honest. A loosely-filed contribution must also be
   *findable*: an unnamed, photoless rock holding one problem is what
   "somebody wasn't sure" looks like, and admins need a surface that
   surfaces them (open item 9).
6. **Plain words, app's existing vocabulary.** The product already says
   "Spot Map" (`Landing.tsx`'s feature grid, per `ROADMAP.md`), so "spot"
   is established, layman-friendly, and preferable to "crag" in UI copy
   where either works. Indonesian plain terms are the fallback when the
   English is jargon — "patokan" is already the right word for directions,
   and "batu" reads better than "boulder" to a beginner.
7. **No technical vocabulary in the UI, ever.** Not "entity", "parent",
   "record", "required field", "annotation", "topo", "invalid". Say "draw
   the line on the photo", not "add a topo annotation". Say "we need a name
   for this", not "name is a required field".
8. **Never let the hierarchy become the layout — and never let it become a
   corridor either.** *(Rewritten 2026-08-08(f). Was: "One screen, one
   question — short steps, each answering one plain question, with a
   visible way back.")*

   The original wording was half right, and the half it got wrong did real
   damage. A form with three nested sections labelled Spot / Rock / Climb
   is the hierarchy leaking into the layout, and that is still forbidden.
   But "short steps" was read as a step wizard, and a wizard turned out to
   be worse than the disease:
   - It made every question feel mandatory and ordered, when in practice
     the middle one is skipped for most spots (6 of 8 in the local data
     have exactly one rock) — a three-step flow that is usually two steps,
     one of which is a single tap, is ceremony.
   - Its linearity is what produced the one-way door: because nothing was
     written until the last screen, there was no way to save a spot on its
     own, and decision 11's whole premise became unreachable.
   - Its primary button was the visual anchor of every screen while being
     unable to advance two of the three — you progressed by tapping a card,
     and "Continue" existed only to tell you off.

   The replacement: **one sheet, hierarchy shown as breadcrumb rather than
   as structure.** The spot and rock are single context lines, not
   sections; they arrive answered; changing one expands a picker inline and
   collapses it again. Everything stays on one scroll, so going "back" is
   just scrolling up, and nothing is discarded on the way. A beginner sees
   name, grade, done — the nesting is present, but as a place you already
   are, not as a corridor you must walk.

## Proposed data model (sketch, not final SQL)

```
crags
  id
  name                  -- canonical, e.g. "Goa Agung"
  lat, lng               -- single approach/parking pin, required
  directions              -- patokan
  access_notes            -- optional
  image_urls              -- ADDED 2026-08-08(f). The approach shot ("park
                          -- here, the trail starts at this tree"). Not
                          -- annotatable. Gives cards a picture of the
                          -- place instead of borrowing a rock's photo.
  created_by, created_at

boulders
  id
  crag_id                -- FK -> crags, required
  name                   -- optional; many rocks are unnamed, and the user
                          -- is never made to invent one to proceed. A bare
                          -- generated label ("Rock 2") is NOT an acceptable
                          -- fallback in the picker -- identify an unnamed
                          -- rock by the problems on it (UX principle 3, as
                          -- amended 2026-08-08(f)).
  image_urls             -- MOVED here from problems. The rock's photos;
                          -- problems draw their own lines on these. The
                          -- ONLY annotatable photos in the app (decision 2
                          -- as amended 2026-08-08(f)).
  type                    -- boulder | wall. ADDED 2026-08-08(f): cliffs are
                          -- in scope (decision 1). Drives UI copy only
                          -- ("which rock?" vs "which wall?", batu vs
                          -- tebing) -- no structural difference.
  rock_type               -- optional
  lat, lng                -- optional; the rock's own point (decision 4).
                          -- Not drawn on the default map layer.
  merged_into             -- FK -> boulders, nullable. Set instead of
                          -- deleting when this rock is merged away, so a
                          -- merge stays reversible. See the merge section.
  created_by, created_at

problems
  id
  boulder_id             -- FK -> boulders, required
  crag_id                -- FK -> crags. Denormalised on purpose: every
                          -- list/filter/map query wants it, and it saves a
                          -- two-hop join on the app's hottest read path.
  name
  grade
  first_ascensionist      -- optional, free text
  discovered_by           -- optional, free text
  landing_hazards         -- optional
  descent                 -- optional
  height_m                 -- optional, numeric; highball derived in UI
  notes                   -- optional, freeform catch-all
  image_urls              -- RE-ADDED 2026-08-08(f) with a NEW meaning:
                          -- beta/action shots (crux hold, start position,
                          -- someone on it), never the topo base and never
                          -- annotatable. Not a revert of 0015's drop --
                          -- that column held the wide shot, which now
                          -- belongs to the rock. New column, new purpose.
  created_by, created_at
  location                -- EXISTING free-text column. Survives the first
                          -- migration as the backfill source, then gets
                          -- dropped in a later one, once the backfill is
                          -- verified. Not both in one step.
  image_urls              -- EXISTING. Emptied by the migration (contents
                          -- move to boulders), dropped in the same later
                          -- migration as `location`.
  lat, lng                -- EXISTING. Contents move to the problem's
                          -- backfilled boulder, then dropped alongside
                          -- `location` and `image_urls` (decision 4).

boulder_merge_requests   -- see the merge section below
  id
  source_boulder_id, target_boulder_id   -- FK -> boulders
  suggested_by, reason
  status                 -- pending | merged | rejected
  resolved_by, resolved_at
  created_at

boulder_merge_objections
  id
  merge_request_id       -- FK -> boulder_merge_requests
  user_id, body, created_at

topo_annotations         -- UNCHANGED. Its existing (problem_id, image_url)
                          -- unique key already expresses one photo, many
                          -- lines once the photo hangs off the boulder; only
                          -- the membership check moves (see decision 2). FK
                          -- to problems still cascades.
```

## Add flow

*Rewritten 2026-08-08(f). The previous version of this section described a
three-step wizard ("Where is it?" -> "Which rock?" -> "Tell us about the
climb", each its own screen). That shipped, and it was wrong — see
UX principle 8 for why, and decisions 11-14 for what replaces it.*

*Amended 2026-08-09(g) after prototyping. The layouts below are updated;
decisions 15-20 carry the reasoning and `prototypes/add-flow-v2.html` is
the working interaction spec. The three intents, the single sheet, and
"each one commits on its own" are unchanged.*

Written as the user experiences it. No screen names a "level".

**Tap Add — three intents, per decision 11.** They are a segmented control
at the top of the sheet, not a menu you clear first:

```
  Add a problem                                        [x]
  [  A problem  |    A spot    |    A rock  ]   <- "A problem" pre-selected
```

Ordered by how often each is the answer, not by hierarchy depth — a
newcomer never touches it; a veteran taps straight to the one they meant
(UX principle 1). *(Amended 2026-08-09(g): (f) drew this as a blocking
three-option menu. Decision 11 justifies the choice as "classification,
offered rather than demanded" — but a menu you must clear before typing
anything is demanded. A segmented control is zero taps for the common case
and one for the other two: strictly better than one tap for everyone, with
all three still first-class and still committing on their own.)* Opening
from a crag or rock page pre-answers the intent and everything above it:
"add a rock here" on a crag page opens on the rock tab with the spot filled
in, and must not walk back through "where is it?".

**"Add a spot"** is a short sheet on its own: name, **the pin on a map**
(decision 20), photo, patokan, access notes. It saves and stops. The result
is a dimmed pin with "no problems yet · add the first one" (open item 1) —
a complete contribution, not an abandoned one.

**"Add a rock"** is the same shape one level down: which spot (pre-filled
if you came from a crag page), photo, optional name and rock type, and
whether it's a boulder or a wall. Saves and stops — but **not empty**: a
photo or a name is required (decision 19).

**"Add a problem"** is one scrolling sheet. Not steps:

```
  Add a problem                                        [x]
  [  A problem  |    A spot    |    A rock  ]

    ✓ Sit Start is up                        see it     <- after a save
      [ Draw the line on the photo ]                       (decision 20)

    ⌾ Citatah · 80 m away                          >   <- ONE breadcrumb,
        the one with the crack                            not two rows
    ──────────────────────────────────────────────────
    Name      [ Slab Mantap                    ]
    Grade     [ V0  V1  V2  V3  V4  V5 ... ] more      <- rope scale if
    Photo     [ the rock's topo ]  [ Draw your line ]     it's a wall
    More details (optional)                          v
  ──────────────────────────────────────────────────── <- sticky footer
    [ Add problem ]        Give it a name first
```

How it behaves — these are requirements, not styling notes:

- **The breadcrumb arrives answered.** Spot defaults to the nearest one
  *if it is actually near* (decision 19); the rock defaults to the only one
  there, or is absent entirely when the spot has no rocks yet
  (decision 12/18). Tapping it opens the picker **as an overlay**
  (decision 16) which returns to the exact scroll position. *(Amended
  2026-08-09(g): (f) specced two stacked rows with inline expansion. See
  decisions 15-16 — the expansion swallowed the sibling row, and at 320 px
  the two rows truncated away the distance.)*
- **Changing the spot re-derives the rock; it never goes stale.** See
  decision 18 for the three cases.
- **Nothing is discarded when you reach back up.** Changing the spot after
  typing a name and grade keeps the name and grade. This is the whole point
  of the sheet over the wizard.
- **The spot picker is sorted by distance.** The answer to "where is it" is
  almost always "here" — the map already has a "find my location" control,
  so the data is there. This also happens to be the only duplicate-spot
  prevention in the design: someone who can't find "Citatah" by typing
  (because the row reads "Citatah 125") creates a second pin 200 m from the
  first, and unlike duplicate rocks there is no merge path for that
  (open item 8). Showing "Citatah · 80 m away" at the top prevents it
  before it happens. Distance beats search here. *(Strengthened
  2026-08-09(g): a sorted list is the weak form of this. When a **new**
  spot is being created, the neighbours are drawn on a map alongside the
  dropped pin — "Citatah is 80 m from your pin. Same place?" — which is
  where the duplicate actually gets made. See decision 20.)*
- **The photo field is on this sheet, not on a rock step.** The person is
  standing in front of the rock with a camera right now; that is the moment
  to ask. It uploads to the *rock* (decision 2 — the rock owns the topo
  base), whether that rock already existed or is being created implicitly.
  If the chosen rock already has photos, this row offers them to draw on
  instead of asking for another. *(Sharpened 2026-08-09(g): when the rock
  already has a topo, **drawing is the primary action and uploading is a
  52 px afterthought** — a second wide shot of the same rock is exactly the
  duplicate decision 2 exists to kill, reintroduced one level down. (f)
  had the uploader as a full-width dashed box and "draw on one" as body
  text, which is that emphasis backwards.)*
- **"Draw the line" appears only once a photo exists**, and never blocks
  submitting. It is the payoff of the whole restructure, but it is not a
  requirement for contributing. *(Amended 2026-08-09(g): it must also be
  offered **after** submit — see decision 20. (f) dropped the subject
  entirely on the success screen, at the one moment the person has a fresh
  photo and is still standing at the rock.)*
- **Name is the only required field.** Grade included — an unclimbed
  project has no grade yet, and demanding one is how you lose the entry.
  The grade scale itself follows the rock's type (decision 1, open item 10):
  V-scale for a boulder, `rope` for a wall.
- **The submit button is disabled until it can actually work**, rather than
  enabled-and-scolding — and it **lives in a sticky footer with its reason
  underneath** (decision 19), because a disabled button you have to scroll
  to find is worse than a scolding one. The shipped wizard's primary button
  was the brightest thing on screen while being unable to advance two of its
  three steps; don't reproduce that in either direction.
- **Submitting offers "add another to this rock"** and keeps the spot and
  the rock filled in, clearing only the climb fields — as a **banner above
  an already-reset sheet, not a full-screen success step** (decision 20).
  This is the single
  highest-value affordance for the people who will actually populate
  palabatu: documenting a rock means entering its lines one after another —
  sit start, stand start, the traverse, the arête — in one sitting, at the
  rock, and re-answering "where is it / which rock" for each of them is a
  tax charged five times for one visit. It is also nearly free to build,
  since the sheet already holds that state. Same offer one level up after
  adding a rock ("add another rock here"). See UX principle 1 on why
  repetition, not confusion, is the veteran's failure mode.
- **The spot and rock pickers always have a search box**, even though the
  list is distance-sorted. Proximity is the right default and the wrong
  only option — someone entering a trip's worth of problems at home, from
  notes, is nowhere near the spot.

**The motivating case end to end** (decision 11): someone finds a rock or
cliff with one known line on it. They tap Add a problem, the sheet opens
with "Where" already showing the nearest spot or "add a new spot", they
name the spot and drop a pin, they never see the word "rock" at all
(decision 12), they type a name and a grade, they photograph the rock, they
submit. Three fields and a photo — the same effort as before this
restructure, with all three levels correctly filed behind the scenes.

**Implementation note.** Build this sheet through the `impeccable` skill
(`.claude/skills/impeccable/`) rather than hand-rolling the layout — it
reads `PRODUCT.md` and `DESIGN.md` automatically, which is where this app's
palette, typography, spacing, and component patterns actually live, and
this sheet is the single most-used surface in the product. The interaction
requirements above are the brief; the visual execution should come from the
design system, not from whatever the previous modal happened to do. Mobile
is the primary target (installable PWA), so verify at phone widths first,
not last.

## Boulder merge flow

Duplicate rocks are guaranteed, not hypothetical: the backfill creates one
boulder per existing problem (see migration notes), and contributors
standing at the same rock will keep creating new ones. So merging is a
first-class flow, not a cleanup script.

**Executing a merge is an admin privilege. Suggesting one is open to
anyone signed in.** Same additive shape as decision 6.

```
Any signed-in user spots two duplicate rocks
  -> "These are the same rock" CTA on the boulder page
  -> picks the other rock, optional short reason
  -> merge request created (status: pending)

Notifications fire immediately:
  -> admins: a merge has been suggested, needs review
  -> the creator of each boulder involved   [can object]
  -> the creators of the problems on each boulder
     (informed only — their lines move, but no objection right)

The two boulder creators can object: "this is not the same
rock", free text, on the request itself.
  -> objections are visible to admins on the request
  -> an objection does NOT veto the merge

48h hold: the request cannot be merged until the window
closes, so the objection right is real and not theoretical.
Admins can override the hold for obvious cases.

Admin decides: merge (choosing which rock survives) or reject.
  -> notification to the suggester and both boulder creators,
     either way, with the outcome
```

Design notes, in rough order of how much they matter:

1. **Merges are reversible — soft, not destructive.** The losing boulder's
   row is kept with `merged_into` set, rather than deleted. This is the
   single most important property here: a late objection, a mistaken merge,
   or an admin acting too fast all become an undo instead of an
   unrecoverable data loss. A hard delete of a rock takes its problems,
   photos, annotations, sends, and comments with it — never do that on a
   judgement call that a rebuttal might overturn.
2. **What actually moves on merge**: the losing boulder's problems repoint
   to the surviving boulder, and its photos union into the survivor's set.
   Sends, comments, reports, and annotations all hang off `problems.id`,
   which doesn't change, so they follow their problems automatically and
   need no special handling.
3. **Only the two boulder creators can object.** *(Settled 2026-08-07 —
   an earlier draft let anyone notified object.)* The person who put the
   rock in is the one most likely to actually know whether it's the same
   rock; opening rebuttal to every passer-by turns a factual question into
   a vote. Creators of the *problems* on each rock are still **notified**,
   since their lines move, but have no formal objection — if they disagree
   they still have the ordinary report/contact-an-admin path, which is the
   same recourse everyone else has.
   - If a boulder's creator is gone (deleted account) nobody objects on
     that side, and the merge proceeds after the hold. Acceptable.
   - Backfilled boulders inherit `created_by` from the problem they were
     generated from, so migrated rocks have a real creator with real
     objection rights — not an orphaned row.
4. **Objections inform, they don't block.** Confirmed: the decision is the
   admin's. The UI should present objections prominently on the request
   rather than as a footnote, but it never gates the button.
5. **48h hold before a merge can execute.** *(Confirmed 2026-08-07.)*
   Without it, an admin resolving instantly makes the objection window
   theoretical. Admins can override the hold for obvious cases (same
   creator on both rocks, spam, clear vandalism). The hold applies to
   *merging*; rejecting a bad suggestion needs no wait.
6. **Which rock survives is the admin's pick, not automatic.** Default the
   UI's suggestion to the older / more-documented rock, but let the admin
   flip it — the better-named rock isn't always the older one.
7. **Duplicate problem names after a merge are fine.** Two rocks each
   having a "Sit Start" is a naming collision, not a data error. No
   constraint, no auto-rename; leave it to admins to tidy if it matters.
8. **New notification types needed** (`notifications` already has a type
   system, migrations/0007): merge suggested, merge objected, merge
   resolved. Reuses the existing table and delivery path — no new
   notification infrastructure.
9. **Don't say "merge" to laymen.** Per the UX principles: the CTA is
   "These are the same rock", the objection is "This is not the same rock",
   the outcome notice is "Two rocks were combined". No "merge request",
   no "resolve", no "source/target".

## Migration notes

The local Docker DB has real problem rows with free-text `location`
strings. Small, throwaway, no external users — so this is **a one-off
hand-checked script, not general tooling.** Don't build a reusable importer
for a job that runs once.

- **Crags: group by *normalized* location** (trim + lowercase), not exact
  string match. Exact match turns "Citatah", "citatah", and "Citatah 125"
  into three crags.
- **Each new crag needs a lat/lng and its grouped problems disagree.** Pick
  one rule and write it into the script: centroid of the group, or the
  oldest problem's coords. **Resolved 2026-08-07(c): centroid** — more
  representative of the whole group than an arbitrary single problem's
  coordinates. Implemented in `cmd/backfill-crags`, run and verified
  against the local Docker DB.
- **Boulders: one per existing problem.** There is no data that says which
  existing problems share a rock, so don't guess — give each problem its
  own boulder and move its `image_urls` there. Real rocks get merged later
  by hand. This is the honest backfill; an inferred one would silently
  invent facts.
- **Each problem's `lat`/`lng` transfers to its backfilled boulder**, so
  the coordinate move (decision 4) is lossless — one boulder per problem
  means one coordinate per boulder, no averaging or discarding.
- **A merge path is therefore required, not optional** — the backfill
  creates duplicate rocks by construction. See the merge section above; it
  is a real user-facing flow, not a SQL runbook.
- `topo_annotations` rows carry over unchanged in content — the image URLs
  they reference just belong to a boulder now instead of a problem.
- Problems keep their existing `lat`/`lng` **through 0014**, so the
  backfill can be eyeballed against the old coordinates before anything is
  destroyed. 0015 drops them alongside `location`/`image_urls`, once that
  check has happened.
- `problems.location` and `problems.image_urls` are dropped in a **later**
  migration, after the backfill is eyeballed — not in the same one.

## Blast radius

Checked against the code, 2026-08-07:

- **The FK graph mostly doesn't fight this.** `sends`, `comments`,
  `reports`, and `notifications` all hang off `problems.id`, which this
  design preserves — none of them need to change. `topo_annotations` turns
  out not to be an exception either: its key is already the right one, and
  only the membership check moves (decision 2).
- **Photos moving from problem to boulder is the largest single change**,
  and it's the one to schedule first — it touches upload, display, the
  annotation editor/viewer, and every card that shows a thumbnail.
- **Frontend**: 12 files touch `lat`/`lng`/`location_name`, including the
  663-line `src/pages/Map.tsx` and `ClusterCardRail.tsx`. The map's
  clustering layer now partly overlaps with what a crag expresses — check
  whether crags supersede some of it rather than layering on top.
- `Directory.tsx` and `ProblemList.tsx` group/filter by free-text
  `location_name` today; both get a real join, which is an improvement.
- **The merge flow adds two tables and three notification types**, but no
  new infrastructure — `notifications` already has a type system
  (migrations/0007) and a delivery path, and the admin review surface can
  follow the existing report/moderation queue's pattern rather than
  inventing a second one.
- **This unblocks "Follow a crag"** (Phase 2 in `ROADMAP.md`), currently
  specced there as a geospatial "within X km" check. With a crag entity it
  becomes a plain FK join. Crags first makes follow-a-crag nearly free.

## Sequencing — done 2026-08-08, before any deploy

*Historical: the argument that carried the decision, kept for the record.
It played out as written — schema, backend, and frontend all landed against
the local Docker DB with no users to notify.*

**Do this before the first production deploy.** It's a Phase-1.5-sized item
not currently on `ROADMAP.md`, and Phase 1 is down to deployment services
plus art assets — so it does delay launch. Take the delay anyway: right now
the migration is free (local Docker, throwaway rows, no users to notify,
mistakes are `db.ps1 down`). After launch it's real contributions from real
people, and the identical change becomes harder, slower, and much less
reversible.

This argument is now stronger than it was at two levels: *inserting* a
level between two existing ones post-launch, while also moving photo
ownership, is the most expensive version of this change. The cost only goes
up from here.

## Open items

1. ~~**Does creating a Crag require adding its first Problem?**~~
   **Resolved 2026-08-07: no — empty crags render dimmed.** Let people stop
   partway. *(Amended 2026-08-08(f): this originally said "chain the steps
   so it's the default path, but let people stop partway". The chaining
   shipped and the stopping did not — the wizard committed nothing until a
   problem name existed, so an empty crag was unreachable through the
   product and the dimmed-pin work below was dead in practice. Decision 11
   replaces the chain with three intents that each commit on their own,
   which is what makes this item's resolution real.)* An empty crag
   stays **visible on the map, drawn dimmed** rather than hidden: a dimmed
   pin is a legible invitation ("someone marked this, nobody's documented
   it yet"), where a hidden one is indistinguishable from the crag not
   existing and invites a duplicate pin from the next person. Two CTA
   surfaces needed:
   - the dimmed pin's popup — "No problems yet · Add the first one"
   - the crag page's empty state — the primary action on the page, not a
     line of grey text
   Same treatment for a crag whose problems were all deleted, so this isn't
   a create-time-only state. **Now also applies to boulders**: a rock with
   a photo but no problems yet gets the same dimmed-with-CTA treatment on
   the crag page.
2. ~~**Crag edit rights.**~~ **Resolved 2026-08-07** — see decision 6.
3. ~~**Does a boulder/rock level belong between crag and problem?**~~
   **Resolved 2026-08-07: yes** — see decisions 1 and 2.
4. ~~**Does `lat`/`lng` sit on the boulder or the problem?**~~ **Resolved
   2026-08-07: the boulder** (and the crag). Problems carry none. See
   decision 4.
5. ~~**Is the boulder merge path admin-only or user-facing?**~~ **Resolved
   2026-08-07: both** — anyone can suggest, only admins execute, the two
   boulder creators can object, a 48h hold guarantees they get the chance,
   admin has the final call. Full flow in the merge section above.
6. ~~**Does a creator's objection outweigh a passer-by's?**~~ **Resolved
   2026-08-07: only the boulder creators can object at all.** See merge
   design note 3.
7. **Which rock the admin UI defaults to keeping.** Merge design note 6
   says default to the older / more-documented rock. The shipped UI
   (`AdminMergeRequests.tsx`) defaults to the **source** boulder — the one
   the suggestion was filed from — with no age or documentation
   comparison. Since the suggester picks the target, that default
   systematically favours whichever rock the suggester happened to be
   standing at. Either the note or the default should move; it's a
   one-line change on the UI side. Open.
8. ~~**What "Not sure which rock" actually files.**~~ **Mostly resolved
   2026-08-08(f)** — decision 13 (re-parenting) gives "tidy up later" a
   real operation, and decision 12 removes most of the cases that produced
   an unnamed placeholder rock in the first place. **What remains open is
   duplicate *spots*, not duplicate rocks.** Rocks have a merge path;
   crags have none at all — no merge, no delete, and a boulder cannot move
   between crags (decision 13 fixes the last of those). A duplicate spot is
   worse than a duplicate rock: two pins on the map, a split directory, and
   every rock underneath stranded on the wrong one. Distance-sorted spot
   picking (see the Add flow section) is prevention, not a cure. Open:
   decide whether crags need a merge path of their own, or whether
   re-parenting rocks plus an admin rename is enough to fold one duplicate
   spot into another by hand.

   **Narrowed 2026-08-09(g).** Decision 20 strengthens the prevention
   side considerably — a map showing nearby pins at drop time catches
   what a sorted list does not, and it is the case this item was most
   worried about. That does not close the item, because prevention is
   never total, but it lowers the expected volume enough that the
   recommendation is now **the cheap half rather than a full merge flow**:
   let an admin re-parent every rock off a duplicate spot (decision 13
   already provides the mechanism) and delete the emptied husk. No new
   tables, no new notification types, no 48h hold. Still open only as
   "confirm that's enough" rather than "design a crag merge".
9. **Where loosely-filed contributions surface for admins.** UX principle 5
   promises somebody tidies up later; nothing currently shows an admin
   what needs tidying. An unnamed, photoless rock holding exactly one
   problem is a strong signal that somebody wasn't sure. Open — needs
   either a flag written at add time, a derived "needs attention" list
   (cheap: it's a query, not a schema change), or an explicit decision that
   the merge queue is enough. Related: the same surface is where a
   duplicate-spot review would live if open item 8 goes that way.
10. ~~**Whether wall-type children are called "routes" in the UI.**~~
    **Resolved 2026-08-09(g): switch on the rock's type.** Decision 1
    already settled that copy switches on type ("which rock?" vs "which
    wall?", batu vs tebing) — the noun is the same kind of string, so
    there is no new rule here, only a consistent application of an
    existing one. Pick a wall and the sheet reads "Add a route", the
    button reads "Add route", and the grade chips become the `rope` scale;
    pick a boulder and all three stay as they are. The URL stays
    `/problems/:id` and the Go package stays `problems` — the user never
    sees either (UX principle 6). Revision (a)'s "Problem, not Route" call
    still stands for boulders, which is what it was actually deciding.
11. **Who may add a photo to an existing rock.** Today it's
    creator-or-admin (`authorizeBoulderEdit`), while *adding* rocks and
    problems is open to anyone (decision 6) — so the shared artifact the
    whole middle level exists for is the most restricted write in the app,
    and the person best placed to supply a missing photo (whoever is
    standing there now) usually can't. Decision 2's amendment makes photos
    more central, not less, which sharpens this. Arguably in scope of the
    deferred "collaborative editing" question (see "Explicitly not decided
    here"), but adding a photo is additive, not an edit of someone else's
    words — it may deserve to be carved out. Open, needs a product call.

    **Sharpened, then reframed 2026-08-09(g) by decision 22.** Approach
    guides made this urgent rather than theoretical: the person best
    placed to document the walk in is almost never the crag's creator.
    Decision 22 resolves the *blocking* half — the mechanism gets built
    now (`authz.CanContribute`, attribution, a removal path), shipping
    with today's creator-or-admin behaviour so nothing changes on day one.
    **What stays open is only the policy**: which contribution kinds widen
    to any signed-in user, and whether that is global or per-crag. No
    longer blocks anything; needs a product call whenever you want to turn
    it on.
13. ~~**What the crag pin actually means, given decision 21.**~~
    **Resolved 2026-08-09(g): three layers, chosen by zoom.** Decision 4
    said the crag's `lat`/`lng` is "the approach/parking point". Decision
    21 gave an approach its own start coordinate, which left two competing
    answers to "where do I park" and put the crag's map pin in a car park
    — wrong for every other use of that pin (distance sorting in the add
    sheet, "near you" on cards, the future follow-a-crag join).

    The resolution is that **the crag pin was being asked to be a precise
    navigational target when it is really a "there is climbing here"
    marker**, and zoom is what separates those jobs:

    - **Far out — one pin per crag.** A representative point for the whole
      area, near enough the climbing to be honest. Precision is not
      required and should not be implied; nobody navigates from this zoom.
      Unchanged from decision 3.
    - **Zoomed in — the crag's rocks appear**, each at its own `lat`/`lng`
      (decision 4 already stored these and explicitly kept this view "possible
      rather than foreclosed"). This is where per-rock precision at a
      sprawling crag like Citatah finally pays off.
    - **Parking / the start of the walk in — an approach's start point**
      (decision 21), drawn as its own marker kind, distinct from both.

    So `crags.lat/lng` means **the climbing, approximately** — no longer
    parking, and no longer pretending to a precision it never had.

    Two consequences to get right when building it:
    - **Only rocks get pins at close zoom, never problems.** Problems have
      no coordinates by design (decision 4) and never will — a problem is
      a line on a rock, and it has no position of its own. Tap a rock to
      see its problems. Do not add coordinates to `problems` to make a
      denser map layer.
    - **A rock's `lat`/`lng` is optional and many will be null.** The
      backfill gave every migrated boulder its problem's old coordinates,
      so historical rocks are covered, but rocks created through the add
      flow often have none. Draw the ones that have coordinates; do not
      invent positions for the rest, and do not make the field required
      just to fill the layer.

12. **A DESIGN.md change falls out of decision 20's prototype.**
    *(2026-08-09(g).)* Drawing the sheet against DESIGN.md's real tokens
    put three text tiers below WCAG AA at the sizes this UI actually uses:
    Faint Stone (`#4a3c30`) helper text measured **1.76:1** — not subtle,
    invisible — and Weathered Stone (`#8a7060`) measured **3.91:1** at
    11–12 px against both panel and surface, where 4.5:1 is required.
    PRODUCT.md names the operating context as *outdoors, patchy data,
    lower-end Android*; these values assume a dark room and a good panel,
    which is the opposite.

    Proposed, and applied in `add-flow-v2.html`: raise Weathered Stone to
    **`#967b6a`** (4.58:1 on surface, 4.75:1 on panel — a ~6% lift,
    visually near-identical, crosses AA), and **retire Faint Stone for
    anything containing words**, keeping it for hairlines, disabled
    states, and decoration. The system rule to write into DESIGN.md:
    *if it's a sentence, it's at least Weathered Stone.* Note DESIGN.md
    currently invites the failure — it describes Faint Stone as "reserve
    for text that should barely register", which is the bug in one
    sentence.

    **Resolved 2026-08-09(g): applied.** `DESIGN.md` now carries the
    raised value, demotes Dusk Stone and Faint Stone to non-text roles,
    and states it as **The Sentence Rule** — if it is made of words, it
    is at least Weathered Stone. Screens still using the old value are
    not a regression to chase separately; they get it as they are touched.

**The design is amended and partly unbuilt** (2026-08-09(g)). Items 1-6
were resolved before implementation and remain resolved; 8 and 10 were
resolved or narrowed, and 12 and 13 resolved, in (g). Still open: 7 is a
one-line UI default, 9 is the needs-attention surface, and 11 is now
policy-only — decision 22 builds the mechanism and ships it behaving
exactly as today. **Nothing still open blocks implementation.**
If something here turns out wrong, edit this file rather than the chat log.

### What decisions 11-20 invalidate in the shipped frontend

Scoping note for whoever picks this up — the backend and schema are
untouched by this revision except where noted:

- `components/add-flow/` (`AddFlow`, `SpotStep`, `RockStep`, `ClimbStep`)
  is superseded wholesale by the single sheet. `ClimbStep`'s grade picker
  and `SpotStep`'s new-spot fields are worth keeping as parts; the
  three-step state machine in `AddFlow` is not.
- The Add entry point (`Map.tsx`'s "Add Problem" control) becomes the
  three-intent choice of decision 11; "add a spot" and "add a rock" each
  need their own short sheet that commits on its own. `AddFlow`'s existing
  `initialCragId`/`initialBoulderId` seeding is the right idea for the
  context entry points (UX principle 1) and is worth keeping — it just
  needs to pre-answer the *intent* as well as the level.
- Repeat-adding ("add another to this rock") is new and has no equivalent
  in the shipped wizard, which closed on submit.
- **Backend work this does require**: `boulders` gains a type
  (`boulder | wall`, decision 1); `UpdateProblemRequest` gains
  `boulder_id` and `UpdateBoulderRequest` gains `crag_id` for re-parenting
  (decision 13); `crags` gains photos and `problems` regains them
  (decision 2 as amended) — note `problems.image_urls` was dropped by
  migration 0015, so this is a new column with a new meaning (beta/action
  shots), not a revert of that migration.
- Distance-sorted spot picking is client-side; the crag list already
  returns `lat`/`lng` and `cragCache` already computes "near you"
  distance for cards, so nothing new is needed server-side.

## Explicitly not decided here

- General collaborative editing (non-creator users editing existing
  crag/boulder/problem detail) — still deferred, see `ROADMAP.md` and the
  `collaborative-problem-editing` memory. Decision 6 only covers *adding*
  new things, never editing existing ones. Open item 11 asks whether
  adding a photo to someone else's rock should be carved out of this
  deferral, since it's additive rather than an edit — that carve-out is
  the only part of this question in play here.
- Sensitive/approximate crag locations (GPS fuzzing) — still deferred, see
  the `sensitive-crag-locations` memory. A crag entity is a natural future
  home for that flag (applied per-area instead of per-problem) but that's a
  side-benefit, not a decision here. Note that keeping finer coords
  (decision 4) means fuzzing would eventually need to apply at two levels,
  not just the crag pin.
