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
│   ├── authz/authz.go       # stateless admin-role policy: IsAdmin(titles), CanEditProblem(userID, createdBy, titles).
│   │                        # Takes already-fetched data as args — never reaches into another domain's repository,
│   │                        # so problems/social/auth -> authz stays one-way with no import cycle possible.
│   ├── auth/                # users, sessions, JWT issuance/verification, signup/signin, email verification,
│   │   │                    # password reset, and profiles (profiles.title is an authz concern, so Profile lives here).
│   │   ├── handler.go       # AuthRoutes(rg) mounted at /auth; ProfileRoutes(rg) mounted at /api (GET/PUT /profiles/:id)
│   │   ├── service.go       # Signup/Signin/Session/VerifyEmail/ForgotPassword/ResetPassword/GetProfile/UpsertProfile
│   │   ├── repository.go    # `users` + `profiles` table queries; GetUserTitles() exported for internal/problems
│   │   └── errors.go        # ErrEmailExists, ErrInvalidCredentials, ErrNotVerified, ErrInvalidToken, etc.
│   ├── problems/            # map spots/routes, problem CRUD, image uploads, "Founder" (creator) authorization
│   │   ├── handler.go       # Routes(rg) mounted at /api — /problems, /upload/topo, /upload/avatar
│   │   ├── upload.go        # handleUpload multipart parsing, shared by topo/avatar handlers
│   │   ├── service.go       # ListProblems/CreateProblem/UpdateProblem/DeleteProblem; authorizeProblemEdit fetches
│   │   │                    # titles via auth.GetUserTitles() then defers the decision to authz.CanEditProblem
│   │   ├── repository.go    # `problems` table queries
│   │   └── errors.go        # ErrNotFound, ErrForbidden
│   └── social/               # sends (ticks) and comments today; likes/follows if those get added later
│       ├── handler.go        # Routes(rg) mounted at /api — send-status/send, comments
│       ├── service.go        # HasSent/ToggleSend/ListComments/CreateComment
│       ├── repository.go     # `sends` + `comments` table queries
│       └── errors.go         # ErrEmptyComment
```

- Domain package convention (this replaced a `handler`/`service`/`repository`-by-technical-layer split — see git history before commit that executed [palabatu-be/docs/domain-restructure.md](palabatu-be/docs/domain-restructure.md) if you need the old shape): each domain (`auth`, `problems`, `social`) is one package holding its own `handler.go`/`service.go`/`repository.go`. Within a domain, repository-tier functions are unexported (lowercase) since they're now pure implementation detail of that package; service-tier functions stay exported only where the handler in the same file needs them or another domain calls in (e.g. `auth.GetUserTitles`). Handlers should stay thin (request parsing + response writing); business rules belong in the service-tier functions; raw SQL belongs in the repository-tier functions. This is a modular monolith (one binary, one `pgxpool`, one deploy) — not separate services; see the restructure doc for why splitting into actual network-separated services isn't warranted at current scale.
- The CORS allowlist in `cmd/api/main.go` intentionally omits a literal `"*"` origin entry — in `gin-contrib/cors`, `"*"` means "allow all origins," which would contradict the explicit-allowlist policy. Add new LAN IPs (used for testing on a phone during dev) directly to that list — don't switch to a wildcard-only policy.
- `GET /session` is wrapped with `middleware.RequireAuth` (passed as an extra handler in the `rg.GET("/session", middleware.RequireAuth, handleSession)` chain) rather than duplicating JWT parsing inline — same secret, same verification, one code path.
- `main.go` builds one `*gin.RouterGroup` per mount point (`r.Group("/auth")`, `r.Group("/api")`) and passes each to every domain's route-registration function that needs it — e.g. both `auth.ProfileRoutes` and `problems.Routes` and `social.Routes` all register onto the same `/api` group.
- Prometheus: `internal/metrics.Middleware` (registered via `r.Use`) records `http_requests_total` and `http_request_duration_seconds`, labeled by method, matched route pattern (`c.FullPath()`, e.g. `/problems/:id` — not the raw path, to keep cardinality bounded), and status. `GET /metrics` serves `promhttp.Handler()` (wrapped via `gin.WrapH`) for a Prometheus server to scrape. No business/domain metrics yet, just HTTP-layer instrumentation.
- `auth.User.Password` and `.IsVerified` are tagged `json:"-"` so the struct can be serialized directly as an API response (used by `/session` and `/signin`) without ever leaking the password hash.
- User-facing error strings (e.g. `"Invalid credentials"`, `"Email registered but not verified"`) are hardcoded at the handler layer with the exact casing `palabatu-fe`'s `AuthContext.tsx` expects (it displays `data.error` directly in a toast) — Go's own `error.Error()` strings stay lowercase/idiomatic and are not surfaced to users.
- `auth.Signup` treats *any* `createUser` failure as "email already exists" (400) — a deliberately preserved quirk (its catch-all doesn't distinguish a unique-constraint violation from other DB errors), not a bug.
- `internal/cloudinary.DestroyByURL` re-derives a Cloudinary `public_id` from a stored secure URL (strip up to `/upload/`, drop a `vNNN/` version segment, drop the extension) and calls `Upload.Destroy`. `problems.DeleteProblem` calls it once per `image_urls` entry, best-effort (a destroy failure is logged, not fatal).
- Cloudinary CDN caveat learned while testing the delete path: destroying an asset removes it from Cloudinary's asset store immediately (verified via the Admin API), but a previously-fetched delivery URL can keep returning `200` from CDN edge cache for a while afterward. Don't use "can I still GET the old URL" as a signal that cleanup failed — check the Admin API (or just trust `Destroy`'s returned `Result`) instead.
- `auth.Profile.Title` and `.Tags` are `json.RawMessage`, passed through opaquely rather than typed: `tags` is a frontend-defined shape (`{ level, styles }`), and `title` is a JSON array of role strings but has legacy rows that aren't. `auth.GetUserTitles()` is the one place that actually parses `title`; any non-array or missing profile yields `[]` rather than an error.
- `cmd/api/main.go` strips trailing slashes ahead of every route (its own `stripTrailingSlash` wrapper, applied around the whole `*gin.Engine` at the `http.ListenAndServe` call — not as a `r.Use()` middleware): `palabatu-fe` actually calls `POST /api/upload/avatar/` with a trailing slash. It has to wrap the raw `http.Handler` rather than run as gin middleware because gin resolves routes (and would otherwise 301/307-redirect a trailing slash) before any `r.Use()` middleware executes — and a redirected POST is fragile across CORS (body replay, extra preflight).
- Problem authorization model (`problems.authorizeProblemEdit` in `problems/service.go`, policy in `internal/authz`):
  - **Creating** a problem (`POST /problems`) has no role gate — any logged-in user can add one, for now.
  - **Editing/deleting** a problem is allowed for two groups: admins, whose `profiles.title` includes `'Council'` or `'Associate'` (`authz.IsAdmin`), who can CRUD *any* problem; and that problem's own creator (its "Founder"), who can only CRUD the problem(s) they added (`authz.CanEditProblem`).

## Known WIP rough edges

- `App.tsx` has an unused `Home()`/`About()` component pair left over from an earlier Supabase-based setup — not wired into any route.
- `req.user`-equivalent context on the backend has no shared typed augmentation yet beyond `middleware.UserFromContext`.
