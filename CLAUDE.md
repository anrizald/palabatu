# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Palabatu — a community web app for Indonesian bouldering enthusiasts (interactive spot map, climber profiles, route/problem listings). Status: work in progress, not yet deployed. https://palabatu.id is the planned production domain (referenced in CORS config, OG tags, etc.) but nothing is hosted there yet — no hosting/deploy setup exists in this repo.

## Repo layout: two independent projects

The frontend (`palabatu-fe/`) and the backend (`palabatu-be/`) are **separate projects** — separate dependency managers and no shared config. Install and run each independently.

`palabatu-be/` is a Go rewrite of what was originally a Node/Express backend. The Node backend has been fully retired and removed from this repo — `palabatu-be/` (Go) is now the only backend and is the one that will serve https://palabatu.id once deployed.

## Commands

Frontend (`palabatu-fe/`):
```sh
cd palabatu-fe
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # production build to dist/
npm run lint      # ESLint (eslint.config.ts)
npm run preview   # preview production build
```

Backend (`palabatu-be/`):
```sh
cd palabatu-be
go run ./cmd/api   # http://localhost:3001 (default PORT)
go build ./cmd/api # compiles a binary
go vet ./...
```

There is no test suite configured in either project (no test script/runner in the frontend, no `_test.go` files yet in the backend) — see below for the separate root-level Playwright e2e suite. Don't assume Vitest/`go test` coverage exists — check before referencing test commands.

Both `palabatu-fe/` and `palabatu-be/` must run simultaneously for the app to work end to end. Vite proxies `/api` and `/auth` to `http://localhost:3001` in dev ([palabatu-fe/vite.config.ts](palabatu-fe/vite.config.ts)), and `palabatu-fe/src/lib/api.ts` falls back to `VITE_API_URL` or `http://localhost:3001` otherwise.

## Browser automation & E2E testing

Playwright is already installed (`@playwright/test` dev dependency) and the browser
binaries are already downloaded. Do NOT run `npm install playwright`,
`npx playwright install`, or install chrome-cli — the tooling is in place.

- Run tests: `npx playwright test`  (add `--headed` to watch, `--debug` for inspector)
- Screenshot a page: `npx playwright screenshot http://localhost:5173 out.png`
- The Vite dev server auto-starts via the `webServer` block in playwright.config.ts.
- Tests live in `tests/`; base URL is http://localhost:5173.

## Database migrations (`migrations/`)

Schema lives in `migrations/` as numbered `golang-migrate`-style pairs (`000N_name.up.sql` / `000N_name.down.sql`), applied via the `migrate` CLI (`go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`, installed to `%GOPATH%\bin`, e.g. `C:\Users\dede\go\bin`, which is on PATH).

Day-to-day, use [scripts/db.ps1](scripts/db.ps1) instead of calling `migrate` directly — it reads `DATABASE_URL` from `palabatu-be/.env` (so no `PGPASSWORD`/URL-typing ceremony), converts the `migrations` path to forward slashes (raw Windows backslashes break `migrate`'s internal `file://` URL parsing — `C:\...` gets misread as a host:port), and refuses to run at all if that `.env` points at a `neon.tech` host:

```powershell
.\scripts\db.ps1 up
.\scripts\db.ps1 down 1
.\scripts\db.ps1 version
.\scripts\db.ps1 force 1   # unstick a "dirty" migration state
```

Validated locally: a throwaway `palabatu_test` database on the local Postgres 18 install, confirmed via the VS Code Database Client extension after `up`.

The raw CLI form still works if needed, e.g. against Neon directly (read-only operations only — see below):
```sh
migrate -path migrations -database "$DATABASE_URL" up
migrate -path migrations -database "$DATABASE_URL" version
```

- `0001_init` is the schema as it actually exists in the live Neon database (captured via `pg_dump --schema-only`), not a from-scratch design — this repo had no schema file before.
- **Never run `migrate ... down` against the production `DATABASE_URL`** — it drops tables. Point at a local Postgres instance for testing the up/down cycle. `scripts/db.ps1` enforces this automatically.
- `golang-migrate`'s postgres driver (v4.19.1) registers itself for both the `postgres://` and `postgresql://` URI schemes, so Neon's connection strings work unmodified — no prefix-swapping needed.

## API Contract

`palabatu-be`'s handlers document themselves via [swaggo/swag v2](https://github.com/swaggo/swag) comment annotations, generated into a committed OpenAPI 3.1 spec at `palabatu-be/docs/swagger.json`. This exists so a mismatched request/response shape becomes a documented, generatable contract instead of something hand-copied by eye into `palabatu-fe`'s types (which is how it worked before this existed) — and so a future second client (the Phase 4 React Native app, see ROADMAP.md) has a real spec to generate against instead of a third copy of hand-guessed types.

Rules for every new or changed endpoint:
- **Named types only** — every request body and every non-trivial response is a named Go struct (in that domain's `dto.go` if it has one, e.g. `internal/auth/dto.go`/`internal/problems/dto.go`, otherwise declared inline near the top of `handler.go`). Never bind into an anonymous `var body struct{...}`, never respond with a bare `gin.H{...}`.
- **Shared response envelopes** live in `internal/apitypes` (sibling of `internal/middleware`/`internal/authz`, same one-way-import shape — domains import it, it imports nothing domain-specific): `apitypes.ErrorResponse{Error string}` for every non-2xx body, `apitypes.SuccessResponse{Success bool}` for plain "it worked" responses, `apitypes.MessageResponse{Message string}` for a human-readable confirmation, `apitypes.CountResponse{Count int}` for a bare count. Reach for a domain-local named type instead only when the shape is genuinely domain-specific.
- **Every handler gets a swag doc comment** directly above it: `@Summary`, `@Tags <domain>`, `@Accept`/`@Produce` as applicable, `@Param` per path/query/body/formData parameter, `@Success`/`@Failure` per response, `@Router <path> [method]`, and `@Security BearerAuth` iff the route is wrapped in `middleware.RequireAuth`.
- **Route mounting** stays as-is: the `/auth` group for auth's own routes (`auth.AuthRoutes`), the `/api` group (`apiGroup`) for everything else including `auth.ProfileRoutes`.
- **Public (no-auth) endpoints that accept user input** get the existing `middleware.RateLimit(...)` pattern, per the precedent in `waitlist`, `auth`'s signup/signin/forgot-password/reset-password, and `social.handleCreateComment`.
- After changing any handler's request/response shape or annotations, run `.\scripts\gen-api-docs.ps1` (wraps `swag init` with this repo's required flags — see below) and commit the regenerated `palabatu-be/docs/swagger.json` alongside the code change.

```powershell
.\scripts\gen-api-docs.ps1
```

Requires the swag v2 CLI once per machine: `go install github.com/swaggo/swag/v2/cmd/swag@v2.0.0-rc5` (installs to `%GOPATH%\bin`, already on PATH per the `migrate` precedent above). `swag` is a codegen tool only — it never touches `go.mod`/`go.sum`.

- Pinned at `v2.0.0-rc5` deliberately: swag's stable v1 line only emits Swagger 2.0, and swag v2 (native OpenAPI 3.1 output, via `swag init`'s `--v3.1` flag) is still a release candidate, not GA. Expect to bump the pin occasionally as it stabilizes.
- **Known upstream limitation** (swaggo/swag [#1933](https://github.com/swaggo/swag/issues/1933), open as of this writing): a `formData file` param's schema lands under the wrong content-type key in `--v3.1` output — `multipart/form-data`'s schema comes out as an empty object, with the real `type: file` schema misplaced under `application/x-www-form-urlencoded`. Affects `POST /upload/topo` and `POST /upload/avatar` only; the `@Accept multipart/form-data`/`@Param ... formData file` annotations are still correct, and the actual endpoints are unaffected — this is a spec-generation cosmetic issue, not a runtime behavior change. Don't "fix" it with non-standard annotations; revisit once swag v2 addresses the upstream issue.
- No route serves the spec itself (no Swagger UI, no `/swagger.json` endpoint) — this is deliberately just a committed artifact for other tooling to generate against, not a live docs page.

### Frontend consumption

`palabatu-fe` generates TypeScript types from the committed spec rather than hand-copying shapes by eye:

```powershell
npm run gen:types   # openapi-typescript ../palabatu-be/docs/swagger.json -o ./src/types/api.d.ts
```

Run it (from `palabatu-fe/`) after any backend handler shape/annotation change lands and `docs/swagger.json` is regenerated, and commit the resulting `palabatu-fe/src/types/api.d.ts`.

- `src/lib/api.ts`'s `get`/`post`/`put`/`upload`/`delete` all take a **required** generic (`api.get<T>(path)`, no default) — every call site in the codebase supplies a real `T` as of 2026-08-01, so a missing type argument is a compile error, not a silent `any`. (Earlier in the migration this briefly defaulted to `T = any` so untyped call sites could be converted incrementally instead of all at once; once every call site was converted, the default was removed specifically so a future call site can't quietly skip typing — see git history around 2026-08-01 if you need the reasoning.) Where a call's success payload genuinely isn't used by anyone (e.g. a fire-and-forget mutation), that's still a real type — either `Partial<ErrorResponse>` (only the error path is checked) or `unknown` (the result is fully discarded) — never `any`.
- **`api.d.ts` is not imported directly by call sites.** It's all-optional by construction (swag doesn't emit `required`, and doesn't model Go pointer-vs-value nullability), so using it raw would force defensive optional-chaining everywhere a field is actually guaranteed. Instead, each domain has a small hand-written mirror type in `src/types/` (`problem.ts`, `social.ts`, `report.ts`, `apitypes.ts` mirroring `internal/apitypes`, etc.) — named after and doc-commented with a pointer to the Go struct and the generated schema name it mirrors, with optionality/nullability resolved against the actual Go field types (no `omitempty` → always present; `*T` → `| null`), not guessed. Add new response/request shapes there, colocated by domain, rather than declaring a local `type X = {...}` inside a page or component file.
- **Check `src/types/` before hand-writing a type.** A local one-off redefinition of an entity that already has a shared type is exactly the drift this setup exists to prevent (see git history around 2026-08-01 for a case where `ProblemRow` had drifted into two conflicting local definitions, and `Comment` was independently redefined verbatim in two files).
- Where a call site never reads the success payload (only checks for a possible error), type it narrowly as `Partial<ErrorResponse>` rather than fabricating unused precision.

## Environment variables

- `palabatu-fe/.env`: `VITE_API_URL` (backend base URL), `VITE_OWNER_EMAIL` (gates the Developer nav link's visibility only — the real enforcement is backend-side, see `OWNER_USER_ID` below).
- `palabatu-be/.env`: `PORT`, `DATABASE_URL` (Postgres), `JWT_SECRET`, `OWNER_USER_ID` (the single `users.id` allowed to call `/api/dev/*`, see `middleware.RequireOwner`), Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), email credentials — see `palabatu-be/environments/.env.example`, loaded via `godotenv`.

## Architecture

**Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Routing is a flat `<Routes>` tree in [palabatu-fe/src/App.tsx](palabatu-fe/src/App.tsx). Pages live in `src/pages/`, shared UI in `src/components/`. Map view (`src/pages/Map.tsx`) uses React Leaflet with marker clustering.

Product context (users, positioning, brand commitments) and the visual design system (palette, typography, component patterns, do's/don'ts) live in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) at the repo root, not duplicated here — check them before making product-shape or visual-design decisions. The `impeccable` skill (`.claude/skills/impeccable/`) reads both automatically for its own commands; consult them directly for any other frontend/design work.

When writing or editing CSS/Tailwind (layout, spacing, breakpoints, component styles), always design for responsiveness — check behavior at mobile widths as well as desktop, not just the viewport you're eyeballing. This app is used as an installable PWA on phones, so mobile is a primary target, not an afterthought.

**Auth**: JWT-based, not Supabase (Supabase Auth UI packages are installed but the actual flow is custom JWT). `src/lib/AuthContext.tsx` provides `user`, `handleLogin`, `handleSignup`, `handleLogout`, and a toast helper; on mount it validates any stored token via `GET /auth/session`. Token is stored in `localStorage` under the key `token`.

**API client** ([palabatu-fe/src/lib/api.ts](palabatu-fe/src/lib/api.ts)): a thin fetch wrapper (`api.get/post/put/upload/delete`) that attaches `Authorization: Bearer <token>` from `localStorage` on every call and returns the parsed JSON body directly (not a `{ data, error }` envelope — some dead code in `App.tsx`'s unused `Home()` still destructures that shape; don't copy that pattern).

**Backend** (`palabatu-be/`, Go): uses `gin` for routing, `pgx/v5` (`pgxpool`) for Postgres, `golang-jwt/jwt/v5` for auth, `gin-contrib/cors` for CORS, `godotenv` for env loading, `cloudinary-go/v2` for image uploads, `prometheus/client_golang` for metrics.

```
palabatu-be/
├── cmd/api/main.go          # entrypoint: env load, DB connect, Cloudinary connect, router mount, listen
├── internal/
│   ├── db/db.go             # pgxpool.Pool singleton
│   ├── cloudinary/cloudinary.go # upload-to-folder + destroy-by-URL
│   ├── metrics/metrics.go   # Prometheus HTTP request-count/duration middleware, exposed at GET /metrics
│   ├── mailer/mailer.go     # SMTP sender (no emoji, see global style rule)
│   ├── middleware/auth.go   # RequireAuth (JWT) gin middleware + UserFromContext
│   ├── authz/authz.go       # stateless admin-role policy: IsAdmin(titles), CanEditProblem(userID, createdBy, titles).
│   │                        # Takes already-fetched data as args — never reaches into another domain's repository,
│   │                        # so problems/social/auth -> authz stays one-way with no import cycle possible.
│   ├── auth/                # users, sessions, JWT issuance/verification, signup/signin, email verification,
│   │   │                    # password reset, and profiles (profiles.title is an authz concern, so Profile lives here).
│   │   ├── handler.go       # AuthRoutes(rg) mounted at /auth; ProfileRoutes(rg) mounted at /api (GET/PUT /profiles/:id)
│   │   ├── service.go       # Signup/Signin/Session/VerifyEmail/ForgotPassword/ResetPassword/GetProfile/UpsertProfile
│   │   ├── repository.go    # `users` + `profiles` table queries; GetUserTitles() exported for internal/problems
│   │   └── errors.go        # ErrEmailExists, ErrInvalidCredentials, ErrNotVerified, ErrInvalidToken, etc.
│   ├── problems/            # map spots/routes, problem CRUD, image uploads, "Founder" (creator) authorization,
│   │   │                    # topo photo annotation (drawn route lines/holds)
│   │   ├── handler.go       # Routes(rg) mounted at /api — /problems, /upload/topo, /upload/avatar, /problems/:id/annotations
│   │   ├── upload.go        # handleUpload multipart parsing, shared by topo/avatar handlers
│   │   ├── service.go       # ListProblems/CreateProblem/UpdateProblem/DeleteProblem; authorizeProblemEdit fetches
│   │   │                    # titles via auth.GetUserTitles() then defers the decision to authz.CanEditProblem
│   │   ├── annotation.go / annotation_repository.go / annotation_handler.go
│   │   │                    # ListAnnotations/SaveAnnotation for `topo_annotations` (one vector-shape overlay per
│   │   │                    # problem image, keyed by (problem_id, image_url) since images have no per-row id — same
│   │   │                    # precedent as `report`'s image reports); reuses authorizeProblemEdit/getProblemOwnerAndImages
│   │   │                    # verbatim rather than being a separate domain, since it never reaches into another package
│   │   ├── repository.go    # `problems` table queries
│   │   └── errors.go        # ErrNotFound, ErrForbidden
│   ├── social/               # sends (ticks) and comments today; likes/follows if those get added later
│   │   ├── handler.go        # Routes(rg) mounted at /api — send-status/send, comments
│   │   ├── service.go        # HasSent/ToggleSend/ListComments/CreateComment
│   │   ├── repository.go     # `sends` + `comments` table queries
│   │   └── errors.go         # ErrEmptyComment
│   └── devtools/             # owner-only Developer page: fixed data export, analytics, tester-flag management.
│       │                     # Every route is behind middleware.RequireAuth + middleware.RequireOwner (OWNER_USER_ID
│       │                     # env var compared against AuthUser.ID) — not an authz role, since this is one account,
│       │                     # not a community tier others can hold.
│       ├── handler.go        # Routes(rg) mounted at /api/dev/* — export/:table, analytics, testers/search, testers/:id/toggle
│       ├── service.go        # Export/GetAnalytics/SearchTesterCandidates/ToggleTester
│       ├── repository.go     # Reads directly from users/problems/sends/comments/reports (own SQL, no cross-domain
│       │                     # repository calls), mirroring auth.getProfileStats' precedent for the same reasoning
│       └── errors.go         # ErrInvalidTable, ErrNotFound
```

- Domain package convention (executed 2026-07-09, replacing a `handler`/`service`/`repository`-by-technical-layer split — see git history before that commit if you need the old shape): each domain (`auth`, `problems`, `social`) is one package holding its own `handler.go`/`service.go`/`repository.go`. Within a domain, repository-tier functions are unexported (lowercase) since they're now pure implementation detail of that package; service-tier functions stay exported only where the handler in the same file needs them or another domain calls in (e.g. `auth.GetUserTitles`). Handlers should stay thin (request parsing + response writing); business rules belong in the service-tier functions; raw SQL belongs in the repository-tier functions. This is a modular monolith (one binary, one `pgxpool`, one deploy) — not separate network-separated services, which aren't warranted at current scale.
- The CORS allowlist in `cmd/api/main.go` intentionally omits a literal `"*"` origin entry — in `gin-contrib/cors`, `"*"` means "allow all origins," which would contradict the explicit-allowlist policy. Add new LAN IPs (used for testing on a phone during dev) directly to that list — don't switch to a wildcard-only policy.
- `GET /session` is wrapped with `middleware.RequireAuth` (passed as an extra handler in the `rg.GET("/session", middleware.RequireAuth, handleSession)` chain) rather than duplicating JWT parsing inline — same secret, same verification, one code path.
- `main.go` builds one `*gin.RouterGroup` per mount point (`r.Group("/auth")`, `r.Group("/api")`) and passes each to every domain's route-registration function that needs it — e.g. both `auth.ProfileRoutes` and `problems.Routes` and `social.Routes` all register onto the same `/api` group.
- Prometheus: `internal/metrics.Middleware` (registered via `r.Use`) records `http_requests_total` and `http_request_duration_seconds`, labeled by method, matched route pattern (`c.FullPath()`, e.g. `/problems/:id` — not the raw path, to keep cardinality bounded), and status. `GET /metrics` serves `promhttp.Handler()` (wrapped via `gin.WrapH`) for a Prometheus server to scrape. No business/domain metrics yet, just HTTP-layer instrumentation.
- `auth.User.Password` and `.IsVerified` are tagged `json:"-"` so the struct can be serialized directly as an API response (used by `/session` and `/signin`) without ever leaking the password hash.
- User-facing error strings (e.g. `"Invalid credentials"`, `"Email registered but not verified"`) are hardcoded at the handler layer with the exact casing `palabatu-fe`'s `AuthContext.tsx` expects (it displays `data.error` directly in a toast) — Go's own `error.Error()` strings stay lowercase/idiomatic and are not surfaced to users.
- `auth.Signup` requires `email`, `username`, and `password` to be non-empty and `terms_accepted` to be `true` (`ErrMissingFields`/`ErrTermsNotAccepted`), then creates the `users` row and its `profiles` row together in one DB transaction (`insertUserAndProfile` in `repository.go`) — a profile exists from the moment of signup rather than being created lazily on first edit (see `GetProfile`'s doc comment for the pre-existing-account fallback this replaced). `createUser` distinguishes the `users_email_key` and `users_username_key` constraint violations, returning `ErrEmailExists`/`ErrUsernameExists` respectively, so a username collision no longer gets misreported as "email already exists" — that conflation was tolerable back when username was silently derived from the email's local part, but stopped being tenable once `palabatu-fe`'s signup form made username a real, user-typed, user-facing field. If the verification email fails to send, the whole signup (user + profile) is rolled back via `deleteUser`, relying on `profiles_id_fkey`'s `ON DELETE CASCADE` (migrations/0003) to take the profile row with it.
- `users.terms_accepted_at` (migrations/0009) records ToS/privacy-policy consent at signup — relevant given Indonesia's UU PDP personal-data-protection law. Nullable at the DB level (existing pre-migration accounts have no value and were never asked); enforcement that new signups must accept happens in `auth.Signup`, not via a NOT NULL constraint.
- `internal/cloudinary.DestroyByURL` re-derives a Cloudinary `public_id` from a stored secure URL (strip up to `/upload/`, drop a `vNNN/` version segment, drop the extension) and calls `Upload.Destroy`. `problems.DeleteProblem` calls it once per `image_urls` entry, best-effort (a destroy failure is logged, not fatal).
- Cloudinary CDN caveat learned while testing the delete path: destroying an asset removes it from Cloudinary's asset store immediately (verified via the Admin API), but a previously-fetched delivery URL can keep returning `200` from CDN edge cache for a while afterward. Don't use "can I still GET the old URL" as a signal that cleanup failed — check the Admin API (or just trust `Destroy`'s returned `Result`) instead.
- `auth.Profile.Title` and `.Tags` are `json.RawMessage`, passed through opaquely rather than typed: `tags` is a frontend-defined shape (`{ level, styles }`), and `title` is a JSON array of role strings but has legacy rows that aren't. `auth.GetUserTitles()` is the one place that actually parses `title`; any non-array or missing profile yields `[]` rather than an error.
- `cmd/api/main.go` strips trailing slashes ahead of every route (its own `stripTrailingSlash` wrapper, applied around the whole `*gin.Engine` at the `http.ListenAndServe` call — not as a `r.Use()` middleware): `palabatu-fe` actually calls `POST /api/upload/avatar/` with a trailing slash. It has to wrap the raw `http.Handler` rather than run as gin middleware because gin resolves routes (and would otherwise 301/307-redirect a trailing slash) before any `r.Use()` middleware executes — and a redirected POST is fragile across CORS (body replay, extra preflight).
- Problem authorization model (`problems.authorizeProblemEdit` in `problems/service.go`, policy in `internal/authz`):
  - **Creating** a problem (`POST /problems`) has no role gate — any logged-in user can add one, for now.
  - **Editing/deleting** a problem is allowed for two groups: admins, whose `profiles.title` includes `'Council'` or `'Associate'` (`authz.IsAdmin`), who can CRUD *any* problem; and that problem's own creator (its "Founder"), who can only CRUD the problem(s) they added (`authz.CanEditProblem`).
- Topo photo annotation (drawing route lines/holds on a problem's photo): shared frontend components live in `palabatu-fe/src/components/topo-annotations/` (`TopoImage` read-only viewer, `TopoAnnotationEditor` drawing modal, `TopoAnnotationOverlay` the shared SVG renderer used by both, `useContainRect` the geometry hook) and are imported by both `ProblemDetails.tsx` and `ProblemDetailPage.tsx`. Shapes are stored as coordinates normalized to the image's natural width/height (radius/strokeWidth normalized against width for *both* axes, so a circle stays circular regardless of photo aspect ratio) — see `palabatu-fe/src/types/annotation.ts`. `useContainRect` measures the rendered `<img>` box directly via `getBoundingClientRect()` rather than trusting `naturalWidth`/`naturalHeight` math, because those don't reliably match what the browser actually paints for every real-world (often EXIF-oriented) photo.
- **lucide-react icons inside a `display:flex`/`inline-flex` parent can render at 0 width** (confirmed repeatedly live via `getComputedStyle` — height resolves correctly but width resolves to `0px` — despite correct SVG markup, `currentColor`, and computed `color`) — a real, reproducible rendering bug in this app's environment, not a hypothetical. Any icon that is a child of a flex-display element (inline `style={{display:'flex'}}`, Tailwind `flex`/`inline-flex` classes, or a CSS class rule) needs an explicit `flexShrink:0` (inline) / `shrink-0` (Tailwind) / `flex-shrink: 0` (CSS rule) on the icon itself. `tsc`/`eslint` passing is never sufficient evidence a new icon-in-a-flex-button actually renders — visually verify (screenshot or live) any new one.

## Known WIP rough edges

- `App.tsx` has an unused `Home()`/`About()` component pair left over from an earlier Supabase-based setup — not wired into any route.
- `req.user`-equivalent context on the backend has no shared typed augmentation yet beyond `middleware.UserFromContext`.
