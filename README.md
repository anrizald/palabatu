<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/anrizald/palabatu">
    <img src="palabatu-fe/public/favicon_transparent.png" alt="Logo" width="80" height="80">
  </a>
  <h3 align="center">Palabatu</h3>
  <p align="center">
    A community web app for Indonesian bouldering enthusiasts — interactive spot map, climber profiles, route/problem listings.
    <br />
    <strong>Status: work in progress, deployed but not open.</strong> <code>palabatu.id</code> is live and serving, currently behind an under-construction screen while the app is reworked.
    <br />
    <br />
    <a href="https://github.com/anrizald/palabatu/issues">Report Bug / Request Feature</a>
  </p>
</div>

## About

Palabatu is a web-first community platform for the Indonesian bouldering scene: discover spots on an interactive map, log sends, comment on problems, and maintain a climber profile.

Two independent projects live in this repo, each with its own dependency manager — install and run each separately:

- **`palabatu-fe/`** — React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Map view built on React Leaflet, with hand-rolled proximity clustering (no markercluster library — see [CLAUDE.md](CLAUDE.md) before adding one). Installable as a PWA; mobile is a primary target, not an afterthought.
- **`palabatu-be/`** — Go (Gin + `pgx/v5` + PostgreSQL). A rewrite of an earlier Node/Express backend, which has been fully retired and removed from this repo. In production it also serves the built frontend, so the two projects deploy as a single binary even though they develop separately.

See [CLAUDE.md](CLAUDE.md) for the full architecture breakdown and [ROADMAP.md](ROADMAP.md) for what's shipped vs. planned.

### Built with

- React 19, TypeScript, Vite 7, Tailwind CSS 4
- React Leaflet (interactive map; clustering is our own, not a plugin)
- Go, Gin, `pgx/v5`, PostgreSQL 18
- JWT auth (`golang-jwt/jwt/v5`), Cloudinary (image uploads), Prometheus `client_golang` (HTTP metrics)

## Getting started

### Prerequisites

- Node.js 20+ and npm (CI builds on 22, so that's the version actually exercised)
- Go 1.26+ (`go.mod` pins 1.26.4)
- Docker (spins up local PostgreSQL — see step 4) or your own local PostgreSQL 18 install

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/anrizald/palabatu.git
   ```
2. Install frontend dependencies
   ```sh
   cd palabatu-fe && npm install
   ```
3. Install backend dependencies
   ```sh
   cd ../palabatu-be && go mod download
   ```
4. Start PostgreSQL and apply the schema (the `migrate` service in `docker-compose.yml` runs everything in `migrations/`, then exits)
   ```sh
   docker compose up -d
   ```
5. Create `palabatu-be/.env` from the example — the default `DATABASE_URL` already matches the docker-compose credentials; comments in the file explain where to get a JWT secret and free-tier Resend/Cloudinary credentials
   ```sh
   cp palabatu-be/environments/.env.example palabatu-be/.env
   ```
6. Create `palabatu-fe/.env`
   ```env
   VITE_API_URL=http://localhost:3001
   ```

## Usage

```sh
# Backend
cd palabatu-be && go run ./cmd/api      # http://localhost:3001

# Frontend (new terminal)
cd palabatu-fe && npm run dev           # http://localhost:5173
```

Vite proxies `/api` and `/auth` to the backend in dev, so `http://localhost:5173` is the only URL you need to open. The interactive map lives at `/map`.

## Testing & CI

- `npx playwright test` — end-to-end suite in `tests/` (browser binaries are already installed; `playwright.config.ts` auto-starts both the Go API and the Vite dev server, or reuses ones you already have running)
- `cd palabatu-fe && npm run lint` — ESLint
- `cd palabatu-be && go vet ./...` — Go static checks
- No unit test suite yet on either side — no Vitest config, no `_test.go` files
- `.github/workflows/ci.yml` runs `go vet`/`go build` and `npm run lint`/`npm run build` on every PR and on push to `dev`

## Database

Schema lives in `migrations/` as numbered `golang-migrate` pairs. Day-to-day, use `scripts/db.ps1` instead of the raw CLI — it reads `DATABASE_URL` from `palabatu-be/.env` and refuses to run against a `neon.tech` host:

```powershell
.\scripts\db.ps1 up
.\scripts\db.ps1 down 1
.\scripts\db.ps1 version
```

See [CLAUDE.md](CLAUDE.md) for the full rundown, including the raw-CLI form and the production-safety rules.

## Deployment

`palabatu.id` is deployed on a Hostinger VPS, serving the `stage` branch behind Caddy. The deployment is real and proven end to end, but the app is not open: `stage` sets `UNDER_CONSTRUCTION` in `palabatu-fe/src/App.tsx`, so every route falls through to a single under-construction screen while the app is reworked. Treat "deployed" and "launched" as separate milestones here; only the first has happened.

It runs as one image built from the root `Dockerfile`: `palabatu-be`'s Go binary answers `/api` and `/auth` and serves the built `palabatu-fe/dist` for every other route (`STATIC_DIR`, see `palabatu-be/cmd/api/static.go`). There is no separate frontend host.

Two things are easy to trip over:

- **The `Dockerfile` lives only on `stage`**, along with `deploy/` (the compose file and Caddyfile) and the deploy docs. None of them are on `main`, `dev`, `ci`, or `devtools`. If you're on one of those and don't see them, nothing is missing — check `git cat-file -e stage:Dockerfile` before recreating anything.
- **`STATIC_DIR` is production-only.** Leave it unset in dev, where Vite serves the frontend and proxies the API. Setting it locally makes the Go server shadow the dev server in confusing ways.

The full deploy write-up, `hostinger_vps_deployment_handoff.md`, is on `stage` (`git show stage:hostinger_vps_deployment_handoff.md`). An earlier plan to host on Railway was abandoned, and its doc was deleted in `5b7afb6`.

## Roadmap

Auth, profiles, the interactive map, comments, send tracking, topo annotation, and in-app notifications are all live in dev, as is the crags → boulders → problems hierarchy the catalog is built on (a spot you park at, a rock at that spot, a way up that rock) along with its approach guides, duplicate-rock merge flow, and photo attribution. What's left before public launch — and everything planned after it — is tracked in [ROADMAP.md](ROADMAP.md) rather than duplicated here, so it doesn't go stale.

## Contributing

Solo/small-team project, not yet accepting outside contributions while pre-launch.

### Branches

Five long-lived branches, each with a distinct job:

- **`main`** — meant to be production, but it isn't what runs: `palabatu.id` is deployed from `stage`, which is where the `Dockerfile` and `deploy/` config live.
- **`dev`** — primary integration branch. Day-to-day feature work merges here first; CI (`go vet`, `go build`, ESLint, frontend build) runs on every PR and on every push to `dev`.
- **`stage`** — the deployed branch. Deliberately kept behind `dev`, pinned at whatever state is safe to show the public (currently the under-construction screen) while `dev` races ahead with the live app for internal testing. Nothing in the repo deploys it automatically: a redeploy is a manual `git pull` plus `docker compose up` on the VPS.
- **`ci`** — sandbox for iterating on `.github/workflows` changes in isolation, so a broken CI config never blocks real feature work on `dev`/`main`.
- **`devtools`** — long-lived home for owner-only internal tooling (the Developer page, feedback system, and similar admin-facing features), merged into `dev` periodically but kept separable from the main app's feature history.

Short-lived branches branch off `dev` and merge back via PR. `feat/`, `fix/`, `refactor/`, `revamp/` and `ui/` are the intended prefixes, but plenty of live branches predate the convention and use a bare descriptive name instead (`api-contract-migration`, `problem-revamp-be`, `problem-revamp-fe`, `testing-deploy`, `under-construction-page`). Prefix new ones; don't assume an unprefixed branch is something other than ordinary feature work.

## License

No license has been chosen yet — all rights reserved by default until one is added.

## Contact

[@anrizald](https://github.com/anrizald) — [github.com/anrizald/palabatu](https://github.com/anrizald/palabatu)
