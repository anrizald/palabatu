# Add-sheet drafts — design handoff

Status: **Milestone 1 built 2026-08-17. Milestone 2 still proposed, not
built.** Written 2026-08-14, same session as the `handoff-add-sheet.md`
fixes, before starting `handoff-directory.md`. This is a design doc in the
shape of `handoff.md`, not a punch list — it's new build, not a review of
shipped code (M1's section now describes what actually shipped).

**Two milestones, one doc.** Milestone 1 is client-side only (no backend
change at all) and is the one that actually matters: it covers the failure
mode this feature exists for. Milestone 2 is backend sync, which buys
cross-device/reinstall survival at real schema-and-endpoint cost. Build M1
first and ship it; M2 is a deliberate second pass, not a prerequisite.

**M1, as shipped.** `palabatu-fe/src/components/add-sheet/drafts.ts` (a
small promise-based wrapper over the `palabatu-add-sheet-drafts` IndexedDB
database) plus `DraftsOverlay.tsx` (the "Your drafts" full-sheet overlay),
wired into `AddSheet.tsx`: a debounced (800ms) autosave effect keyed off
`hasUnsavedInput()`, lazy draft creation on the first real edit, the "N
drafts saved" affordance and resume-into-sheet flow, `clearActiveDraft()`
called from all three submit paths (decision 5), and `handleClose` replacing
C12's `window.confirm` with the toast-plus-undo from decision 4 (`Toast.tsx`
gained optional `actionLabel`/`onAction`/`duration` props for this). Verified
live against the local Docker DB: type past the debounce, close, reopen,
resume with fields pre-filled, and the Undo path deleting the just-created
draft, all confirmed working. `tsc`/`eslint` clean. Not yet exercised: the
spot/rock tabs' draft paths specifically (only the problem tab was driven
live), and the submit-clears-the-draft path was verified by code review of
the three call sites rather than a live submit (submitting requires a
resolved crag, which means driving the location-picker overlay).

## Motivation

Right now, closing the add sheet with something typed either loses it
outright, or — since `handoff-add-sheet.md` C12 shipped — blocks on
`window.confirm('Discard what you typed?')`. Both are the wrong shape for
the actual failure mode this app cares about most: `handoff.md` decision 20
calls a staged photo "perishable — you leave the rock and it's gone for
months", and B9 in the add-sheet review was about exactly that, one layer
down (an upload failing silently). A confirm dialog only helps when the
person is still holding the phone and chooses to close deliberately. It does
nothing for a phone call, a backgrounded app that gets killed for memory, a
dead battery, or a tab closed by habit — the same interruptions that
motivated decision 20's banner-not-takeover in the first place.

The fix isn't a better confirm dialog. It's not needing one: autosave the
in-progress sheet continuously, so there is nothing left to confirm away.

## Decisions made

1. **Two milestones, client-side first.** M1 is IndexedDB only — no
   migration, no new domain, no endpoints, nothing in `CLAUDE.md`'s API
   Contract section to satisfy. It covers same-device recovery, which is the
   actual scenario (interrupted while standing at the rock, on the phone
   that has the sheet open). M2 adds a `drafts` backend domain for
   cross-device continuity and reinstall-survival — real scope (migration,
   DTOs, swag annotations, orphaned-upload cleanup), and not worth paying
   for until M1 proves the feature earns its keep.

2. **A real draft list, not a single resume slot.** Someone scouting five
   rocks in one session opens the sheet five times and abandons four of them
   partway — those are five different things, not one slot that the fifth
   overwrites. Each abandoned session becomes its own entry in a list,
   revisitable later (that evening, on wifi, per decision 21's own
   "capture happens later" precedent for approach guides).

3. **A draft is created lazily, on the first real keystroke — not on
   opening the sheet.** Reuses `hasUnsavedInput()` (built for C12) as the
   trigger: the moment it flips true, the sheet assigns a draft id and
   starts autosaving. Opening the sheet and closing it immediately (the
   overwhelmingly common case — someone taps Add, sees the tabs, taps X)
   must not manufacture a junk draft. Once a draft id exists for the
   session, every subsequent change updates that same row — debounced
   (~800ms after the last edit), not on every keystroke.

4. **Closing the sheet no longer needs to confirm-or-discard.** This is the
   real payoff and it supersedes part of C12. Once autosave exists, closing
   the sheet (X, Escape, or navigating away) has nothing left to lose —
   whatever was typed is already a draft. Replace the blocking
   `window.confirm('Discard what you typed?')` with a non-blocking toast:
   **"Saved as a draft"**, shown only when this session actually created
   one, with an **"Undo" action** that deletes the just-created draft —
   the same reversible-action toast pattern already used elsewhere in the
   app, not a new one. C12's dialog roles/Escape/focus-trap work is
   unaffected; only the discard-confirmation half of it is replaced.

5. **A draft is deleted the moment it's submitted for real**, and only
   then, or when the person deletes it from the list themselves. Submitting
   a draft is not a new code path — the sheet loads the draft's state in
   exactly like resuming any other in-progress session, and the existing
   `submitSpot`/`submitRock`/`submitProblem` handlers run unchanged. The
   only addition is a best-effort `DELETE /api/drafts/:id` (M2) or IndexedDB
   delete (M1) after a successful submit.

6. **A draft's label follows UX principle 3, never a bare index.** The same
   rule that stops the rock picker from showing "Rock 2": a draft card shows
   the typed name if there is one, else the resolved rock/spot's own name
   (`sample_problem_name` fallback and all), else "New problem" / "New rock"
   / "New spot" plus however much context is resolved (`New problem ·
   Citatah`). The staged photo, if any, is the card's thumbnail — exactly
   the visual language `RockRow` already uses.

7. **Drafts are private to their owner.** Not shared, not visible to
   admins, not part of the report/moderation path, not related to open item
   9's "unnamed photoless rock" admin queue despite both involving
   unfinished-looking data — open item 9 is about *already-submitted* rocks
   an admin might need to tidy; a draft is pre-submission scratch state that
   doesn't exist anywhere else yet. Worth saying explicitly so the two don't
   get conflated later.

8. **The draft list lives inside the add sheet, not a new page — for M1.**
   A small "3 drafts" affordance near the segmented-control row opens a
   full-sheet overlay (same layered pattern `LocationOverlay` already
   establishes) listing drafts newest-first, with intent badges, thumbnails,
   and relative timestamps ("2 days ago"). Tapping one loads its state into
   the sheet and switches to its intent. This keeps drafts scoped to the one
   flow that creates them (UX principle 1's "context is a first-class entry
   point," applied to context the app itself created) instead of a
   standalone "My Drafts" page nobody thinks to visit. A dedicated page
   (e.g. under the profile) is a reasonable M2-or-later addition once
   `handoff-add-sheet.md` B4 lands (`AddSheet` mounted at the app root,
   sequenced in `handoff-directory.md`) — resuming a draft from outside the
   sheet's current mount points is naturally easier once that's true, so
   this is a soft dependency, not a hard blocker for M1.

9. **No automatic deletion, ever — by design, not a placeholder.**
   *(Sharpened 2026-08-14 after discussion — the original version of this
   decision hedged "revisit if/when it's a problem", which was weaker than
   the reasoning actually supports.)* A calendar TTL is the wrong shape for
   this domain, not just an unbuilt convenience: outdoor bouldering is
   weather-, money-, and logistics-gated, not weekly-habit gated, and
   `handoff.md` decision 20 already treats "gone for months" as this app's
   own normal cadence for unfinished work at a rock, not an edge case —
   someone who scouts a spot right before the wet season may not physically
   get back to finish that draft for 6-10 months. Any fixed number
   (30/90/180 days) is a guess that will eventually delete real,
   still-wanted fieldwork with no warning, and decision 18 already forbids
   exactly that for the sheet itself ("typed content is never discarded,
   ever") — a timed auto-delete is that same silent discard, just deferred.

   So: the only thing that ever deletes a draft is the owner's own tap on
   "Remove", or submitting it for real (decision 5). The list shows age
   (`now() - updated_at`, computed at read time) so the person can judge for
   themselves — it never triggers deletion on its own. If M2's Cloudinary
   cost from abandoned draft photos ever becomes a real operational number
   (not a hypothetical), the lever is a passive, honest nudge in the list
   UI — "this one's over a year old — still working on it?" — never a
   background sweep. **This means the feature likely never needs cron-like
   infrastructure at all**, which this backend doesn't have today (no
   scheduled-job runner; migrations are applied by hand) — the only thing a
   scheduler could ever justify here is silent auto-delete, which this
   decision rules out on purpose.

10. **M2's staged photos upload eagerly, same as they do on final submit
    today.** The only way a photo survives to another device is if it's
    already a Cloudinary URL, not a local `File`. Staging a photo in a draft
    calls `/api/upload/topo` immediately (same endpoint, same as the sheet's
    existing behavior) and the returned URL replaces the local blob
    reference in the draft's payload. Deleting a draft (manually, or
    superseded by a real submit that used a *different* photo) must destroy
    that provisional upload via `internal/cloudinary.DestroyByURL`,
    best-effort, mirroring `boulders.DeleteBoulderImage`'s existing pattern
    — otherwise M2 quietly leaks Cloudinary storage on every abandoned
    draft with a photo.

## Data model

**M1 — IndexedDB, one object store, no backend involvement.**

```
addSheetDrafts (object store, keyPath: "id")
  id            -- client-generated (crypto.randomUUID())
  intent        -- 'problem' | 'spot' | 'rock'
  label         -- derived per decision 6, recomputed on every autosave
  createdAt, updatedAt

  -- Everything below is a direct snapshot of the sheet's own existing
  -- state shapes (add-sheet/types.ts) -- no new parallel model to keep in
  -- sync. File objects serialize into IndexedDB natively (structured
  -- clone supports Blob/File), so no upload is needed for M1 at all.
  cragId, boulderId, isNewSpot
  newSpotDraft   -- NewSpotDraft, photoFile stored as a real File/Blob
  newRockDraft   -- NewRockDraft, imageFiles stored as real File[]/Blob[]
  problemDraft   -- NewProblemDraft, photoFile stored as a real File/Blob
```

**M2 — adds `internal/drafts` (backend domain) + `drafts` table.**

```
drafts
  id            uuid, pk
  user_id       FK -> users, required -- decision 7, always scoped to owner
  intent        text -- 'problem' | 'spot' | 'rock'
  label         text -- decision 6, computed client-side and sent as-is
                      -- (the backend has no opinion on labeling copy)
  payload       jsonb -- the same snapshot shape as M1's IndexedDB record,
                      -- minus File objects: photoFile/imageFiles become
                      -- photo_urls (already-uploaded, decision 10)
  created_at, updated_at
```

DTOs per `CLAUDE.md`'s API Contract rules (`internal/drafts/dto.go`):
`DraftPayload` (mirrors the FE snapshot shape), `CreateDraftRequest`,
`UpdateDraftRequest`, `DraftListItem` (id/intent/label/updated_at only —
the list view never needs the full payload). Routes on the existing `/api`
group:

- `GET /api/drafts` — list the caller's own drafts, newest-updated first
- `POST /api/drafts` — create (first autosave past decision 3's trigger)
- `PUT /api/drafts/:id` — update (every autosave after the first)
- `GET /api/drafts/:id` — full payload, fetched when resuming one
- `DELETE /api/drafts/:id` — explicit delete or post-submit cleanup
  (decision 5), destroys any uploaded photos first (decision 10)

No `/api/drafts/:id/submit` endpoint — submitting stays exactly
`POST /api/crags` / `/api/boulders` / `/api/problems` as today; the draft
delete is a side effect the client fires afterward, not a state transition
the backend models.

## Flow (M1)

```
  Add a problem                                        [x]
  [  A problem  |    A spot    |    A rock  ]

    3 drafts saved                                  >   <- decision 8,
    ──────────────────────────────────────────────────    only shown once
    Name      [                              ]            hasUnsavedInput()
    ...                                                    or a draft exists
```

Tapping "3 drafts saved" opens the overlay:

```
  Your drafts                                        [x]

    New problem · Citatah                        2h ago
    [thumb]  no name yet
    ──────────────────────────────────────────────────
    Slab Mantap · Batu Kalong                    1d ago
    [thumb]  V2 · line not drawn yet
    ──────────────────────────────────────────────────
    New spot                                     3d ago
             pin dropped, no name yet
```

Tapping a row loads that draft into the sheet (switches intent, fills every
field, restores the staged photo preview and any resolved rock/spot
context) and closes the overlay. A swipe-to-delete or trailing "Remove" on
each row deletes it outright — no confirm, symmetric with decision 4's
"nothing here is a one-way door anymore" theme.

## Sequencing

**M1** touches only `palabatu-fe/src/components/add-sheet/`: a new
`drafts.ts` (IndexedDB wrapper — open/put/get/getAll/delete, small, no
external dependency needed for this scale), the autosave effect + debounce
in `AddSheet.tsx`, the draft-list overlay component, and replacing C12's
`window.confirm` with the toast-plus-undo from decision 4. No backend
change, no migration, no `swagger.json`/`api.d.ts` regen.

**M2** is `internal/drafts` end to end (migration, domain package, DTOs,
swag annotations, `gen-api-docs.ps1`, `gen:types` on the frontend side) plus
swapping M1's IndexedDB calls for the new endpoints — the FE-side draft
shape doesn't change, only where it's persisted, so this shouldn't touch
the autosave/overlay UI at all.

## Open items

- **Exact debounce interval and list overlay copy** are placeholders above,
  not settled — normal implementation-time judgment calls, not a decision
  this doc needs to pin down.
- **Cross-device conflict (M2 only).** If the same draft is somehow open on
  two devices at once (unlikely — nothing invites it), last-write-wins on
  `updated_at` is the proposed behavior. Not designed further; revisit only
  if it turns out to matter in practice.
- **Whether M2 ships at all** depends on whether M1 shows drafts actually
  getting used and abandoned-then-resumed, versus abandoned-then-ignored.
  Don't build M2 speculatively.
