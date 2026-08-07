# Problem Add/Edit addendum — design handoff

Status: **schema + backend implemented and verified locally (2026-08-07
(c)); frontend not started.** Migrations 0014/0015 are applied to the local
Docker DB, the one-off backfill has run and been hand-checked, and
`internal/crags`/`internal/boulders` (including the merge sub-flow) plus a
rewritten `internal/problems` are live and smoke-tested end to end —
crag/boulder/problem CRUD, image add/remove, per-boulder annotation
listing, and the full suggest → object → resolve merge flow (including the
48h hold and its admin override) all work against the real DB. The
**existing frontend does not build a problem successfully yet** — every
page that touches `lat`/`lng`/`location_name`/`image_urls` on a problem
(`AddProblemModal`, `ProblemDetails`, `ProblemDetailPage`, `Map.tsx`,
`ClusterCardRail`, `Directory.tsx`, `ProblemList.tsx`, `ProblemCard`, the
topo-annotation components) still assumes the old flat shape and is a
separate, not-yet-started pass. See `ROADMAP.md`'s Phase 1.5 entry for
current status and `CLAUDE.md`'s Architecture section for the new
`internal/crags`/`internal/boulders` domains. Continue editing this file
directly as the design changes; it's the source of truth for this effort,
not the chat log.

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

## Background — what exists today

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
   2026-08-07(b); was two levels.)* A crag is the place you drive to and
   park at. A boulder is one rock you can walk up and touch. A problem is
   one way up that rock. The middle level exists because **one rock hosts
   several problems** depending on where you start and finish (sit vs stand
   start, traverse, different finishes) — that's not an edge case, it's how
   bouldering works.
2. **The boulder owns the photo.** This is the concrete payoff of the
   middle level, and it fixes something the current schema actively fights.
   Today `problems.image_urls` is a jsonb array per problem and
   `topo_annotations` is keyed `(problem_id, image_url)` — so two problems
   on the same rock mean two uploads of *the same photograph*, two
   Cloudinary URLs, and two unrelated overlays, with no way to see the
   rock's lines together (which is the one thing a printed topo always
   shows). Under the new model the photo hangs off the boulder and each
   problem draws its own line on that shared image. `topo_annotations`
   re-keys to `(boulder_image, problem_id)`: one photo, N lines. Note this
   makes the annotation model *simpler* than today's, not more complex.
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
     status/permission/parking).
   - Boulder: `rock_type` (andesite, limestone/batu kapur), photos.
   - Problem: `landing_hazards` (pad placement, spotting, exposed
     landing), `descent`, `height_m`.
   - A freeform `notes` field stays at the problem level for anything that
     doesn't fit a structured slot.
10. **One height field, not two.** *(Revised 2026-08-07(a) — was `height`
    plus a separate `highball_flag`.)* They encode the same fact and will
    drift the moment someone fills one and not the other. Keep optional
    `height_m`, derive the "highball" label in the UI at a threshold.

## UX principles — non-negotiable for this effort

Three levels of nesting is the single biggest risk in this design. It is
correct as a model and **actively hostile as an interface** if exposed
directly. A beginner should never have to understand the hierarchy to
contribute. Everything below is a requirement, not a suggestion.

1. **Never make the user classify.** Don't present "Crag / Boulder /
   Problem" as a choice of what to add. Ask plain questions in the order a
   person naturally answers them — "Where is it?", "Which rock?", "Tell us
   about the climb" — and let the app do the filing. The user describes a
   place; they don't pick a database level.
2. **Explain by example, never by definition.** Where the words do have to
   appear, one line each, concrete:
   - Crag — "the place you park and walk in from"
   - Boulder — "one rock, the thing you actually touch"
   - Problem — "one way up that rock"
   No paragraph explaining containment. If it needs a diagram, it's wrong.
3. **Pick the rock by photo, not by name.** Nobody recognises "Boulder 3B";
   everybody recognises a picture of the rock they're standing next to. The
   boulder picker is a photo grid, not a dropdown or a text list. This
   falls straight out of decision 2 (the boulder owns the photo) and is the
   main reason that decision pays for itself in UX and not just in schema
   tidiness.
4. **Collapse any step with nothing to choose.** If a crag has one boulder,
   don't ask which boulder — skip the step. The third level should only
   become visible when there is genuinely something to choose between. Most
   early adds will never see it.
5. **Never dead-end someone who doesn't know.** "Not sure which rock" and
   "it's a new rock" are always available, and both proceed. A beginner who
   can't confidently classify must still be able to finish — file it
   loosely and let admins tidy up later. Losing the contribution is worse
   than filing it imperfectly.
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
8. **One screen, one question.** Don't render a single form with three
   nested sections — that's the hierarchy leaking into the layout. Short
   steps, each answering one plain question, with a visible way back.

## Proposed data model (sketch, not final SQL)

```
crags
  id
  name                  -- canonical, e.g. "Goa Agung"
  lat, lng               -- single approach/parking pin, required
  directions              -- patokan
  access_notes            -- optional
  created_by, created_at

boulders
  id
  crag_id                -- FK -> crags, required
  name                   -- optional; many rocks are unnamed. Fall back to
                          -- a generated label ("Rock 2") in UI, never make
                          -- the user invent a name to proceed.
  image_urls             -- MOVED here from problems. The rock's photos;
                          -- problems draw their own lines on these.
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

topo_annotations         -- re-keys from (problem_id, image_url) to
                          -- (boulder image_url, problem_id): one photo,
                          -- many lines. FK to problems still cascades.
```

## Add flow (conceptual)

Written as the user experiences it. Note that no screen names a "level".

```
Tap "Add" ->

  "Where is it?"
     [ search spots ]  [ can't find it? + Add a new spot ]
     -- new spot: name, drop the pin, patokan, access notes

  "Which rock?"
     [ photo grid of rocks at this spot ]
     [ + It's a new rock ]   [ Not sure ]
     -- skipped entirely if the spot has only one rock
     -- new rock: photo, rock type, optional name

  "Tell us about the climb"
     name, grade, draw the line on the rock's photo,
     who did it first, landing/spotting, how to get down,
     height, anything else
```

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
5. **Which rock survives is the admin's pick, not automatic.** Default the
   UI's suggestion to the older / more-documented rock, but let the admin
   flip it — the better-named rock isn't always the older one.
6. **Duplicate problem names after a merge are fine.** Two rocks each
   having a "Sit Start" is a naming collision, not a data error. No
   constraint, no auto-rename; leave it to admins to tidy if it matters.
7. **New notification types needed** (`notifications` already has a type
   system, migrations/0007): merge suggested, merge objected, merge
   resolved. Reuses the existing table and delivery path — no new
   notification infrastructure.
8. **Don't say "merge" to laymen.** Per the UX principles: the CTA is
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
- Problems keep their existing `lat`/`lng` throughout, so nothing is
  destroyed and the migration is reversible.
- `problems.location` and `problems.image_urls` are dropped in a **later**
  migration, after the backfill is eyeballed — not in the same one.

## Blast radius

Checked against the code, 2026-08-07:

- **The FK graph mostly doesn't fight this.** `sends`, `comments`,
  `reports`, and `notifications` all hang off `problems.id`, which this
  design preserves — none of them need to change. `topo_annotations` is the
  one exception and it re-keys to something simpler (decision 2).
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

## Sequencing

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
   **Resolved 2026-08-07: no — empty crags render dimmed.** Chain the steps
   so it's the default path, but let people stop partway. An empty crag
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

**No open items remain.** The design is settled end to end; what's left is
implementation, which hasn't started. If something here turns out wrong
once code exists, edit this file rather than the chat log.

## Explicitly not decided here

- General collaborative editing (non-creator users editing existing
  crag/boulder/problem detail) — still deferred, see `ROADMAP.md` and the
  `collaborative-problem-editing` memory. Decision 6 only covers *adding*
  new things, never editing existing ones.
- Sensitive/approximate crag locations (GPS fuzzing) — still deferred, see
  the `sensitive-crag-locations` memory. A crag entity is a natural future
  home for that flag (applied per-area instead of per-problem) but that's a
  side-benefit, not a decision here. Note that keeping finer coords
  (decision 4) means fuzzing would eventually need to apply at two levels,
  not just the crag pin.
