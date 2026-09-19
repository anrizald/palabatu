# Palabatu Roadmap

Status: in active development. **Deployed, not launched** — palabatu.id runs on a Hostinger VPS behind Caddy, serving the `stage` branch behind an under-construction screen, with a live API and an empty database. So "v1" can no longer mean "the first production deploy" (that already happened); it means the first *public* release: the curtain down, real data in, real users able to sign up. See [CLAUDE.md](CLAUDE.md)'s Project section for the verified deploy facts and architecture conventions.

This file tracks direction across sessions. Update it as items complete or scope changes — don't let it go stale.

## Phase 1 — Pre-launch (blocking v1)

Everything on the original deployability punch list (validation, rate limiting, CI, shareable URLs, moderation queue, topo annotation, notifications) is done. Two open items remain:

- **Deployment services** — decide and provision the production tier for every third-party service the app actually depends on, currently all wired up on dev/free-tier credentials only:
  - **Email (Resend)** — the sending domain is done: the deploy doc (`hostinger_vps_deployment_handoff.md`, on `stage`) records `marketing.palabatu.id` as Resend-verified, with production using `EMAIL_FROM=noreply@marketing.palabatu.id`. (This line used to say only the `onboarding@resend.dev` sandbox address worked; that predates the domain.) Still open: confirm the account's plan and sending limits cover signup/reset volume at launch.
  - **Image storage/CDN (Cloudinary)** — confirm the production plan and limits; currently a dev account.
  - ~~**App hosting**~~ — **done.** The Go binary (which also serves the built frontend, per the shareable-URL work) runs on a Hostinger VPS as one Docker image, behind Caddy. A Railway alternative was written up and abandoned, and its doc was deleted in `5b7afb6` (`git show 5b7afb6^:railway_prod_deployment_handoff.md` still reads it). The real deploy write-up is `hostinger_vps_deployment_handoff.md`, which lives on `stage` only (`git show stage:hostinger_vps_deployment_handoff.md`).
  - ~~**DNS/domain**~~ — **done.** palabatu.id resolves to the VPS and serves over TLS.
  - **Edge protection** — still open, and now urgent rather than theoretical, since the origin is publicly reachable. The plan is already written, as step 10 of `hostinger_vps_deployment_handoff.md`: Cloudflare's free tier in front, plus two changes that must ship together (rewrite `X-Forwarded-For` from `CF-Connecting-IP` in `deploy/Caddyfile`, and restrict `ufw` to Cloudflare's published ranges). `edge_protection_handoff.md` adds one post-launch check. Both docs and the Caddy/compose config live on `stage` only. As of 2026-09-17 none of it has happened: `palabatu.id`'s nameservers are still Hostinger's, and responses carry no `cf-ray`. See CLAUDE.md's Known WIP rough edges.
- **Art assets** — replace remaining placeholder art (OG/social preview image, generic icons) with final hand-drawn assets. Owned by the user personally — in progress, not blocked on anyone else. See the icon asset plan for the specific remaining list (profile reactions, the rock/wall choice in the add sheet, send-counter icon, verify-email illustration). Already shipped: map pinpoint + cluster art, the plus-button FAB, and the locate-me button. The inline pin glyph was settled as Lucide's `MapPin` rather than custom art.
- ~~**Feedback / bug report form**~~ — **built 2026-07-28.** A global "Feedback" entry point in `Header.tsx` (desktop) and `Sidebar.tsx` (mobile), opening `FeedbackModal.tsx` (mirrors `ReportModal.tsx`'s visual language). Open to logged-out visitors as well as signed-in users: `POST /api/feedback` (`internal/feedback/`) sits behind `middleware.RateLimit` (per-IP, same pattern as `internal/waitlist`) instead of `middleware.RequireAuth`, and runs the new `middleware.OptionalAuth` so a logged-in submitter's `user_id` gets attached without requiring a session. Submissions land in their own `feedback` table (migrations/0012) and trigger an immediate email via `mailer.SendFeedbackNotification`, sent to whatever inbox `OWNER_USER_ID` resolves to (`auth.GetUserEmail`) rather than a second owner-email env var. Review list is a 5th tab ("Feedback") on the Developer page, listing open submissions and marking them reviewed via `POST /api/feedback/:id/reviewed` — same owner-only gate as the rest of that page.

## Phase 1.5 — Crags/boulders/problems restructure (done 2026-08-08)

The full design record was `handoff.md`, removed once everything in it was
built; it is the complete decision record, not this summary, and CLAUDE.md's
handoffs bullet gives the one command that reads it back out of git.
Restructured `problems` (was
flat: name/grade/free-text location/lat-lng/image_urls) into a
`crags -> boulders -> problems` hierarchy: a crag is the place you park and
walk in from, a boulder is one rock, a problem is one way up that rock. This
was the item `handoff.md`'s own sequencing section called out as needing to
land before the first production deploy — inserting a level into the
hierarchy (and moving photo ownership) only gets more expensive once real
contributions exist. Both schema/backend and frontend are now complete.

- **Schema + backend — done 2026-08-07.** Migrations 0014/0015 applied and
  verified against the local Docker DB; the one-off `cmd/backfill-crags`
  script backfilled every existing problem (centroid coordinates per crag,
  one boulder per problem, singleton crag for any problem with no location
  string) and was hand-checked before 0015 dropped the old columns. New
  `internal/crags` and `internal/boulders` domains (the latter including
  the full boulder-merge sub-flow: suggest / object / admin-only resolve
  with a 48h objection hold), `internal/problems` rewritten for the new
  shape, `internal/report`'s image-report flow updated for boulder-owned
  photos, three new notification types. `docs/swagger.json` and
  `palabatu-fe/src/types/api.d.ts` regenerated. Smoke-tested end to end
  (crag/boulder/problem CRUD, image add/remove, merge suggest → object →
  resolve) against the local DB. A small follow-on addition landed with the
  frontend pass below: `GET /boulders/:id/merge-requests`
  (creator-or-admin gated), so a boulder's own creator can actually see and
  object to a request filed against their rock (the admin-wide listing
  alone left that right unreachable).
- **Frontend — done 2026-08-08.** `AddProblemModal` replaced by a
  three-step wizard (`components/add-flow/`: spot search/create → boulder
  photo-grid picker, auto-skipped when there's nothing to choose → climb
  details) per `handoff.md`'s UX principles; `Map.tsx`/`PinpointMarker`/
  `ClusterCardRail` rewritten for one-pin-per-crag with a dimmed
  empty-crag state; new `CragDetailPage`/`BoulderDetailPage` routes
  (boulder photo grid, combined per-boulder annotation view, "these are
  the same rock" suggest CTA + objection banner); `ProblemDetailPage`/
  `ProblemEditForm` rewritten for the new field set (the old `ProblemDetails`
  modal was deleted, not ported — `ProblemDetailPage` is now the only
  problem-detail surface); `Directory`/`ProblemList`/`Landing`/`ProblemCard`
  rejoined to crag/boulder data via a small client-side `cragCache.ts`
  helper rather than a backend denormalization; a new admin same-rock
  review page (`AdminMergeRequests`); the three merge notification types
  wired into the existing bell/page icon maps. tsc/eslint/go vet clean;
  smoke-tested live against the local Docker DB (not just typechecked).
  **The wizard didn't last.** `handoff.md` revisions (f)-(h) replaced it on
  2026-08-10 with one scrolling add sheet (`components/add-sheet/`: three
  intents, spot / rock / problem, each saving on its own), and shipped
  approach guides ("jalan masuk"), the map's three zoom layers, and
  re-parenting alongside it. `components/add-flow/` is deleted.
- **Directory & All Problems (read surfaces) — done 2026-09-05.** The
  frontend pass above only mechanically rejoined `Directory.tsx`/
  `ProblemList.tsx` to the new hierarchy via `cragCache.ts`; both still
  expressed the old flat model (one photo, one pin, one problem-granular
  row) underneath. Full design lived in `handoff-directory.md` (12 findings,
  14 decisions across two rounds of review) — removed from the repo now
  that it shipped in full; see `git log -- handoff-directory.md` for the
  complete record. Summary of what landed: a new `/directory/spots` place
  index; `Directory.tsx`'s rows regrouped so each asks its question at the
  right hierarchy level (spots near you, crag-level recent activity spanning
  contributors and rocks, problem-level hot); a shared
  `DirectorySegmentedControl` tying the three directory-adjacent pages
  together; `boulder_type`/`topo_url`/`topo_line` added to `ProblemListItem`
  (killing a per-crag fetch fan-out); a working spot/type/ungraded filter set
  on All Problems; and a rotating single-slot nudge for the three real
  content gaps (no approach mapped / a photoless rock / an empty spot). One
  idea was deliberately not built (drawing a problem's line over its rock's
  cropped card photo — the annotation overlay math isn't crop-safe) and two
  were named but not started (search ranking, catalog pagination) — see
  Deferred below for both.
- **Admin tidy-up queue — done 2026-09-06.** `handoff.md` open item 9, and
  `handoff-add-sheet.md` C11 with it. `boulders.filed_uncertain`
  (migrations/0020) records what a contributor said when their problem
  created a rock implicitly — three-state, so "we never asked" stays
  distinct from "they said no" — and
  `GET /api/boulders/needs-attention` + `AdminNeedsAttention` pair it with
  item 9's derived heuristic rather than choosing between them, labelling
  which signal each row came from. Drainable by construction: a row
  qualifies only while the rock is still unidentified, so naming or
  photographing it removes the row, which is why there is no dismiss action
  and the flag is never mutated.
- **Photo attribution — done 2026-09-06.** The build half of `handoff.md`
  open item 11, and the last thing decision 22 required before the
  `authz.CanContribute` policy can widen past creator-or-admin. Photos had
  no attribution at all: `crags`/`boulders`/`problems.image_urls` are jsonb
  arrays of bare URL strings. `photo_credits` (migrations/0021) is a sidecar
  keyed `(entity_kind, entity_id, image_url)`, following the shape
  `topo_annotations` and `reports` already use for the same reason — a photo
  inside a jsonb array has no id to point at — so it changed no existing
  read or write path. `internal/photocredits` is shared infrastructure in
  the mould of `internal/cloudinary`: three domains use it, it imports none
  of them. Credits attach to the single-entity GETs only, never to a list.
  No backfill, because an absent row is not unknown: until the policy
  widens, a photo with no credit was added by the entity's creator, which is
  what `CanEditOwned` enforced, so the UI falls back to `creator_name`.

  **The policy call followed the same day.** `authz.CanContribute` now lets
  any signed-in user add a photo or an approach, globally rather than
  per-crag; removal stays creator-or-admin. The same pass gave
  `CragDetailPage` its own photo gallery, which it had never had, so crag
  credits now render through `PhotoCreditLine` like the rock and problem
  pages.

  Opening photo adds to anyone raised four follow-ups (`handoff.md` open
  items 15-18):
  - **Self-delete (item 15), done 2026-09-06.** Whoever uploaded a photo can
    remove it. On a rock this is refused if another founder has drawn a
    line on that photo.
  - **Bring your own photo (item 16), done 2026-09-17.** A new problem on a
    rock that already has a photo can draw its line on a photo of its own.
    Reusing the shared photo stays the default.
  - **No approval step (item 17), decided 2026-09-17.** Drawing a line on
    someone's shared photo touches nothing they made, and `internal/report`
    already covers abuse.
  - **Admin-only override on shared rock photos (item 18), done 2026-09-19.**
    A rock's creator is now held to the same item 15 check as an uploader:
    a photo carrying another founder's line can't be deleted by them. Only
    an admin can force it through, and their confirm names how many other
    people's lines go with it.
- **Add-sheet drafts (autosave) — M1 done 2026-08-17, M2 done 2026-09-17.**
  Full design lived in `handoff-drafts.md`, removed now that both milestones
  shipped; see `git log -- handoff-drafts.md` for the complete record.
  Closes the failure mode `handoff.md` decision 20 named ("gone for months")
  and the add-sheet review's B9 found separately (a staged photo lost to a
  silent upload failure): closing the sheet no longer risks losing what was
  typed. **M1** autosaves the whole sheet (not just the active tab) to
  IndexedDB, debounced ~800ms, created lazily on the first real edit; a "N
  drafts saved" overlay lists every abandoned session; closing replaced a
  blocking confirm dialog with a "Saved as a draft" toast plus Undo. **M2**
  (`internal/drafts`, `migrations/0022`) makes drafts survive a reinstall or
  a second device — staged photos now upload eagerly instead of waiting for
  final submit, and provisional uploads are swept on every edit or delete,
  except the one case the design doc got wrong: a *submitted* draft's
  cleanup must not destroy its photo, since that URL is by then the real
  problem/boulder/crag's own (`keep_photos`, fixed the day it was found —
  see `internal/drafts`' entry in CLAUDE.md's Architecture section). M2 was gated in the
  original doc on M1 proving drafts get resumed rather than abandoned —
  built anyway, deliberately, once it was clear IndexedDB-only M1 had no way
  to ever produce that signal for anyone to wait on. Both milestones
  verified live against the local Docker DB. **Still open:** the spot/rock
  tabs' own draft paths were never driven live at either milestone, only
  covered by the same intent-agnostic upload/serialize code the verified
  problem tab runs through; and M2's cross-device-conflict behavior
  (last-write-wins on `updated_at`) was never designed further than that one
  line, on the reasoning that nothing invites two devices editing the same
  draft at once.

## Phase 2 — Post-launch, near-term

- **RBAC/badge rework** — split `profiles.title` (currently doing double duty as both the admin-permission gate and a public badge) into real permission tiers (Warden/Chief Warden, backend-only) plus a separate cosmetic badge system (Council/Associate repurposed as showable badges, room for more). Design already agreed, not built.
- **Follow a crag** — notify users when a new problem is added at a crag they've marked as followed. Originally specced as a geospatial "within X km" check; the Phase 1.5 `crags` table makes this a plain FK join instead (`crag_follows(user_id, crag_id)`, notify on `POST /problems` for that crag) — nearly free now that a crag is a real entity.

## Phase 3 — Community features

- **Logbook** — full personal ascent history: every problem sent, from first V0 to current project. Builds on the existing `sends` domain (`internal/social`), which today only powers the tick toggle and an aggregate count on profile stats — no endpoint lists *which* problems were sent. Needs a joined `sends` → `problems` query and a profile-page view.
- **Crew** — user-to-user following, an activity feed of who's active at your local spot, and a reputation/recognition signal ("build your name"). `internal/social` already anticipated this in scope. Needs a new `follows` table, follow/unfollow endpoints, and an activity view. "Build your name" may fold into the RBAC/badge work above rather than inventing a separate reputation system. Distinct from "follow a crag" (that follows a *location*; this follows *people*), though the two will likely ship around the same time since both extend the existing notification system.
- **Ultra-customizable profile page** — Friendster-era profile customization, brought back: users style their own profile page (custom layout/colors/theme, not just the fixed template everyone gets today). Just added 2026-07-28, not designed yet — open questions: how far customization goes (theme picker vs. raw CSS/HTML a la old Friendster, with the XSS/sanitization implications that implies), where it's stored (`profiles.Tags`-style opaque JSON blob vs. dedicated columns), and how it interacts with the RBAC/badge work above if badges/titles need to render consistently inside a custom layout.

## Phase 4 — Native mobile apps (iOS / Android)

- **Framework: React Native**, chosen over Flutter — the existing frontend is React 19 + TypeScript, so `api.ts`, `AuthContext`, shared types, and business logic can realistically carry over. Flutter would mean a fully separate Dart codebase with zero reuse. Trade-off accepted: Flutter generally gives more polished out-of-box native UI/performance, but that didn't outweigh the reuse story.
- **Styling**: revisit Tamagui (cross-platform React UI kit) only once RN work actually starts — it was evaluated and rejected for the current web-only app since its core value (shared components across RN + web) doesn't apply yet. Don't assume Tailwind carries over as-is; re-litigate Tamagui vs. NativeWind vs. plain StyleSheet at that point.
- Not scoped beyond framework choice yet — no timeline, no feature-parity decision (full parity vs. mobile-first subset) made.

## Marketing site & community (parallel track, not gating v1)

Separate from the four product phases above — public-facing presence around palabatu.id. None of this blocks the app itself shipping.

- **Waitlist / coming-soon page** — **partly built.** The `waitlist_subscribers` table (migrations/0010), the rate-limited `POST /api/waitlist` (`internal/waitlist`) and `ComingSoon.tsx` all exist. A confirmation email (`mailer.SendWaitlistConfirmation`) exists on `stage` only. Not built: the planned sync to a Resend Audience via its Audiences API, so Resend Automations (welcome email, drip sequences) and Broadcasts can't reach subscribers yet. The table stays the source of truth either way, and Resend being the transactional-email provider already means no second email service is needed. **Note what's live:** `stage` shows `UnderConstruction.tsx`, which has no email field, so production collects no emails today (see the deploy doc's "Which curtain ships" note).
- **Discord community** — a direct feedback/beta-testing channel ahead of in-app social features (Crew, Phase 3). Open question not yet decided: public-open vs. invite-gated off the waitlist.
- ~~**Support section on the Landing page**~~ — **built.** Verified in place 2026-09-06 (this entry still described it as unbuilt and specced it in detail; the spec is left below only as the record of what was asked for). `Landing.tsx` carries a `#support` panel inside the existing `about` section, with the `scroll-margin-top` and the hash-scroll handler that make a direct link from a Discord bio land on it. Both lanes shipped: **Duit** (Saweria for IDR, Ko-fi for USD) and **Tenaga** (a call for devs, illustrators, writers and translators, with Discord and Instagram as the intake), in the section's own bespoke inline-style aesthetic rather than the app's Tailwind tokens.

  Two deviations from the spec below, both deliberate as far as the code shows: **GitHub Sponsors is absent**, and the GitHub link in the Tenaga lane is commented out — consistent with the repo still being private, so a "help us build it" link would lead nowhere. Revisit both if the repo opens up. The original spec, for reference: financial contribution (Saweria for IDR via QRIS/e-wallet/bank transfer; GitHub Sponsors + Ko-fi for USD, deliberately capped at two USD platforms) and skills contribution with an intake mechanism, given its own in-page anchor, matched to the section's Playfair Display / DM Sans / `#f0e0c8`/`#6a5848`/`#8a7060`/`#c87a30` palette. **Note:** an earlier pass at this roadmap wrongly assumed this meant reviving the dead, unwired `About()` component in `App.tsx` — a separate, unrelated leftover, and not part of this item.
- **Public interactive roadmap page** — a visitor-facing version of this file: a custom map-like background (user supplying the art personally, same ownership pattern as the Phase 1 art assets) with each phase revealed on click/hover. A private prototype of the "phases as an ascending climbing route" visual concept already exists as a Claude artifact from this planning session — worth using as a design reference, not something to build directly on top of.

## Developer / ops tooling (parallel track, owner-only)

Internal tooling for the user themselves, not community-facing — distinct from the RBAC/badge rework above, which is about community admin roles (Council/Associate/Warden).

- **Developer page** — data export, analytics viewing, API docs, and tester management, in one place. Scoped 2026-07-28, **built 2026-07-28**:
  - **Access control** — `OWNER_USER_ID` env var (godotenv, alongside `JWT_SECRET` etc.) plus `middleware.RequireOwner` (`palabatu-be/internal/middleware/owner.go`), which compares it against `AuthUser.ID`. Deliberately not a role/title — Council/Associate/Warden are community tiers meant to be held by more than one person; this page is for one account. Chained after `RequireAuth` via one `rg.Group("/dev", middleware.RequireAuth, middleware.RequireOwner)` call rather than repeating it per route.
  - **New domain package** `internal/devtools/` (`handler.go`/`service.go`/`repository.go`/`errors.go`, mounted on the existing `/api` group as `/api/dev/*`), following the existing one-package-per-domain convention.
  - **Data export** — `GET /api/dev/export/{users|problems|sends|comments|reports}`, JSON by default, CSV via `?format=csv` (CSV rendering shared across all five types via one reflection-based `writeCSV` helper keyed off each type's json tags). `users` export deliberately excludes `password`/`verification_token`/`reset_token`/`reset_token_expiry`.
  - **Analytics** — `GET /api/dev/analytics`: signups/problems/sends per day (trailing 30 days), verified-vs-unverified counts, top 10 sent problems, top 10 most active users (by sends+comments+problems added). Direct Postgres aggregate queries, deliberately bypassing `internal/metrics`/Prometheus (nothing scrapes `GET /metrics` today).
  - **API docs** — manually maintained reference (route, method, auth requirement, one-line purpose), rendered as a static table in `Developer.tsx` covering every mounted route across all domains.
  - **Tester management** — `profiles.is_tester boolean default false` (`migrations/0011_developer_tools`), plus search-by-username/email (`GET /api/dev/testers/search`) and toggle (`POST /api/dev/testers/:id/toggle`, atomic via `NOT COALESCE(is_tester, false)` in SQL) on the page. Gating specific unreleased features behind `is_tester` is still unstarted — ships ad hoc as those features need it.
  - **Frontend** — `src/pages/Developer.tsx` at `/developer` (tabs: Analytics/Export/Testers/API Docs), with its own owner-email guard as a fallback for direct navigation. Nav entry in `Header.tsx`/`Sidebar.tsx` renders only when the logged-in user's email matches `VITE_OWNER_EMAIL` — backend `RequireOwner` is the actual enforcement.

## Deferred, no committed phase

- **Sensitive/approximate crag locations** — obscure exact GPS coordinates for spots with land-access or overcrowding concerns. Cheap to build once decided, but the policy itself needs outside input the user doesn't have: an outdoor-bouldering-access perspective and/or legal advice (Indonesian land-access/liability norms), not just an internal call. Moved out of Phase 1 — not launch-blocking, revisit once that input exists.
- **Collaborative problem editing** — the additive half is decided and built (see Photo attribution under Phase 1.5): any signed-in user can add photos and approach guides. Still deferred: letting non-creators *change* existing fields (name, grade, description), and structured beta notes (`authz.KindAddNote` has no call site). No implementation should start on those until the product shape is decided.
- **Topo line rendering on Directory/All Problems cards** — draw a problem's own drawn line (`topo_annotations`) over its rock's shared photo on card thumbnails, so several problems on one boulder stop rendering as identical photos. The data half is done (`ProblemListItem.topo_url`/`.topo_line`), but every card today crops its photo (`object-fit: cover`) and the existing annotation overlay's coordinate math assumes an uncropped, letterboxed photo — building crop-aware math risked a subtly wrong line, worse than none. Asked directly during `handoff-directory.md`'s design; the call was to skip it for now rather than letterbox every card app-wide. Revisit only if a safe crop-aware transform becomes available.
- **Server-side pagination/search for the problem catalog** — `GET /api/problems` is one unpaginated fetch, fine at today's scale but the wrong shape for the surface meant to *be* the browse experience. Named threshold so it isn't re-argued later: build it when a cold `/directory/all` load exceeds ~300 problems or the response exceeds ~250KB. Below that, client-side filtering is faster (no round-trip per keystroke) and simpler.
- **Ranked search across the catalog** — today's search (`ProblemList.tsx`) is an unranked substring match over name/crag-name/boulder-name. Typo tolerance and Indonesian spelling variants (e.g. "Citatah" vs. "Citata") are a real future need; not started, no design yet.
