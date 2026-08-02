#!/usr/bin/env bash
# Install Stockfish into ./bin/stockfish for Linux hosts (Render, Oracle, etc.).
# - x86_64: download official ubuntu baseline binary
# - aarch64 (Oracle Ampere): prefer apt / system binary (no official ubuntu-arm tarball)
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
BIN_DIR="${ROOT}/bin"
OUT="${BIN_DIR}/stockfish"
ARCH="$(uname -m)"

mkdir -p "${BIN_DIR}"

uci_smoke() {
  local bin="$1"
  local smoke
  smoke="$(mktemp)"
  set +e
  if command -v timeout >/dev/null 2>&1; then
    printf 'uci\nquit\n' | timeout 45s "${bin}" >"${smoke}" 2>&1
  else
    printf 'uci\nquit\n' | "${bin}" >"${smoke}" 2>&1
  fi
  local status=$?
  set -e
  if ! grep -q '^uciok$' "${smoke}"; then
    echo "[install-stockfish] ERROR: binary did not answer uciok (exit=${status})" >&2
    head -n 40 "${smoke}" >&2 || true
    rm -f "${smoke}"
    return 1
  fi
  rm -f "${smoke}"
  return 0
}

link_system() {
  local src="$1"
  ln -sfn "${src}" "${OUT}"
  echo "[install-stockfish] Linked ${OUT} -> ${src}"
  uci_smoke "${OUT}"
  echo "[install-stockfish] UCI ok. Set STOCKFISH_PATH=${OUT}"
}

# Prefer system/apt binary first (works on Oracle Ampere arm64 + x86).
for candidate in "${STOCKFISH_SYSTEM_PATH:-}" /usr/games/stockfish /usr/bin/stockfish; do
  if [[ -n "${candidate}" && -x "${candidate}" ]]; then
    echo "[install-stockfish] Found system Stockfish: ${candidate}"
    link_system "${candidate}"
    exit 0
  fi
done

if [[ "${ARCH}" == "aarch64" || "${ARCH}" == "arm64" ]]; then
  echo "[install-stockfish] aarch64 detected and no system binary." >&2
  echo "[install-stockfish] Install with: sudo apt-get install -y stockfish" >&2
  echo "[install-stockfish] Then re-run this script." >&2
  exit 1
fi

TAG="${STOCKFISH_RELEASE_TAG:-sf_17.1}"
ASSET="${STOCKFISH_ASSET:-stockfish-ubuntu-x86-64.tar}"
URL="https://github.com/official-stockfish/Stockfish/releases/download/${TAG}/${ASSET}"

TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

echo "[install-stockfish] Downloading ${URL}"
curl -fsSL -o "${TMP}/${ASSET}" "${URL}"

echo "[install-stockfish] Extracting…"
tar -xf "${TMP}/${ASSET}" -C "${TMP}"

CANDIDATE="$(
  find "${TMP}" -type f \( -name 'stockfish-ubuntu-*' -o -name 'stockfish' \) \
    ! -name '*.tar' ! -name '*.md' \
    -print 2>/dev/null | head -n 1 || true
)"

if [[ -z "${CANDIDATE}" ]]; then
  echo "[install-stockfish] ERROR: no stockfish binary found in archive" >&2
  find "${TMP}" -type f | head -n 50 >&2 || true
  exit 1
fi

cp "${CANDIDATE}" "${OUT}"
chmod +x "${OUT}"

echo "[install-stockfish] Installed: ${OUT}"
uci_smoke "${OUT}"
echo "[install-stockfish] UCI ok. Set STOCKFISH_PATH=${OUT}"
test -x "${OUT}"
