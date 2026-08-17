# Add sheet — review findings (2026-08-13)

Status: **A1-A3, B5-B9, C10-C13 fixed 2026-08-13; B4 fixed 2026-08-17.** A
punch list against the add sheet that shipped in `handoff.md` revision (h) —
`palabatu-fe/src/components/add-sheet/` plus its entry points.

**B4 (mount `AddSheet` at the app root) shipped 2026-08-17**, built as
decision 10 of `handoff-directory.md` (sequenced there as step 2, done as one
change for both documents per this file's original note). The
implementation: `palabatu-fe/src/lib/addSheetContextInstance.ts` +
`useAddSheet.ts` + `AddSheetContext.tsx` (split across three files the same
way `AuthContext` already is, to satisfy the fast-refresh lint rule),
providing `AddSheetProvider` mounted once in `App.tsx` above `<Routes>`.
Every entry point named in this file's own "Start here" section now opens
the sheet in place instead of routing through `/map`: `Map.tsx`'s FAB,
`CragDetailPage`'s "Add a rock"/"Add the first one", `BoulderDetailPage`'s
"Add a problem", and — beyond this file's original scope but named by
decision 10 itself — `Directory.tsx`'s "Add a problem" CTA. The
`?addToCrag=`/`?addToBoulder=`/`?addIntent=` query-param deep link this file
originally documented is gone; nothing outside `Map.tsx` referenced it, so
it was a clean removal rather than a compatibility gap. Verified live
(logged in, scripted through all four entry points): the URL no longer
changes when opening from a detail page or the directory, and each opens
pre-seeded correctly (`CragDetailPage` resolves the crag name in the
breadcrumb, `BoulderDetailPage` resolves both crag and rock). See
`handoff-directory.md`'s own status line for the fuller writeup.

**What's still open:** C11 is recorded, not built — a code comment at the
implicit-new-rock collapse point in `AddSheet.tsx` names the nullable marker
column that's the eventual fix, but open item 9 (whether/how to surface "not
sure" rocks to admins) is still undecided, so no schema or admin surface was
added. C12's confirm-before-discard dialog has since been superseded, not by
this file but by [handoff-drafts.md](handoff-drafts.md)'s Milestone 1
(shipped 2026-08-17, same day as B4): the sheet now autosaves, so
`handleClose` replaces the confirm-before-discard prompt shipped here with
the toast-plus-undo flow decision 4 of that doc specifies. Everything
else — A1-A3, B4, B5-B9, C10, C12, C13 — shipped: `resolveCragId` now commits
crag id/isNewSpot/draft to state immediately (fixes A1 and A3 as one
change), the nearest-spot default has its own guard independent of the
context-prefill guard (A2), photo upload failures surface as toasts instead
of vanishing (B9), the boulder-image-attach and annotation-save calls check
for `'error' in res` instead of a decorative `.catch(() => {})` (C10), a
staged photo now survives picking a rock that already has a topo and
attaches as an extra angle (B7/B8), a newly created rock becomes the
resolved context with a banner offering the first problem on it (B5), the
rock tab's title/button read the tab's own draft type (B6), the dead
`NewProblem` type and `CragDetailPage`'s bare `Rock ${idx+1}` fallback are
gone (C13), the sheet has dialog roles, Escape-to-close (overlay first, then
the sheet), a Tab focus trap, and tabpanel wiring, its close confirmation now
the drafts-autosave toast-with-undo rather than a `window.confirm` (C12),
and every entry point opens it in place rather than bouncing through `/map`
(B4). `tsc`, `eslint`, `go vet` all clean throughout.

## Start here (cold session)

**Read first, in order:** `CLAUDE.md` (repo conventions), then `handoff.md`
decisions 11-22 and its "UX principles" section — every finding below is
phrased as a divergence from those, so they won't parse without them. Then
this file. `PRODUCT.md`/`DESIGN.md` only if you're changing visuals.

**The code under review:**

```
palabatu-fe/src/components/add-sheet/
  AddSheet.tsx        orchestration, all three submit paths, the breadcrumb
  LocationOverlay.tsx the spot picker, and the rock picker for problem intent
  RockPicker.tsx      RockList (shared) + standalone picker for re-parenting
  SpotFields.tsx      name / pin / photo / patokan, used in two places
  RockFields.tsx      batu-or-tebing, photo, name, rock type
  ProblemFields.tsx   name / grade chips / photo / more details
  SpotMiniMap.tsx     the pin map with neighbour spots and accuracy radius
  types.ts            drafts + haversine; NOT backend mirrors
```

Entry points (all context-driven since B4/decision 10, not URL-driven —
see the status note above): `Map.tsx`'s FAB, `CragDetailPage.tsx`,
`BoulderDetailPage.tsx`, `Directory.tsx`, each calling `useAddSheet()`'s
`openAddSheet()` from `palabatu-fe/src/lib/useAddSheet.ts`.

**To run it:** two processes, per `CLAUDE.md` — `cd palabatu-be && go run
./cmd/api`, then `cd palabatu-fe && npm run dev`, then
`http://localhost:5173/map`. You must be signed in for the add FAB to render
at all (`canAdd = !!user`); local test accounts live in the Docker `palabatu`
DB.

**Before fixing A1-A3, reproduce them.** They were read off the code, not
observed (see the limits note below), and each carries repro steps. A finding
that doesn't reproduce is a finding that's wrong — say so in this file rather
than patching around it.

---

`handoff.md` stays the source of truth for the *design*. **No finding here
proposes changing a decision.** Every one is the shipped code diverging from
decisions 11-22 or the UX principles, so the fix is always "make the code
match the doc", never "amend the doc". Where a finding touches something the
doc left genuinely unspecified, it says so.

**How this was produced, and its limits.** A static read of the shipped code
against `handoff.md`'s decisions and UX principles — the sheet, its five
sub-components, `Map.tsx`'s entry points, `cragCache.ts`, `api.ts`, and the
backend request/response shapes they call. **The app was not run and no
finding was reproduced live.** Findings A1-A3 are state-machine bugs read off
the code, and each carries reproduction steps so they can be confirmed in
about a minute at a dev server. Not reviewed at all: the approach
capture/reading views, the merge flow, and the backend handlers (all
smoke-tested in (h) and unchanged since).

---

## A. Breaks a path the design is built around

### A1. New spot → problem → "add another" is a dead end

**Symptom.** Add a problem at a brand-new spot. It saves. The banner says
"Still on <rock>. The next one's ready below" — but the breadcrumb above it
has reverted to "Where is it? — tap to choose", and tapping *Add problem*
again fails with "Please finish adding the new spot first".

**Repro.** Open the sheet → breadcrumb → "It's a new spot" → name + pin →
"Use this spot" → type a problem name → Add problem → type a second name →
Add problem.

**Evidence.** `AddSheet.tsx:172-184` — `resolveCragId()` POSTs the crag and
returns its id, but `submitProblem` (`:227-298`) never writes that id back
to state. It sets `setIsNewSpot(false)` at `:291` while `cragId` is still
`null` (cleared by the overlay's `onConfirmNewSpot`, `:167`), so
`resolvedCrag` resolves to `null` and the next `resolveCragId()` returns
`null` down the `!isNewSpot` branch. `submitRock` gets this right at `:222`
(`setCragId(resolvedCragId)`); `submitProblem` is the one that doesn't.

**Why it matters.** This is decision 11's motivating case (a person finds one
rock, adds one line) running straight into decision 20's repeat-add, which
the doc calls "the single highest-value affordance for the people who will
actually populate palabatu". It fails at exactly the seam between them.

**Fix.** `setCragId(resolvedCragId)` in `submitProblem` alongside the
existing `setIsNewSpot(false)`, and clear `newSpotDraft` at the same point
(it is currently left populated, which is what keeps the banner's `spotName`
fallback at `:280` working — so clear it *after* building the banner, or read
the name from the created crag instead).

### A2. The nearest-spot default almost never fires

**Symptom.** The breadcrumb opens unanswered ("Where is it? — tap to choose")
even when standing at a known spot, on most cold opens.

**Repro.** Clear the geolocation permission for the origin, reload, open the
sheet, grant location. The breadcrumb stays unanswered.

**Evidence.** `AddSheet.tsx:99-127`. The effect returns early on
`didInit.current`, but sets `didInit.current = true` at `:101` *before*
reaching the `if (myLoc && ...)` branch at `:115`. Crags arrive from one API
call; `myLoc` arrives after a permission prompt (`:87-94`). So the first real
run has `myLoc === null` and does nothing but burn the guard, and the re-run
when the fix lands returns at `:100`. It only works when a cached fix is
already available inside `maximumAge: 5 * 60 * 1000`.

The comment at `:124-126` states the intent exactly — "Re-runs when myLoc
resolves after crags -- guarded by didInit so it only ever does real work
once" — and the guard as placed guarantees it never does.

**Why it matters.** Decision 19's "'Nearest spot' is only a default when it
is near" and the Add flow section's "the breadcrumb arrives answered" are
both dead in practice. Every user then reaches for the picker, which is the
tap the design exists to remove.

**Fix.** Set the guard only on the branch that actually resolves something —
or track two guards (`didResolveContext`, `didResolveNearest`) since the
`initialBoulderId`/`initialCragId` branches genuinely are one-shot while the
nearest-spot branch must wait for `myLoc`.

### A3. A failed save creates a duplicate spot on retry

**Symptom.** If the boulder or problem POST fails after a new spot was
created, tapping the button again creates a *second* crag at the same pin.

**Evidence.** `resolveCragId()` (`:172-184`) POSTs unconditionally whenever
`isNewSpot` is true, and neither `submitRock` (`:205-225`) nor
`submitProblem` (`:227-298`) records that the crag now exists before their
later awaits. Every early-return error path (`:218`, `:248`, `:267`) leaves
`isNewSpot` true and `newSpotDraft` intact.

**Why it matters.** Duplicate spots are the one write in this app with no
merge, no delete, and every rock beneath them stranded — `handoff.md` open
item 8, still open, and decision 20 spent an entire inline map on preventing
users from making them. The app making them unprompted is worse than the case
the map was built to catch.

**Fix.** Have `resolveCragId` commit its result to state before returning
(`setCragId(res.id); setIsNewSpot(false)`), so the retry takes the
already-resolved branch. That also fixes A1 as a side effect.

---

## B. Tediousness

The friction findings. None of these are broken exactly; all of them cost the
veteran contributor taps or confidence, which UX principle 1 names as the
failure mode that matters most.

### B4. Every entry point detours through the map

**Fixed 2026-08-17** — see the status note at the top of this file and
`handoff-directory.md` decision 10. Left below as the historical record of
the bug; the description past this point is no longer current behavior.

`AddSheet` is mounted only inside `Map.tsx` (`:421-429`). So
`CragDetailPage`'s "Add a rock" (`:222`) and `BoulderDetailPage`'s "Add a
problem" (`:353`) both `navigate('/map?addTo...')`, which loads Leaflet and a
screenful of satellite tiles in order to display a form — and leaves the
person on the map afterwards, not back on the page they were documenting.

`Map.tsx:311` also gates the deep link on `addToCrag || addToBoulder`, so
`/map?addIntent=problem` alone is silently ignored; there is no URL anywhere
that opens the sheet cold. That's why `Directory.tsx:171-176`'s "Add a
problem" CTA just drops you on the map with nothing open.

UX principle 1 makes context a first-class entry point specifically so the
veteran isn't walked back through questions they've answered. Arriving
somewhere else entirely is a heavier version of the same tax.

**Fix.** Mount `AddSheet` at the app root and drive it from shared state.
This is decision 10 of `handoff-directory.md`, sequenced as step 2 there —
worth doing as one change for both documents.

### B5. The rock you just created isn't selected

`submitRock` (`:205-225`) has the created `Boulder` in hand and sets neither
`boulderId` nor `resolvedBoulder`. Add a rock, switch to the problem tab, and
you must reopen the picker and find the rock you made ten seconds ago.

The banner is also the weakest of the three: "<name> is up. The next one's
ready below" (`:394`) offers another *rock*, when the obvious next act is the
first line on the rock just created. Decision 20's "same offer one level up"
is implemented literally, and the more valuable offer is missing.

**Fix.** Set the created boulder as resolved context, and give the rock
banner a "Add the first problem on it" action that flips the intent tab.

### B6. The rock tab's noun follows the wrong thing

`title` (`:451`) and `submitLabel` (`:315`) both read `boulderType`
(`:132`), which is derived from `resolvedBoulder` — the *previously selected
existing* rock. The "A rock" tab's own segmented control writes
`newRockDraft.type` (`RockFields.tsx:42`). Pick "Tebing — a wall" and the
header still reads "Add a rock" and the button "Add rock"; conversely,
arriving with a wall resolved titles the tab "Add a wall" before you've
chosen anything.

**Fix.** For `intent === 'rock'`, read `newRockDraft.type`. `boulderType`
stays correct for the problem intent, where the rock is a given.

### B7. A staged photo is silently discarded

Stage a photo while no rock is resolved, then open the picker and choose a
rock that already has a topo. `ProblemFields` stops rendering the staged
preview (the `hasExistingTopo` branch takes over at `:82`), and
`submitProblem`'s `else if (stagedFile && (resolvedBoulder?.image_urls.length
?? 0) === 0)` at `:250` skips it. The photo is dropped without a word.

Decision 18 legislates this case by name: *"A photo already staged against
the old rock moves with it, and the sheet says so in one plain line rather
than re-parenting an upload silently."* The current behaviour is neither —
it's a silent drop.

**Fix.** Keep the staged photo visible in the `hasExistingTopo` branch as the
second uploader B8 also wants, and attach it to the newly chosen rock, with
the one plain line decision 18 asks for.

### B8. Dead copy: "another angle is welcome"

`ProblemFields.tsx:100` reads "Another angle is welcome, but the line goes on
the shot above" — and that branch (`:82-101`) contains no file input at all.
The copy promises an affordance that doesn't exist.

Decision 19 specced this deliberately: when the rock already has a topo,
"drawing is the primary action and uploading is a 52 px afterthought". The
demotion shipped; the afterthought didn't.

**Fix.** Add the small secondary uploader the copy already describes, at the
weight decision 19 specifies.

### B9. Photos upload on submit, blind, and fail silently

Uploads happen inside the submit handlers, behind one static "Saving..."
label (`:494`) — a multi-megabyte phone photo over 3G at a crag, no
compression, no progress, no cancel. And `uploadPhotos` (`:41-44`) filters
failures out of the array, so a failed upload saves the problem *without* its
photo and says nothing. Any line drawn on that photo goes with it, since
`targetPhotoUrl` stays `null` and the annotation PUT at `:270` is skipped.

The photo is the one thing decision 20 calls perishable — "you leave the rock
and it's gone for months". Losing it quietly is the worst available outcome.

**Fix, in order of value:** surface upload failure as an error rather than
dropping it; upload on file-select rather than on submit (the person is
usually still standing there with signal, and the submit then costs nothing);
downscale client-side before upload.

---

## C. Correctness and housekeeping

### C10. `.catch(() => {})` is decorative

`api.post/put/get` resolve with the parsed body on any status — they never
reject on non-2xx (`lib/api.ts:12-32`). So the trailing `.catch(() => {})` on
the boulder-image attach (`AddSheet.tsx:255`) and the annotation save
(`:271`) catch nothing an HTTP error would produce; both failures pass
through as an ignored `{error}` object. They read as "handled quietly" and
are actually "unhandled".

**Fix.** Check `'error' in res` on both, and surface at least the annotation
failure — a line the user drew and believes is saved is not a quiet failure.

### C11. "It's a new rock" and "Not sure which one" are byte-identical

`RockPicker.tsx:71-74` renders both; `LocationOverlay.tsx:165-166` wires
`onPickNewRock` and `onPickNotSure` to identical handlers, and
`AddSheet.tsx:243-249` collapses both into the same implicit-boulder create.
The code comment at `:239-243` acknowledges this ("identical handlers,
different narrative only").

The narrative difference is real and the recorded difference is zero, so open
item 9 — "an unnamed, photoless rock holding exactly one problem is a strong
signal that somebody wasn't sure" — has to *infer* uncertainty that the user
stated outright one tap earlier.

**Fix.** One nullable marker written at creation time when the user picked
"not sure". Cheap now, and it's the column open item 9's needs-attention
query would key on. Note this is the one finding here that touches schema,
and open item 9 is still undecided — so record the intent, don't build the
admin surface off it yet.

### C12. Modal basics missing

No Escape-to-close on the sheet or the overlay, no focus trap, no
`role="dialog"`/`aria-modal` on either (`AddSheet.tsx:457-460`,
`LocationOverlay.tsx:78-79`), and the X (`:463`) discards a filled draft with
no confirmation — on the one sheet whose stated principle is that typed
content is *never* discarded (decision 18).

The `role="tablist"`/`role="tab"` group at `:468-480` also has no
`aria-controls` or corresponding `tabpanel`.

**Fix.** Escape closes the overlay first, then the sheet; confirm on close
when any draft field is non-empty; add the dialog roles and a focus trap.

### C13. Two leftovers from the wizard's deletion

- `types/problem.ts:8` — `NewProblem` is dead. Its only remaining reference
  is its own doc comment, which still describes "the add wizard's
  in-progress problem-level draft"; `components/add-flow/` was deleted in (h)
  and the sheet has its own `NewProblemDraft` (`add-sheet/types.ts:64`).
  Exactly the drift `CLAUDE.md`'s "check `src/types/` before hand-writing a
  type" rule exists to prevent, one step earlier.
- `CragDetailPage.tsx:238` and `:246` label photoless rocks
  `Rock ${idx + 1}` — the precise fallback UX principle 3 forbids ("A bare
  generated label ('Rock 2') is NOT an acceptable fallback"). `(h)` added
  `sample_problem_name` to `BoulderListItem` for this exact purpose and the
  rock picker uses it correctly (`RockPicker.tsx:12`); the crag page never
  got the same treatment.

---

## What is already right — don't "fix" these

Recorded so a later pass doesn't undo deliberate work:

- **The portal.** `createPortal(..., document.body)` at `:457` is load-bearing
  against `Footer.tsx`'s fixed positioning — see (h)'s bug note.
- **One breadcrumb line**, not two rows (decision 15), including the
  `isFar` danger border at `:355`.
- **The overlay picker** returning to scroll position (decision 16), and its
  live rock re-derivation at `LocationOverlay.tsx:68-75` (decision 18's three
  cases, correctly implemented).
- **Single-column 16:9 rock rows** (decision 17) and the
  `sample_problem_name` fallback (UX principle 3).
- **The sticky footer's permanently-visible disabled button with its reason
  underneath** (decision 19).
- **`SpotMiniMap`'s neighbour pins, distances, accuracy radius, and the
  under-300 m duplicate warning** (decision 20) — the strongest part of the
  build.
- **Single-select grade chips with no "no grade yet" chip** — deliberate per
  (h)'s scope trims; an unselected row already means that.

---

## Suggested order

1. **A1 + A3 together** — one change (`resolveCragId` commits its result)
   fixes both, and they're the two that lose or corrupt real data.
2. **A2** — two lines, and it restores the sheet's central promise.
3. **B6, C13** — trivial, and B6 is user-visible nonsense.
4. **B9's error surfacing**, then B7/B8 as one photo-path pass.
5. ~~**B4** — larger, and shared with `handoff-directory.md` step 2; do it
   there.~~ **Done 2026-08-17.**
6. **B5, C10, C12** — as time allows.
7. **C11** — only when open item 9 gets decided; record the intent now.

`tsc`, `eslint`, `go vet` clean at every step. Verify live at 360 px, not
just typechecked — (h)'s own notes and `CLAUDE.md`'s lucide/flex rule both
make that point, and half of these findings would have surfaced in one pass
through the sheet on a phone.
