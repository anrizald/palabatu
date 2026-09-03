# Edge protection handoff — what app-level rate limiting can't do

Read this alongside [hostinger_vps_deployment_handoff.md](hostinger_vps_deployment_handoff.md),
specifically its step 10 ("Cloudflare in front"). **This is not a second
plan** — that step already is the plan for the gap described here. This
file exists so whoever executes that handoff has the app-level context for
*why* step 10 isn't optional, plus one verification worth adding to step
11's checklist once it's live.

## What's already true at the app layer (as of 2026-09-03)

Every rate limiter in `palabatu-be` — the blanket `/api` backstop, every
domain's own tighter per-endpoint limiter (auth credentials, waitlist,
feedback, report, comments, uploads), and `internal/hype`'s click counter —
is `middleware.RateLimit`, an in-memory **per-IP** token bucket keyed on
`c.ClientIP()`. See its doc comment in
[ratelimit.go](palabatu-be/internal/middleware/ratelimit.go).

One route is a deliberate exception to how these stack: `POST
/api/hype/click` (the "Allez" cheer button on the under-construction page)
is mounted on its own route group in `main.go`, not the shared `apiGroup`,
so it skips the blanket limiter entirely and relies solely on its own
considerably more generous one (burst 200, 3 req/s sustained forever). This
was sized generously on purpose — see the doc comments on `hype.Routes` and
the `hypeGroup` block in `main.go` for the reasoning — because it's the one
route in the app designed to be mashed by a real visitor as fast as they
physically can.

## What none of this can do

A per-IP limiter's entire model is "one bucket per source address." A
distributed source — a botnet, a pool of proxies, anything that isn't one
IP — gets one fresh bucket per address, so the *aggregate* request rate the
Go process and Postgres actually absorb has no ceiling at the app layer
regardless of how any individual limiter is tuned. This is a general,
app-wide fact, not something this session introduced — CLAUDE.md's "Known
WIP rough edges" already flagged it as the one hardening gap the app alone
can't close.

`/api/hype/click` is worth naming specifically here because it's the most
attractive single target for that shape of abuse on the API today: no auth,
no request body, no captcha — the cheapest possible request to script — and
its own limit was deliberately loosened this session (burst 200, 3/s
forever) specifically so real spamming wouldn't get punished. That's the
right call for a real visitor; it also means a moderately-sized distributed
source multiplies to real sustained throughput against a single hot-row
`UPDATE` faster than it would against any of this app's other, tighter
endpoints.

## Where the actual fix lives

[hostinger_vps_deployment_handoff.md](hostinger_vps_deployment_handoff.md)
step 10 already covers this: Cloudflare in front, free tier, on the VPS's
public IP — DDoS absorption, a basic WAF, and hiding the origin IP — plus
the two follow-ups that must ship together (rewriting `X-Forwarded-For` from
`CF-Connecting-IP` in `deploy/Caddyfile`, and restricting `ufw` to
Cloudflare's published ranges so that header can't be forged by hitting the
origin directly). Don't do one without the other; the handoff already says
so.

Nothing hype-specific needs to be added to that plan. Because `hype`'s
limiter calls the same `c.ClientIP()` as every other domain's, step 10's fix
(`TRUSTED_PROXIES` + the `CF-Connecting-IP` rewrite) corrects IP resolution
for it exactly the same way it does for everything else — there's no
separate edge config this route needs.

## One addition to step 11's verification checklist

Once Cloudflare is live, add this spot check alongside the existing
`curl` checks in step 11: hit `/api/hype/click` a couple dozen times rapidly
from two genuinely different networks (e.g. a phone on mobile data and a
laptop on wifi) and confirm neither throttles the other — both should sail
well under their own 200-request burst independently. If they instead share
a bucket and start 429ing each other quickly, that's the concrete sign the
`CF-Connecting-IP` rewrite isn't actually wired through: every visitor is
collapsing onto a handful of Cloudflare edge-node IPs, which silently makes
*every* limiter in the app over-trigger on ordinary traffic, not just hype's
— hype is just the easiest place to notice it, since it's the one route
tuned to tolerate real bursts and would otherwise go quiet immediately.

## If Cloudflare's own rate-limiting rules ever get configured (paid tier)

Not needed at launch — the free tier used in step 10 doesn't include
configurable rate rules. If a future session adds them, keep any edge-level
rule for `/api/hype/click` at least as loose as the app's own (burst 200,
3/s), or it re-introduces the exact "too strict, a real fan's taps silently
stop counting" problem this session spent two rounds fixing at the app
layer (see git history around 2026-09-03 in
[internal/hype/handler.go](palabatu-be/internal/hype/handler.go)).
