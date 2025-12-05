import os
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
import json

load_dotenv()

class PredictionService:
    def __init__(self):
        self.model_path = os.getenv('MODEL_PATH', 'models/best_hybrid_model.keras')
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the Keras model"""
        try:
            import tensorflow as tf
            model_full_path = os.path.join(
                os.path.dirname(__file__), 
                '..', 
                self.model_path
            )
            self.model = tf.keras.models.load_model(model_full_path)
            print(f'Model loaded successfully from {model_full_path}')
        except Exception as e:
            print(f'Error loading model: {str(e)}')
            self.model = None
    
    def predict(self, start_date: str, forecast_days: int, current_values: dict):
        """
        Generate predictions using the ML model
        
        Args:
            start_date: Starting date for predictions (YYYY-MM-DD)
            forecast_days: Number of days to forecast
            current_values: Dictionary with current parameter values
        
        Returns:
            Dictionary with predictions in the specified format
        """
        if self.model is None:
            raise Exception('Model not loaded')
        
        # Parse the start date
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        
        # Prepare input data (this is a placeholder - adjust based on your model's input requirements)
        input_data = self._prepare_input(current_values)
        
        # Generate predictions (placeholder - replace with actual model prediction)
        predictions = self._generate_predictions(
            input_data, 
            start_dt, 
            forecast_days
        )
        
        # Format the response
        response = self._format_response(predictions, start_dt, forecast_days)
        
        return response
    
    def _prepare_input(self, current_values: dict):
        """Prepare input data for the model"""
        # Extract features in the correct order
        features = [
            current_values.get('water_temperature', 28.0),
            current_values.get('lagoon', 2.0),
            current_values.get('OR_brine_level', 4.5),
            current_values.get('OR_bund_level', 1.5),
            current_values.get('IR_brine_level', 5.5),
            current_values.get('IR_bound_level', 1.5),
            current_values.get('East_channel', 7.0),
            current_values.get('West_channel', 6.5),
        ]
        
        return np.array([features])
    
    def _generate_predictions(self, input_data, start_dt, forecast_days):
        """Generate predictions using the model"""
        # This is a placeholder implementation
        # Replace with actual model prediction logic
        
        predictions = []
        
        for day in range(forecast_days):
            current_date = start_dt + timedelta(days=day)
            
            # Use the model to predict (placeholder)
            # In reality, you would use: prediction = self.model.predict(input_data)
            
            # Generate mock prediction for now
            prediction = {
                'date': current_date.strftime('%Y-%m-%d'),
                'day_number': day + 1,
                'parameters': {
                    'water_temperature': float(28.0 + np.random.randn() * 0.5),
                    'lagoon': float(2.0 + np.random.randn() * 0.1),
                    'OR_brine_level': float(4.5 + np.random.randn() * 0.1),
                    'OR_bund_level': float(1.5 + np.random.randn() * 0.05),
                    'IR_brine_level': float(5.5 + np.random.randn() * 0.1),
                    'IR_bound_level': float(1.5 + np.random.randn() * 0.05),
                    'East_channel': float(7.0 + np.random.randn() * 0.1),
                    'West_channel': float(6.5 + np.random.randn() * 0.1),
                },
                'weather': {
                    'temperature_mean': float(26.5 + np.random.randn() * 1.0),
                    'temperature_max': float(29.5 + np.random.randn() * 1.0),
                    'temperature_min': float(24.0 + np.random.randn() * 1.0),
                    'relative_humidity_mean': float(80.0 + np.random.randn() * 5.0),
                    'wind_speed_max': float(20.0 + np.random.randn() * 5.0),
                    'wind_gusts_max': float(35.0 + np.random.randn() * 10.0),
                    'rain_sum': float(max(0, 2.0 + np.random.randn() * 2.0)),
                }
            }
            
            predictions.append(prediction)
            
            # Update input_data for next iteration (use previous prediction as input)
            # This creates a sequence of predictions
        
        return predictions
    
    def _format_response(self, predictions, start_dt, forecast_days):
        """Format the response according to the specified structure"""
        
        # Calculate end date
        end_dt = start_dt + timedelta(days=forecast_days - 1)
        
        # Generate monthly forecasts
        monthly_6_forecasts = self._generate_monthly_forecasts(predictions, 3)
        monthly_12_forecasts = self._generate_monthly_forecasts(predictions, 12)
        
        # Generate seasonal forecasts
        seasonal_forecasts = self._generate_seasonal_forecasts(monthly_12_forecasts)
        
        response = {
            'status': 'success',
            'daily_parameters_forecast': {
                'forecast_type': 'daily_parameters',
                'forecast_start_date': start_dt.strftime('%Y-%m-%d'),
                'forecast_end_date': end_dt.strftime('%Y-%m-%d'),
                'total_days': forecast_days,
                'forecasts': predictions
            },
            'monthly_production_6months': monthly_6_forecasts,
            'monthly_production_12months': monthly_12_forecasts,
            'seasonal_production': seasonal_forecasts,
            'model_info': {
                'model_type': 'LSTM_Hybrid_with_Weather',
                'forecast_generated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'performance_metrics': {
                    'test_rmse': 0.36510669291987724,
                    'test_mae': 0.22643738985061646,
                    'test_r2_score': 0.7749716637562971,
                    'test_accuracy': 77.49716637562972,
                    'validation_r2_score': 0.8884437289486968,
                    'validation_accuracy': 88.84437289486968
                }
            },
            'summary': {
                'daily_forecast_days': forecast_days,
                'monthly_6_total_production': monthly_6_forecasts['total_production'],
                'monthly_12_total_production': monthly_12_forecasts['total_production'],
                'maha_season_total': seasonal_forecasts['seasons']['Maha']['total_production'],
                'yala_season_total': seasonal_forecasts['seasons']['Yala']['total_production']
            }
        }
        
        return response
    
    def _generate_monthly_forecasts(self, daily_predictions, months):
        """Generate monthly production forecasts"""
        # This is a simplified implementation
        # You would aggregate daily predictions into monthly forecasts
        
        forecasts = []
        total_production = 0
        
        start_date = datetime.strptime(daily_predictions[0]['date'], '%Y-%m-%d')
        
        for month_num in range(months):
            month_date = start_date + timedelta(days=30 * month_num)
            production = float(20000 + np.random.randn() * 3000)
            total_production += production
            
            # Determine season
            month = month_date.month
            if month in [12, 1, 2, 3]:
                season = 'Maha'
            elif month in [4, 5, 6, 7]:
                season = 'Yala'
            else:
                season = 'Other'
            
            forecasts.append({
                'month_number': month_num + 1,
                'month': month_date.strftime('%Y-%m'),
                'production_forecast': production,
                'lower_bound': production * 0.85,
                'upper_bound': production * 1.15,
                'season': season
            })
        
        period = '6_months' if months == 3 else '12_months'
        
        return {
            'forecast_type': 'monthly_production',
            'forecast_period': period,
            'forecast_start_month': forecasts[0]['month'],
            'forecast_end_month': forecasts[-1]['month'],
            'total_months': len(forecasts),
            'forecasts': forecasts,
            'total_production': total_production
        }
    
    def _generate_seasonal_forecasts(self, monthly_forecasts):
        """Generate seasonal production forecasts"""
        
        maha_production = 0
        maha_months = []
        yala_production = 0
        yala_months = []
        
        for forecast in monthly_forecasts['forecasts']:
            if forecast['season'] == 'Maha':
                maha_production += forecast['production_forecast']
                maha_months.append({
                    'month': forecast['month'],
                    'production': forecast['production_forecast']
                })
            elif forecast['season'] == 'Yala':
                yala_production += forecast['production_forecast']
                yala_months.append({
                    'month': forecast['month'],
                    'production': forecast['production_forecast']
                })
        
        return {
            'forecast_type': 'seasonal_production',
            'forecast_period': '12_months',
            'seasons': {
                'Maha': {
                    'months_count': len(maha_months),
                    'months': maha_months,
                    'total_production': maha_production
                },
                'Yala': {
                    'months_count': len(yala_months),
                    'months': yala_months,
                    'total_production': yala_production
                }
            }
        }
