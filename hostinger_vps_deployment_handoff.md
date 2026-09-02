# Deploy handoff — palabatu.id on a Hostinger VPS

Goal: get the `stage` branch (currently just the coming-soon/waitlist gate —
`SITE_LIVE = false` in `palabatu-fe/src/App.tsx`) running at
`https://palabatu.id` on a Hostinger KVM VPS.

One binary serves everything: `palabatu-be`'s Go server answers `/api` and
`/auth`, and serves the built `palabatu-fe/dist` for every other route
(`STATIC_DIR`, see `palabatu-be/cmd/api/static.go`). There is no separate
frontend service — the root [Dockerfile](Dockerfile) (present on `stage`,
not on `main`) produces one image containing both.

This replaces the Railway plan (see this file's git history for that
version). The image itself is unchanged and fully portable; what changes is
that TLS, process supervision, restarts and the deploy trigger are now ours
to run instead of Railway's. Caddy covers the first three in about four
lines of config; the fourth is an SSH command.

## Why VPS and not Hostinger's cheaper tiers

Hostinger's web/cloud/business hosting is LiteSpeed + PHP + MySQL with no
root, no long-running processes and no Docker. None of them can run a Go
binary at any price. KVM VPS is the only product that fits, and every KVM
tier from KVM 1 up has full root and a Docker-ready OS template.

## Current status (as of this handoff)

- Neon remains production Postgres. The VPS runs one stateless container,
  which is what keeps rebuilding or replacing the box risk-free.
- **Neon's schema is behind.** The Railway-era handoff recorded it at
  `schema_migrations` version 12, clean; `migrations/` is at 0018. Verify
  and apply before deploying anything past the coming-soon gate (step 8).
- `marketing.palabatu.id` is set up as the Resend-verified sending domain;
  `EMAIL_FROM=noreply@marketing.palabatu.id`.
- Domain is registered at Hostinger, currently unpointed (still shows
  Hostinger's parking page).
- **The box is provisioned and ready** (`148.230.97.16`, steps 1 through 3
  complete): Ubuntu 24.04.4, `deploy` user with key-only SSH and passwordless
  sudo, root login and password auth both off, ufw active on 22/80/443,
  unattended-upgrades on, Docker 29.7.2 + Compose v5.5.0, `/opt/palabatu`
  created and owned by `deploy`. Nothing is listening on 80/443 yet.
- Still missing on the hosting side: DNS records, Cloudflare, the GitHub
  deploy key, and `deploy/.env`. Ask anrizald (ghul) for the real secret
  values (Neon `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, Cloudinary
  keys) — don't regenerate blind.
- `stage` now carries the merged app (`under-construction-page` merged in),
  the root `Dockerfile`, `deploy/compose.yml`, `deploy/Caddyfile`, and the
  trusted-proxies change from step 6. The repo side is ready; what's left is
  ordering the box, the secrets, DNS, and the Neon migration.
- **Which curtain ships is still a live decision.** `App.tsx` has both
  `SITE_LIVE = false` and `UNDER_CONSTRUCTION = true`, and the latter wins.
  That means `UnderConstruction.tsx`, which is a static screen with no email
  field. `ComingSoon.tsx` is the one wired to `POST /api/waitlist`. Shipping
  as currently flagged launches with no email capture at all, leaving the
  waitlist table, the Resend domain and the confirmation email unused.

## 1. Order the VPS

**Ordered:** KVM 2, `srv1950331.hstgr.cloud`, monthly term (first renewal
2026-10-02). Pending the Setup wizard, so it has no IP yet.

- **Plan:** KVM 1 (1 vCPU / 4 GB RAM / 50 GB NVMe) would have been enough --
  the box runs one Go process plus Caddy, with Postgres on Neon. KVM 2
  (2 vCPU / 8 GB) is what we took, which buys enough headroom that the
  image build never needs swap and that moving Postgres onto the box later
  stays an option rather than a re-order.
- **Location:** Hostinger has **no Singapore VPS region**. Their Asia VPS
  locations are Indonesia (Jakarta), Malaysia (Kuala Lumpur) and India.
  Jakarta is the right pick for the user base. Check which region the Neon
  project sits in first: Neon's SEA region is Singapore, so every query
  crosses Jakarta to Singapore at roughly 20 ms. That is fine for this app,
  but it is a reason not to add chatty per-request query fan-out later.
- **OS template (chosen in the Setup wizard):** Ubuntu 24.04, either plain
  or with Hostinger's Docker application template. **Do not pick any
  control panel image** -- cPanel, Plesk, CyberPanel, CloudPanel and Webuzo
  all install their own nginx or OpenLiteSpeed bound to ports 80 and 443,
  which is exactly where Caddy needs to be. Recovering from that means
  reinstalling the OS. Skip the Coolify template too; we went with Compose
  plus Caddy instead (see this file's git history for that comparison).
- **SSH key:** paste your public key into the wizard rather than relying on
  a root password. Still set a strong root password when asked -- Hostinger
  uses it for browser-console/VNC recovery, which is your way back in if
  you ever lock yourself out over SSH. Step 2 disables password auth for
  SSH specifically, not for the console.
- **Term:** the headline price assumes a 24 to 48 month commitment and the
  renewal rate is materially higher. Read the renewal column before
  committing to four years.
- Add your SSH public key during setup rather than using a root password.

## 2. First-boot hardening

**Run [scripts/provision-vps.sh](scripts/provision-vps.sh) instead of doing
this by hand** -- `./scripts/provision-vps.sh <ip>`, idempotent, safe to
re-run. The commands below are what it does, kept here because two details
are easy to get wrong and one of them fails silently.

The script exists because applying an OS template in Hostinger's panel
**reimages the box and wipes all of this**. That happened once already (the
first provisioning pass was done against a VPS that was mid-reinstall), so
assume it can happen again. A reimage also changes the SSH host key; the
script clears the stale `known_hosts` entry itself, but by hand that shows
up as an alarming man-in-the-middle warning that is, in this one case,
expected.

```sh
# As root. Additive first -- nothing here can lock you out.
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-deploy && chmod 440 /etc/sudoers.d/90-deploy
```

**Verify `ssh deploy@<ip> 'sudo -n whoami'` returns `root` before running
anything below.** Disabling root login while the replacement account is
unproven is the one move here that ends in a support ticket.

```sh
# Only after that check passes.
printf "PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\n" \
  > /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t && systemctl restart ssh
```

**The filename matters, and this is the silent-failure part.** Hostinger's
image ships `/etc/ssh/sshd_config.d/50-cloud-init.conf` containing
`PasswordAuthentication yes`. sshd takes the *first* occurrence of a keyword
and `Include sshd_config.d/*.conf` sits at the top of the main config, so
that file beats both `60-cloudimg-settings.conf` (which sets it to `no`) and
anything you `sed` into `/etc/ssh/sshd_config` itself. Editing the main file
looks like it worked and changes nothing. A `00-` prefixed drop-in sorts
first and actually wins. Confirm with `sshd -T | grep -E
"permitrootlogin|passwordauthentication"` rather than by reading the file.

```sh
# As deploy, from here on.
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw --force enable      # --force, or it prompts and hangs non-interactively

sudo apt-get update && sudo apt-get install -y unattended-upgrades
# dpkg-reconfigure is interactive; this is the same thing as a file:
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  | sudo tee /etc/apt/apt.conf.d/20auto-upgrades
```

`deploy` gets passwordless sudo because deploys have to run non-interactively
over SSH. That does mean the SSH key is effectively root on this box, which
is the standard trade for a single-admin server and the reason password auth
is off entirely.

**ufw gotcha worth knowing now:** Docker writes its own iptables rules in
the `DOCKER-USER` chain, which are evaluated *before* ufw's INPUT rules. A
port published with `ports:` in compose is reachable from the internet even
if ufw claims to deny it. Our compose only publishes 80 and 443 (via Caddy),
so this is fine as written — but if you ever add `ports: ["5432:5432"]` to
run Postgres on the box, ufw will not protect it. Bind such ports to
`127.0.0.1:5432:5432` instead.

## 3. Install Docker (skip if you used the Docker template)

```sh
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Log out and back in as `deploy` for the group to take effect.

## 4. Get the code onto the box

The repo is private, so the VPS needs read access. Generate a deploy key on
the VPS and add it to the GitHub repo (Settings, Deploy keys, read-only):

```sh
ssh-keygen -t ed25519 -C "palabatu-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # paste into GitHub deploy keys
```

```sh
sudo mkdir -p /opt/palabatu && sudo chown deploy:deploy /opt/palabatu
git clone -b stage git@github.com:anrizald/palabatu.git /opt/palabatu
```

## 5. Deployment files

[deploy/compose.yml](deploy/compose.yml) and [deploy/Caddyfile](deploy/Caddyfile)
are already in the repo on `stage`, so they are reviewable and
version-controlled and there is nothing to type on the box. Only `.env` stays
off GitHub. Reproduced here so this document stands on its own:

`deploy/compose.yml`:

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: Dockerfile
      args:
        # Vite inlines VITE_* at build time, so this MUST be a build arg.
        # As a plain runtime env var it silently ships a bundle pointed at
        # nothing: the site loads, every API call fails.
        VITE_API_URL: https://palabatu.id
    env_file: .env
    restart: unless-stopped
    # Deliberately no `ports:` — only Caddy is reachable from outside.
    # This is also what makes the X-Forwarded-For chain trustworthy.
    networks: [edge]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data      # certificates — must persist across restarts
      - caddy_config:/config
    networks: [edge]
    depends_on: [app]

networks:
  edge:
    ipam:
      config:
        # Pinned so TRUSTED_PROXIES below is stable rather than whatever
        # subnet Docker happens to hand out.
        - subnet: 172.28.0.0/16

volumes:
  caddy_data:
  caddy_config:
```

`deploy/Caddyfile`:

```
palabatu.id, www.palabatu.id {
	encode zstd gzip

	# /metrics is Prometheus output with no auth in front of it (see
	# main.go). It leaks route names and traffic volumes, and nothing
	# external scrapes it yet, so close it at the edge.
	@metrics path /metrics
	respond @metrics 404

	reverse_proxy app:3001
}
```

That is the whole of the TLS setup: Caddy provisions and renews Let's
Encrypt certificates automatically once DNS resolves to the box. There is no
certbot step and no renewal cron.

`/opt/palabatu/deploy/.env` (never committed; `.dockerignore` already
excludes `**/.env`):

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
TRUSTED_PROXIES=172.28.0.0/16
```

Don't set `PORT` or `STATIC_DIR` — the Dockerfile bakes both
(`STATIC_DIR=/app/palabatu-fe/dist`, `PORT=3001`) and Caddy proxies to 3001.

## 6. Trusted proxies (already applied)

This one is done, recorded here because it is the least obvious thing in the
whole setup and the failure mode is silent.

`cmd/api/main.go` did not call `r.SetTrustedProxies`. gin's default is to
trust **every** proxy (`0.0.0.0/0`) and read the client IP out of
`X-Forwarded-For`. Directly exposed that was harmless. Behind a reverse
proxy it is not: `c.ClientIP()` will believe an `X-Forwarded-For` value a
client set itself, and since that is exactly what `middleware.RateLimit`
keys its per-IP token buckets on, an attacker can rotate the header and
bypass every rate limit in the app — the blanket `/api` backstop, the
credential-endpoint limiter, and the Cloudinary upload limits alike.

What landed in `main.go`, right after `r := gin.New()`:

```go
// Behind Caddy the app never sees a real client IP on the connection, so
// it has to read one from X-Forwarded-For — but gin's default is to trust
// every proxy, which means it would equally trust a header the client
// forged. middleware.RateLimit keys its buckets on c.ClientIP(), so that
// default is a rate-limit bypass. Trust only the Docker network Caddy
// reaches us over. Unset (local dev, direct `go run`) keeps gin's default.
if proxies := os.Getenv("TRUSTED_PROXIES"); proxies != "" {
	if err := r.SetTrustedProxies(strings.Split(proxies, ",")); err != nil {
		log.Fatalf("invalid TRUSTED_PROXIES: %v", err)
	}
}
```

Unset (local dev, direct `go run`) it keeps gin's default, so nothing about
local development changes. `TRUSTED_PROXIES` is documented in
`palabatu-be/environments/.env.example` and set in `deploy/.env` to match
the pinned `172.28.0.0/16` subnet in `deploy/compose.yml`. If you ever
change that subnet, change both.

Sanity check after deploying: hit the site with
`curl -H 'X-Forwarded-For: 1.2.3.4' https://palabatu.id/healthz` and confirm
the gin access log records your real IP, not `1.2.3.4`.

## 7. First deploy

```sh
cd /opt/palabatu/deploy
docker compose up -d --build
docker compose logs -f app
```

The frontend build (`npm ci` + `vite build`) runs inside the image build and
is the memory-hungry step. KVM 2's 8 GB clears it comfortably, so the swap
workaround the KVM 1 sizing would have needed doesn't apply.

This exact build was verified locally against the merged `stage` branch
before any of it reached a VPS: image builds clean, container boots, serves
`/healthz`, `/api/waitlist/count` and the SPA shell. So a failure here is a
box or env problem, not a Dockerfile problem.

## 8. Migrations against Neon

Check first, then apply. Run this from your local machine (the `migrate`
CLI is already installed there per CLAUDE.md) with `DATABASE_URL` pointed at
Neon:

```sh
migrate -path migrations -database "$DATABASE_URL" version   # expect 12
migrate -path migrations -database "$DATABASE_URL" up        # -> 18
```

- Use the raw CLI here, not `scripts/db.ps1` — that script refuses to run at
  all against a `neon.tech` host by design.
- **Never run `down` against Neon.** It drops tables. That guard is the
  entire reason `db.ps1` exists.
- The coming-soon gate only exercises `waitlist_subscribers`, so it will
  appear to work even on the stale schema. Don't take that as evidence the
  migration isn't needed — flipping `SITE_LIVE` on a v12 database breaks
  the whole app.

## 9. DNS

The VPS has a static IP, so this is simpler than the Railway version was:
no apex CNAME problem, just A records. In Hostinger's DNS zone for
`palabatu.id`:

```
A     @      <vps-ip>
A     www    <vps-ip>
```

Wait for propagation, then bring Caddy up (or restart it) — it needs DNS
resolving to the box before Let's Encrypt will validate.

## 10. Cloudflare in front (do this, but after step 11 passes)

CLAUDE.md flags that there is no network-edge protection anywhere in this
repo and that it "needs to be a real decision made at hosting time." On a
bare VPS with a public IP that decision is now due, and the free tier covers
it: DDoS absorption, a basic WAF, caching, and hiding the origin IP.

Move `palabatu.id`'s nameservers to Cloudflare, import the two A records,
and set both to Proxied (orange cloud).

Two follow-ups that matter once traffic is proxied:

1. **Real client IPs.** Caddy will now see Cloudflare edge IPs, and pass
   those to the app, so every rate-limit bucket ends up keyed per
   Cloudflare edge node instead of per user. Fix it by taking Cloudflare's
   own header, in `deploy/Caddyfile`:

   ```
   reverse_proxy app:3001 {
   	header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
   }
   ```

2. **That header is only trustworthy if Cloudflare is the only thing that
   can reach port 80/443.** Otherwise anyone hitting the origin IP directly
   can set `CF-Connecting-IP` themselves and you are back where step 6
   started. Restrict the firewall to Cloudflare's published ranges
   (`https://www.cloudflare.com/ips-v4` and `-v6`), replacing the blanket
   `ufw allow 80/tcp` / `443/tcp` rules from step 2 with per-range allows.

   Do these two together or neither. Doing (1) without (2) is worse than
   doing nothing.

## 11. Verify

```sh
curl -I https://palabatu.id/healthz            # 200
curl https://palabatu.id/api/waitlist/count    # {"count": N}
curl -I https://palabatu.id/metrics            # 404, blocked at Caddy
curl -I http://palabatu.id                     # 308 redirect to https
```

Then in a browser: `https://palabatu.id` shows the coming-soon page (not the
full app — `SITE_LIVE` is `false`), and submitting an email both saves to
`waitlist_subscribers` and sends a confirmation from
`noreply@marketing.palabatu.id`.

Also confirm in dev tools, Network tab, that requests go to
`https://palabatu.id/api/...`. That is the check that the `VITE_API_URL`
build arg actually landed — if it didn't, everything above still passes and
only the browser fails.

## 12. Redeploying

```sh
ssh deploy@<vps-ip> 'cd /opt/palabatu && git pull && \
  docker compose -f deploy/compose.yml up -d --build'
```

Worth wrapping in a `scripts/deploy.ps1` once the values are real. There is
a brief gap while the container restarts; a zero-downtime story (build the
new image, start it alongside, let Caddy switch, drop the old) is a later
problem, not a launch blocker.

## 13. What we now own that Railway did for us

Track these — they are the actual cost of this move, and none of them fail
loudly on their own:

- **Backups.** Neon covers the database. The VPS holds nothing irreplaceable
  as long as everything except `.env` is in git, so back up `.env` somewhere
  (a password manager entry is enough). Revisit the moment Postgres moves
  onto the box.
- **Patching.** `unattended-upgrades` handles the OS. Docker images do not
  update themselves: periodically `docker compose pull && docker compose up
  -d` for Caddy, and rebuild the app image so the Alpine/Go/Node bases get
  their security fixes.
- **Monitoring.** Nothing watches `/healthz` any more. Cloudflare has health
  checks on paid tiers; a free external pinger (UptimeRobot or similar) is
  the pragmatic version. `restart: unless-stopped` covers a crashed
  container but not a wedged one.
- **Disk.** 50 GB is plenty, but `docker system prune -af` occasionally,
  since every rebuild leaves layers behind and a full disk takes the site
  down in a way that looks like an application bug.
- **Logs.** `docker compose logs` only. Add
  `logging: {driver: json-file, options: {max-size: "10m", max-file: "3"}}`
  to both services if the disk starts filling with gin access logs.
