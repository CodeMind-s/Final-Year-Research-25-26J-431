import grpc
from concurrent import futures
import sys
import os
from dotenv import load_dotenv

# Add the generated directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'generated'))

try:
    # Import generated gRPC code
    import compass_predictions_pb2
    import compass_predictions_pb2_grpc
    proto_loaded = True
except ImportError:
    print("Warning: Generated proto files not found. Please run generate_proto.bat/sh first.")
    proto_loaded = False

# Import the ML predictor
try:
    from ml_predictor import MLPredictor
except ImportError:
    print("Warning: ml_predictor not found in the same directory")
    MLPredictor = None

load_dotenv()

if proto_loaded:
    class CompassPredictionServicer(compass_predictions_pb2_grpc.CompassPredictionServiceServicer):
        def __init__(self):
            self.predictor = MLPredictor() if MLPredictor else None

        def _convert_to_proto_response(self, result):
            """Convert dictionary result to protobuf PredictionResponse"""
            
            # Convert historical data
            historical_data = []
            for data in result['prediction_data']['historical_data']:
                historical_data.append(compass_predictions_pb2.MonthlyData(
                    month=data['month'],
                    month_number=data['month_number'],
                    predicted_demand=data['predicted_demand'],
                    predicted_price=data['predicted_price'],
                    demand_lower_bound=data.get('demand_lower_bound', 0),
                    demand_upper_bound=data.get('demand_upper_bound', 0),
                    price_lower_bound=data.get('price_lower_bound', 0),
                    price_upper_bound=data.get('price_upper_bound', 0)
                ))
            
            # Convert future predictions
            future_predictions = []
            for data in result['prediction_data']['future_predictions']:
                future_predictions.append(compass_predictions_pb2.MonthlyData(
                    month=data['month'],
                    month_number=data['month_number'],
                    predicted_demand=data['predicted_demand'],
                    predicted_price=data['predicted_price'],
                    demand_lower_bound=data.get('demand_lower_bound', 0),
                    demand_upper_bound=data.get('demand_upper_bound', 0),
                    price_lower_bound=data.get('price_lower_bound', 0),
                    price_upper_bound=data.get('price_upper_bound', 0)
                ))
            
            # Build the complete response
            return compass_predictions_pb2.PredictionResponse(
                status=result['status'],
                prediction_data=compass_predictions_pb2.PredictionData(
                    historical_data=historical_data,
                    future_predictions=future_predictions,
                    summary=compass_predictions_pb2.PredictionSummary(
                        total_historical_demand=result['prediction_data']['summary']['total_historical_demand'],
                        average_historical_price=result['prediction_data']['summary']['average_historical_price'],
                        total_predicted_demand=result['prediction_data']['summary']['total_predicted_demand'],
                        average_predicted_price=result['prediction_data']['summary']['average_predicted_price'],
                        demand_trend=result['prediction_data']['summary']['demand_trend'],
                        price_trend=result['prediction_data']['summary']['price_trend']
                    )
                ),
                model_info=compass_predictions_pb2.ModelInfo(
                    model_type=result['model_info']['model_type'],
                    prediction_generated=result['model_info']['prediction_generated'],
                    performance_metrics=compass_predictions_pb2.PerformanceMetrics(
                        train_accuracy=result['model_info']['performance_metrics']['train_accuracy'],
                        test_accuracy=result['model_info']['performance_metrics']['test_accuracy'],
                        validation_accuracy=result['model_info']['performance_metrics']['validation_accuracy'],
                        mae=result['model_info']['performance_metrics']['mae'],
                        rmse=result['model_info']['performance_metrics']['rmse'],
                        r2_score=result['model_info']['performance_metrics']['r2_score']
                    )
                )
            )

        def GetDemandPricePrediction(self, request, context):
            try:
                if not self.predictor:
                    context.set_code(grpc.StatusCode.INTERNAL)
                    context.set_details('Prediction service not initialized')
                    return compass_predictions_pb2.PredictionResponse(status='error')
                
                # Call the prediction service
                result = self.predictor.predict(
                    date=request.date,
                    features=dict(request.features) if request.features else {}
                )
                
                # Convert result to protobuf response
                return self._convert_to_proto_response(result)
                
            except Exception as e:
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(str(e))
                return compass_predictions_pb2.PredictionResponse(status='error')

def serve():
    if not proto_loaded:
        print("Cannot start server: Proto files not generated")
        print("Please run: generate_proto.bat (Windows) or generate_proto.sh (Linux/Mac)")
        return
    
    port = os.getenv('GRPC_PORT', '50056')
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    
    compass_predictions_pb2_grpc.add_CompassPredictionServiceServicer_to_server(
        CompassPredictionServicer(), server
    )
    
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    
    print(f'Compass ML 2 Service is running on gRPC port {port}')
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print('Shutting down...')
        server.stop(0)

if __name__ == '__main__':
    serve()
