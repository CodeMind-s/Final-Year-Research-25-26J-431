import grpc
from concurrent import futures
import sys
import os
from dotenv import load_dotenv
import json

# Add the generated directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'generated'))

try:
    # Import generated gRPC code
    import predictions_pb2
    import predictions_pb2_grpc
    proto_loaded = True
except ImportError:
    print("Warning: Generated proto files not found. Please run generate_proto.bat/sh first.")
    proto_loaded = False

# Import the prediction service
try:
    from prediction_service import PredictionService
except ImportError:
    print("Warning: prediction_service not found in the same directory")
    PredictionService = None

load_dotenv()

if proto_loaded:
    class PredictionsServicer(predictions_pb2_grpc.PredictionsServiceServicer):
        def __init__(self):
            self.prediction_service = PredictionService() if PredictionService else None

        def _convert_to_proto_response(self, result):
            """Convert dictionary result to protobuf PredictionResponse"""
            
            # Convert daily forecasts
            daily_forecasts = []
            for forecast in result['daily_parameters_forecast']['forecasts']:
                daily_forecasts.append(predictions_pb2.DailyForecast(
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
                ))
            
            # Convert monthly forecasts (6 months)
            monthly_6_forecasts = []
            for forecast in result['monthly_production_6months']['forecasts']:
                monthly_6_forecasts.append(predictions_pb2.MonthlyForecast(
                    month=forecast['month'],
                    month_number=forecast['month_number'],
                    production_forecast=forecast['production_forecast'],
                    lower_bound=forecast['lower_bound'],
                    upper_bound=forecast['upper_bound'],
                    season=forecast['season']
                ))
            
            # Convert monthly forecasts (12 months)
            monthly_12_forecasts = []
            for forecast in result['monthly_production_12months']['forecasts']:
                monthly_12_forecasts.append(predictions_pb2.MonthlyForecast(
                    month=forecast['month'],
                    month_number=forecast['month_number'],
                    production_forecast=forecast['production_forecast'],
                    lower_bound=forecast['lower_bound'],
                    upper_bound=forecast['upper_bound'],
                    season=forecast['season']
                ))
            
            # Convert seasonal data
            seasons_dict = {}
            for season_name, season_data in result['seasonal_production']['seasons'].items():
                month_productions = []
                for month_prod in season_data['months']:
                    month_productions.append(predictions_pb2.MonthProduction(
                        month=month_prod['month'],
                        production=month_prod['production']
                    ))
                
                seasons_dict[season_name] = predictions_pb2.SeasonData(
                    months_count=season_data['months_count'],
                    total_production=season_data['total_production'],
                    months=month_productions
                )
            
            # Build the complete response
            return predictions_pb2.PredictionResponse(
                status=result['status'],
                daily_parameters_forecast=predictions_pb2.DailyParametersForecast(
                    forecast_type=result['daily_parameters_forecast']['forecast_type'],
                    forecast_start_date=result['daily_parameters_forecast']['forecast_start_date'],
                    forecast_end_date=result['daily_parameters_forecast']['forecast_end_date'],
                    total_days=result['daily_parameters_forecast']['total_days'],
                    forecasts=daily_forecasts
                ),
                monthly_production_6months=predictions_pb2.MonthlyProductionForecast(
                    forecast_type=result['monthly_production_6months']['forecast_type'],
                    forecast_period=result['monthly_production_6months']['forecast_period'],
                    forecast_start_month=result['monthly_production_6months']['forecast_start_month'],
                    forecast_end_month=result['monthly_production_6months']['forecast_end_month'],
                    total_months=result['monthly_production_6months']['total_months'],
                    total_production=result['monthly_production_6months']['total_production'],
                    forecasts=monthly_6_forecasts
                ),
                monthly_production_12months=predictions_pb2.MonthlyProductionForecast(
                    forecast_type=result['monthly_production_12months']['forecast_type'],
                    forecast_period=result['monthly_production_12months']['forecast_period'],
                    forecast_start_month=result['monthly_production_12months']['forecast_start_month'],
                    forecast_end_month=result['monthly_production_12months']['forecast_end_month'],
                    total_months=result['monthly_production_12months']['total_months'],
                    total_production=result['monthly_production_12months']['total_production'],
                    forecasts=monthly_12_forecasts
                ),
                seasonal_production=predictions_pb2.SeasonalProduction(
                    forecast_type=result['seasonal_production']['forecast_type'],
                    forecast_period=result['seasonal_production']['forecast_period'],
                    seasons=seasons_dict
                ),
                model_info=predictions_pb2.ModelInfo(
                    model_type=result['model_info']['model_type'],
                    forecast_generated=result['model_info']['forecast_generated'],
                    performance_metrics=predictions_pb2.PerformanceMetrics(
                        test_mae=result['model_info']['performance_metrics']['test_mae'],
                        test_rmse=result['model_info']['performance_metrics']['test_rmse'],
                        test_r2_score=result['model_info']['performance_metrics']['test_r2_score'],
                        test_accuracy=result['model_info']['performance_metrics']['test_accuracy'],
                        validation_r2_score=result['model_info']['performance_metrics']['validation_r2_score'],
                        validation_accuracy=result['model_info']['performance_metrics']['validation_accuracy']
                    )
                ),
                summary=predictions_pb2.Summary(
                    daily_forecast_days=result['summary']['daily_forecast_days'],
                    monthly_6_total_production=result['summary']['monthly_6_total_production'],
                    monthly_12_total_production=result['summary']['monthly_12_total_production'],
                    maha_season_total=result['summary']['maha_season_total'],
                    yala_season_total=result['summary']['yala_season_total']
                )
            )

        def GetPredictions(self, request, context):
            try:
                if not self.prediction_service:
                    context.set_code(grpc.StatusCode.INTERNAL)
                    context.set_details('Prediction service not initialized')
                    return predictions_pb2.PredictionResponse(status='error')
                
                # Call the prediction service
                result = self.prediction_service.predict(
                    start_date=request.start_date,
                    forecast_days=request.forecast_days,
                    current_values={
                        'water_temperature': request.current_values.water_temperature,
                        'lagoon': request.current_values.lagoon,
                        'OR_brine_level': request.current_values.OR_brine_level,
                        'OR_bund_level': request.current_values.OR_bund_level,
                        'IR_brine_level': request.current_values.IR_brine_level,
                        'IR_bound_level': request.current_values.IR_bound_level,
                        'East_channel': request.current_values.East_channel,
                        'West_channel': request.current_values.West_channel,
                    }
                )
                
                # Convert result to protobuf response
                return self._convert_to_proto_response(result)
                
            except Exception as e:
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(str(e))
                return predictions_pb2.PredictionResponse(status='error')

def serve():
    if not proto_loaded:
        print("Cannot start server: Proto files not generated")
        print("Please run: generate_proto.bat (Windows) or generate_proto.sh (Linux/Mac)")
        return
    
    port = os.getenv('GRPC_PORT', '50057')
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    
    predictions_pb2_grpc.add_PredictionsServiceServicer_to_server(
        PredictionsServicer(), server
    )
    
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    
    print(f'Crystallization ML Service is running on gRPC port {port}')
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print('Shutting down...')
        server.stop(0)

if __name__ == '__main__':
    serve()
