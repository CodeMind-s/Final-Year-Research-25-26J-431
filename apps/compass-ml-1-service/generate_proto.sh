#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Generating Python gRPC code from proto files..."

# Generate Python code from proto file
python -m grpc_tools.protoc \
  -I"$SCRIPT_DIR/proto" \
  --python_out="$SCRIPT_DIR/src/generated" \
  --grpc_python_out="$SCRIPT_DIR/src/generated" \
  "$SCRIPT_DIR/proto/seller_recommendations.proto"

# Create __init__.py if it doesn't exist
mkdir -p "$SCRIPT_DIR/src/generated"
touch "$SCRIPT_DIR/src/generated/__init__.py"

echo "Done!"
