# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Palabatu — a community web app for Indonesian bouldering enthusiasts (interactive spot map, climber profiles, route/problem listings). Live at https://palabatu.id. Status: work in progress.

## Repo layout: two independent Node projects

The frontend (`palabatu-fe/`) and backend (`palabatu-be/`) are **separate npm projects** — separate `package.json`, `node_modules`, and `tsconfig.json`. Install and run each independently. `palabatu-fe/` uses `"type": "module"` (ESM, `verbatimModuleSyntax`); `palabatu-be/` uses `"type": "commonjs"`. Don't assume settings from one apply to the other.

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

There is no test suite configured in either project (no test script, no test runner installed). Don't assume Jest/Vitest exists — check before referencing test commands.

Both servers must run simultaneously for the app to work end to end. Vite proxies `/api` and `/auth` to `http://localhost:3001` in dev ([palabatu-fe/vite.config.ts](palabatu-fe/vite.config.ts)), and `palabatu-fe/src/lib/api.ts` falls back to `VITE_API_URL` or `http://localhost:3001` otherwise.

## Environment variables

- `palabatu-fe/.env`: `VITE_API_URL` (backend base URL).
- `palabatu-be/.env`: `PORT`, `DATABASE_URL` (Postgres), `JWT_SECRET`, Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), Nodemailer/email credentials.

## Architecture

**Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4. Routing is a flat `<Routes>` tree in [palabatu-fe/src/App.tsx](palabatu-fe/src/App.tsx). Pages live in `src/pages/`, shared UI in `src/components/`. Map view (`src/pages/Map.tsx`) uses React Leaflet with marker clustering.

**Auth**: JWT-based, not Supabase (Supabase Auth UI packages are installed but the actual flow is custom JWT). `src/lib/AuthContext.tsx` provides `user`, `handleLogin`, `handleSignup`, `handleLogout`, and a toast helper; on mount it validates any stored token via `GET /auth/session`. Token is stored in `localStorage` under the key `token`.

**API client** ([palabatu-fe/src/lib/api.ts](palabatu-fe/src/lib/api.ts)): a thin fetch wrapper (`api.get/post/put/upload/delete`) that attaches `Authorization: Bearer <token>` from `localStorage` on every call and returns the parsed JSON body directly (not a `{ data, error }` envelope — some dead code in `App.tsx`'s unused `Home()` still destructures that shape; don't copy that pattern).

**Backend**: Express 5 app ([palabatu-be/index.ts](palabatu-be/index.ts)) mounting two routers: `routes/auth.ts` at `/auth` and `routes/api.ts` at `/api`. CORS origins are an explicit hardcoded list in `index.ts` (includes LAN IPs used for testing on a phone during dev — add new LAN IPs there if needed, don't switch to a wildcard-only policy).

- `requireAuth` middleware ([palabatu-be/middleware/auth.ts](palabatu-be/middleware/auth.ts)) verifies the JWT and attaches the decoded payload as `req.user` (untyped, cast with `as any` at call sites).
- No ORM — all queries are hand-written SQL via a raw `pg.Pool` ([palabatu-be/db/client.ts](palabatu-be/db/client.ts)).
- Core tables (inferred from queries, no schema file in repo): `users`, `profiles`, `problems`, `sends`, `comments`.
- Authorization beyond "owns the resource": `profiles.title` stores a JSON array of title strings; `getUserTitles()` in `routes/api.ts` checks for `'Council'` to grant elevated permissions (edit/delete other users' problems).
- Image uploads: `multer` memory storage → streamed to Cloudinary (`kepalabatu_topos` / `kepalabatu_avatars` folders) → the returned `secure_url` is stored (as a JSON array, in `problems.image_urls`). Deleting a problem re-derives the Cloudinary `public_id` from the stored URL to destroy the asset.
- Email (verification, password reset) goes through `palabatu-be/lib/mailer.ts` via Nodemailer; signup rolls back the created user row if the verification email fails to send.

## Known WIP rough edges

- `App.tsx` has an unused `Home()`/`About()` component pair left over from an earlier Supabase-based setup — not wired into any route.
- `req.user` on the backend is typed as `any`; if you touch auth-adjacent routes, keep in mind there's no shared `Request` type augmentation yet.
