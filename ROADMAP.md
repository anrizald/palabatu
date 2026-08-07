# Palabatu Roadmap

Status: in active development, not yet deployed. No hosting exists for palabatu.id yet — "v1" is defined here as the first production deploy, not a feature count. See [CLAUDE.md](CLAUDE.md) for architecture and conventions.

This file tracks direction across sessions. Update it as items complete or scope changes — don't let it go stale.

## Phase 1 — Pre-launch (blocking v1)

Everything on the original deployability punch list (validation, rate limiting, CI, shareable URLs, moderation queue, topo annotation, notifications) is done. Two open items remain:

- **Deployment services** — decide and provision the production tier for every third-party service the app actually depends on, currently all wired up on dev/free-tier credentials only:
  - **Email (Resend)** — on the free tier today, which can only send from the shared `onboarding@resend.dev` sandbox address to the account owner's own inbox. Needs a paid tier + a verified custom domain before signup/reset emails can reach real users.
  - **Image storage/CDN (Cloudinary)** — confirm the production plan and limits; currently a dev account.
  - **App hosting** — where the Go binary (which also serves the built frontend, per the shareable-URL work) actually runs in production. Nothing chosen yet.
  - **DNS/domain** — palabatu.id is registered (via Hostinger), but unpointed: it still shows Hostinger's default parking template because nothing's been deployed there yet. Needs DNS pointed at wherever app hosting ends up.
- **Art assets** — replace remaining placeholder art (OG/social preview image, generic icons) with final hand-drawn assets. Owned by the user personally — in progress, not blocked on anyone else. See the icon asset plan for the specific remaining list (plus-button FAB, profile reactions, boulder/rope toggle, send-counter icon, inline pin glyph, verify-email illustration); map pinpoint + cluster art already shipped.
- ~~**Feedback / bug report form**~~ — **built 2026-07-28.** A global "Feedback" entry point in `Header.tsx` (desktop) and `Sidebar.tsx` (mobile), opening `FeedbackModal.tsx` (mirrors `ReportModal.tsx`'s visual language). Open to logged-out visitors as well as signed-in users: `POST /api/feedback` (`internal/feedback/`) sits behind `middleware.RateLimit` (per-IP, same pattern as `internal/waitlist`) instead of `middleware.RequireAuth`, and runs the new `middleware.OptionalAuth` so a logged-in submitter's `user_id` gets attached without requiring a session. Submissions land in their own `feedback` table (migrations/0012) and trigger an immediate email via `mailer.SendFeedbackNotification`, sent to whatever inbox `OWNER_USER_ID` resolves to (`auth.GetUserEmail`) rather than a second owner-email env var. Review list is a 5th tab ("Feedback") on the Developer page, listing open submissions and marking them reviewed via `POST /api/feedback/:id/reviewed` — same owner-only gate as the rest of that page.

## Phase 1.5 — Crags/boulders/problems restructure (blocking v1)

Full design in `handoff.md` at the repo root — read that file for the
complete decision record, not this summary. Restructures `problems` (today
flat: name/grade/free-text location/lat-lng/image_urls) into a
`crags -> boulders -> problems` hierarchy: a crag is the place you park and
walk in from, a boulder is one rock, a problem is one way up that rock. This
is the item `handoff.md`'s own sequencing section calls out as needing to
land before the first production deploy — inserting a level into the
hierarchy (and moving photo ownership) only gets more expensive once real
contributions exist.

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
  resolve) against the local DB.
- **Frontend — not started.** The existing UI (`AddProblemModal`,
  `ProblemDetails`, `ProblemDetailPage`, `Map.tsx`'s pin-per-problem
  clustering, `ClusterCardRail`, `Directory.tsx`, `ProblemList.tsx`,
  `ProblemCard`, the topo-annotation components) still assumes the old flat
  per-problem lat/lng/image_urls shape and will not build a problem
  successfully against the new API until this lands. Needs: the multi-step
  add flow (crag search/create → boulder photo-grid picker → problem
  details) per `handoff.md`'s UX principles, rewiring photo/annotation
  display to the boulder, the map's pin-per-crag + dimmed-empty-state
  treatment, and the "these are the same rock" merge-suggest UI.

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

- **Waitlist / coming-soon page** — gated email capture, being built in a separate session as of 2026-07-26. Planned flow: submitted emails land in a new `waitlist_subscribers` table (source of truth, owned data) and are also synced to a Resend Audience via its Audiences API, so Resend Automations (instant welcome email, drip sequences) and Broadcasts (manual one-off sends) can actually reach them — Resend already being the transactional-email provider means no second email service is needed.
- **Discord community** — a direct feedback/beta-testing channel ahead of in-app social features (Crew, Phase 3). Open question not yet decided: public-open vs. invite-gated off the waitlist.
- **Support section on the Landing page** — reversed 2026-07-26: NOT a separate About page or route. `Landing.tsx` already has a live, styled `about` section (`section.about`, ~line 437) with an origin-story paragraph, a 3-feature grid (Spot Map/Logbook/Crew), and a "Create your profile" CTA already linked to `/signup` — that CTA already exists, nothing to add there. What's actually missing is a **support subsection** to add into (or directly after) that same existing section: **financial** contribution (Saweria for IDR — QRIS/e-wallet/bank transfer; GitHub Sponsors + Ko-fi for USD, deliberately capped at two USD platforms) and **skills** contribution (a call for people who want to help as a dev, artist, copywriter, etc. instead of/alongside donating — needs some intake mechanism, e.g. a simple form or a link to a specific Discord channel, not yet decided). Give it its own in-page anchor (e.g. `#support`) so a direct link (Discord bio, etc.) can jump straight there. Match the section's existing bespoke inline-style aesthetic (Playfair Display headings, DM Sans body, the `#f0e0c8`/`#6a5848`/`#8a7060`/`#c87a30` palette already used in that section) rather than pulling in the rest of the app's Tailwind tokens. **Note:** an earlier pass at this roadmap wrongly assumed this meant reviving the dead, unwired `About()` component in `App.tsx` (see CLAUDE.md's "Known WIP rough edges") — that's a separate, unrelated leftover and is NOT part of this item.
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
- Collaborative problem editing — letting non-creators add photos/beta to a problem they didn't create, without being an admin. Explicitly unresolved: additive-only vs. destructive edit, moderation needs, and whether this is really just "comments already do this." No implementation should start until the product shape is decided.
