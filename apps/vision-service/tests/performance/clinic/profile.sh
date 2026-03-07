#!/usr/bin/env bash
# clinic.js profiling script for vision-service
#
# Usage:
#   ./profile.sh doctor|flame|bubbleprof [duration_seconds]
#
# Prerequisites:
#   npm install -g clinic
#   npx nx build vision-service
#
# Examples:
#   ./profile.sh doctor 30        # Event loop analysis for 30s
#   ./profile.sh flame 20         # CPU flame graph for 20s
#   ./profile.sh bubbleprof 30    # Async flow visualization for 30s

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
SERVICE_DIR="$REPO_ROOT/apps/vision-service"
OUTPUT_DIR="$SERVICE_DIR/test-output/performance/clinic"
DIST_MAIN="$SERVICE_DIR/dist/main.js"

PROFILE_TYPE="${1:-doctor}"
DURATION="${2:-30}"

# Validate profile type
case "$PROFILE_TYPE" in
  doctor|flame|bubbleprof) ;;
  *)
    echo "Error: Invalid profile type '$PROFILE_TYPE'. Use: doctor, flame, or bubbleprof"
    exit 1
    ;;
esac

# Check prerequisites
if ! command -v clinic &>/dev/null; then
  echo "Error: clinic.js not found. Install with: npm install -g clinic"
  exit 1
fi

if [ ! -f "$DIST_MAIN" ]; then
  echo "Error: Built service not found at $DIST_MAIN"
  echo "Run: npx nx build vision-service"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "=== Vision Service clinic.js Profiling ==="
echo "  Profile:  $PROFILE_TYPE"
echo "  Duration: ${DURATION}s"
echo "  Output:   $OUTPUT_DIR"
echo ""

# Set environment variables for the service
export VISION_MODEL_PATH="${VISION_MODEL_PATH:-$SERVICE_DIR/models/best.onnx}"
export VISION_INPUT_SIZE="${VISION_INPUT_SIZE:-320}"
export VISION_CONFIDENCE_THRESHOLD="${VISION_CONFIDENCE_THRESHOLD:-0.5}"
export VISION_IOU_THRESHOLD="${VISION_IOU_THRESHOLD:-0.45}"
export GRPC_PORT="${GRPC_PORT:-50057}"

# Run clinic with auto-stop after duration
# clinic generates an HTML report in .clinic/ directory
echo "Starting vision-service under clinic $PROFILE_TYPE..."
echo "Service will be profiled for ${DURATION}s, then auto-stopped."
echo ""

# Use autocannon or a timeout to stop the profiling after the specified duration
# We run the service, wait for it to start, then kill it after DURATION seconds
(
  sleep "$DURATION"
  echo ""
  echo "Duration reached. Stopping profiled process..."
  # Find and kill the node process running our service
  pkill -f "dist/main.js" 2>/dev/null || true
) &
TIMER_PID=$!

cd "$SERVICE_DIR"

clinic "$PROFILE_TYPE" \
  --dest "$OUTPUT_DIR" \
  -- node dist/main.js 2>&1 || true

# Clean up timer if still running
kill "$TIMER_PID" 2>/dev/null || true
wait "$TIMER_PID" 2>/dev/null || true

echo ""
echo "=== Profiling Complete ==="
echo "Reports saved to: $OUTPUT_DIR"
echo ""
# List generated reports
ls -la "$OUTPUT_DIR"/*.html 2>/dev/null || echo "  (HTML reports will be in .clinic/ subdirectory)"
echo ""
echo "Open the .html report in a browser to view results."
