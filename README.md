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
    <strong>Status: work in progress, not yet deployed.</strong> <code>palabatu.id</code> is the planned production domain; nothing is hosted there yet.
    <br />
    <br />
    <a href="https://github.com/anrizald/palabatu/issues">Report Bug / Request Feature</a>
  </p>
</div>

## About

Palabatu is a web-first community platform for the Indonesian bouldering scene: discover spots on an interactive map, log sends, comment on problems, and maintain a climber profile.

Two independent projects live in this repo, each with its own dependency manager — install and run each separately:

- **`palabatu-fe/`** — React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Map view built on React Leaflet with marker clustering. Installable as a PWA; mobile is a primary target, not an afterthought.
- **`palabatu-be/`** — Go (Gin + `pgx/v5` + PostgreSQL). A rewrite of an earlier Node/Express backend, which has been fully retired and removed from this repo.

See [CLAUDE.md](CLAUDE.md) for the full architecture breakdown and [ROADMAP.md](ROADMAP.md) for what's shipped vs. planned.

### Built with

- React 19, TypeScript, Vite 7, Tailwind CSS 4
- React Leaflet (interactive map, marker clustering)
- Go, Gin, `pgx/v5`, PostgreSQL 18
- JWT auth (`golang-jwt/jwt/v5`), Cloudinary (image uploads), Prometheus `client_golang` (HTTP metrics)

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Go 1.26+
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

- `npx playwright test` — end-to-end suite in `tests/` (browser binaries are already installed; the dev server auto-starts via `playwright.config.ts`)
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

## Roadmap

Auth, profiles, the interactive map, problem/spot CRUD, comments, send tracking, topo annotation, and in-app notifications are all live in dev. What's left before the first production deploy — and everything planned after it — is tracked in [ROADMAP.md](ROADMAP.md) rather than duplicated here, so it doesn't go stale.

## Contributing

Solo/small-team project, not yet accepting outside contributions while pre-launch.

### Branches

Five long-lived branches, each with a distinct job:

- **`main`** — production. What deploys to `palabatu.id` once the site is actually hosted.
- **`dev`** — primary integration branch. Day-to-day feature work merges here first; CI (`go vet`, `go build`, ESLint, frontend build) runs on every PR and on every push to `dev`.
- **`stage`** — public-facing holding branch. Deliberately kept behind `dev`, pinned at whatever state is safe to show the public (currently the "coming soon" gate) while `dev` races ahead with the live app for internal testing.
- **`ci`** — sandbox for iterating on `.github/workflows` changes in isolation, so a broken CI config never blocks real feature work on `dev`/`main`.
- **`devtools`** — long-lived home for owner-only internal tooling (the Developer page, feedback system, and similar admin-facing features), merged into `dev` periodically but kept separable from the main app's feature history.

Short-lived branches (`feat/`, `fix/`, `refactor/`, `revamp/`, `ui/`) branch off `dev` and merge back via PR.

## License

No license has been chosen yet — all rights reserved by default until one is added.

## Contact

[@anrizald](https://github.com/anrizald) — [github.com/anrizald/palabatu](https://github.com/anrizald/palabatu)
