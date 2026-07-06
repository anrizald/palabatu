# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Palabatu — a community web app for Indonesian bouldering enthusiasts (interactive spot map, climber profiles, route/problem listings). Live at https://palabatu.id. Status: work in progress.

## Repo layout: three independent projects

The frontend (`palabatu-fe/`), the live backend (`palabatu-be/`), and an in-progress Go rewrite of the backend (`palabatu-be-go/`) are **separate projects** — separate dependency managers and no shared config. Install and run each independently. `palabatu-fe/` uses `"type": "module"` (ESM, `verbatimModuleSyntax`); `palabatu-be/` uses `"type": "commonjs"`. Don't assume settings from one apply to another.

`palabatu-be-go/` is **not yet in production use** — it's being built incrementally alongside `palabatu-be/` (see "Go backend rewrite" below). `palabatu-be/` remains the backend that actually serves https://palabatu.id until the port is complete.

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
cd palabatu-be && npm install
npm run dev       # ts-node-dev --respawn index.ts, http://localhost:3001
```

Go backend (`palabatu-be-go/`, WIP):
```sh
cd palabatu-be-go
go run ./cmd/api   # http://localhost:3001 (default PORT)
go build ./cmd/api # compiles a binary
go vet ./...
```

There is no test suite configured in any of the three projects (no test script/runner in the Node projects, no `_test.go` files yet in the Go one). Don't assume Jest/Vitest/`go test` coverage exists — check before referencing test commands.

Both `palabatu-fe/` and `palabatu-be/` must run simultaneously for the live app to work end to end. Vite proxies `/api` and `/auth` to `http://localhost:3001` in dev ([palabatu-fe/vite.config.ts](palabatu-fe/vite.config.ts)), and `palabatu-fe/src/lib/api.ts` falls back to `VITE_API_URL` or `http://localhost:3001` otherwise. `palabatu-be-go/` binds to the same port/routes, so it's a drop-in target for the frontend once ported — don't run both backends on port 3001 at once.

## Database migrations (`migrations/`)

Schema lives in `migrations/` as numbered `golang-migrate`-style pairs (`000N_name.up.sql` / `000N_name.down.sql`), applied via the `migrate` CLI (`go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`, installed to `%GOPATH%\bin`, e.g. `C:\Users\dede\go\bin`, which is on PATH).

Day-to-day, use [scripts/db.ps1](scripts/db.ps1) instead of calling `migrate` directly — it reads `DATABASE_URL` from `palabatu-be-go/.env` (so no `PGPASSWORD`/URL-typing ceremony), converts the `migrations` path to forward slashes (raw Windows backslashes break `migrate`'s internal `file://` URL parsing — `C:\...` gets misread as a host:port), and refuses to run at all if that `.env` points at a `neon.tech` host:

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
- **Never run `migrate ... down` against the production `DATABASE_URL`** (the one in `palabatu-be/.env`) — it drops tables. Point at a local Postgres instance for testing the up/down cycle. `scripts/db.ps1` enforces this automatically.
- `golang-migrate`'s postgres driver (v4.19.1) registers itself for both the `postgres://` and `postgresql://` URI schemes, so Neon's connection strings work unmodified — no prefix-swapping needed.

## Environment variables

- `palabatu-fe/.env`: `VITE_API_URL` (backend base URL).
- `palabatu-be/.env`: `PORT`, `DATABASE_URL` (Postgres), `JWT_SECRET`, Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), Nodemailer/email credentials.
- `palabatu-be-go/.env`: same variable names as `palabatu-be/.env` (see `palabatu-be-go/environments/.env.example`), loaded via `godotenv`.

## Architecture

**Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Routing is a flat `<Routes>` tree in [palabatu-fe/src/App.tsx](palabatu-fe/src/App.tsx). Pages live in `src/pages/`, shared UI in `src/components/`. Map view (`src/pages/Map.tsx`) uses React Leaflet with marker clustering.

**Auth**: JWT-based, not Supabase (Supabase Auth UI packages are installed but the actual flow is custom JWT). `src/lib/AuthContext.tsx` provides `user`, `handleLogin`, `handleSignup`, `handleLogout`, and a toast helper; on mount it validates any stored token via `GET /auth/session`. Token is stored in `localStorage` under the key `token`.

**API client** ([palabatu-fe/src/lib/api.ts](palabatu-fe/src/lib/api.ts)): a thin fetch wrapper (`api.get/post/put/upload/delete`) that attaches `Authorization: Bearer <token>` from `localStorage` on every call and returns the parsed JSON body directly (not a `{ data, error }` envelope — some dead code in `App.tsx`'s unused `Home()` still destructures that shape; don't copy that pattern).

**Backend**: Express 5 app ([palabatu-be/index.ts](palabatu-be/index.ts)) mounting two routers: `routes/auth.ts` at `/auth` and `routes/api.ts` at `/api`. CORS origins are an explicit hardcoded list in `index.ts` (includes LAN IPs used for testing on a phone during dev — add new LAN IPs there if needed, don't switch to a wildcard-only policy).

- `requireAuth` middleware ([palabatu-be/middleware/auth.ts](palabatu-be/middleware/auth.ts)) verifies the JWT and attaches the decoded payload as `req.user` (untyped, cast with `as any` at call sites).
- No ORM — all queries are hand-written SQL via a raw `pg.Pool` ([palabatu-be/db/client.ts](palabatu-be/db/client.ts)).
- Core tables: `users`, `profiles`, `problems`, `sends`, `comments` — see [migrations/](migrations/), captured via `pg_dump --schema-only` from the live Neon DB. All primary keys and foreign keys are `uuid`, not integers.
- Authorization beyond "owns the resource": `profiles.title` stores a JSON array of title strings; `getUserTitles()` in `routes/api.ts` checks for `'Council'` to grant elevated permissions (edit/delete other users' problems).
- Image uploads: `multer` memory storage → streamed to Cloudinary (`kepalabatu_topos` / `kepalabatu_avatars` folders) → the returned `secure_url` is stored (as a JSON array, in `problems.image_urls`). Deleting a problem re-derives the Cloudinary `public_id` from the stored URL to destroy the asset.
- Email (verification, password reset) goes through `palabatu-be/lib/mailer.ts` via Nodemailer; signup rolls back the created user row if the verification email fails to send.

## Go backend rewrite (`palabatu-be-go/`, WIP)

A layered Go port of `palabatu-be/`, built incrementally route-by-route while `palabatu-be/` keeps serving production. Uses `chi` for routing, `pgx/v5` (`pgxpool`) for Postgres, `golang-jwt/jwt/v5` for auth, `go-chi/cors` for CORS, `godotenv` for env loading.

```
palabatu-be-go/
├── cmd/api/main.go          # entrypoint: env load, DB connect, router mount, listen
├── internal/
│   ├── db/db.go             # pgxpool.Pool singleton, mirrors palabatu-be/db/client.ts
│   ├── httpx/json.go        # shared WriteJSON/DecodeJSON helpers
│   ├── mailer/mailer.go     # Resend SMTP sender, mirrors palabatu-be/lib/mailer.ts (no emoji, see global style rule)
│   ├── middleware/auth.go   # RequireAuth (JWT) + UserFromContext, mirrors middleware/auth.ts
│   ├── handler/             # HTTP layer: parses requests, calls service — mirrors routes/*.ts
│   │   ├── auth.go          # AuthRouter(), mounted at /auth — fully ported (signup/signin/session/verify-email/forgot-password/reset-password)
│   │   ├── api.go           # APIRouter(), mounted at /api — router wiring only
│   │   ├── problem.go       # /problems handlers (list/create/update/delete) — ported
│   │   ├── profile.go       # /profiles handlers (get/upsert) — ported
│   │   └── interaction.go   # /problems/:id/send*, /problems/:id/comments handlers — ported
│   ├── service/
│   │   ├── auth.go          # auth business logic, called by handler/auth.go — ported
│   │   ├── problem.go       # problem CRUD + isCreator||isCouncil authorization — ported
│   │   ├── profile.go       # profile get/upsert — ported
│   │   ├── send.go          # send toggle/status — ported
│   │   └── comment.go       # comment list/create — ported
│   └── repository/
│       ├── user.go          # `users` table queries, called by service/auth.go — ported
│       ├── problem.go       # `problems` table queries — ported
│       ├── profile.go       # `profiles` table queries + GetUserTitles() — ported
│       ├── send.go          # `sends` table queries — ported
│       └── comment.go       # `comments` table queries — ported
```

- Layering convention: `handler` → `service` → `repository` → `internal/db`. Handlers should stay thin (request parsing + response writing); business rules belong in `service`; raw SQL belongs in `repository`.
- The CORS allowlist in `cmd/api/main.go` intentionally **omits** the literal `"*"` that appears in `palabatu-be/index.ts`'s origin list — in `go-chi/cors`, `"*"` means "allow all origins," which would contradict the explicit-allowlist policy noted above (`"*"` is a no-op in the Node `cors` package, so this is a behavior-preserving omission, not a divergence).
- `GET /session` is wrapped with `middleware.RequireAuth` (via chi's `.With(...)`) instead of duplicating JWT parsing inline like `palabatu-be/routes/auth.ts` does — same secret, same verification, one code path.
- `repository.User.Password` and `.IsVerified` are tagged `json:"-"` so the struct can be serialized directly as an API response (used by `/session` and `/signin`) without ever leaking the password hash.
- User-facing error strings (e.g. `"Invalid credentials"`, `"Email registered but not verified"`) are hardcoded at the handler layer with the exact casing from `palabatu-be/routes/auth.ts`, since `palabatu-fe`'s `AuthContext.tsx` displays `data.error` directly in a toast — Go's own `error.Error()` strings stay lowercase/idiomatic and are not surfaced to users.
- `service.Signup` treats *any* `CreateUser` failure as "email already exists" (400), matching a quirk in the original Node code (its catch-all doesn't distinguish a unique-constraint violation from other DB errors) — preserved faithfully rather than fixed silently.
- `/api` is ported except image uploads: `POST /upload/topo` and `POST /upload/avatar` still need the Cloudinary Go SDK, and `service.DeleteProblem` deletes the DB row but doesn't yet destroy the problem's Cloudinary images (the Node route derives the `public_id` from the stored URL to do this) — both land together with the upload port.
- `repository.Profile.Title` and `.Tags` are `json.RawMessage`, passed through opaquely rather than typed: `tags` is a frontend-defined shape (`{ level, styles }`), and `title` is a JSON array of role strings but has legacy rows that aren't. `repository.GetUserTitles()` is the one place that actually parses `title`, and it mirrors the Node helper's try/catch — any non-array or missing profile yields `[]` rather than an error.
- The commented-out Council/Founder title check on Node's `POST /problems` is preserved as a no-op (not enforced) in `service.CreateProblem`, for behavior parity — revisit if that gate should actually be turned on.

## Known WIP rough edges

- `App.tsx` has an unused `Home()`/`About()` component pair left over from an earlier Supabase-based setup — not wired into any route.
- `req.user` on the backend is typed as `any`; if you touch auth-adjacent routes, keep in mind there's no shared `Request` type augmentation yet.
