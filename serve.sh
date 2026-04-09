#!/bin/bash
PORT="${PORT:-3000}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "Server running at http://localhost:$PORT/"
powershell -ExecutionPolicy Bypass -File "$ROOT/serve.ps1"
