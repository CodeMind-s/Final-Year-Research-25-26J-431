#!/usr/bin/env bash
# clinic.js profiling with simulated load using autocannon
#
# This script:
# 1. Starts the vision-service under clinic.js
# 2. Waits for the service to be ready
# 3. Fires load using autocannon against the health endpoint
# 4. Stops and generates the clinic report
#
# Usage:
#   ./profile-with-load.sh doctor|flame|bubbleprof [duration_seconds] [connections]
#
# Prerequisites:
#   npm install -g clinic autocannon
#   npx nx build vision-service
#   API Gateway must be running (for HTTP endpoint testing)
#   OR test directly against gRPC port
#
# Examples:
#   ./profile-with-load.sh doctor 20 5
#   ./profile-with-load.sh flame 30 10

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
SERVICE_DIR="$REPO_ROOT/apps/vision-service"
OUTPUT_DIR="$SERVICE_DIR/test-output/performance/clinic"
DIST_MAIN="$SERVICE_DIR/dist/main.js"

PROFILE_TYPE="${1:-doctor}"
DURATION="${2:-20}"
CONNECTIONS="${3:-5}"

# The health endpoint for load generation
# When testing via API Gateway:
LOAD_TARGET="${LOAD_TARGET:-http://localhost:3400/api/v1/vision/health}"

case "$PROFILE_TYPE" in
  doctor|flame|bubbleprof) ;;
  *)
    echo "Error: Invalid profile type '$PROFILE_TYPE'. Use: doctor, flame, or bubbleprof"
    exit 1
    ;;
esac

for cmd in clinic autocannon; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd not found. Install with: npm install -g $cmd"
    exit 1
  fi
done

if [ ! -f "$DIST_MAIN" ]; then
  echo "Error: Built service not found at $DIST_MAIN"
  echo "Run: npx nx build vision-service"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "=== Vision Service clinic.js + autocannon ==="
echo "  Profile:     $PROFILE_TYPE"
echo "  Duration:    ${DURATION}s"
echo "  Connections: $CONNECTIONS"
echo "  Target:      $LOAD_TARGET"
echo "  Output:      $OUTPUT_DIR"
echo ""

export VISION_MODEL_PATH="${VISION_MODEL_PATH:-$SERVICE_DIR/models/best.onnx}"
export VISION_INPUT_SIZE="${VISION_INPUT_SIZE:-320}"
export VISION_CONFIDENCE_THRESHOLD="${VISION_CONFIDENCE_THRESHOLD:-0.5}"
export VISION_IOU_THRESHOLD="${VISION_IOU_THRESHOLD:-0.45}"
export GRPC_PORT="${GRPC_PORT:-50057}"

cd "$SERVICE_DIR"

# clinic with autocannon on-load
# clinic will start the service, autocannon generates load, then clinic stops and reports
clinic "$PROFILE_TYPE" \
  --dest "$OUTPUT_DIR" \
  --on-port "autocannon -c $CONNECTIONS -d $DURATION $LOAD_TARGET" \
  -- node dist/main.js

echo ""
echo "=== Profiling Complete ==="
echo "Reports saved to: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"/*.html 2>/dev/null || echo "  Check $OUTPUT_DIR for generated reports"
