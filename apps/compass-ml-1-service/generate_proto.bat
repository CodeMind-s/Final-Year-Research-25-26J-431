@echo off

REM Generate Python code from proto file
python -m grpc_tools.protoc ^
  -I./proto ^
  --python_out=./src/generated ^
  --grpc_python_out=./src/generated ^
  ./proto/seller_recommendations.proto

REM Create __init__.py if it doesn't exist
if not exist "./src/generated" mkdir "./src/generated"
type nul > "./src/generated/__init__.py"

echo Proto generation complete!
