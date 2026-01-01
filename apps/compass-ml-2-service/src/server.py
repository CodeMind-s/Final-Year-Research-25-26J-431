import grpc
from concurrent import futures
import compass_predictions_pb2
import compass_predictions_pb2_grpc
from ml_predictor import MLPredictor
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)


class CompassPredictionService(compass_predictions_pb2_grpc.CompassPredictionServiceServicer):
    def __init__(self):
        self.predictor = MLPredictor()
        logger.info("Compass prediction service initialized")

    def GetDemandPricePrediction(self, request, context):
        try:
            logger.info(f"Received prediction request for date {request.date}")
            
            # Extract request data
            features = dict(request.features) if request.features else {}
            
            # Get predictions from ML model
            prediction_result = self.predictor.predict(
                date=request.date,
                features=features
            )
            
            # Build response
            response = self._build_response(prediction_result)
            logger.info("Prediction completed successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error during prediction: {str(e)}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f'Prediction failed: {str(e)}')
            return compass_predictions_pb2.PredictionResponse(status="error")

    def _build_response(self, data):
        """Build gRPC response from prediction data"""
        response = compass_predictions_pb2.PredictionResponse(
            status=data['status']
        )
        
        # Build historical data
        historical_data = []
        for item in data['prediction_data']['historical_data']:
            historical_data.append(compass_predictions_pb2.MonthlyData(
                month=item['month'],
                month_number=item['month_number'],
                predicted_demand=item['predicted_demand'],
                predicted_price=item['predicted_price'],
                demand_lower_bound=item.get('demand_lower_bound', 0.0),
                demand_upper_bound=item.get('demand_upper_bound', 0.0),
                price_lower_bound=item.get('price_lower_bound', 0.0),
                price_upper_bound=item.get('price_upper_bound', 0.0)
            ))
        
        # Build future predictions
        future_predictions = []
        for item in data['prediction_data']['future_predictions']:
            future_predictions.append(compass_predictions_pb2.MonthlyData(
                month=item['month'],
                month_number=item['month_number'],
                predicted_demand=item['predicted_demand'],
                predicted_price=item['predicted_price'],
                demand_lower_bound=item.get('demand_lower_bound', 0.0),
                demand_upper_bound=item.get('demand_upper_bound', 0.0),
                price_lower_bound=item.get('price_lower_bound', 0.0),
                price_upper_bound=item.get('price_upper_bound', 0.0)
            ))
        
        # Build prediction data
        prediction_data = compass_predictions_pb2.PredictionData(
            historical_data=historical_data,
            future_predictions=future_predictions,
            summary=compass_predictions_pb2.PredictionSummary(
                total_historical_demand=data['prediction_data']['summary']['total_historical_demand'],
                average_historical_price=data['prediction_data']['summary']['average_historical_price'],
                total_predicted_demand=data['prediction_data']['summary']['total_predicted_demand'],
                average_predicted_price=data['prediction_data']['summary']['average_predicted_price'],
                demand_trend=data['prediction_data']['summary']['demand_trend'],
                price_trend=data['prediction_data']['summary']['price_trend']
            )
        )
        response.prediction_data.CopyFrom(prediction_data)
        
        # Build model info
        model_info = compass_predictions_pb2.ModelInfo(
            model_type=data['model_info']['model_type'],
            prediction_generated=data['model_info']['prediction_generated'],
            performance_metrics=compass_predictions_pb2.PerformanceMetrics(
                train_accuracy=data['model_info']['performance_metrics']['train_accuracy'],
                test_accuracy=data['model_info']['performance_metrics']['test_accuracy'],
                validation_accuracy=data['model_info']['performance_metrics']['validation_accuracy'],
                mae=data['model_info']['performance_metrics']['mae'],
                rmse=data['model_info']['performance_metrics']['rmse'],
                r2_score=data['model_info']['performance_metrics']['r2_score']
            )
        )
        response.model_info.CopyFrom(model_info)
        
        return response


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    compass_predictions_pb2_grpc.add_CompassPredictionServiceServicer_to_server(
        CompassPredictionService(), server
    )
    server.add_insecure_port('[::]:50056')
    logger.info("Starting Compass ML 2 Service on port 50056")
    server.start()
    logger.info("Server started successfully")
    server.wait_for_termination()


if __name__ == '__main__':
    serve()
