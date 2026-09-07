#!/usr/bin/env bash
PORT="${PORT:-3000}"
for pid in $(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do kill "$pid" 2>/dev/null && echo "stopped $pid"; done
