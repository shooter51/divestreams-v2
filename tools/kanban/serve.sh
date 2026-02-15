#!/usr/bin/env bash
#
# serve.sh - Start the Kanban board local server
#
# Usage:
#   ./serve.sh          # Starts on port 8484
#   ./serve.sh 9090     # Starts on custom port
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8484}"

echo ""
echo "  DiveStreams Agent Kanban Board"
echo "  =============================="
echo ""
echo "  URL:  http://localhost:$PORT/board.html"
echo "  Data: $SCRIPT_DIR/tasks.json"
echo ""
echo "  Quick commands:"
echo "    ./update-task.sh list"
echo "    ./update-task.sh add \"Title\" \"Desc\" P1 backlog"
echo "    ./update-task.sh move <id> in_progress"
echo "    ./update-task.sh <id> status done"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

cd "$SCRIPT_DIR"
python3 -m http.server "$PORT"
