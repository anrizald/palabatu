# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Palabatu — a community web app for Indonesian bouldering enthusiasts (interactive spot map, climber profiles, route/problem listings).

**https://palabatu.id is deployed and publicly reachable.** Do not repeat the "not yet deployed" line that used to sit here and still survives in places (ROADMAP.md's Phase 1.5 preamble had it; `railway_prod_deployment_handoff.md` is written from it) — it was already false when those were written, and it licensed some reasoning that no longer holds, most importantly the security bullet in Known WIP rough edges. Verify before restating deploy status, e.g. `curl -sI https://palabatu.id`.

What is actually true, as of 2026-09-06:
- **Deployed but not launched, and those are separate things.** The site is up on a Hostinger VPS, serving the `stage` branch behind a Caddy reverse proxy (`Via: 1.1 Caddy`, HTTP/3 advertised) that terminates TLS. But `stage` sets `UNDER_CONSTRUCTION = true` in `palabatu-fe/src/App.tsx`, so every route falls through to a single under-construction screen. `SITE_LIVE` is the older, second curtain behind it — `UNDER_CONSTRUCTION` takes precedence, so flipping `SITE_LIVE` alone changes nothing.
- **The backend is live too, not just static files.** `GET /api/crags` and `GET /auth/users/count` both answer 200 in production, and `static.go`'s crawler OG path serves. The database behind it is empty (0 crags, 0 users) and is not the local Docker one — a public, reachable, unpopulated production stack.
- **One image, from the root `Dockerfile`, which lives only on `stage`** (`git cat-file -e stage:Dockerfile`) — not on `main`, `dev`, `ci`, or `devtools`. A `Dockerfile`-shaped hole on this branch is expected, not a deletion to restore. `palabatu-be/cmd/api/static.go` is what makes the one-image shape work; see the `cmd/api` entries in the Architecture tree.
- **The Railway plan is dead.** [railway_prod_deployment_handoff.md](railway_prod_deployment_handoff.md) describes hosting this on Railway and claims to supersede "the old VPS plan". The reverse happened: the VPS won. Its env-var and build notes are still broadly useful, but it is history, not instructions.
- **Pushing to `stage` changes what the public sees.** It is not an inert holding branch any more.

## Repo layout: two independent projects

The frontend (`palabatu-fe/`) and the backend (`palabatu-be/`) are **separate projects** — separate dependency managers and no shared config. Install and run each independently.

`palabatu-be/` is a Go rewrite of what was originally a Node/Express backend. The Node backend has been fully retired and removed from this repo — `palabatu-be/` (Go) is now the only backend and is the one that will serve https://palabatu.id once deployed.

Everything else at the root supports those two rather than shipping with them: `migrations/` (the schema, applied to whichever database `DATABASE_URL` names — shared by both, owned by neither), `tests/` + `playwright.config.ts` (the root-level e2e suite, the reason the root `package.json` exists at all), `scripts/`, and the docs (`ROADMAP.md`, `PRODUCT.md`, `DESIGN.md`, the `handoff*.md` files). Three more are never built or imported, but only one of them is disposable. `prototypes/` holds standalone HTML interaction specs (`add-flow.html`, `add-flow-v2.html`, `approach-guide.html`) that are **cited by name in shipped code comments** as the reference for the behavior that got built — `AddSheet.tsx` and `ProblemFields.tsx` both point at `add-flow-v2.html`. So it's documentation with a claim on the code, not scratch work: if you change one of those behaviors deliberately, the comment pointing here is now lying, and that's the thing to fix. `.agents/skills` and `.impeccable/` (the `impeccable` skill's config and cache) are agent tooling — read them if you're working on the skill, otherwise ignore them, and never make application code depend on either.

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

## Line endings

`.gitattributes` at the repo root declares `* text=auto eol=lf`, with `*.ps1`/`*.bat`/`*.cmd` pinned to `eol=crlf` and image/font types marked `binary`. It exists because Git for Windows ships `core.autocrlf=true` in its **system** config (`C:/Program Files/Git/etc/gitconfig` — not this repo's config, not the global one), which checked out CRLF working-tree files against an LF index. gofmt requires LF and reports a CRLF file as unformatted, so `gofmt -l .` in `palabatu-be` flagged 69 of 74 Go files purely on line endings, making it useless as a real formatting check. Path attributes override `core.autocrlf`, so this holds on any machine without anyone reconfiguring git.

The working tree was normalized to LF in the same pass (383 tracked files, `.ps1` excluded). It produced **zero** content diff — the index was already LF, so git had been converting on checkout only.

- Don't "fix" a CRLF complaint by reformatting files or flipping `core.autocrlf` — change `.gitattributes`.
- If `gofmt -l` ever flags a file you didn't touch, check `git ls-files --eol <path>` before assuming a formatting problem: `w/crlf` on a `.go` file means a tool wrote it with CRLF, not that it needs gofmt.

## Browser automation & E2E testing

Playwright is already installed (`@playwright/test` dev dependency) and the browser
binaries are already downloaded. Do NOT run `npm install playwright`,
`npx playwright install`, or install chrome-cli — the tooling is in place.

- Run tests: `npx playwright test`  (add `--headed` to watch, `--debug` for inspector)
- Screenshot a page: `npx playwright screenshot http://localhost:5173 out.png`
- **Both servers auto-start** via `playwright.config.ts`'s `webServer` array: the Go API (`go run ./cmd/api`, probed at `/metrics`) and then Vite. It was Vite alone until 2026-09-06; the API had to join it because almost every route is data-backed, and without it those specs measure an error state rather than the page. `reuseExistingServer` is on outside CI, so an already-running dev pair is reused rather than fought over.
- `tests/no-horizontal-overflow.spec.ts` asserts the one invariant this repo keeps breaking by accident: the document must never scroll sideways, at 320/360/768/1280, logged out and as admin. Route ids are discovered from the API rather than hardcoded, so a reseeded database doesn't rot it, and the admin half skips itself if `admin1@gmail.com` isn't there.
  - **Assert on `documentElement.scrollWidth` only.** A sweep for "any element past the right edge" cries wolf on the topo carousel, the directory card rail and Leaflet tiles, all of which are supposed to overflow inside their own scroller.
  - Its failure message names the offending element. Working that out is fiddlier than it looks: filtering as you go (drop anything whose child also sticks out) can eliminate every candidate, because the leaf under a too-wide row is often an icon path inside a lucide `<svg>`, which computes `overflow-x: hidden` and reads as a scroller. Collect candidates first, then report the outermost.
  - It only covers states someone enumerated. `palabatu-fe/src/lib/overflowGuard.ts` covers the rest — a dev-only console warning that fires wherever you actually navigate, stripped from production by `import.meta.env.DEV`. Verified absent from `dist/`.
  - `scripts/seed-demo-crags.sql` seeds a crag, rock and problem all named at the cap, and the spec deliberately picks the **longest-named** crag/rock/problem it can find. Without both halves the sweep is decorative: the real seed names top out at 31 characters, and it passed happily until the fixture existed. The first run with it found a real bug (the spot filter `<select>` on `/directory/all` sizes to its widest `<option>`, so one long spot name scrolled the page at 320, 360 *and* 768).
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

Postgres runs in Docker, not as a native Windows service (migrated 2026-07-23; the native service is disabled deliberately — don't re-enable it). The container is `kepalabatu-postgres-1`, exposing 5432, database `palabatu`. Reach it directly with `docker exec kepalabatu-postgres-1 psql -U user -d palabatu -c "..."` when you need SQL that isn't a migration.

**`palabatu-be/.env` currently declares `DATABASE_URL` twice** — Neon first, local Docker second, both uncommented. Both `godotenv` and `scripts/db.ps1` take the *last* occurrence, so the local one wins and that's what the running backend and `db.ps1` both use. Swapping targets means reordering (or commenting) those lines, not editing one in place — and check which one is last before assuming which database you just talked to.

The raw CLI form still works if needed, e.g. against Neon directly (read-only operations only — see below):
```sh
migrate -path migrations -database "$DATABASE_URL" up
migrate -path migrations -database "$DATABASE_URL" version
```

- `0001_init` is the schema as it actually exists in the live Neon database (captured via `pg_dump --schema-only`), not a from-scratch design — this repo had no schema file before.
- Numbering is at `0021` as of 2026-09-06: `0014`/`0015` the crags/boulders/problems hierarchy, `0016` add-flow v2, `0017` approach guides, `0018` feedback type, `0020` `boulders.filed_uncertain`, `0021` `photo_credits` (see `internal/photocredits` in the Architecture tree).
- **`0019` is missing on this branch on purpose, and it is a merge hazard.** `0019_hype_counter` exists only on `stage` (commit `172b5bb`), so `main` jumps `0018` -> `0020`. Numbering around it was right — reusing `0019` here would have collided on merge — but the gap has a consequence: a database that applied `0020` records `schema_migrations.version = 20`, and `migrate up` only applies versions *above* the current one. Merging `stage` into `main` therefore leaves `0019` silently unapplied on every database already at `20` (the local Docker one is, as of this writing). At merge time, apply `0019` by hand (or `force 18` then `up`) rather than assuming `migrate up` covers it. Check `git log --all -- migrations/` before picking a new number, not just `ls migrations/`.
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
- `palabatu-be/.env`: `PORT`, `DATABASE_URL` (Postgres), `JWT_SECRET`, `OWNER_USER_ID` (the single `users.id` allowed to call `/api/dev/*`, see `middleware.RequireOwner`), Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), email credentials (`RESEND_API_KEY`, `EMAIL_FROM` — Resend's SMTP endpoint), `CLIENT_URL` (the base URL verification/reset links in emails are built against), `STATIC_DIR` (path to a built `palabatu-fe/dist`; when set, the Go binary also serves the frontend — see `cmd/api/static.go` in the Architecture tree, and leave it unset in dev, where Vite serves the frontend instead), and `GIN_MODE` (optional; unset means `ReleaseMode`). See `palabatu-be/environments/.env.example`, loaded via `godotenv`. The authoritative list is `grep -rhoE 'os\.Getenv\("[A-Z_]+"\)' --include=*.go .` — the `.env.example` has drifted behind it before.

- **User-typed names are capped at 250 runes**, in `maxNameLen` (each of `crags`/`boulders`/`problems`' own `validate.go`, per this repo's per-domain-validator convention) and mirrored as `MAX_NAME_LEN` in `palabatu-fe/src/lib/constants.ts` for the `maxLength` on the six name inputs. The backend is the enforcement, since the API is public; the input attribute only stops someone typing past it and eating a 400 on submit. Runes not bytes, so a non-ASCII name isn't silently cut shorter than an ASCII one. Nothing capped these before and the columns are still unbounded `text` -- the cap is the app's, not the schema's, so pre-existing longer rows (there are none) would still render.
- **Long text and horizontal overflow.** `truncate` alone does not stop a flex child overflowing: a flex item won't shrink below its content's intrinsic width without `min-w-0`, so the ellipsis never appears and the page scrolls instead. Reach for `min-w-0` first, then decide presentation -- wrap (`break-words`) for a detail page's `h1`, where there is vertical room and the name is the page's identity, and truncation only where one line is structural (cards, rows, chips). A native `<select>` needs `max-w-full min-w-0`, since it sizes to its widest `<option>` regardless of its container.

## Copywriting

- Never use em-dashes in any user-facing copy (UI labels, descriptions, tooltips, empty states, marketing/landing pages, emails, etc.). Use a period, comma, or a plain rewrite instead. This is separate from the global no-emoji rule, and applies only to copy users read, not to prose in this file, code comments, or commit messages.

## Architecture

**Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Routing is a flat `<Routes>` tree in [palabatu-fe/src/App.tsx](palabatu-fe/src/App.tsx). Pages live in `src/pages/`, shared UI in `src/components/`. Map view (`src/pages/Map.tsx`) uses React Leaflet.

Clustering on the map is **hand-rolled** (`ProximityClusters` inside `Map.tsx`: container-point distance, zoom-scaled threshold, centroid pins). The three markercluster packages (`leaflet.markercluster`, `react-leaflet-markercluster`, `@changey/react-leaflet-markercluster`) that used to sit unused in `package.json` are gone — don't reinstall one assuming it's the established pattern here.

Product context (users, positioning, brand commitments) and the visual design system (palette, typography, component patterns, do's/don'ts) live in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) at the repo root, not duplicated here — check them before making product-shape or visual-design decisions. The `impeccable` skill (`.claude/skills/impeccable/`) reads both automatically for its own commands; consult them directly for any other frontend/design work.

When writing or editing CSS/Tailwind (layout, spacing, breakpoints, component styles), always design for responsiveness — check behavior at mobile widths as well as desktop, not just the viewport you're eyeballing. This app is used as an installable PWA on phones, so mobile is a primary target, not an afterthought.

**Auth**: JWT-based, not Supabase (Supabase Auth UI packages are installed but the actual flow is custom JWT). `src/lib/AuthContext.tsx` provides `user`, `handleLogin`, `handleSignup`, `handleLogout`, and a toast helper; on mount it validates any stored token via `GET /auth/session`. Token is stored in `localStorage` under the key `token`.

**API client** ([palabatu-fe/src/lib/api.ts](palabatu-fe/src/lib/api.ts)): a thin fetch wrapper (`api.get/post/put/upload/delete`) that attaches `Authorization: Bearer <token>` from `localStorage` on every call and returns the parsed JSON body directly — not a `{ data, error }` envelope. Check for failure with `'error' in res` (or type the call `Partial<ErrorResponse>` where the success payload is unused), never by destructuring `{ data, error }`.

**Backend** (`palabatu-be/`, Go): uses `gin` for routing, `pgx/v5` (`pgxpool`) for Postgres, `golang-jwt/jwt/v5` for auth, `gin-contrib/cors` for CORS, `godotenv` for env loading, `cloudinary-go/v2` for image uploads, `prometheus/client_golang` for metrics.

```
palabatu-be/
├── cmd/api/main.go          # entrypoint: env load, DB connect, Cloudinary connect, router mount, listen
├── cmd/api/static.go        # the same binary optionally serves the built frontend, which is what makes the
│                            # one-image Railway deploy possible (see the Project section). Mounted as gin's
│                            # r.NoRoute fallback when STATIC_DIR is set: unmatched /api or /auth paths still 404
│                            # as JSON, any real file under STATIC_DIR is served verbatim, everything else
│                            # falls back to dist/index.html so client-side routing works. On top of that
│                            # shell it server-renders OG/Twitter preview HTML for known crawler user agents
│                            # hitting /problems/:id, since link-preview bots don't run the JS that would
│                            # otherwise set <head>. Uses html/template, not text/template or Sprintf,
│                            # specifically because problem names are user-submitted content being put into
│                            # HTML here for the first time in this codebase — auto-escaping is the defense.
│                            # This is the one place cmd/api imports problems and boulders directly, which is
│                            # fine: main is the top of the dependency graph, not a package they could import
│                            # back. Unset STATIC_DIR in dev — Vite serves the frontend there.
├── internal/
│   ├── db/db.go             # pgxpool.Pool singleton
│   ├── cloudinary/cloudinary.go # upload-to-folder + destroy-by-URL
│   ├── metrics/metrics.go   # Prometheus HTTP request-count/duration middleware, exposed at GET /metrics
│   ├── mailer/mailer.go     # SMTP sender (no emoji, see global style rule)
│   ├── apitypes/            # shared response envelopes (ErrorResponse/SuccessResponse/MessageResponse/
│   │                        # CountResponse) — see the API Contract section above
│   ├── middleware/          # auth.go: RequireAuth (JWT) + OptionalAuth (same parse, but a missing/invalid
│   │                        # token is not an error — used by public endpoints that still want to attribute
│   │                        # a signed-in submitter, e.g. feedback) + UserFromContext;
│   │                        # owner.go: RequireOwner; ratelimit.go: RateLimit
│   ├── authz/authz.go       # stateless admin-role policy: IsAdmin(titles), CanEditOwned(userID, ownerID, titles),
│   │                        # CanContribute(userID, kind, ownerID, titles) — the seam handoff.md decision 22 asked
│   │                        # for, so an additive kind's policy can move independently of CanEditOwned's
│   │                        # creator-or-admin. Widened 2026-09-06 (open item 11, resolved): KindAddPhoto and
│   │                        # KindAddApproach now grant to any signed-in user, globally. KindAddNote has no call
│   │                        # site yet and stays on CanEditOwned's default; removing a contribution (any
│   │                        # DeleteXImage, DeleteApproach) is a different question and still creator-or-admin via
│   │                        # CanEditOwned directly, never through this function.
│   │                        # Takes already-fetched data as args — never reaches into another domain's repository,
│   │                        # so problems/social/auth -> authz stays one-way with no import cycle possible.
│   ├── photocredits/        # who added a given photo, so an additive contribution can be credited, judged and
│   │                        # reverted (migrations/0021). Same leaf shape as authz/apitypes: crags, boulders and
│   │                        # problems all import it, it imports none of them. Record/Remove/RemoveEntity/
│   │                        # RemoveURLs/List over `photo_credits`, keyed (entity_kind, entity_id, image_url) —
│   │                        # a sidecar rather than reshaping image_urls into objects or normalizing a photos
│   │                        # table, because a photo inside a jsonb array has no id to point at. That's the
│   │                        # third instance of this shape here (topo_annotations and report are the others),
│   │                        # so it's a pattern, not a workaround, and it changed no existing read/write path.
│   │                        # This built handoff.md open item 11's blocking half: decision 22 required attribution
│   │                        # on every contribution before authz.CanContribute could widen past creator-or-admin
│   │                        # (it has, 2026-09-06 — see authz/authz.go above), and photos had none. Deliberately
│   │                        # not backfilled — a photo added before this migration has no row, so the FE falls
│   │                        # back to the entity's own created_by and guesses nothing. Surfaces as `image_credits`
│   │                        # on the crag/boulder/problem responses; rendered by components/PhotoCreditLine.tsx,
│   │                        # including on CragDetailPage's own photo gallery, which didn't exist before this.
│   │                        # No FK can point into a jsonb array, so a credit row can outlive its photo: every
│   │                        # delete path that already enumerates a URL for cloudinary.DestroyByURL drops the
│   │                        # credit in the same place. Keep that pairing when you add a new one.
│   ├── auth/                # users, sessions, JWT issuance/verification, signup/signin, email verification,
│   │   │                    # password reset, and profiles (profiles.title is an authz concern, so Profile lives here).
│   │   ├── handler.go       # AuthRoutes(rg) mounted at /auth — the credential endpoints, /session,
│   │   │                    # /verify-email, and GET /users/count (a public site-wide signup count, so it
│   │   │                    # sits under /auth rather than with the profile reads it looks like it belongs to);
│   │   │                    # ProfileRoutes(rg) mounted at /api — GET/PUT /profiles/:id, plus
│   │   │                    # GET /profiles/:id/stats and /profiles/:id/activity
│   │   ├── service.go       # Signup/Signin/Session/VerifyEmail/ForgotPassword/ResetPassword/GetProfile/UpsertProfile
│   │   ├── repository.go    # `users` + `profiles` table queries; GetUserTitles() exported for internal/problems
│   │   └── errors.go        # ErrEmailExists, ErrInvalidCredentials, ErrNotVerified, ErrInvalidToken, etc.
│   ├── crags/                # top level of the crags -> boulders -> problems hierarchy (see handoff.md at the repo
│   │   │                     # root for the full design): the place you drive to and park at. Create is open to any
│   │   │                     # signed-in user; edit is creator-or-admin, same authz.CanEditOwned policy as problems;
│   │   │                     # delete is admin-only AND empty-only (handoff.md open item 8's cure for duplicate
│   │   │                     # spots: re-parent the rocks off the duplicate, then remove the husk). "Empty" means no
│   │   │                     # rocks, no problems, and no approach guides — boulders/approaches both cascade from
│   │   │                     # crags, so an approach-bearing crag would silently lose a photographed jalan masuk,
│   │   │                     # while problems.crag_id has no ON DELETE clause and would 500 on the raw FK instead.
│   │   ├── handler.go        # Routes(rg) mounted at /api — /crags, /crags/:id, /crags/:id/images (POST/DELETE:
│   │   │                     # a crag has its own photos, the top of the "photos at all three levels" rule);
│   │   │                     # also calls registerPurgeRoutes. Note /crags/:id/boulders and /crags/:id/approaches
│   │   │                     # are crag-scoped paths registered by those other domains, not here.
│   │   ├── service.go        # ListCrags/GetCrag/CreateCrag/UpdateCrag/DeleteCrag + AddCragImages/DeleteCragImage;
│   │   │                     # authorizeCragEdit mirrors
│   │   │                     # problems.authorizeProblemEdit exactly (per-domain helper, not shared), while
│   │   │                     # requireAdmin mirrors report/boulders' (third package to call authz.IsAdmin directly)
│   │   ├── purge.go / purge_repository.go / purge_handler.go
│   │   │                     # the destructive counterpart to DeleteCrag's empty-only rule (handoff.md decision 24):
│   │   │                     # GET /crags/:id/purge-preview + POST /crags/:id/purge, admin-only, removing a crag AND
│   │   │                     # everything under it. A separate endpoint rather than a flag, because a plain cascade
│   │   │                     # skips every safeguard the app has — it runs no Go, so no Cloudinary destroy (orphaning
│   │   │                     # photos whose URLs die with the rows), no notification to the creators losing work, and
│   │   │                     # it silently erases pending reports. The purge does all three explicitly, refuses unless
│   │   │                     # the caller echoes back the exact counts the server recomputes, and returns a
│   │   │                     # row_to_json snapshot of everything destroyed (the FE saves it as a file — the only
│   │   │                     # surviving copy). Deletion order is forced by the schema: problems must go first and
│   │   │                     # explicitly, since problems.crag_id/boulder_id are NO ACTION while boulders/approaches
│   │   │                     # are ON DELETE CASCADE.
│   │   ├── repository.go     # `crags` table queries; CragListItem includes boulder_count/problem_count so a dimmed
│   │   │                     # empty-crag UI doesn't need a second round-trip
│   │   ├── validate.go       # Indonesia bounding-box lat/lng check, this domain's own copy (see boulders/validate.go)
│   │   └── errors.go         # ErrNotFound, ErrForbidden, ErrInvalidLocation, ErrCragNotEmpty
│   ├── boulders/              # middle level of the hierarchy: one rock, and the thing that actually owns the topo
│   │   │                      # photo(s) problems on it draw their lines on (moved here from problems -- two problems
│   │   │                      # on the same rock used to mean two uploads of the same photograph). Also owns the
│   │   │                      # boulder-merge sub-flow (duplicate rocks are expected, not exceptional -- the backfill
│   │   │                      # creates one boulder per pre-existing problem, and contributors standing at the same
│   │   │                      # rock keep creating new ones): anyone signed in may suggest "these are the same rock",
│   │   │                      # only the source/target boulder's own creator may object, only an admin executes a
│   │   │                      # merge (choosing which boulder survives), gated by a 48h objection hold an admin can
│   │   │                      # override. problems and boulders never import each other's Go package in either
│   │   │                      # direction -- each reaches into the other's table with its own direct SQL instead
│   │   │                      # (mirrors devtools/auth.getProfileStats' "own SQL, no cross-domain repository calls"
│   │   │                      # precedent), so the dependency graph stays acyclic without a shared package.
│   │   ├── handler.go         # Routes(rg) mounted at /api — /boulders, /crags/:id/boulders, /boulders/:id/images,
│   │   │                      # /boulders/:id/annotations (every problem-on-this-boulder's line together).
│   │   │                      # Also calls registerMergeRoutes onto the same group.
│   │   ├── service.go         # ListBoulders/GetBoulder/CreateBoulder/UpdateBoulder/DeleteBoulder/ListNeedsAttention/
│   │   │                      # Add|DeleteBoulderImages/ListAnnotationsForBoulder. DeleteBoulder (added 2026-09-06,
│   │   │                      # handoff.md decision 24) is creator-or-admin and empty-only — until it existed the
│   │   │                      # middle level had no delete at all, so a junk rock could only ever be merged away,
│   │   │                      # which needs a plausible target and asserts "same rock" rather than "remove this".
│   │   │                      # Destroys its own Cloudinary photos on the way out, since nothing else will.
│   │   │                      # ListNeedsAttention (GET /boulders/needs-attention, admin-only) is handoff.md open
│   │   │                      # item 9's tidy-up queue: rocks still unidentified (no name, no photo) that either
│   │   │                      # carry boulders.filed_uncertain (the contributor picked "Not sure which one" —
│   │   │                      # migrations/0020, three-state: true/false/NULL-never-asked, closing
│   │   │                      # handoff-add-sheet.md C11) or hold exactly one problem (item 9's heuristic, and the
│   │   │                      # only signal that sees rocks predating the column). The "still unidentified"
│   │   │                      # precondition is what makes the queue drainable — naming or photographing a rock
│   │   │                      # removes it, so there's no dismiss action and the flag itself is never mutated.
│   │   │                      # Route registered BEFORE /boulders/:id so gin doesn't read the literal segment as an id.
│   │   ├── repository.go      # `boulders` table queries, plus direct SQL against problems/topo_annotations for
│   │   │                      # image-delete cascade and the annotations-by-boulder listing
│   │   ├── merge.go / merge_repository.go / merge_handler.go
│   │   │                      # SuggestMerge/ObjectToMerge/ListPendingMergeRequests/ResolveMergeRequest for
│   │   │                      # `boulder_merge_requests`/`boulder_merge_objections`, plus
│   │   │                      # ListPendingMergeRequestsForBoulder (GET /boulders/:id/merge-requests,
│   │   │                      # creator-or-admin) — without it a boulder's own creator can't see a request
│   │   │                      # filed against their rock and the objection right is unexercisable;
│   │   │                      # requireAdmin mirrors
│   │   │                      # report.requireAdmin (second package to call authz.IsAdmin directly, not
│   │   │                      # authz.CanEditOwned, since resolving a merge isn't "owned" by anyone)
│   │   ├── validate.go        # Indonesia bounding-box lat/lng check (only when both are provided -- a boulder's
│   │   │                      # coordinates are optional, unlike a crag's)
│   │   └── errors.go          # ErrNotFound, ErrForbidden, ErrCragNotFound, ErrHoldNotExpired, etc.
│   ├── problems/            # bottom level of the hierarchy: one way up a rock. Problem CRUD and topo photo
│   │   │                    # annotation (drawn route lines/holds on the *boulder's* photo); "Founder" (creator)
│   │   │                    # authorization. crag_id is denormalized onto every problem (also reachable via
│   │   │                    # boulder_id -> boulders.crag_id) since every hot list/filter/map query wants it without
│   │   │                    # a two-hop join. The topo photo a problem's line is drawn on belongs to its *boulder*,
│   │   │                    # not to it (see internal/boulders) -- but POST/DELETE /problems/:id/images still exist
│   │   │                    # here on purpose: 0015 dropped problems.image_urls and 0016 deliberately re-added it
│   │   │                    # with a different meaning, beta/action shots (crux hold, start position), never the
│   │   │                    # canonical topo. Don't route boulder-topo work through them.
│   │   ├── handler.go       # Routes(rg) mounted at /api — /problems, /problems/:id/images, /upload/topo,
│   │   │                    # /upload/avatar, /problems/:id/annotations
│   │   ├── upload.go        # handleUpload multipart parsing, shared by topo/avatar handlers
│   │   ├── service.go       # ListProblems/CreateProblem/UpdateProblem/DeleteProblem; authorizeProblemEdit fetches
│   │   │                    # titles via auth.GetUserTitles() then defers the decision to authz.CanEditProblem
│   │   ├── annotation.go / annotation_repository.go / annotation_handler.go
│   │   │                    # ListAnnotations/SaveAnnotation for `topo_annotations` (one vector-shape overlay per
│   │   │                    # problem image, keyed by (problem_id, image_url) since images have no per-row id — same
│   │   │                    # precedent as `report`'s image reports); the image-membership check reads the problem's
│   │   │                    # *boulder's* image_urls (getProblemOwnerAndBoulderImages), not the problem's own —
│   │   │                    # problems don't own images anymore
│   │   ├── repository.go    # `problems` table queries
│   │   └── errors.go        # ErrNotFound, ErrForbidden, ErrBoulderNotFound
│   ├── social/               # sends (ticks), comments, and profile reactions
│   │   ├── handler.go        # Routes(rg) mounted at /api — send-status/send, sends/mine, comments (list/create/
│   │   │                     # delete), profiles/:id/reactions (+ /status, + /:type toggle)
│   │   ├── service.go        # HasSent/ToggleSend/ListComments/CreateComment/DeleteComment/reaction counts+toggle
│   │   ├── repository.go     # `sends` + `comments` + reaction table queries
│   │   └── errors.go         # ErrEmptyComment
│   ├── approaches/           # "jalan masuk" approach guides: a recorded walk-in with a start coordinate, so the
│   │                         # map's close-zoom layer can show where the trail actually begins (distinct from the
│   │                         # crag pin, which means "the climbing, approximately"). Routes at /api —
│   │                         # /crags/:id/approaches, /approaches/:id.
│   ├── drafts/                # backend sync for the add sheet's autosave (handoff-drafts.md, both milestones —
│   │                           # M1 2026-08-17, M2 2026-09-17, M2 built speculatively rather than gated on M1 usage
│   │                           # signal that client-only IndexedDB storage had no way to ever produce). Every route
│   │                           # is /api/drafts*, behind middleware.RequireAuth, scoped to the caller in the SQL
│   │                           # WHERE clause rather than a separate ownership check — someone else's draft id reads
│   │                           # as 404, never 403, matching "private to owner" (handoff-drafts.md decision 7).
│   │                           # migrations/0022. payload stays json.RawMessage, an opaque mirror of the frontend's
│   │                           # own add-sheet/types.ts draft shapes, same passthrough precedent as
│   │                           # auth.Profile.Title/Tags — this domain has no business interpreting FE form state.
│   │                           # photo_urls is a separate text[] column, not parsed out of payload, so
│   │                           # UpdateDraft/DeleteDraft can sweep provisional Cloudinary uploads a later edit
│   │                           # orphaned without understanding that JSON shape.
│   │                           # DELETE /api/drafts/:id?keep_photos=true is the one deliberate departure from the
│   │                           # handoff doc's own text, found while building it: by the time a *submitted* draft's
│   │                           # post-save cleanup call fires, its photo URLs are already the real
│   │                           # problem/boulder/crag's own photo (that reuse is the entire point of eager upload —
│   │                           # AddSheet.tsx's ensurePhotosUploaded/resolvePhotoUrl), so an unconditional destroy
│   │                           # would take down a just-attached photo seconds later. true is the post-submit path
│   │                           # only; every other delete (the drafts overlay's "Remove", the "Saved as a draft"
│   │                           # toast's Undo) defaults to false, genuine abandonment, where the photos really are
│   │                           # only reachable through the draft. handoff-drafts.md has the full account, including
│   │                           # a second, unrelated finding from the same build: AddSheet.tsx tracked the active
│   │                           # draft's id in useState, whose closures go stale once eager upload's own setState
│   │                           # forces an extra render mid-save — fixed by moving it to a ref (draftIdRef),
│   │                           # alongside draftCreatedAtRef which already used the same pattern for the same
│   │                           # reason.
│   ├── notification/         # in-app notifications (comment/send/report_resolved/content_removed/reaction/
│   │                         # problem_edited/problem_deleted/mention/merge_suggested/merge_objected/
│   │                         # merge_resolved — the type CHECK constraint lives in migrations, see 0014)
│   ├── report/               # user reports on comments and images, plus the admin resolve queue; requireAdmin
│   │                         # calls authz.IsAdmin directly (the precedent boulders' merge resolution follows)
│   ├── waitlist/             # public POST /api/waitlist, rate-limited — the marketing-side signup capture
│   ├── feedback/             # POST /api/feedback (public, rate-limited, middleware.OptionalAuth so a signed-in
│   │                         # submitter is attributed and an anonymous one still gets through), plus the
│   │                         # owner-only GET /api/dev/feedback and POST /api/dev/feedback/:id/reviewed
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
- `users.guidelines_accepted_at` (migrations/0013) records Community Guidelines acceptance at signup, tracked as a separate consent from `terms_accepted_at` since it's a behavioral/etiquette acknowledgment rather than the legal ToS/Privacy agreement — same nullable-at-the-DB-level, enforced-in-`auth.Signup` shape. Content lives in `LegalModal.tsx`'s `GuidelinesContent` (third tab alongside Terms/Privacy) and carries the same "draft — not yet reviewed or final" disclaimer as the other two docs.
- `internal/cloudinary.DestroyByURL` re-derives a Cloudinary `public_id` from a stored secure URL (strip up to `/upload/`, drop a `vNNN/` version segment, drop the extension) and calls `Upload.Destroy`. Every caller invokes it once per removed URL, best-effort (a destroy failure is logged, not fatal). There are eight, across four domains — `grep -rn DestroyByURL internal/` rather than trusting this list to stay complete:
  - per-photo deletes: `crags.DeleteCragImage`, `boulders.DeleteBoulderImage`, `problems.DeleteProblemImage`
  - whole-entity deletes that take their photos with them: `crags.DeleteCrag`, `boulders.DeleteBoulder`, `approaches.DeleteApproach`, and `crags`' purge (`purge.go`, which has to collect the URLs *before* deleting rows — see `purge_repository.go`'s comment)
  - avatars, in `auth`: `UpsertProfile` (destroying the one it replaces) and `DeleteAccount`
  - Each of these is also the place the matching `photocredits` row is dropped, since no FK can cascade into a jsonb array. Add both halves together.
- **`problems.DeleteProblem` deliberately destroys nothing**, and that's the one exception to the pattern above: the topo photos a problem's line is drawn on belong to its *boulder* and must survive any single problem on that rock being deleted. The destroy call moved out of it when photo ownership moved to boulders (see the crags/boulders/problems bullet below). `DeleteProblemImage` still destroys, because those are the problem's own beta/action shots, not the boulder's topo.
- Cloudinary CDN caveat learned while testing the delete path: destroying an asset removes it from Cloudinary's asset store immediately (verified via the Admin API), but a previously-fetched delivery URL can keep returning `200` from CDN edge cache for a while afterward. Don't use "can I still GET the old URL" as a signal that cleanup failed — check the Admin API (or just trust `Destroy`'s returned `Result`) instead.
- `auth.Profile.Title` and `.Tags` are `json.RawMessage`, passed through opaquely rather than typed: `tags` is a frontend-defined shape (`{ level, styles }`), and `title` is a JSON array of role strings but has legacy rows that aren't. `auth.GetUserTitles()` is the one place that actually parses `title`; any non-array or missing profile yields `[]` rather than an error.
- `cmd/api/main.go` strips trailing slashes ahead of every route (its own `stripTrailingSlash` wrapper, applied around the whole `*gin.Engine` at the `http.ListenAndServe` call — not as a `r.Use()` middleware): `palabatu-fe` actually calls `POST /api/upload/avatar/` with a trailing slash. It has to wrap the raw `http.Handler` rather than run as gin middleware because gin resolves routes (and would otherwise 301/307-redirect a trailing slash) before any `r.Use()` middleware executes — and a redirected POST is fragile across CORS (body replay, extra preflight).
- Problem authorization model (`problems.authorizeProblemEdit` in `problems/service.go`, policy in `internal/authz`):
  - **Creating** a problem (`POST /problems`) has no role gate — any logged-in user can add one, for now.
  - **Editing/deleting** a problem is allowed for two groups: admins, whose `profiles.title` includes `'Council'` or `'Associate'` (`authz.IsAdmin`), who can CRUD *any* problem; and that problem's own creator (its "Founder"), who can only CRUD the problem(s) they added. The policy function is `authz.CanEditOwned(userID, ownerID, titles)` — generic over any creator-owned row, which is why `crags` and `boulders` reuse it verbatim. (There is no `authz.CanEditProblem`; if you see that name referenced anywhere, it's stale.)
  - **Additive** acts route through `authz.CanContribute(userID, kind, ownerID, titles)` instead of `CanEditOwned` directly — a separate seam so a kind's policy can move independently, without touching every call site. As of 2026-09-06 (handoff.md open item 11, resolved) `KindAddPhoto` and `KindAddApproach` grant to any signed-in user; `boulders.AddBoulderImages` is one of three add-photo call sites (crags, boulders, problems) that now behave this way. Removing a contribution is unaffected — every delete path still calls `CanEditOwned` directly, creator-or-admin, same as before.
- **Crags/boulders/problems hierarchy** (shipped end to end 2026-08-08 — schema, backend, and frontend; see `handoff.md` at the repo root for the full design and `ROADMAP.md`'s Phase 1.5 entry): a problem is the bottom level of `crags -> boulders -> problems` (migrations 0014/0015). A crag is the place you park and walk in from (required `lat`/`lng`, optional `directions`/`access_notes`); a boulder is one rock (optional `lat`/`lng`, owns `image_urls` — the photo(s) every problem on it shares); a problem is one way up that rock, with no location of its own (`crag_id`/`boulder_id` FKs only, `crag_id` denormalized so hot queries skip the two-hop join). Duplicate boulders are a normal state, not a bug: the one-off `cmd/backfill-crags` script gave each pre-existing problem its own boulder (no data said which problems shared a rock), contributors standing at the same rock keep creating more, and the add sheet's "Not sure which one" files one too. They're resolved through `internal/boulders`' merge sub-flow — anyone signed in may suggest "these are the same rock", only the two boulders' own creators may object, only an admin executes the merge (picking which boulder survives), gated by a 48h objection hold an admin can override.
  - Frontend surfaces for it: the single add sheet (`components/add-sheet/` — see the bullet below), `CragDetailPage`/`BoulderDetailPage`/`ProblemDetailPage` (the only problem-detail surface — `ProblemDetails` and `AddProblemModal` were deleted rather than ported), `Map.tsx` (see the map-layers bullet below), `MergeSuggestModal` plus the `AdminMergeRequests` review queue, `AdminNeedsAttention` (the client for `GET /boulders/needs-attention` — a queue with no dismiss action, since naming or photographing a rock is what drains it), `PurgeSpotModal` (the client for the two purge routes, and the thing that saves the destroyed-rows snapshot to a file — that download is the only surviving copy, so treat it as part of the operation rather than a convenience), `components/PhotoCreditLine.tsx` with `types/photocredit.ts` (rendering `image_credits`, falling back to the entity's creator when a photo predates `migrations/0021`), and `lib/cragCache.ts` — a small client-side join so list/card surfaces resolve crag/boulder names, thumbnails, and "near you" distance through the existing crag/boulder list endpoints rather than new backend denormalization.
  - **The map is three layers chosen by zoom, not one pin per crag** (handoff.md open item 13, resolved 2026-08-09(g)). Far out: one pin per crag (`PinpointMarker`), dimmed when the crag has no problems yet. Past `DETAIL_ZOOM` (15, in `lib/constants.ts`, shared so `Map.tsx` and `PinpointMarker` can't drift): `CragDetailLayer` mounts that crag's own rocks (`BoulderPinMarker`, a tailless badge — "an object is here") and its approach start points (`ApproachStartMarker`, a teardrop — "you go here"), both drawn from `lib/mapIcons.ts`'s shared badge/teardrop SVG language. The crag pin then de-emphasizes, and hides outright once `onContentAvailability` confirms real detail pins are on screen — but *only* then, because a crag whose rocks all lack coordinates would otherwise lose its only marker. `crags.lat/lng` means "the climbing, approximately"; it is explicitly not the parking spot any more.
  - **A rock's own `lat`/`lng` is captured in two places, and is optional everywhere** (built 2026-08-30, closing a gap where the close-zoom rock layer existed but nothing could ever feed it — every add-sheet rock was hardcoded to `lat: null, lng: null`, so only `cmd/backfill-crags`-era rocks ever drew a pin). `components/RockPointMap.tsx` is the shared picker, used by the add sheet's `RockFields` and by `BoulderDetailPage`'s edit form (so rocks added before this can be pinned retroactively). It opens on the parent crag rather than on GPS and never auto-stamps a position — per open item 13, draw the rocks that have a coordinate, never invent one for the rest. It is deliberately *not* a mode of `SpotMiniMap`: same appearance, opposite contract (a spot's pin is required, GPS-first, and warns about other spots 300 m away; a rock's is optional, crag-centred, and warns at 15 m). Note `boulders.updateBoulderRow` writes `lat`/`lng` unconditionally — there is no "empty means leave as is" convention for them as there is for the string fields — so **any `PUT /api/boulders/:id` that omits them silently clears the rock's pin**.
  - **The add flow is one scrolling sheet, `components/add-sheet/`** (`AddSheet` plus `LocationOverlay`, `RockPicker`/`RockList`, `SpotMiniMap`, `ProblemFields`, `SpotFields`, `RockFields`, `DraftsOverlay`, `drafts.ts`), shipped 2026-08-10 per `handoff.md` revision (h). It replaced a three-step wizard at `components/add-flow/`, which was **deleted** — if you see it referenced anywhere, that reference is stale. One sheet, three intents ("a problem" / "a spot" / "a rock") that each save on their own; the spot and rock are one breadcrumb line opening a full-sheet picker overlay; photos live at all three levels but only the rock's is annotatable; cliffs are in scope (`boulders.type` is `boulder | wall`, driving UI copy and which grade scale applies — so the `rope` scales in `lib/constants.ts` are deliberate, not vestigial). **`boulders.type` also gates anything *derived* from a problem's own columns.** The live case is the "highball" label: `ProblemDetailPage`'s `detailRows` reads the rock's type as well as `height_m`, because a roped wall route is never a highball however tall it is — it shipped comparing the number alone and rendered the seed's 300 m Gunung Parang lines as highballs until 2026-09-06 (handoff.md decision 10 records it). Most such derivations were written before `boulders.type` existed, so re-check any other one you touch. Approach guides ("jalan masuk", `internal/approaches` + `ApproachReadingPage`/`ApproachCaptureView`) and re-parenting shipped in the same revision. Build UI changes here via the `impeccable` skill rather than hand-rolling layout.
  - **Deliberate choices inside the add sheet — don't "fix" these.** Each looks like an oversight and isn't; this list was the surviving half of the add-sheet review (see the handoffs bullet below) and is kept so a later pass doesn't quietly undo the work.
    - **The portal.** `AddSheet`'s `createPortal(..., document.body)` is load-bearing against `Footer.tsx`'s fixed positioning, not incidental nesting.
    - **One breadcrumb line, not two rows** (handoff.md decision 15), including its `isFar` danger border.
    - **The overlay picker returns to its scroll position** (decision 16), and `LocationOverlay` re-derives the rock list live rather than caching it (decision 18's three cases, correctly implemented).
    - **Single-column 16:9 rock rows** (decision 17), and the `sample_problem_name` fallback for an unnamed rock (UX principle 3).
    - **The sticky footer keeps its disabled button permanently visible with the reason underneath** (decision 19) — naming what's in the way beats hiding the control.
    - **`SpotMiniMap`'s neighbour pins, distances, accuracy radius and under-300 m duplicate warning** (decision 20) — the app's main defense against duplicate spots, which open item 8 has no cure for after the fact.
    - **Single-select grade chips with no "no grade yet" chip** — an unselected row already means that.
  - **Every design handoff that lived alongside `handoff.md` has now shipped
    and been removed**, per this repo's convention that a drained handoff
    becomes git history rather than a file nobody reads. Code comments still
    cite their finding codes, so this is the decoder ring:
    - `handoff-drafts.md` — the add sheet's autosave feature, two milestones.
      M1 (client-side IndexedDB autosave, `add-sheet/drafts.ts` +
      `DraftsOverlay.tsx`, debounced ~800 ms, lazily creating a draft on the
      first real keystroke) built 2026-08-17, replacing the add-sheet
      review's C12 confirm-before-discard dialog. M2 (backend sync,
      `internal/drafts`) built 2026-09-17 — see that package's own entry
      above for what shipped and the one place it deliberately departs from
      the handoff doc's literal text. The doc's own M2 gate ("depends on
      whether M1 shows drafts being resumed rather than abandoned") was
      overridden deliberately rather than waited on: M1's client-only
      storage had no way to ever produce that signal for anyone to observe,
      so the gate could never resolve on its own. Removed 2026-09-17; see
      ROADMAP.md's Phase 1.5 entry for the shipped summary and
      `git log -- handoff-drafts.md` for the complete decision record.
    - `handoff-add-sheet.md` — a punch list against the shipped add sheet,
      13 findings written 2026-08-13, all fixed (A1-A3, B5-B9, C10, C12,
      C13 same-day; B4 on 2026-08-17; C11 last, on 2026-09-06, once open
      item 9 decided what would read the flag). Removed 2026-09-06. Bare
      `A2`/`B5`/`B7`/`C11`-style citations in `components/add-sheet/`,
      `boulders/dto.go`, `types/boulder.ts` and `migrations/0020` all point
      here; `git log -- handoff-add-sheet.md` has the full text. Its one
      forward-looking section was rescued into the "don't fix these" bullet
      above rather than deleted with it.
    - `handoff-directory.md` — the crags/boulders/problems restructure's
      read surfaces, `Directory.tsx`/`ProblemList.tsx`. Shipped in full and
      removed 2026-09-05; see ROADMAP.md's Phase 1.5 entry for the shipped
      summary, its Deferred section for what stayed unbuilt (topo-line
      rendering on cards, search ranking, catalog pagination), and
      `git log -- handoff-directory.md` for the complete record.
- Topo photo annotation (drawing route lines/holds on a boulder's photo, which every problem on that boulder shares — see the hierarchy bullet above): shared frontend components live in `palabatu-fe/src/components/topo-annotations/` (`TopoImage` read-only viewer, `TopoAnnotationEditor` drawing modal, `TopoAnnotationOverlay` the shared SVG renderer used by both, `useContainRect` the geometry hook) and are imported by `ProblemDetailPage.tsx` (`TopoImage`), `BoulderDetailPage.tsx` (`TopoAnnotationOverlay` + `useContainRect`, for the combined every-line-on-this-rock view), and the add sheet's `AddSheet.tsx` (`TopoAnnotationEditor`, opened from `ProblemFields`' photo row and from the post-save banner). **`topo_annotations` was never re-keyed** for the hierarchy change, contrary to what an early draft of `handoff.md` said: its original `(problem_id, image_url)` unique key (migrations/0005) already expresses "one photo, N lines" once the photo belongs to the boulder. The only thing that moved is the membership check — `getProblemOwnerAndBoulderImages` validates a save's URL against the problem's *boulder's* `image_urls`, not the problem's own. Shapes are stored as coordinates normalized to the image's natural width/height (radius/strokeWidth normalized against width for *both* axes, so a circle stays circular regardless of photo aspect ratio) — see `palabatu-fe/src/types/annotation.ts`. `useContainRect` measures the rendered `<img>` box directly via `getBoundingClientRect()` rather than trusting `naturalWidth`/`naturalHeight` math, because those don't reliably match what the browser actually paints for every real-world (often EXIF-oriented) photo.
- **lucide-react icons inside a `display:flex`/`inline-flex` parent can render at 0 width** (confirmed repeatedly live via `getComputedStyle` — height resolves correctly but width resolves to `0px` — despite correct SVG markup, `currentColor`, and computed `color`) — a real, reproducible rendering bug in this app's environment, not a hypothetical. Any icon that is a child of a flex-display element (inline `style={{display:'flex'}}`, Tailwind `flex`/`inline-flex` classes, or a CSS class rule) needs an explicit `flexShrink:0` (inline) / `shrink-0` (Tailwind) / `flex-shrink: 0` (CSS rule) on the icon itself. `tsc`/`eslint` passing is never sufficient evidence a new icon-in-a-flex-button actually renders — visually verify (screenshot or live) any new one.
- **Backend abuse protection** (app-level only, and these are currently the *only* protections on a publicly reachable origin — see the network-edge bullet in Known WIP rough edges): `middleware.RateLimit` is an in-memory per-IP token bucket (`golang.org/x/time/rate`, 10-minute stale-entry sweep), applied at two layers — a blanket backstop on the whole `/api` group (`cmd/api/main.go`, 10 req/s sustained, burst 20, mounted via `apiGroup.Use` before any domain's `Routes` registers onto it) covering every otherwise-unthrottled `GET` listing, plus tighter per-endpoint limits domains apply to their own write-heavy or costed routes: `auth` credentials endpoints, `waitlist`, `feedback`, `social` comment creation, `report` creation, and `problems`' two upload endpoints (`/upload/topo`, `/upload/avatar` — rate-limited separately from other problem routes since a burst there is billed Cloudinary traffic, not just DB load). Its own doc comment states the ceiling: fine at today's single-instance scale, needs a shared store (Redis or similar) the moment there's more than one backend replica, since each replica would otherwise track independent counters. `auth`'s credential-endpoint limiter (`limitCredentialEndpoints`, 1 req/12s, burst 5) is a **single shared bucket per IP across all of signup/signin/forgot-password/reset-password/change-password/delete-account** — spamming login also eats into the budget for the other five, by design (one combined brute-force/spam budget, not five independent ones), and it's a continuous drip rather than a lockout-then-reset window: once the burst of 5 is spent, exactly one more request is allowed every 12s, with the bucket only returning to full after 60s of that IP making no requests at all. Beyond rate limiting, `cmd/api/main.go`'s `http.Server` sets `ReadHeaderTimeout`/`ReadTimeout`/`WriteTimeout`/`IdleTimeout` (5s/30s/30s/60s) to close the Slowloris gap where an unbounded server lets a client hold a connection open indefinitely — the read/write values are deliberately generous to still allow an 8MB topo/avatar upload over a slow mobile connection. `gin.SetMode(gin.ReleaseMode)` is the default now (quieter logging, no debug-mode warnings) unless `GIN_MODE` is already set in the environment. `middleware.BodyLimit` (mounted at the root in `main.go`, ahead of both `/auth` and `/api`) caps every request body via `http.MaxBytesReader`, content-type-aware: 2MB for everything except `multipart/form-data`, which gets 10MB (mirroring `problems.maxUploadMemory`, the existing multipart buffering ceiling) since the two upload endpoints legitimately carry an image file — an oversized body surfaces through the same "invalid request body"/"Invalid upload" 400 branch every handler's `ShouldBindJSON`/`ParseMultipartForm` error check already has, no handler changes needed. `internal/db/db.go`'s `pgxpool.Connect` uses `pgxpool.ParseConfig` + explicit `MaxConns`(10)/`MinConns`(2)/`MaxConnLifetime`(1h)/`MaxConnIdleTime`(15m)/`HealthCheckPeriod`(1m) rather than pgx's NumCPU-scaled defaults — deliberately conservative given `DATABASE_URL` sometimes points at Neon (see Database migrations above), whose lower tiers cap total connections.

## Known WIP rough edges

- `req.user`-equivalent context on the backend has no shared typed augmentation yet beyond `middleware.UserFromContext`.
- ~~Dead dependencies in `palabatu-fe/package.json`~~ — cleared 2026-09-06. The markercluster and `@supabase/auth-ui-*` packages this bullet used to name had already gone; five more that nothing imported went with this pass: `cloudinary`, `multer` and `@types/multer` (leftovers from the retired Node/Express backend — image upload and multipart parsing are backend concerns and live in `palabatu-be` now), `rive-js`, and `@tailwindcss/cli` (`vite.config.ts` uses the `@tailwindcss/vite` plugin, so a CLI invocation is nothing's entry point). `npm run build`, `npm run lint` and `tsc --noEmit` all clean afterwards. Separately, `npm audit` reports 16 advisories, all in dev tooling (`vite`'s dev server, `node-tar`) and none in anything shipped to a browser — not addressed here, since fixing them means version bumps rather than deletions.
- **Tailwind is wired up twice, and the duplicate is still there.** `vite.config.ts` loads the `@tailwindcss/vite` plugin, *and* `palabatu-fe/postcss.config.ts` (which Vite auto-discovers) declares `@tailwindcss/postcss` + `autoprefixer` — so the CSS goes through Tailwind on both paths, and `@tailwindcss/postcss`/`postcss`/`autoprefixer` are all still real devDependencies because of it. Alongside them sits a `tailwind.config.ts` in the Tailwind v3 `content`/`theme.extend` shape, with an empty theme, under Tailwind 4 (which configures via `@theme` in CSS). None of this breaks the build, which is why it survived the dead-dependency pass — that pass looked for unimported packages, and these are genuinely imported, just redundantly. Resolving it means picking one path and deleting the other, so it's a deliberate decision rather than a cleanup: don't half-remove it. (An earlier version of the bullet above asserted "there is no PostCSS config in this project" — there is; that was wrong.)
- The em-dash rule in Copywriting above post-dates a lot of existing UI copy. Not a regression to chase in bulk; fix as you touch them, and don't add new ones. **Grep for both spellings** — the entity `&mdash;` *and* a literal `—`, which is by far the more common of the two and which an entity-only grep misses entirely. As of 2026-09-06: 8 files carry `&mdash;` (`AddSheet`, `ProblemFields`, `SpotMiniMap`, `RockPointMap`, `ApproachCaptureView`, `ApproachReadingPage`, `Map`, `ProblemDetailPage`) and 20 carry a literal `—` (`Directory.tsx` alone has 14). `RockFields`/`SpotFields`, which this bullet used to name, are both clean now.
- **Backend hardening gaps not yet covered** (see the Backend abuse protection bullet above for what is, including the now-tuned DB pool and body size cap): no per-request query timeout wraps pgx calls, so a pile of slow/hanging queries still has nothing stopping it from exhausting the pool short of the new `MaxConns` ceiling — that's a larger change (a shared `context.WithTimeout` helper or per-call timeouts across every repository function) than pool sizing alone, deliberately not bundled into that pass. **Network-edge protection is a live gap, not a hypothetical one.** This bullet used to dismiss it as "expected given nothing is deployed yet" — that premise was false (see the Project section) and the conclusion went with it. The current state: a Caddy reverse proxy fronts the app on the VPS and terminates TLS, but its config is **not in this repo**, so nothing here can tell you what it does or doesn't filter — check the box, don't infer it from the codebase. No CDN or WAF is evident in the response headers. So the app-level protections above (per-IP rate limiting, body caps, server timeouts) are doing the work, on a publicly reachable origin, and they are explicitly not enough for volumetric/L3-L4 traffic. What limits the damage today is that the deployment holds no data (empty database, under-construction curtain), which is a fact about timing rather than a defense. Putting something with real protections in front (Cloudflare or similar) is a decision that is now overdue rather than premature, and it can't be solved inside the Go app.
