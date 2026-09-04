# Deploy handoff — palabatu.id on Railway

Goal: get the `stage` branch (currently just the coming-soon/waitlist gate —
`SITE_LIVE = false` in `palabatu-fe/src/App.tsx`) running at
`https://palabatu.id` on Railway.

One binary serves everything: `palabatu-be`'s Go server answers `/api` and
`/auth`, and serves the built `palabatu-fe/dist` for every other route
(`STATIC_DIR`, see `palabatu-be/cmd/api/static.go`). There is no separate
frontend service — a single Railway service builds and runs the root
[Dockerfile](Dockerfile), which produces one image containing both.

This replaces the old VPS plan: no server to provision, no nginx/certbot to
configure, no systemd unit, no firewall rules, and no dependency on anyone
else's box or access to it. Railway handles TLS, process supervision, and
restarts on its own.

## Current status (as of this handoff)

- Neon (production Postgres) is already migrated to the latest schema
  (`schema_migrations` version 12, clean) — nothing to do here.
- `marketing.palabatu.id` is set up as the Resend-verified sending domain;
  `EMAIL_FROM=noreply@marketing.palabatu.id`.
- Nothing carries over from the old VPS plan — this is a brand-new Railway
  project, so every env var below has to be entered fresh in Railway's
  dashboard. Ask anrizald (ghul) for the actual values (Neon `DATABASE_URL`,
  `JWT_SECRET`, `RESEND_API_KEY`, Cloudinary keys) — don't regenerate blind.
- Not done yet: Railway project creation, env vars, custom domain, DNS.

## 1. Prerequisites

- A Railway account (railway.app), with billing set up — this isn't the
  free-forever tier once a custom domain + always-on service are involved.
- Repo access: `https://github.com/anrizald/palabatu.git`, `stage` branch.
- Nothing to install locally — Railway builds the Dockerfile in the cloud.
  The Railway CLI is optional (useful for `railway logs` / `railway run`
  but not required for the steps below).

## 2. Create the Railway project

1. New Project → Deploy from GitHub repo → select the repo, branch `stage`.
2. **Root Directory**: leave it as the repo root (`/`), not `palabatu-fe` or
   `palabatu-be`. The Dockerfile's `COPY palabatu-fe/...` /
   `COPY palabatu-be/...` lines are written relative to repo root — pointing
   Railway's build context at a subfolder will break the build.
3. Railway should auto-detect the root [Dockerfile](Dockerfile) and use it as
   the builder (Settings → Build → Builder should read "Dockerfile"). If it
   picks Nixpacks instead, switch it manually.

## 3. Environment variables

Settings → Variables. Set these (same list `palabatu-be/environments/.env.example`
documents):

```
DATABASE_URL=<Neon connection string>
JWT_SECRET=<real secret>
OWNER_USER_ID=<your users.id>
RESEND_API_KEY=<real key>
EMAIL_FROM=noreply@marketing.palabatu.id
CLIENT_URL=https://palabatu.id
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>
```

Don't set `PORT` or `STATIC_DIR` — the Dockerfile already bakes
`STATIC_DIR=/app/palabatu-fe/dist`, and Railway injects its own `PORT` at
runtime, which `main.go` already reads (`os.Getenv("PORT")`, falls back to
`3001` only if unset). Setting a `PORT` variable yourself would just
override Railway's and risk mismatching the port it actually proxies to.

## 4. Build-time variable: `VITE_API_URL`

This is the one gotcha specific to this Dockerfile. Vite inlines `VITE_*`
vars into the bundle at build time — it is not read at container runtime —
so it has to reach the `frontend-builder` stage as a Docker build arg, not
just a normal runtime env var:

```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build
```

In Railway: Settings → Build → **Build Arguments** (separate from the
regular Variables tab used in step 3) → add:

```
VITE_API_URL=https://palabatu.id
```

If this only gets set as a normal runtime variable instead, the build stage
never sees it and the frontend ships pointed at nothing — this will look
like everything deployed fine but API calls will fail from the browser.
Verify by checking the built bundle actually calls `https://palabatu.id/api/...`
in the browser network tab after first deploy.

## 5. Health check

Settings → Deploy → Health Check Path → `/healthz` (already implemented,
returns `200`). Lets Railway know a deploy is actually healthy before
routing traffic to it, and restarts the container if it stops responding.

## 6. Custom domain + TLS

Settings → Networking → Custom Domain → add `palabatu.id` and
`www.palabatu.id` separately. Railway will show the exact DNS record
(type + value) to create for each — follow what it displays rather than
assuming A vs CNAME, since Railway's edge targets can change. TLS is
issued and renewed automatically once DNS resolves and Railway verifies
ownership; there's no certbot step.

## 7. DNS

Domain is registered at Hostinger, currently unpointed (still shows
Hostinger's parking page). In Hostinger's DNS zone for `palabatu.id`, add
whatever records Railway showed in step 6 for both the apex (`palabatu.id`)
and `www`. If Hostinger doesn't support the record type Railway wants for
the apex domain (some registrars don't support `CNAME`/`ALIAS` on a bare
apex), Railway's domain docs list the fallback — check there before
assuming it's blocked.

## 8. Verify

```sh
curl -I https://palabatu.id/healthz          # expect 200
curl https://palabatu.id/api/waitlist/count   # expect {"count": N}
```

Then in a browser: `https://palabatu.id` should show the coming-soon page
(not the full app — `SITE_LIVE` is `false`), and submitting an email on it
should both save to `waitlist_subscribers` and send a confirmation email
from `noreply@marketing.palabatu.id`. Also confirm (browser dev tools,
Network tab) that requests are actually going to `https://palabatu.id/api/...`
— this is the check that step 4's build arg actually landed.
