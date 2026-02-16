#!/bin/bash
# Log viewer for CashFlow application
# Usage: ./scripts/view_logs.sh [options]
#   --errors    Show only errors
#   --tail N    Show last N lines (default: 50)
#   --follow    Follow log output (like tail -f)
#   --json      Show raw JSON logs
#   --search PATTERN  Search for pattern in logs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../backend/logs"

ERRORS_ONLY=false
TAIL_LINES=50
FOLLOW=false
RAW_JSON=false
SEARCH_PATTERN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --errors) ERRORS_ONLY=true; shift ;;
        --tail) TAIL_LINES="$2"; shift 2 ;;
        --follow) FOLLOW=true; shift ;;
        --json) RAW_JSON=true; shift ;;
        --search) SEARCH_PATTERN="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [ "$ERRORS_ONLY" = true ]; then
    LOG_FILE="$LOG_DIR/error.log"
else
    LOG_FILE="$LOG_DIR/app.log"
fi

if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found: $LOG_FILE"
    echo "Make sure the backend is running."
    exit 1
fi

if [ "$RAW_JSON" = true ]; then
    if [ "$FOLLOW" = true ]; then
        tail -f "$LOG_FILE"
    else
        tail -n "$TAIL_LINES" "$LOG_FILE"
    fi
elif [ -n "$SEARCH_PATTERN" ]; then
    grep -i "$SEARCH_PATTERN" "$LOG_FILE" | tail -n "$TAIL_LINES" | python3 -m json.tool 2>/dev/null || tail -n "$TAIL_LINES" "$LOG_FILE"
elif [ "$FOLLOW" = true ]; then
    tail -f "$LOG_FILE" | while read -r line; do
        echo "$line" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    level = d.get('level', '?')
    ts = d.get('timestamp', '?')[:19]
    msg = d.get('message', '?')
    path = d.get('path', '')
    status = d.get('status_code', '')
    duration = d.get('duration_ms', '')
    extra = f' [{path} {status} {duration}ms]' if path else ''
    colors = {'ERROR': '\033[91m', 'WARNING': '\033[93m', 'INFO': '\033[92m', 'DEBUG': '\033[94m'}
    reset = '\033[0m'
    color = colors.get(level, '')
    print(f'{ts} | {color}{level:8s}{reset} | {msg}{extra}')
except:
    print(sys.stdin.read(), end='')
" 2>/dev/null || echo "$line"
    done
else
    tail -n "$TAIL_LINES" "$LOG_FILE" | while read -r line; do
        echo "$line" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    level = d.get('level', '?')
    ts = d.get('timestamp', '?')[:19]
    msg = d.get('message', '?')
    path = d.get('path', '')
    status = d.get('status_code', '')
    duration = d.get('duration_ms', '')
    extra = f' [{path} {status} {duration}ms]' if path else ''
    colors = {'ERROR': '\033[91m', 'WARNING': '\033[93m', 'INFO': '\033[92m', 'DEBUG': '\033[94m'}
    reset = '\033[0m'
    color = colors.get(level, '')
    print(f'{ts} | {color}{level:8s}{reset} | {msg}{extra}')
except:
    print(sys.stdin.read(), end='')
" 2>/dev/null || echo "$line"
    done
fi
