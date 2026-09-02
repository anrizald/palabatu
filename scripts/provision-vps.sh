#!/usr/bin/env bash
# Provision a fresh Hostinger VPS for palabatu: steps 2-3 of
# hostinger_vps_deployment_handoff.md (deploy user, SSH hardening, firewall,
# unattended-upgrades, Docker).
#
#   ./scripts/provision-vps.sh 148.230.97.16
#
# Run from Git Bash on Windows, or any shell with ssh. Safe to re-run: every
# step is idempotent, so a half-finished run can just be repeated.
#
# Written because Hostinger reimages the box when you apply an OS template,
# which wipes all of this. If that happens again, run this instead of doing
# it by hand.

set -euo pipefail

IP="${1:?usage: provision-vps.sh <ip>}"

echo "==> Clearing any stale host key (a reimage changes it)"
ssh-keygen -R "$IP" >/dev/null 2>&1 || true

echo "==> [1/5] Creating deploy user (additive, cannot lock you out)"
ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes "root@$IP" 'set -e
  id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
  install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
  echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-deploy
  chmod 440 /etc/sudoers.d/90-deploy
  visudo -c -f /etc/sudoers.d/90-deploy >/dev/null'

echo "==> [2/5] Verifying deploy user BEFORE disabling root"
# This gate is the whole reason the script is ordered this way. Locking root
# out while the replacement account is unproven is the one unrecoverable
# mistake available here (short of Hostinger's browser console).
if [ "$(ssh -o BatchMode=yes "deploy@$IP" 'sudo -n whoami' 2>/dev/null)" != "root" ]; then
  echo "FAILED: deploy@$IP cannot sudo. Stopping before root is disabled." >&2
  exit 1
fi
echo "    ok: deploy has passwordless sudo"

echo "==> [3/5] Hardening SSH"
# The filename matters. Hostinger's image ships
# /etc/ssh/sshd_config.d/50-cloud-init.conf with "PasswordAuthentication yes",
# and sshd honours the FIRST occurrence of a keyword with Include at the top
# of the main config -- so editing /etc/ssh/sshd_config silently does nothing
# and a 00- prefixed drop-in is what actually wins.
ssh -o BatchMode=yes "root@$IP" 'set -e
  printf "PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\n" \
    > /etc/ssh/sshd_config.d/00-hardening.conf
  chmod 644 /etc/ssh/sshd_config.d/00-hardening.conf
  sshd -t
  systemctl restart ssh
  sshd -T | grep -E "^(permitrootlogin|passwordauthentication)"'

echo "==> [4/5] Firewall + automatic security updates"
ssh -o BatchMode=yes "deploy@$IP" 'set -e
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
  sudo -E ufw default deny incoming >/dev/null
  sudo -E ufw default allow outgoing >/dev/null
  sudo -E ufw allow OpenSSH >/dev/null
  sudo -E ufw allow 80/tcp >/dev/null
  sudo -E ufw allow 443/tcp >/dev/null
  sudo -E ufw --force enable >/dev/null
  sudo -E ufw status

  # A freshly imaged box runs its own apt on first boot; wait it out rather
  # than failing on the lock.
  for i in $(seq 1 60); do
    pgrep -x apt-get >/dev/null || pgrep -x unattended-upgrade >/dev/null || break
    [ "$i" = 1 ] && echo "    waiting for first-boot apt to finish..."
    sleep 10
  done

  sudo -E apt-get -o DPkg::Lock::Timeout=600 update -qq
  sudo -E apt-get -o DPkg::Lock::Timeout=600 install -y -qq unattended-upgrades
  printf "APT::Periodic::Update-Package-Lists \"1\";\nAPT::Periodic::Unattended-Upgrade \"1\";\n" \
    | sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null'

echo "==> [5/5] Docker"
ssh -o BatchMode=yes "deploy@$IP" 'set -e
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh >/dev/null 2>&1
    rm -f /tmp/get-docker.sh
  fi
  sudo usermod -aG docker deploy
  docker --version
  docker compose version
  systemctl is-active docker'

echo
echo "==> Done. Next: step 4 of the handoff (deploy key + clone)."
echo "    ssh deploy@$IP"
