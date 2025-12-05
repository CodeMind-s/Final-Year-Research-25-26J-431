@echo off
echo Generating Python gRPC code from proto files...
cd apps\crystallization-ml-service\src
python -m grpc_tools.protoc -I../../../proto --python_out=generated --grpc_python_out=generated ../../../proto/predictions.proto
echo Done!
