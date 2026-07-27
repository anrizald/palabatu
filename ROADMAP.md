# Palabatu Roadmap

Status: in active development, not yet deployed. No hosting exists for palabatu.id yet — "v1" is defined here as the first production deploy, not a feature count. See [CLAUDE.md](CLAUDE.md) for architecture and conventions.

This file tracks direction across sessions. Update it as items complete or scope changes — don't let it go stale.

## Phase 1 — Pre-launch (blocking v1)

Everything on the original deployability punch list (validation, rate limiting, CI, shareable URLs, moderation queue, topo annotation, notifications) is done. Two open items remain:

- **Deployment services** — decide and provision the production tier for every third-party service the app actually depends on, currently all wired up on dev/free-tier credentials only:
  - **Email (Resend)** — on the free tier today, which can only send from the shared `onboarding@resend.dev` sandbox address to the account owner's own inbox. Needs a paid tier + a verified custom domain before signup/reset emails can reach real users.
  - **Image storage/CDN (Cloudinary)** — confirm the production plan and limits; currently a dev account.
  - **App hosting** — where the Go binary (which also serves the built frontend, per the shareable-URL work) actually runs in production. Nothing chosen yet.
  - **DNS/domain** — palabatu.id itself isn't registered/pointed anywhere yet.
- **Art assets** — replace remaining placeholder art (OG/social preview image, generic icons) with final hand-drawn assets. Owned by the user personally — in progress, not blocked on anyone else. See the icon asset plan for the specific remaining list (plus-button FAB, profile reactions, boulder/rope toggle, send-counter icon, inline pin glyph, verify-email illustration); map pinpoint + cluster art already shipped.

## Phase 2 — Post-launch, near-term

- **RBAC/badge rework** — split `profiles.title` (currently doing double duty as both the admin-permission gate and a public badge) into real permission tiers (Warden/Chief Warden, backend-only) plus a separate cosmetic badge system (Council/Associate repurposed as showable badges, room for more). Design already agreed, not built.
- **Follow a crag** — notify users when a new problem is added near a map spot they've marked as followed. Needs a `crag_follows` table, follow/unfollow UI on the map, and a geospatial "within X km" check on problem creation.

## Phase 3 — Community features

- **Logbook** — full personal ascent history: every problem sent, from first V0 to current project. Builds on the existing `sends` domain (`internal/social`), which today only powers the tick toggle and an aggregate count on profile stats — no endpoint lists *which* problems were sent. Needs a joined `sends` → `problems` query and a profile-page view.
- **Crew** — user-to-user following, an activity feed of who's active at your local spot, and a reputation/recognition signal ("build your name"). `internal/social` already anticipated this in scope. Needs a new `follows` table, follow/unfollow endpoints, and an activity view. "Build your name" may fold into the RBAC/badge work above rather than inventing a separate reputation system. Distinct from "follow a crag" (that follows a *location*; this follows *people*), though the two will likely ship around the same time since both extend the existing notification system.

## Phase 4 — Native mobile apps (iOS / Android)

- **Framework: React Native**, chosen over Flutter — the existing frontend is React 19 + TypeScript, so `api.ts`, `AuthContext`, shared types, and business logic can realistically carry over. Flutter would mean a fully separate Dart codebase with zero reuse. Trade-off accepted: Flutter generally gives more polished out-of-box native UI/performance, but that didn't outweigh the reuse story.
- **Styling**: revisit Tamagui (cross-platform React UI kit) only once RN work actually starts — it was evaluated and rejected for the current web-only app since its core value (shared components across RN + web) doesn't apply yet. Don't assume Tailwind carries over as-is; re-litigate Tamagui vs. NativeWind vs. plain StyleSheet at that point.
- Not scoped beyond framework choice yet — no timeline, no feature-parity decision (full parity vs. mobile-first subset) made.

## Marketing site & community (parallel track, not gating v1)

Separate from the four product phases above — public-facing presence around palabatu.id. None of this blocks the app itself shipping.

- **Waitlist / coming-soon page** — gated email capture, being built in a separate session as of 2026-07-26. Planned flow: submitted emails land in a new `waitlist_subscribers` table (source of truth, owned data) and are also synced to a Resend Audience via its Audiences API, so Resend Automations (instant welcome email, drip sequences) and Broadcasts (manual one-off sends) can actually reach them — Resend already being the transactional-email provider means no second email service is needed.
- **Discord community** — a direct feedback/beta-testing channel ahead of in-app social features (Crew, Phase 3). Open question not yet decided: public-open vs. invite-gated off the waitlist.
- **Mission & Support page** — mission/vision copy plus donation links. Saweria for IDR (QRIS/e-wallet/bank transfer, no subscription lock-in); for USD, GitHub Sponsors (fits since the repo's already on GitHub, zero platform fee) plus Ko-fi, deliberately not spreading across more than two USD platforms.
- **Public interactive roadmap page** — a visitor-facing version of this file: a custom map-like background (user supplying the art personally, same ownership pattern as the Phase 1 art assets) with each phase revealed on click/hover. A private prototype of the "phases as an ascending climbing route" visual concept already exists as a Claude artifact from this planning session — worth using as a design reference, not something to build directly on top of.

## Deferred, no committed phase

- **Sensitive/approximate crag locations** — obscure exact GPS coordinates for spots with land-access or overcrowding concerns. Cheap to build once decided, but the policy itself needs outside input the user doesn't have: an outdoor-bouldering-access perspective and/or legal advice (Indonesian land-access/liability norms), not just an internal call. Moved out of Phase 1 — not launch-blocking, revisit once that input exists.
- Collaborative problem editing — letting non-creators add photos/beta to a problem they didn't create, without being an admin. Explicitly unresolved: additive-only vs. destructive edit, moderation needs, and whether this is really just "comments already do this." No implementation should start until the product shape is decided.
