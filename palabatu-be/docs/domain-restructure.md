# Domain restructure sketch

Status: executed 2026-07-09. Written 2026-07-07 during a discussion about whether
`palabatu-be` should be organized by domain instead of by technical layer, resolved
the same day, and carried out as a pure file/package move on 2026-07-09 — no
behavior change, route surface (paths, methods, middleware) verified identical
before/after. See `CLAUDE.md`'s Architecture section for the shape as it exists now.

## Problem

`internal/` is currently layered by technical concern: `handler/`, `service/`, and
`repository/` each hold one file per resource (auth, problem, profile, send, comment).
That's fine at 5 resources, but every new feature means touching three parallel
directories, and there's no folder boundary that tells you "this is the Problems
domain" versus "this is Social."

## Proposed shape

Slice by domain instead, each domain owning its own handler/service/repository:

```
internal/
├── auth/
│   ├── handler.go      # was handler/auth.go
│   ├── service.go      # was service/auth.go
│   └── repository.go   # was repository/user.go
├── problems/
│   ├── handler.go       # was handler/problem.go
│   ├── service.go       # was service/problem.go
│   └── repository.go    # was repository/problem.go
├── social/
│   ├── handler.go        # was handler/interaction.go
│   ├── service.go        # was service/send.go + service/comment.go
│   └── repository.go     # was repository/send.go + repository/comment.go
├── authz/                # new: shared admin-role policy (Council/Associate checks)
├── db/                   # unchanged: pgxpool singleton
├── httpx/                # unchanged: WriteJSON/DecodeJSON
├── mailer/               # unchanged
└── middleware/           # unchanged: RequireAuth, UserFromContext
```

`handler/api.go`'s router-wiring role moves to `cmd/api/main.go` or a thin
`internal/router.go` that imports each domain's `Router()` constructor.

## Domains and what they own

- **auth** — users, sessions, JWT issuance/verification, signup/signin,
  email verification, password reset. Everything currently in `handler/auth.go` /
  `service/auth.go` / `repository/user.go`.
- **problems** — map spots/routes, problem CRUD, image uploads (once the
  Cloudinary port lands), "Founder" (creator) authorization check.
- **social** — sends (ticks) and comments today; likes or follows if those get
  added later.

## Cross-cutting concerns (deliberately not owned by one domain)

1. **Profiles are dual-purpose.** `profiles.title` (roles) is an auth/authz
   concern; `tags`/avatar/level is public-facing display data that Social (and
   Problems, for attribution) reads. **Resolved: `auth` owns `Profile`.**
   `GetUserTitles()` already lives there conceptually; Problems and Social call
   into it read-only.
2. **Admin-role authorization is a policy, not a domain.** `adminTitles`
   (Council/Associate) and `authorizeProblemEdit` are needed by Problems today
   and plausibly by Social later (comment moderation). **Resolved: `internal/authz`
   as its own package.** Heavy fan-in from Problems/Social is fine and expected —
   the constraint is that `authz` must stay stateless/leaf-level: functions like
   `IsAdmin(titles []string) bool` and `CanEditProblem(userID, creatorID string,
   titles []string) bool` that take already-fetched data as arguments, rather
   than reaching into `auth`'s repository itself. That keeps the dependency
   direction one-way (`problems`/`social`/`auth` → `authz`, never back), so no
   import cycle is possible no matter how many domains depend on it. The only
   way to break this is if `authz` ever needed to fetch data itself (e.g. call
   `GetUserTitles()` directly) while `auth` also imported `authz` — avoid giving
   `authz` any outbound dependency on domain packages.

## Non-goals

- No behavior change. This is a file/package move, not a rewrite of business
  logic, SQL, or authorization rules.
- Not blocking the Cloudinary upload port or any other in-flight work — do
  this restructure as its own isolated pass, ideally once `/api` is fully
  ported so there isn't a half-migrated split to reason about.

## Decisions (resolved 2026-07-07)

- `profile` lives under `auth`, not its own domain.
- `authz` is its own package (`internal/authz`), designed stateless/leaf-level
  so heavy fan-in from Problems/Social never risks an import cycle. See
  "Cross-cutting concerns" above for the shape.

Nothing left open — this doc is ready to execute against next session.
