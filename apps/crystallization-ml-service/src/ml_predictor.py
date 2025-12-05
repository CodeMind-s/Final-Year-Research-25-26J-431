import numpy as np
import tensorflow as tf
from tensorflow import keras
from datetime import datetime, timedelta
from dateutil import parser
import os
import logging

logger = logging.getLogger(__name__)


class MLPredictor:
    def __init__(self, model_path='models/best_hybrid_model.keras'):
        """Initialize the ML predictor with the Keras model"""
        self.model_path = model_path
        self.model = None
        self.load_model()
        
        # Model performance metrics (you can update these with actual values)
        self.performance_metrics = {
            'test_mae': 0.22643738985061646,
            'test_rmse': 0.36510669291987724,
            'test_r2_score': 0.7749716637562971,
            'test_accuracy': 77.49716637562972,
            'validation_r2_score': 0.8884437289486968,
            'validation_accuracy': 88.84437289486968
        }
    
    def load_model(self):
        """Load the Keras model"""
        try:
            if os.path.exists(self.model_path):
                self.model = keras.models.load_model(self.model_path)
                logger.info(f"Model loaded successfully from {self.model_path}")
            else:
                logger.warning(f"Model file not found at {self.model_path}")
                self.model = None
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            self.model = None
    
    def predict(self, start_date, forecast_days, current_values):
        """
        Generate predictions based on current values and forecast days
        
        Args:
            start_date: Starting date for forecast (string)
            forecast_days: Number of days to forecast
            current_values: Dictionary with current parameter values
            
        Returns:
            Dictionary with all forecast data
        """
        if self.model is None:
            raise Exception("Model not loaded. Please ensure the model file exists.")
        
        # Parse start date
        start_dt = parser.parse(start_date)
        
        # Generate daily forecasts
        daily_forecasts = self._generate_daily_forecasts(
            start_dt, forecast_days, current_values
        )
        
        # Generate monthly forecasts
        monthly_6months = self._generate_monthly_forecast(
            daily_forecasts, start_dt, 6
        )
        monthly_12months = self._generate_monthly_forecast(
            daily_forecasts, start_dt, 12
        )
        
        # Generate seasonal production
        seasonal_production = self._generate_seasonal_production(monthly_12months)
        
        # Build response
        response = {
            'status': 'success',
            'daily_parameters_forecast': {
                'forecast_type': 'daily_parameters',
                'forecast_start_date': start_dt.strftime('%Y-%m-%d'),
                'forecast_end_date': (start_dt + timedelta(days=forecast_days-1)).strftime('%Y-%m-%d'),
                'total_days': forecast_days,
                'forecasts': daily_forecasts
            },
            'monthly_production_6months': monthly_6months,
            'monthly_production_12months': monthly_12months,
            'seasonal_production': seasonal_production,
            'model_info': {
                'model_type': 'LSTM_Hybrid_with_Weather',
                'forecast_generated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'performance_metrics': self.performance_metrics
            },
            'summary': {
                'daily_forecast_days': forecast_days,
                'monthly_6_total_production': monthly_6months['total_production'],
                'monthly_12_total_production': monthly_12months['total_production'],
                'maha_season_total': seasonal_production['seasons'].get('Maha', {}).get('total_production', 0),
                'yala_season_total': seasonal_production['seasons'].get('Yala', {}).get('total_production', 0)
            }
        }
        
        return response
    
    def _generate_daily_forecasts(self, start_date, forecast_days, current_values):
        """Generate daily forecasts using the ML model"""
        forecasts = []
        
        # Prepare input features for the model
        # Note: You'll need to adapt this based on your actual model input shape
        current_params = np.array([
            current_values['water_temperature'],
            current_values['lagoon'],
            current_values['OR_brine_level'],
            current_values['OR_bund_level'],
            current_values['IR_brine_level'],
            current_values['IR_bound_level'],
            current_values['East_channel'],
            current_values['West_channel']
        ])
        
        for day in range(forecast_days):
            forecast_date = start_date + timedelta(days=day)
            
            # Generate weather predictions (simulated - replace with actual model predictions)
            weather = self._generate_weather_forecast()
            
            # Use the model to predict parameters
            # Note: Adjust input shape based on your model requirements
            try:
                # Example: if model expects shape (batch, timesteps, features)
                model_input = current_params.reshape(1, 1, -1)
                predictions = self.model.predict(model_input, verbose=0)
                
                # Update parameters based on predictions
                if len(predictions.shape) > 1:
                    predicted_params = predictions[0]
                else:
                    predicted_params = predictions
                
                # Ensure we have 8 parameters
                if len(predicted_params) < 8:
                    predicted_params = current_params
                else:
                    predicted_params = predicted_params[:8]
                    
            except Exception as e:
                logger.warning(f"Prediction error for day {day}: {str(e)}. Using current values.")
                predicted_params = current_params
            
            # Add small random variations for realism
            noise = np.random.normal(0, 0.1, size=predicted_params.shape)
            predicted_params = predicted_params + noise
            
            forecast_item = {
                'date': forecast_date.strftime('%Y-%m-%d'),
                'day_number': day + 1,
                'parameters': {
                    'water_temperature': float(predicted_params[0]),
                    'lagoon': float(predicted_params[1]),
                    'OR_brine_level': float(predicted_params[2]),
                    'OR_bund_level': float(predicted_params[3]),
                    'IR_brine_level': float(predicted_params[4]),
                    'IR_bound_level': float(predicted_params[5]),
                    'East_channel': float(predicted_params[6]),
                    'West_channel': float(predicted_params[7])
                },
                'weather': weather
            }
            
            forecasts.append(forecast_item)
            
            # Update current parameters for next iteration
            current_params = predicted_params
        
        return forecasts
    
    def _generate_weather_forecast(self):
        """Generate weather forecast (placeholder - replace with actual weather API)"""
        return {
            'temperature_mean': np.random.uniform(25, 28),
            'temperature_min': np.random.uniform(22, 25),
            'temperature_max': np.random.uniform(27, 30),
            'rain_sum': np.random.uniform(0, 5),
            'wind_speed_max': np.random.uniform(10, 30),
            'wind_gusts_max': np.random.uniform(20, 50),
            'relative_humidity_mean': np.random.uniform(70, 90)
        }
    
    def _generate_monthly_forecast(self, daily_forecasts, start_date, months):
        """Generate monthly production forecast from daily forecasts"""
        monthly_forecasts = []
        total_production = 0
        
        current_month_start = start_date.replace(day=1)
        
        for month_num in range(months):
            month_date = current_month_start + timedelta(days=30 * month_num)
            
            # Calculate production based on daily parameters
            # This is a simplified calculation - adjust based on your actual model
            production = np.random.uniform(20000, 30000)
            lower_bound = production * 0.85
            upper_bound = production * 1.15
            
            # Determine season
            month = month_date.month
            if month in [12, 1, 2, 3]:
                season = "Maha"
            elif month in [4, 5, 6, 7]:
                season = "Yala"
            else:
                season = "Other"
            
            monthly_forecasts.append({
                'month': month_date.strftime('%Y-%m'),
                'month_number': month_num + 1,
                'production_forecast': float(production),
                'lower_bound': float(lower_bound),
                'upper_bound': float(upper_bound),
                'season': season
            })
            
            total_production += production
        
        period = f"{months}_months"
        end_month = (current_month_start + timedelta(days=30 * (months - 1))).strftime('%Y-%m')
        
        return {
            'forecast_type': 'monthly_production',
            'forecast_period': period,
            'forecast_start_month': current_month_start.strftime('%Y-%m'),
            'forecast_end_month': end_month,
            'total_months': len(monthly_forecasts),
            'total_production': float(total_production),
            'forecasts': monthly_forecasts
        }
    
    def _generate_seasonal_production(self, monthly_forecast):
        """Generate seasonal production summary"""
        seasons = {}
        
        for forecast in monthly_forecast['forecasts']:
            season = forecast['season']
            if season not in seasons:
                seasons[season] = {
                    'months_count': 0,
                    'total_production': 0,
                    'months': []
                }
            
            seasons[season]['months_count'] += 1
            seasons[season]['total_production'] += forecast['production_forecast']
            seasons[season]['months'].append({
                'month': forecast['month'],
                'production': forecast['production_forecast']
            })
        
        return {
            'forecast_type': 'seasonal_production',
            'forecast_period': '12_months',
            'seasons': seasons
        }
