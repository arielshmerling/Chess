#!/bin/sh
# Wrapper so STOCKFISH_PATH can point at a single executable for tests.
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
exec node "$ROOT/test/fixtures/fake-uci-engine.js"
