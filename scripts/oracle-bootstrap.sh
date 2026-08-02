#!/usr/bin/env bash
# Bootstrap Shmerling on an Oracle Cloud Ubuntu VM (Always Free Ampere or x86).
# Run from the repo root as a user with sudo:
#   sudo bash scripts/oracle-bootstrap.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash scripts/oracle-bootstrap.sh" >&2
  exit 1
fi

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
APP_USER="${SUDO_USER:-ubuntu}"
APP_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
NODE_MAJOR="${NODE_MAJOR:-24}"
APP_PORT="${PORT:-3000}"
SERVICE_NAME="shmerling"

echo "[oracle-bootstrap] Repo: ${ROOT}"
echo "[oracle-bootstrap] App user: ${APP_USER}"
echo "[oracle-bootstrap] Port: ${APP_PORT}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates curl gnupg git build-essential \
  ufw

# Stockfish: apt package is available for both amd64 and arm64 (Ampere).
apt-get install -y stockfish || true

# Node.js 24.x (matches package.json engines)
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "^v${NODE_MAJOR}\\."; then
  echo "[oracle-bootstrap] Installing Node.js ${NODE_MAJOR}.x…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

node -v
npm -v

echo "[oracle-bootstrap] Installing npm dependencies…"
cd "${ROOT}"
sudo -u "${APP_USER}" npm install --omit=dev

echo "[oracle-bootstrap] Ensuring Stockfish at bin/stockfish…"
sudo -u "${APP_USER}" env INSTALL_STOCKFISH=1 npm run postinstall || \
  sudo -u "${APP_USER}" env INSTALL_STOCKFISH=1 bash "${ROOT}/scripts/install-stockfish-linux.sh" || true

# Prefer apt binary on ARM / when download is wrong-arch
if [[ -x /usr/games/stockfish ]]; then
  mkdir -p "${ROOT}/bin"
  ln -sfn /usr/games/stockfish "${ROOT}/bin/stockfish"
  chown -h "${APP_USER}:${APP_USER}" "${ROOT}/bin/stockfish" || true
  echo "[oracle-bootstrap] Linked bin/stockfish -> /usr/games/stockfish"
fi

if [[ ! -f "${ROOT}/.env" ]]; then
  if [[ -f "${ROOT}/deploy/oracle.env.example" ]]; then
    cp "${ROOT}/deploy/oracle.env.example" "${ROOT}/.env"
    chown "${APP_USER}:${APP_USER}" "${ROOT}/.env"
    chmod 600 "${ROOT}/.env"
    echo "[oracle-bootstrap] Created .env from deploy/oracle.env.example — EDIT IT before starting."
  else
    echo "[oracle-bootstrap] WARNING: no .env found. Create ${ROOT}/.env before starting the service."
  fi
fi

UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
cat >"${UNIT}" <<EOF
[Unit]
Description=Shmerling chess server
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${ROOT}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=UCI_LOW_MEMORY=1
EnvironmentFile=-${ROOT}/.env
ExecStart=$(command -v node) ${ROOT}/server.js
Restart=on-failure
RestartSec=5
# Soft cap so one Stockfish spike does not take down the whole VM
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"

# Firewall: Oracle also needs the VCN Security List / NSG open for this port.
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow "${APP_PORT}/tcp" || true
  ufw --force enable || true
fi
# Legacy iptables path used on some Oracle images
iptables -I INPUT -p tcp --dport "${APP_PORT}" -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true

echo
echo "[oracle-bootstrap] Done."
echo "  1) Edit ${ROOT}/.env (DATABASE_URL, secrets, STOCKFISH_PATH)"
echo "  2) Open TCP ${APP_PORT} in Oracle VCN → Security List / NSG (ingress 0.0.0.0/0)"
echo "  3) sudo systemctl restart ${SERVICE_NAME} && sudo systemctl status ${SERVICE_NAME}"
echo "  4) Visit http://<public-ip>:${APP_PORT}"
echo
echo "STOCKFISH_PATH tip: ${ROOT}/bin/stockfish  (or /usr/games/stockfish)"
