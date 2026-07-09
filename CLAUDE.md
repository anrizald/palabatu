# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Palabatu — a community web app for Indonesian bouldering enthusiasts (interactive spot map, climber profiles, route/problem listings). Live at https://palabatu.id. Status: work in progress.

## Repo layout: two independent projects

The frontend (`palabatu-fe/`) and the backend (`palabatu-be/`) are **separate projects** — separate dependency managers and no shared config. Install and run each independently.

`palabatu-be/` is a Go rewrite of what was originally a Node/Express backend. The Node backend has been fully retired and removed from this repo — `palabatu-be/` (Go) is now the only backend and the one that serves https://palabatu.id.

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

There is no test suite configured in either project (no test script/runner in the frontend, no `_test.go` files yet in the backend). Don't assume Vitest/`go test` coverage exists — check before referencing test commands.

Both `palabatu-fe/` and `palabatu-be/` must run simultaneously for the app to work end to end. Vite proxies `/api` and `/auth` to `http://localhost:3001` in dev ([palabatu-fe/vite.config.ts](palabatu-fe/vite.config.ts)), and `palabatu-fe/src/lib/api.ts` falls back to `VITE_API_URL` or `http://localhost:3001` otherwise.

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

## Environment variables

- `palabatu-fe/.env`: `VITE_API_URL` (backend base URL).
- `palabatu-be/.env`: `PORT`, `DATABASE_URL` (Postgres), `JWT_SECRET`, Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), email credentials — see `palabatu-be/environments/.env.example`, loaded via `godotenv`.

## Architecture

**Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Routing is a flat `<Routes>` tree in [palabatu-fe/src/App.tsx](palabatu-fe/src/App.tsx). Pages live in `src/pages/`, shared UI in `src/components/`. Map view (`src/pages/Map.tsx`) uses React Leaflet with marker clustering.

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
│   ├── handler/             # HTTP layer: parses requests, calls service. Handlers take
│   │   │                    # *gin.Context directly and use c.JSON/c.ShouldBindJSON.
│   │   ├── auth.go          # AuthRoutes(rg), mounted at /auth — signup/signin/session/verify-email/forgot-password/reset-password
│   │   ├── api.go           # APIRoutes(rg), mounted at /api — router wiring only
│   │   ├── problem.go       # /problems handlers (list/create/update/delete)
│   │   ├── profile.go       # /profiles handlers (get/upsert)
│   │   ├── interaction.go   # /problems/:id/send*, /problems/:id/comments handlers
│   │   └── upload.go        # /upload/topo, /upload/avatar handlers
│   ├── service/
│   │   ├── auth.go          # auth business logic, called by handler/auth.go
│   │   ├── problem.go       # problem CRUD + admin/Founder authorization, Cloudinary cleanup on delete
│   │   ├── profile.go       # profile get/upsert
│   │   ├── send.go          # send toggle/status
│   │   └── comment.go       # comment list/create
│   └── repository/
│       ├── user.go          # `users` table queries, called by service/auth.go
│       ├── problem.go       # `problems` table queries
│       ├── profile.go       # `profiles` table queries + GetUserTitles()
│       ├── send.go          # `sends` table queries
│       └── comment.go       # `comments` table queries
```

- Layering convention: `handler` → `service` → `repository` → `internal/db`. Handlers should stay thin (request parsing + response writing); business rules belong in `service`; raw SQL belongs in `repository`.
- The CORS allowlist in `cmd/api/main.go` intentionally omits a literal `"*"` origin entry — in `gin-contrib/cors`, `"*"` means "allow all origins," which would contradict the explicit-allowlist policy. Add new LAN IPs (used for testing on a phone during dev) directly to that list — don't switch to a wildcard-only policy.
- `GET /session` is wrapped with `middleware.RequireAuth` (passed as an extra handler in the `rg.GET("/session", middleware.RequireAuth, handleSession)` chain) rather than duplicating JWT parsing inline — same secret, same verification, one code path.
- `AuthRoutes`/`APIRoutes` take a `*gin.RouterGroup` (from `r.Group("/auth")` / `r.Group("/api")` in `main.go`) and register routes on it directly, rather than returning a sub-router to `Mount`.
- Prometheus: `internal/metrics.Middleware` (registered via `r.Use`) records `http_requests_total` and `http_request_duration_seconds`, labeled by method, matched route pattern (`c.FullPath()`, e.g. `/problems/:id` — not the raw path, to keep cardinality bounded), and status. `GET /metrics` serves `promhttp.Handler()` (wrapped via `gin.WrapH`) for a Prometheus server to scrape. No business/domain metrics yet, just HTTP-layer instrumentation.
- `repository.User.Password` and `.IsVerified` are tagged `json:"-"` so the struct can be serialized directly as an API response (used by `/session` and `/signin`) without ever leaking the password hash.
- User-facing error strings (e.g. `"Invalid credentials"`, `"Email registered but not verified"`) are hardcoded at the handler layer with the exact casing `palabatu-fe`'s `AuthContext.tsx` expects (it displays `data.error` directly in a toast) — Go's own `error.Error()` strings stay lowercase/idiomatic and are not surfaced to users.
- `service.Signup` treats *any* `CreateUser` failure as "email already exists" (400) — a deliberately preserved quirk (its catch-all doesn't distinguish a unique-constraint violation from other DB errors), not a bug.
- `internal/cloudinary.DestroyByURL` re-derives a Cloudinary `public_id` from a stored secure URL (strip up to `/upload/`, drop a `vNNN/` version segment, drop the extension) and calls `Upload.Destroy`. `service.DeleteProblem` calls it once per `image_urls` entry, best-effort (a destroy failure is logged, not fatal).
- Cloudinary CDN caveat learned while testing the delete path: destroying an asset removes it from Cloudinary's asset store immediately (verified via the Admin API), but a previously-fetched delivery URL can keep returning `200` from CDN edge cache for a while afterward. Don't use "can I still GET the old URL" as a signal that cleanup failed — check the Admin API (or just trust `Destroy`'s returned `Result`) instead.
- `repository.Profile.Title` and `.Tags` are `json.RawMessage`, passed through opaquely rather than typed: `tags` is a frontend-defined shape (`{ level, styles }`), and `title` is a JSON array of role strings but has legacy rows that aren't. `repository.GetUserTitles()` is the one place that actually parses `title`; any non-array or missing profile yields `[]` rather than an error.
- `cmd/api/main.go` strips trailing slashes ahead of every route (its own `stripTrailingSlash` wrapper, applied around the whole `*gin.Engine` at the `http.ListenAndServe` call — not as a `r.Use()` middleware): `palabatu-fe` actually calls `POST /api/upload/avatar/` with a trailing slash. It has to wrap the raw `http.Handler` rather than run as gin middleware because gin resolves routes (and would otherwise 301/307-redirect a trailing slash) before any `r.Use()` middleware executes — and a redirected POST is fragile across CORS (body replay, extra preflight).
- Problem authorization model (`service.authorizeProblemEdit` in `service/problem.go`):
  - **Creating** a problem (`POST /problems`) has no role gate — any logged-in user can add one, for now.
  - **Editing/deleting** a problem is allowed for two groups: admins, whose `profiles.title` includes `'Council'` or `'Associate'` (`service.adminTitles`), who can CRUD *any* problem; and that problem's own creator (its "Founder"), who can only CRUD the problem(s) they added.

## Known WIP rough edges

- `App.tsx` has an unused `Home()`/`About()` component pair left over from an earlier Supabase-based setup — not wired into any route.
- `req.user`-equivalent context on the backend has no shared typed augmentation yet beyond `middleware.UserFromContext`.
- A domain-oriented restructure of `internal/` (slicing by feature instead of by technical layer) is sketched in [palabatu-be/docs/domain-restructure.md](palabatu-be/docs/domain-restructure.md) — proposed, not started.
