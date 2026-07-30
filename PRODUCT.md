# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Indonesian bouldering climbers, primarily discovering spots and logging ascents from their phone at (or on the way to) an outdoor bouldering area. Three roles exist in the product today: a regular climber (browses the map, sends problems, comments, maintains a profile); a "Founder" (the climber who added a given spot/problem, with edit rights over just that problem); and an admin (`Council`/`Associate` title, full CRUD over any problem, report-queue moderation).

## Product Purpose

A community platform for the Indonesian bouldering scene: find spots on an interactive map, log sends, comment and collaborate on problems, and build a public climbing profile. It exists to give this scene a persistent, structured home instead of word-of-mouth and scattered chat threads.

## Positioning

The Indonesia-first alternative to global climbing-log apps (Mountain Project, 27crags, Vertical-Life). Those don't serve this scene well — they weren't built around Indonesian spots, language, or community norms. Palabatu is built local-first: local spots, local grading/community conventions, and land-access norms specific to Indonesia, rather than a global product with a localization pass.

## Operating Context

Used outdoors, at or en route to remote bouldering spots — often on patchy mobile data and lower-end Android devices, not fast wifi on flagship phones. Installed as a PWA rather than opened as a bookmarked site. Pre-launch: nothing is deployed to production yet (`palabatu.id` unregistered, all third-party services — Resend email, Cloudinary — on dev/free tiers). Solo/small-team, community-run project; not yet accepting outside code contributions.

## Capabilities and Constraints

- Interactive spot map with marker clustering; problem/route CRUD with photo topo annotation (drawn route lines/holds on a problem's photo).
- Send tracking (tick toggle) and comments per problem.
- Climber profiles with a public badge/title.
- JWT auth with email verification, password reset; image uploads via Cloudinary.
- In-app notifications (reactions, edits, deletes, mentions).
- Editing/deleting a problem is limited to its Founder or an admin (`Council`/`Associate`) — not open to any signed-in user.
- Explicitly undecided, do not assume an answer: whether non-creators can add photos/beta to a problem they didn't create (collaborative editing); whether exact GPS coordinates get obscured for land-access-sensitive spots (needs outdoor-access and/or legal input before it's a product decision, not just an engineering one).
- No production deploy yet — art assets, feedback-form entry point, and hosting/DNS/paid-tier third-party services are still open Phase 1 work (see ROADMAP.md).

## Brand Commitments

Name: **Palabatu**. Voice is grassroots/community-run — by-climbers-for-climbers, informal, not corporate — and that tone should hold even as the product matures past its current pre-launch stage.

## Evidence on Hand

No testimonials, press, or case studies yet — the product is pre-launch. The Landing page's existing `about` section (`Landing.tsx`, `section.about`) already has real, user-authored origin-story copy and a 3-feature grid (Spot Map / Logbook / Crew) — treat that as existing brand copy to preserve, not a placeholder to rewrite or a pattern to invent more of.

## Product Principles

1. Local-first over generic — Indonesian spots, language, and community norms outrank parity with global climbing apps.
2. Built for outdoor, patchy-network use — a low-end Android phone on spotty data is the default case, not an edge case.
3. Grassroots tone throughout — community-run voice, not corporate polish, regardless of how polished the product itself becomes.
4. Mobile is primary, not an afterthought — installable PWA, phone-first design and interaction.
5. Trust the community's own structure — Founder-based edit rights and lightweight admin roles over heavy top-down moderation.
