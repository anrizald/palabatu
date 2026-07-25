# Palabatu Roadmap

Status: in active development, not yet deployed. No hosting exists for palabatu.id yet — "v1" is defined here as the first production deploy, not a feature count. See [CLAUDE.md](CLAUDE.md) for architecture and conventions.

This file tracks direction across sessions. Update it as items complete or scope changes — don't let it go stale.

## Phase 1 — Pre-launch (blocking v1)

Everything else on the original deployability punch list (validation, rate limiting, CI, shareable URLs, moderation queue, topo annotation, notifications) is done. One open item remains:

- **Sensitive/approximate crag locations** — obscure exact GPS coordinates for spots with land-access or overcrowding concerns. Cheap to build; blocked on a policy decision (which spots, how approximate, opt-in vs. default).

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

## Deferred, no committed phase

- Collaborative problem editing — letting non-creators add photos/beta to a problem they didn't create, without being an admin. Explicitly unresolved: additive-only vs. destructive edit, moderation needs, and whether this is really just "comments already do this." No implementation should start until the product shape is decided.
