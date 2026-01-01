@echo off
echo Generating Python gRPC code from proto files...
cd apps\compass-ml-2-service\src
python -m grpc_tools.protoc -I..\proto --python_out=generated --grpc_python_out=generated ..\proto\compass_predictions.proto
echo Done!
