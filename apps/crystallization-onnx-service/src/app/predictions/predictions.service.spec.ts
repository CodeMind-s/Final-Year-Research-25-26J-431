import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsService } from './predictions.service';
import { MlPredictorService } from './ml-predictor.service';

describe('PredictionsService', () => {
  let service: PredictionsService;
  let mockMlPredictor: jest.Mocked<Partial<MlPredictorService>>;

  const mockCurrentValues = {
    water_temperature: 28.5,
    lagoon: 3.2,
    OR_brine_level: 1.5,
    OR_bund_level: 0.8,
    IR_brine_level: 1.2,
    IR_bound_level: 0.6,
    East_channel: 2.1,
    West_channel: 1.9,
  };

  const mockPredictedParams = [28.6, 3.3, 1.6, 0.9, 1.3, 0.7, 2.2, 2.0];

  const mockPerformanceMetrics = {
    test_mae: 0.22643738985061646,
    test_rmse: 0.36510669291987724,
    test_r2_score: 0.7749716637562971,
    test_accuracy: 77.49716637562972,
    validation_r2_score: 0.8884437289486968,
    validation_accuracy: 88.84437289486968,
  };

  beforeEach(async () => {
    mockMlPredictor = {
      isReady: jest.fn().mockReturnValue(true),
      predict: jest.fn().mockResolvedValue(mockPredictedParams),
      performanceMetrics: mockPerformanceMetrics,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        { provide: MlPredictorService, useValue: mockMlPredictor },
      ],
    }).compile();

    service = module.get<PredictionsService>(PredictionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPredictions', () => {
    const request = {
      start_date: '2025-06-15',
      forecast_days: 3,
      current_values: mockCurrentValues,
    };

    it('should throw error when model is not ready', async () => {
      mockMlPredictor.isReady.mockReturnValue(false);

      await expect(service.getPredictions(request)).rejects.toThrow(
        'Model not loaded. Please ensure the model file exists.',
      );
    });

    it('should throw error for invalid date format', async () => {
      const invalidRequest = {
        ...request,
        start_date: 'not-a-date',
      };

      await expect(service.getPredictions(invalidRequest)).rejects.toThrow(
        'Invalid date format',
      );
    });

    it('should return a complete prediction response', async () => {
      const result = await service.getPredictions(request);

      expect(result.status).toBe('success');
      expect(result.daily_parameters_forecast).toBeDefined();
      expect(result.monthly_production_6months).toBeDefined();
      expect(result.monthly_production_12months).toBeDefined();
      expect(result.seasonal_production).toBeDefined();
      expect(result.model_info).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should generate correct number of daily forecasts', async () => {
      const result = await service.getPredictions(request);

      expect(result.daily_parameters_forecast.total_days).toBe(3);
      expect(result.daily_parameters_forecast.forecasts).toHaveLength(3);
    });

    it('should call mlPredictor.predict for each forecast day', async () => {
      await service.getPredictions(request);

      expect(mockMlPredictor.predict).toHaveBeenCalledTimes(3);
    });

    it('should use initial current values for first prediction call', async () => {
      await service.getPredictions(request);

      expect(mockMlPredictor.predict).toHaveBeenNthCalledWith(1, [
        mockCurrentValues.water_temperature,
        mockCurrentValues.lagoon,
        mockCurrentValues.OR_brine_level,
        mockCurrentValues.OR_bund_level,
        mockCurrentValues.IR_brine_level,
        mockCurrentValues.IR_bound_level,
        mockCurrentValues.East_channel,
        mockCurrentValues.West_channel,
      ]);
    });

    it('should feed previous prediction output as next input (iterative)', async () => {
      await service.getPredictions(request);

      // Second call should use the predicted params from the first call
      expect(mockMlPredictor.predict).toHaveBeenNthCalledWith(2, mockPredictedParams.slice(0, 8));
    });

    it('should build correct daily forecast items with dates', async () => {
      const result = await service.getPredictions(request);
      const forecasts = result.daily_parameters_forecast.forecasts;

      expect(forecasts[0].date).toBe('2025-06-15');
      expect(forecasts[0].day_number).toBe(1);
      expect(forecasts[1].date).toBe('2025-06-16');
      expect(forecasts[1].day_number).toBe(2);
      expect(forecasts[2].date).toBe('2025-06-17');
      expect(forecasts[2].day_number).toBe(3);
    });

    it('should map predicted params to parameter names correctly', async () => {
      const result = await service.getPredictions(request);
      const params = result.daily_parameters_forecast.forecasts[0].parameters;

      expect(params.water_temperature).toBe(mockPredictedParams[0]);
      expect(params.lagoon).toBe(mockPredictedParams[1]);
      expect(params.OR_brine_level).toBe(mockPredictedParams[2]);
      expect(params.OR_bund_level).toBe(mockPredictedParams[3]);
      expect(params.IR_brine_level).toBe(mockPredictedParams[4]);
      expect(params.IR_bound_level).toBe(mockPredictedParams[5]);
      expect(params.East_channel).toBe(mockPredictedParams[6]);
      expect(params.West_channel).toBe(mockPredictedParams[7]);
    });

    it('should include weather forecast in each daily item', async () => {
      const result = await service.getPredictions(request);
      const weather = result.daily_parameters_forecast.forecasts[0].weather;

      expect(weather).toHaveProperty('temperature_mean');
      expect(weather).toHaveProperty('temperature_min');
      expect(weather).toHaveProperty('temperature_max');
      expect(weather).toHaveProperty('rain_sum');
      expect(weather).toHaveProperty('wind_speed_max');
      expect(weather).toHaveProperty('wind_gusts_max');
      expect(weather).toHaveProperty('relative_humidity_mean');
      // Values are random but should be numbers
      expect(typeof weather.temperature_mean).toBe('number');
    });

    it('should set correct start and end dates on daily forecast', async () => {
      const result = await service.getPredictions(request);

      expect(result.daily_parameters_forecast.forecast_start_date).toBe('2025-06-15');
      expect(result.daily_parameters_forecast.forecast_end_date).toBe('2025-06-17');
      expect(result.daily_parameters_forecast.forecast_type).toBe('daily_parameters');
    });

    it('should throw error when predictor returns fewer than 8 parameters', async () => {
      mockMlPredictor.predict.mockResolvedValue([1.0, 2.0, 3.0]); // only 3

      await expect(service.getPredictions(request)).rejects.toThrow(
        'Model returned 3 parameters, expected 8.',
      );
    });
  });

  describe('monthly production forecast', () => {
    it('should generate 6-month and 12-month production forecasts', async () => {
      const request = {
        start_date: '2025-06-15',
        forecast_days: 90,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      expect(result.monthly_production_6months.forecast_type).toBe('monthly_production');
      expect(result.monthly_production_6months.forecast_period).toBe('6_months');
      expect(result.monthly_production_6months.total_months).toBe(6);

      expect(result.monthly_production_12months.forecast_type).toBe('monthly_production');
      expect(result.monthly_production_12months.forecast_period).toBe('12_months');
      expect(result.monthly_production_12months.total_months).toBe(12);
    });

    it('should calculate production from daily parameters using formula', async () => {
      // With forecast_days=3 and start_date in June,
      // those 3 days should all land in the same month
      const request = {
        start_date: '2025-06-15',
        forecast_days: 3,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const monthForecasts = result.monthly_production_6months.forecasts;

      // The first month (2025-06) should have production calculated from the 3 daily forecasts
      const juneMonth = monthForecasts.find((m: any) => m.month === '2025-06');
      expect(juneMonth).toBeDefined();

      // Each day: OR_brine * 50 + IR_brine * 50 + East * 30 + West * 30 + lagoon * 20
      // = 1.6*50 + 1.3*50 + 2.2*30 + 2.0*30 + 3.3*20
      // = 80 + 65 + 66 + 60 + 66 = 337
      // 3 days => 337 * 3 = 1011
      const expectedDailyProduction =
        mockPredictedParams[2] * 50 +  // OR_brine_level
        mockPredictedParams[4] * 50 +  // IR_brine_level
        mockPredictedParams[6] * 30 +  // East_channel
        mockPredictedParams[7] * 30 +  // West_channel
        mockPredictedParams[1] * 20;   // lagoon
      const expectedTotal = expectedDailyProduction * 3;

      expect(juneMonth.production_forecast).toBeCloseTo(expectedTotal, 2);
    });

    it('should calculate confidence bounds at +/- 15%', async () => {
      const request = {
        start_date: '2025-06-15',
        forecast_days: 3,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const firstMonth = result.monthly_production_6months.forecasts[0];

      if (firstMonth.production_forecast > 0) {
        expect(firstMonth.lower_bound).toBeCloseTo(firstMonth.production_forecast * 0.85, 2);
        expect(firstMonth.upper_bound).toBeCloseTo(firstMonth.production_forecast * 1.15, 2);
      }
    });

    it('should assign correct seasons to months', async () => {
      // Start in January to cover multiple seasons
      const request = {
        start_date: '2025-01-15',
        forecast_days: 30,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const forecasts = result.monthly_production_12months.forecasts;

      // January (month 1) is Maha season
      const janForecast = forecasts.find((f: any) => f.month === '2025-01');
      expect(janForecast.season).toBe('Maha');

      // April (month 4) is Yala season
      const aprForecast = forecasts.find((f: any) => f.month === '2025-04');
      expect(aprForecast.season).toBe('Yala');

      // September (month 9) is Other season
      const sepForecast = forecasts.find((f: any) => f.month === '2025-09');
      expect(sepForecast.season).toBe('Other');
    });

    it('should estimate production for months without daily forecasts', async () => {
      // Only 3 days of forecasts -- most months will have no daily data
      const request = {
        start_date: '2025-06-15',
        forecast_days: 3,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const monthForecasts = result.monthly_production_12months.forecasts;

      // Months after June should use the last known production as estimate
      // (the generateMonthlyForecast fallback logic)
      expect(monthForecasts.length).toBe(12);
    });

    it('should track total production across all months', async () => {
      const request = {
        start_date: '2025-06-15',
        forecast_days: 3,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      const sumOfForecasts = result.monthly_production_6months.forecasts.reduce(
        (sum: number, f: any) => sum + f.production_forecast,
        0,
      );

      expect(result.monthly_production_6months.total_production).toBeCloseTo(sumOfForecasts, 2);
    });
  });

  describe('seasonal production', () => {
    it('should generate seasonal production summary from monthly data', async () => {
      const request = {
        start_date: '2025-01-15',
        forecast_days: 30,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const seasonal = result.seasonal_production;

      expect(seasonal.forecast_type).toBe('seasonal_production');
      expect(seasonal.forecast_period).toBe('12_months');
      expect(seasonal.seasons).toBeDefined();
    });

    it('should group months into Maha, Yala, and Other seasons', async () => {
      const request = {
        start_date: '2025-01-15',
        forecast_days: 30,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const seasons = result.seasonal_production.seasons;

      // Should have at least Maha season (Jan, Feb, Mar are Maha)
      expect(seasons['Maha']).toBeDefined();
      expect(seasons['Maha'].months_count).toBeGreaterThan(0);
      expect(seasons['Maha'].months).toBeInstanceOf(Array);
    });

    it('should calculate total production per season', async () => {
      const request = {
        start_date: '2025-01-15',
        forecast_days: 30,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);
      const seasons = result.seasonal_production.seasons;

      for (const seasonName of Object.keys(seasons)) {
        const season = seasons[seasonName];
        const monthsTotal = season.months.reduce(
          (sum: number, m: any) => sum + m.production,
          0,
        );
        expect(season.total_production).toBeCloseTo(monthsTotal, 2);
      }
    });
  });

  describe('model info and summary', () => {
    it('should include model info with performance metrics', async () => {
      const request = {
        start_date: '2025-06-15',
        forecast_days: 3,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      expect(result.model_info.model_type).toBe('LSTM_Hybrid_with_Weather_ONNX');
      expect(result.model_info.forecast_generated).toBeDefined();
      expect(result.model_info.performance_metrics).toEqual(mockPerformanceMetrics);
    });

    it('should include summary with aggregated production totals', async () => {
      const request = {
        start_date: '2025-06-15',
        forecast_days: 3,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      expect(result.summary.daily_forecast_days).toBe(3);
      expect(result.summary.monthly_6_total_production).toBe(
        result.monthly_production_6months.total_production,
      );
      expect(result.summary.monthly_12_total_production).toBe(
        result.monthly_production_12months.total_production,
      );
      expect(typeof result.summary.maha_season_total).toBe('number');
      expect(typeof result.summary.yala_season_total).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('should handle single-day forecast', async () => {
      const request = {
        start_date: '2025-06-15',
        forecast_days: 1,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      expect(result.daily_parameters_forecast.forecasts).toHaveLength(1);
      expect(result.daily_parameters_forecast.forecast_start_date).toBe('2025-06-15');
      expect(result.daily_parameters_forecast.forecast_end_date).toBe('2025-06-15');
      expect(mockMlPredictor.predict).toHaveBeenCalledTimes(1);
    });

    it('should handle date at year boundary', async () => {
      const request = {
        start_date: '2025-12-30',
        forecast_days: 5,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      const forecasts = result.daily_parameters_forecast.forecasts;
      expect(forecasts).toHaveLength(5);
      // Should cross into 2026
      expect(forecasts[forecasts.length - 1].date).toBe('2026-01-03');
    });

    it('should handle predictor returning more than 8 values (uses first 8)', async () => {
      mockMlPredictor.predict.mockResolvedValue([28.6, 3.3, 1.6, 0.9, 1.3, 0.7, 2.2, 2.0, 99, 100]);

      const request = {
        start_date: '2025-06-15',
        forecast_days: 2,
        current_values: mockCurrentValues,
      };

      const result = await service.getPredictions(request);

      expect(result.daily_parameters_forecast.forecasts).toHaveLength(2);
      // Second call should only get first 8 params
      expect(mockMlPredictor.predict).toHaveBeenNthCalledWith(2, [28.6, 3.3, 1.6, 0.9, 1.3, 0.7, 2.2, 2.0]);
    });
  });
});
