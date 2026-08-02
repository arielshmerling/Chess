#!/usr/bin/env bash
# Download an official Stockfish Linux binary into ./bin/stockfish (for Render / Linux hosts).
# Safe default: ubuntu x86-64 sse41-popcnt (broad CPU compatibility).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
BIN_DIR="${ROOT}/bin"
OUT="${BIN_DIR}/stockfish"
TAG="${STOCKFISH_RELEASE_TAG:-sf_17.1}"
ASSET="${STOCKFISH_ASSET:-stockfish-ubuntu-x86-64-sse41-popcnt.tar}"
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
echo "[install-stockfish] Set STOCKFISH_PATH=${OUT}"
# Quick smoke: binary exists and is executable
test -x "${OUT}"
