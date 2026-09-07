#!/usr/bin/env bash
# Start (or restart) the production server on port 3000, killing whatever holds the port first.
#   pnpm demo:start            build if needed, then start
#   pnpm demo:start --rebuild  force a fresh production build
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
if [[ "${1:-}" == "--rebuild" || ! -d .next/server ]]; then
  echo "▶ building production bundle…"
  pnpm build >/dev/null
fi
for pid in $(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  echo "▶ stopping pid $pid on :$PORT"; kill "$pid" 2>/dev/null || true
done
sleep 1
for pid in $(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do kill -9 "$pid" 2>/dev/null || true; done
echo "▶ starting next start -p $PORT (log: .prod.log)"
nohup pnpm exec next start -p "$PORT" > .prod.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/agent" | grep -q 200; then
    echo "✓ up: http://localhost:$PORT  ·  family on phone: http://$(ipconfig getifaddr en0 2>/dev/null || echo LAN-IP):$PORT/family"
    exit 0
  fi
  sleep 1
done
echo "✗ server did not come up; see .prod.log"; tail -20 .prod.log; exit 1
