import grpc
from concurrent import futures
import predictions_pb2
import predictions_pb2_grpc
from ml_predictor import MLPredictor
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)


class PredictionsService(predictions_pb2_grpc.PredictionsServiceServicer):
    def __init__(self):
        self.predictor = MLPredictor()
        logger.info("Predictions service initialized")

    def GetPredictions(self, request, context):
        try:
            logger.info(f"Received prediction request for {request.forecast_days} days starting {request.start_date}")
            
            # Extract request data
            current_values = {
                'water_temperature': request.current_values.water_temperature,
                'lagoon': request.current_values.lagoon,
                'OR_brine_level': request.current_values.OR_brine_level,
                'OR_bund_level': request.current_values.OR_bund_level,
                'IR_brine_level': request.current_values.IR_brine_level,
                'IR_bound_level': request.current_values.IR_bound_level,
                'East_channel': request.current_values.East_channel,
                'West_channel': request.current_values.West_channel,
            }
            
            # Get predictions from ML model
            prediction_result = self.predictor.predict(
                start_date=request.start_date,
                forecast_days=request.forecast_days,
                current_values=current_values
            )
            
            # Build response
            response = self._build_response(prediction_result)
            logger.info("Prediction completed successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error during prediction: {str(e)}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f'Prediction failed: {str(e)}')
            return predictions_pb2.PredictionResponse(status="error")

    def _build_response(self, data):
        """Build gRPC response from prediction data"""
        response = predictions_pb2.PredictionResponse(
            status=data['status']
        )
        
        # Daily parameters forecast
        daily_forecast = predictions_pb2.DailyParametersForecast(
            forecast_type=data['daily_parameters_forecast']['forecast_type'],
            forecast_start_date=data['daily_parameters_forecast']['forecast_start_date'],
            forecast_end_date=data['daily_parameters_forecast']['forecast_end_date'],
            total_days=data['daily_parameters_forecast']['total_days']
        )
        
        for forecast in data['daily_parameters_forecast']['forecasts']:
            daily_item = predictions_pb2.DailyForecast(
                date=forecast['date'],
                day_number=forecast['day_number'],
                parameters=predictions_pb2.Parameters(
                    water_temperature=forecast['parameters']['water_temperature'],
                    lagoon=forecast['parameters']['lagoon'],
                    OR_brine_level=forecast['parameters']['OR_brine_level'],
                    OR_bund_level=forecast['parameters']['OR_bund_level'],
                    IR_brine_level=forecast['parameters']['IR_brine_level'],
                    IR_bound_level=forecast['parameters']['IR_bound_level'],
                    East_channel=forecast['parameters']['East_channel'],
                    West_channel=forecast['parameters']['West_channel']
                ),
                weather=predictions_pb2.Weather(
                    temperature_mean=forecast['weather']['temperature_mean'],
                    temperature_min=forecast['weather']['temperature_min'],
                    temperature_max=forecast['weather']['temperature_max'],
                    rain_sum=forecast['weather']['rain_sum'],
                    wind_speed_max=forecast['weather']['wind_speed_max'],
                    wind_gusts_max=forecast['weather']['wind_gusts_max'],
                    relative_humidity_mean=forecast['weather']['relative_humidity_mean']
                )
            )
            daily_forecast.forecasts.append(daily_item)
        
        response.daily_parameters_forecast.CopyFrom(daily_forecast)
        
        # Monthly production 6 months
        monthly_6 = self._build_monthly_forecast(data['monthly_production_6months'])
        response.monthly_production_6months.CopyFrom(monthly_6)
        
        # Monthly production 12 months
        monthly_12 = self._build_monthly_forecast(data['monthly_production_12months'])
        response.monthly_production_12months.CopyFrom(monthly_12)
        
        # Seasonal production
        seasonal = predictions_pb2.SeasonalProduction(
            forecast_type=data['seasonal_production']['forecast_type'],
            forecast_period=data['seasonal_production']['forecast_period']
        )
        
        for season_name, season_data in data['seasonal_production']['seasons'].items():
            season_msg = predictions_pb2.SeasonData(
                months_count=season_data['months_count'],
                total_production=season_data['total_production']
            )
            for month in season_data['months']:
                month_prod = predictions_pb2.MonthProduction(
                    month=month['month'],
                    production=month['production']
                )
                season_msg.months.append(month_prod)
            seasonal.seasons[season_name].CopyFrom(season_msg)
        
        response.seasonal_production.CopyFrom(seasonal)
        
        # Model info
        model_info = predictions_pb2.ModelInfo(
            model_type=data['model_info']['model_type'],
            forecast_generated=data['model_info']['forecast_generated'],
            performance_metrics=predictions_pb2.PerformanceMetrics(
                test_mae=data['model_info']['performance_metrics']['test_mae'],
                test_rmse=data['model_info']['performance_metrics']['test_rmse'],
                test_r2_score=data['model_info']['performance_metrics']['test_r2_score'],
                test_accuracy=data['model_info']['performance_metrics']['test_accuracy'],
                validation_r2_score=data['model_info']['performance_metrics']['validation_r2_score'],
                validation_accuracy=data['model_info']['performance_metrics']['validation_accuracy']
            )
        )
        response.model_info.CopyFrom(model_info)
        
        # Summary
        summary = predictions_pb2.Summary(
            daily_forecast_days=data['summary']['daily_forecast_days'],
            monthly_6_total_production=data['summary']['monthly_6_total_production'],
            monthly_12_total_production=data['summary']['monthly_12_total_production'],
            maha_season_total=data['summary']['maha_season_total'],
            yala_season_total=data['summary']['yala_season_total']
        )
        response.summary.CopyFrom(summary)
        
        return response
    
    def _build_monthly_forecast(self, data):
        """Build monthly forecast message"""
        monthly = predictions_pb2.MonthlyProductionForecast(
            forecast_type=data['forecast_type'],
            forecast_period=data['forecast_period'],
            forecast_start_month=data['forecast_start_month'],
            forecast_end_month=data['forecast_end_month'],
            total_months=data['total_months'],
            total_production=data['total_production']
        )
        
        for forecast in data['forecasts']:
            monthly_item = predictions_pb2.MonthlyForecast(
                month=forecast['month'],
                month_number=forecast['month_number'],
                production_forecast=forecast['production_forecast'],
                lower_bound=forecast['lower_bound'],
                upper_bound=forecast['upper_bound'],
                season=forecast['season']
            )
            monthly.forecasts.append(monthly_item)
        
        return monthly


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    predictions_pb2_grpc.add_PredictionsServiceServicer_to_server(
        PredictionsService(), server
    )
    server.add_insecure_port('[::]:50055')
    logger.info("Starting Crystallization ML Service on port 50055")
    server.start()
    logger.info("Server started successfully")
    server.wait_for_termination()


if __name__ == '__main__':
    serve()
