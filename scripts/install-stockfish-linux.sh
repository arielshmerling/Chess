#!/usr/bin/env bash
# Download an official Stockfish Linux binary into ./bin/stockfish (for Render / Linux hosts).
# Default: generic ubuntu x86-64 (best free-tier / shared-CPU compatibility).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
BIN_DIR="${ROOT}/bin"
OUT="${BIN_DIR}/stockfish"
TAG="${STOCKFISH_RELEASE_TAG:-sf_17.1}"
# Prefer the baseline binary (no SSE4.1 / AVX2 requirement). Override with STOCKFISH_ASSET if needed.
ASSET="${STOCKFISH_ASSET:-stockfish-ubuntu-x86-64.tar}"
URL="https://github.com/official-stockfish/Stockfish/releases/download/${TAG}/${ASSET}"

mkdir -p "${BIN_DIR}"
TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

echo "[install-stockfish] Downloading ${URL}"
curl -fsSL -o "${TMP}/${ASSET}" "${URL}"

echo "[install-stockfish] Extracting…"
tar -xf "${TMP}/${ASSET}" -C "${TMP}"

# Prefer an executable whose name starts with stockfish-
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
echo "[install-stockfish] Smoke-testing UCI handshake…"
SMOKE_OUT="$(mktemp)"
set +e
if command -v timeout >/dev/null 2>&1; then
  printf 'uci\nquit\n' | timeout 45s "${OUT}" >"${SMOKE_OUT}" 2>&1
else
  printf 'uci\nquit\n' | "${OUT}" >"${SMOKE_OUT}" 2>&1
fi
SMOKE_STATUS=$?
set -e
if ! grep -q '^uciok$' "${SMOKE_OUT}"; then
  echo "[install-stockfish] ERROR: binary did not answer uciok (exit=${SMOKE_STATUS})" >&2
  head -n 40 "${SMOKE_OUT}" >&2 || true
  exit 1
fi
rm -f "${SMOKE_OUT}"

echo "[install-stockfish] UCI ok. Set STOCKFISH_PATH=${OUT}"
test -x "${OUT}"
