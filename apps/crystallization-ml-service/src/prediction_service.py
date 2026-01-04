import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import json
import pickle
import joblib

load_dotenv()

class PredictionService:
    def __init__(self):
        # Model paths
        self.model_path = os.getenv('MODEL_PATH', 'models/best_hybrid_model.keras')
        self.models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        
        # Initialize models
        self.lstm_model = None
        self.log_scaler = None
        self.weather_scaler = None
        self.arima_model = None
        self.hw_model = None
        self.production_series = None
        
        # Load all models
        self._load_models()
    
    def _load_models(self):
        """Load all ML models and scalers - MANDATORY"""
        import tensorflow as tf
        import logging
        
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        # 1. Load LSTM model for daily parameters
        lstm_path = os.path.join(os.path.dirname(__file__), '..', self.model_path)
        if not os.path.exists(lstm_path):
            error_msg = f'CRITICAL: LSTM model not found at {lstm_path}'
            print(error_msg)
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        try:
            self.lstm_model = tf.keras.models.load_model(lstm_path)
            print(f'✓ LSTM model loaded from {lstm_path}')
            print(f'  Input shape: {self.lstm_model.input_shape}')
            print(f'  Output shape: {self.lstm_model.output_shape}')
            logger.info(f'LSTM model loaded successfully')
        except Exception as e:
            error_msg = f'CRITICAL: Failed to load LSTM model: {str(e)}'
            print(error_msg)
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        
        # 2. Load log scaler for denormalization
        log_scaler_path = os.path.join(self.models_dir, 'log_scaler.pkl')
        try:
            self.log_scaler = joblib.load(log_scaler_path)
            print(f'✓ Log scaler loaded from {log_scaler_path}')
            logger.info('Log scaler loaded successfully')
        except Exception as e:
            error_msg = f'CRITICAL: Failed to load log_scaler.pkl: {str(e)}'
            print(error_msg)
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        
        # 3. Load weather scaler
        weather_scaler_path = os.path.join(self.models_dir, 'weather_scaler.pkl')
        try:
            self.weather_scaler = joblib.load(weather_scaler_path)
            print(f'✓ Weather scaler loaded from {weather_scaler_path}')
            logger.info('Weather scaler loaded successfully')
        except Exception as e:
            error_msg = f'CRITICAL: Failed to load weather_scaler.pkl: {str(e)}'
            print(error_msg)
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        
        # 4. Load ARIMA model for production forecasting
        arima_path = os.path.join(self.models_dir, 'arima_model.pkl')
        try:
            with open(arima_path, 'rb') as f:
                self.arima_model = pickle.load(f)
            print(f'✓ ARIMA model loaded from {arima_path}')
            logger.info('ARIMA model loaded successfully')
        except Exception as e:
            error_msg = f'CRITICAL: Failed to load arima_model.pkl: {str(e)}'
            print(error_msg)
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        
        # 5. Load Holt-Winters model for production forecasting
        hw_path = os.path.join(self.models_dir, 'holt_winters_model.pkl')
        try:
            with open(hw_path, 'rb') as f:
                self.hw_model = pickle.load(f)
            print(f'✓ Holt-Winters model loaded from {hw_path}')
            logger.info('Holt-Winters model loaded successfully')
        except Exception as e:
            error_msg = f'CRITICAL: Failed to load holt_winters_model.pkl: {str(e)}'
            print(error_msg)
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        
        # 6. Load production series
        prod_series_path = os.path.join(self.models_dir, 'production_series.pkl')
        try:
            with open(prod_series_path, 'rb') as f:
                self.production_series = pickle.load(f)
            print(f'✓ Production series loaded from {prod_series_path}')
            logger.info('Production series loaded successfully')
        except Exception as e:
            error_msg = f'CRITICAL: Failed to load production_series.pkl: {str(e)}'
            print(error_msg)
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
        
        print('\n✓ All models and scalers loaded successfully!\n')
    
    def _denormalize_parameters(self, normalized_params):
        """Denormalize LSTM outputs using the actual log_scaler from training"""
        # The log_scaler has inverse_transform method
        # Input shape: (1, 8) - single sample with 8 features
        params_array = np.array(normalized_params).reshape(1, -1)
        denorm_params = self.log_scaler.inverse_transform(params_array)[0]
        
        param_names = ['water_temperature', 'lagoon', 'OR_brine_level', 'OR_bund_level',
                      'IR_brine_level', 'IR_bound_level', 'East_channel', 'West_channel']
        
        return {
            param_name: float(denorm_params[i])
            for i, param_name in enumerate(param_names)
        }
    
    def predict(self, start_date: str, forecast_days: int, current_values: dict):
        """Generate predictions using all models"""
        if self.lstm_model is None:
            raise Exception('Models not loaded')
        
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        
        # 1. Generate daily parameter predictions using LSTM (60 days max)
        input_data = self._prepare_input(current_values)
        daily_predictions = self._generate_daily_predictions(input_data, start_dt, min(forecast_days, 60))
        
        # 2. Generate production forecasts using ARIMA + Holt-Winters (6 or 12 months)
        monthly_6_forecasts = self._generate_production_forecasts(start_dt, 6)
        monthly_12_forecasts = self._generate_production_forecasts(start_dt, 12)
        
        # 3. Generate seasonal forecasts from monthly data
        seasonal_forecasts = self._generate_seasonal_forecasts(monthly_12_forecasts)
        
        # 4. Format response
        response = self._format_response(
            daily_predictions, 
            monthly_6_forecasts,
            monthly_12_forecasts,
            seasonal_forecasts,
            start_dt, 
            forecast_days
        )
        
        return response
    
    def _prepare_input(self, current_values: dict):
        """Prepare input data for LSTM model"""
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
    
    def _generate_daily_predictions(self, input_data, start_dt, forecast_days):
        """Generate daily parameter predictions using LSTM - NO FALLBACK"""
        if self.lstm_model is None:
            raise RuntimeError("LSTM model is not loaded")
        
        print(f'Generating daily predictions for {forecast_days} days using LSTM')
        
        # Prepare 30 timesteps of parameters
        current_params = input_data[0]
        param_sequence = np.tile(current_params, (30, 1))
        
        # Generate random weather sequence (TODO: use actual historical data)
        weather_sequence = np.array([
            [
                np.random.uniform(25, 28),
                np.random.uniform(22, 25),
                np.random.uniform(27, 30),
                np.random.uniform(0, 5),
                np.random.uniform(10, 30),
                np.random.uniform(20, 50),
                np.random.uniform(70, 90),
            ]
            for _ in range(30)
        ])
        
        # Reshape for model
        param_input = param_sequence.reshape(1, 30, 8)
        weather_input = weather_sequence.reshape(1, 30, 7)
        
        # Get predictions from LSTM
        model_output = self.lstm_model.predict([param_input, weather_input], verbose=0)
        
        # Reshape output (1, 480) to (60, 8)
        if len(model_output.shape) == 2 and model_output.shape[-1] == 480:
            predicted_data = model_output.reshape(60, 8)
        else:
            raise ValueError(f"Unexpected model output shape: {model_output.shape}")
        
        # Limit to requested days (max 60)
        forecast_days = min(forecast_days, 60)
        
        # Build predictions with denormalization
        predictions = []
        for day in range(forecast_days):
            current_date = start_dt + timedelta(days=day)
            normalized_params = predicted_data[day]
            
            # Denormalize using actual scaler
            denorm_params = self._denormalize_parameters(normalized_params)
            
            # Generate weather
            weather = self._generate_weather()
            
            prediction = {
                'date': current_date.strftime('%Y-%m-%d'),
                'day_number': day + 1,
                'parameters': denorm_params,
                'weather': weather
            }
            
            predictions.append(prediction)
            
            if day == 0:
                print(f'Sample day 1 values:')
                print(f'  water_temperature: {denorm_params["water_temperature"]:.2f}°C')
                print(f'  lagoon: {denorm_params["lagoon"]:.2f}')
            
            if (day + 1) % 10 == 0:
                print(f'  Processed day {day + 1}/{forecast_days}')
        
        print(f'✓ Generated {len(predictions)} daily predictions from LSTM')
        return predictions
    
    def _generate_production_forecasts(self, start_dt, months):
        """Generate production forecasts using ARIMA + Holt-Winters ensemble - NO FALLBACK"""
        print(f'Generating {months}-month production forecast using ARIMA + Holt-Winters')
        
        forecasts = []
        
        # Generate forecasts from both models - NO TRY-CATCH, FAIL IF ERROR
        print(f'Calling ARIMA model.predict(n_periods={months})...')
        arima_forecast = self.arima_model.predict(n_periods=months)
        print(f'  ✓ ARIMA forecast: mean={np.mean(arima_forecast):.2f}, values={arima_forecast[:3]}...')
        
        print(f'Calling Holt-Winters model.forecast(steps={months})...')
        hw_forecast = self.hw_model.forecast(steps=months)
        print(f'  ✓ Holt-Winters forecast: mean={np.mean(hw_forecast):.2f}, values={hw_forecast[:3]}...')
        
        # Naive forecast (repeat last value)
        if hasattr(self.production_series, 'iloc'):
            last_value = self.production_series.iloc[-1]
        elif hasattr(self.production_series, '__getitem__'):
            last_value = self.production_series[-1]
        else:
            raise RuntimeError("Cannot extract last value from production_series")
        
        naive_forecast = np.array([last_value] * months)
        print(f'  ✓ Naive forecast: value={last_value:.2f}')
        
        # Ensemble: average of all three
        ensemble_forecast = (arima_forecast + hw_forecast + naive_forecast) / 3
        print(f'  ✓ Ensemble forecast: mean={np.mean(ensemble_forecast):.2f}')
        
        # Build monthly forecasts
        total_production = 0
        for month_num in range(months):
            month_date = start_dt + timedelta(days=30 * month_num)
            month_str = month_date.strftime('%Y-%m')
            production = float(ensemble_forecast[month_num])
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
                'month': month_str,
                'production_forecast': production,
                'lower_bound': float(production * 0.85),
                'upper_bound': float(production * 1.15),
                'season': season
            })
            
            if month_num < 3:
                print(f'  Month {month_str}: {production:.2f}')
        
        period = '6_months' if months == 6 else '12_months'
        
        print(f'✓ Generated {months}-month production forecast, total={total_production:.2f}')
        
        return {
            'forecast_type': 'monthly_production',
            'forecast_period': period,
            'forecast_start_month': forecasts[0]['month'],
            'forecast_end_month': forecasts[-1]['month'],
            'total_months': len(forecasts),
            'forecasts': forecasts,
            'total_production': float(total_production)
        }
    
    def _generate_weather(self):
        """Generate weather forecast (placeholder)"""
        return {
            'temperature_mean': float(np.random.uniform(25, 28)),
            'temperature_max': float(np.random.uniform(27, 30)),
            'temperature_min': float(np.random.uniform(22, 25)),
            'relative_humidity_mean': float(np.random.uniform(70, 90)),
            'wind_speed_max': float(np.random.uniform(10, 30)),
            'wind_gusts_max': float(np.random.uniform(20, 50)),
            'rain_sum': float(max(0, np.random.uniform(0, 5))),
        }
    
    def _generate_seasonal_forecasts(self, monthly_forecasts):
        """Generate seasonal production forecasts from monthly data"""
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
    
    def _format_response(self, daily_predictions, monthly_6, monthly_12, seasonal, start_dt, forecast_days):
        """Format the complete response"""
        end_dt = start_dt + timedelta(days=len(daily_predictions) - 1)
        
        response = {
            'status': 'success',
            'daily_parameters_forecast': {
                'forecast_type': 'daily_parameters',
                'forecast_start_date': start_dt.strftime('%Y-%m-%d'),
                'forecast_end_date': end_dt.strftime('%Y-%m-%d'),
                'total_days': len(daily_predictions),
                'forecasts': daily_predictions
            },
            'monthly_production_6months': monthly_6,
            'monthly_production_12months': monthly_12,
            'seasonal_production': seasonal,
            'model_info': {
                'model_type': 'Hybrid_LSTM_ARIMA_HoltWinters',
                'forecast_generated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'daily_model': 'LSTM with Weather',
                'production_model': 'ARIMA + Holt-Winters + Naive Ensemble',
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
                'daily_forecast_days': len(daily_predictions),
                'monthly_6_total_production': monthly_6['total_production'],
                'monthly_12_total_production': monthly_12['total_production'],
                'maha_season_total': seasonal['seasons']['Maha']['total_production'],
                'yala_season_total': seasonal['seasons']['Yala']['total_production']
            }
        }
        
        return response
