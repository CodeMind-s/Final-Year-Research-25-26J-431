import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PredictionsService } from './predictions.service';
import { MlPredictorService } from './ml-predictor.service';
import { ProductionForecastService } from './production-forecast.service';
import { RetrainingService } from './retraining.service';
import { WeatherService } from './weather.service';
import { ActualMonthlyProduction } from './schemas/actual-monthly-production.schema';

describe('PredictionsService', () => {
  let service: PredictionsService;
  let mockMlPredictor: jest.Mocked<Partial<MlPredictorService>>;
  let mockProductionForecastService: jest.Mocked<Partial<ProductionForecastService>>;
  let mockRetrainingService: jest.Mocked<Partial<RetrainingService>>;
  let mockWeatherService: jest.Mocked<Partial<WeatherService>>;
  let mockActualMonthlyProductionModel: jest.Mocked<any>;

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

  // Mock ONNX model output: 60 days × 8 parameters (matching model behavior)
  const mockPredictedParams = Array.from({ length: 60 }, (_, day) => [
    28.6 + day * 0.01,  // water_temperature
    3.3 + day * 0.01,   // lagoon
    1.6 + day * 0.01,   // OR_brine_level
    0.9 + day * 0.01,   // OR_bund_level
    1.3 + day * 0.01,   // IR_brine_level
    0.7 + day * 0.01,   // IR_bound_level
    2.2 + day * 0.01,   // East_channel
    2.0 + day * 0.01,   // West_channel
  ]);

  const mockPerformanceMetrics = {
    test_mae: 0.22643738985061646,
    test_rmse: 0.36510669291987724,
    test_r2_score: 0.7749716637562971,
    test_accuracy: 77.49716637562972,
    validation_r2_score: 0.8884437289486968,
    validation_accuracy: 88.84437289486968,
  };

  const mockForecastResult = {
    calibratedMonthlyForecast: [],
    seasonalForecast: [],
    confidence: {
      overallScore: 75,
      overallRating: 'MEDIUM CONFIDENCE — suitable for planning',
      yieldRatio: 1.0,
      yieldStatus: 'NORMAL' as const,
      decliningTrend: false,
      improvingTrend: false,
      formulaR2: 0.97,
      holdoutMae: 7956,
      nHistoryMonths: 0,
      formulaFitScore: 97,
      holdoutScore: 92,
      dataVolumeScore: 60,
      yieldScore: 90,
    },
    monthlyProduction6Months: {
      forecast_type: '6_MONTH_FORECAST',
      forecast_period: '6 months',
      forecast_start_month: '2025-06-01',
      forecast_end_month: '2025-11-01',
      total_months: 6,
      total_production: 50000,
      forecasts: [],
    },
    monthlyProduction12Months: {
      forecast_type: '12_MONTH_FORECAST',
      forecast_period: '12 months',
      forecast_start_month: '2025-06-01',
      forecast_end_month: '2026-05-01',
      total_months: 12,
      total_production: 100000,
      forecasts: [],
    },
    seasonalProduction: {
      forecast_type: 'SEASONAL_FORECAST',
      forecast_period: '12 months',
      seasons: {
        'Maha': {
          months_count: 6,
          total_production: 60000,
          months: [],
        },
        'Yala': {
          months_count: 6,
          total_production: 40000,
          months: [],
        },
      },
    },
  };

  beforeEach(async () => {
    mockMlPredictor = {
      isReady: jest.fn().mockReturnValue(true),
      predict: jest.fn().mockResolvedValue(mockPredictedParams),
      performanceMetrics: mockPerformanceMetrics,
    };

    mockProductionForecastService = {
      forecast: jest.fn().mockResolvedValue(mockForecastResult),
    };

    mockRetrainingService = {
      runRetraining: jest.fn().mockResolvedValue({
        success: true, message: 'ok', newR2Score: 0.97, newHoldoutMae: 7000,
        newPiHalfWidth: 15000, nMonthsUsed: 36, lastRetrained: new Date().toISOString(),
      }),
    };

    mockWeatherService = {
      fetchForecastWeather: jest.fn().mockResolvedValue([
        {
          date: '2024-01-01',
          temp: 28.0,
          humidity: 65,
          rain: 0,
          wind: 10,
          description: 'clear sky',
        },
      ]),
    };

    mockActualMonthlyProductionModel = {
      find: jest.fn().mockReturnValue({
        sort:  jest.fn().mockReturnThis(),
        lean:  jest.fn().mockReturnThis(),
        exec:  jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        { provide: MlPredictorService,         useValue: mockMlPredictor },
        { provide: ProductionForecastService,  useValue: mockProductionForecastService },
        { provide: RetrainingService,          useValue: mockRetrainingService },
        { provide: WeatherService,             useValue: mockWeatherService },
        {
          provide: getModelToken(ActualMonthlyProduction.name),
          useValue: mockActualMonthlyProductionModel,
        },
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
      const invalidRequest = { ...request, start_date: 'not-a-date' };
      await expect(service.getPredictions(invalidRequest)).rejects.toThrow('Invalid date format');
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

    it('should include new production forecast fields in response', async () => {
      const result = await service.getPredictions(request);
      expect(result.calibratedMonthlyForecast).toBeDefined();
      expect(result.seasonalForecast).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('should always have confidence object even when history is empty', async () => {
      const result = await service.getPredictions(request);
      expect(result.confidence).not.toBeNull();
      expect(result.confidence).not.toBeUndefined();
      expect(typeof result.confidence!.overallScore).toBe('number');
    });

    it('should generate correct number of daily forecasts', async () => {
      const result = await service.getPredictions(request);
      expect(result.daily_parameters_forecast.total_days).toBe(3);
      expect(result.daily_parameters_forecast.forecasts).toHaveLength(3);
    });

    it('should call mlPredictor.predict once (returns all 60 days)', async () => {
      await service.getPredictions(request);
      expect(mockMlPredictor.predict).toHaveBeenCalledTimes(1);
    });

    it('should use initial current values for prediction call', async () => {
      await service.getPredictions(request);
      expect(mockMlPredictor.predict).toHaveBeenCalledWith(
        [
          mockCurrentValues.water_temperature,
          mockCurrentValues.lagoon,
          mockCurrentValues.OR_brine_level,
          mockCurrentValues.OR_bund_level,
          mockCurrentValues.IR_brine_level,
          mockCurrentValues.IR_bound_level,
          mockCurrentValues.East_channel,
          mockCurrentValues.West_channel,
        ],
        '2025-06-15',
        7.2008,
        79.8737,
      );
    });

    it('should build correct daily forecast items with dates', async () => {
      const result  = await service.getPredictions(request);
      const forecasts = result.daily_parameters_forecast.forecasts;
      expect(forecasts[0].date).toBe('2025-06-15');
      expect(forecasts[0].day_number).toBe(1);
      expect(forecasts[1].date).toBe('2025-06-16');
      expect(forecasts[2].date).toBe('2025-06-17');
    });

    it('should map predicted params to parameter names correctly', async () => {
      const result = await service.getPredictions(request);
      const params = result.daily_parameters_forecast.forecasts[0].parameters;
      expect(params.water_temperature).toBe(mockPredictedParams[0][0]);
      expect(params.lagoon).toBe(mockPredictedParams[0][1]);
      expect(params.OR_brine_level).toBe(mockPredictedParams[0][2]);
      expect(params.East_channel).toBe(mockPredictedParams[0][6]);
    });

    it('should include weather forecast in each daily item', async () => {
      const result  = await service.getPredictions(request);
      const weather = result.daily_parameters_forecast.forecasts[0].weather;
      expect(weather).toHaveProperty('temperature_mean');
      expect(weather).toHaveProperty('rain_sum');
      expect(weather).toHaveProperty('relative_humidity_mean');
      expect(typeof weather.temperature_mean).toBe('number');
    });

    it('should set correct start and end dates on daily forecast', async () => {
      const result = await service.getPredictions(request);
      expect(result.daily_parameters_forecast.forecast_start_date).toBe('2025-06-15');
      expect(result.daily_parameters_forecast.forecast_end_date).toBe('2025-06-17');
      expect(result.daily_parameters_forecast.forecast_type).toBe('daily_parameters');
    });

    it('should handle predictor returning fewer than 8 parameters (fills with undefined)', async () => {
      mockMlPredictor.predict.mockResolvedValue([[1.0, 2.0, 3.0]] as any);
      const result = await service.getPredictions(request);
      const params = result.daily_parameters_forecast.forecasts[0].parameters;
      expect(params.water_temperature).toBe(1.0);
      expect(params.lagoon).toBe(2.0);
      expect(params.OR_brine_level).toBe(3.0);
      expect(params.OR_bund_level).toBeUndefined();
      expect(params.East_channel).toBeUndefined();
    });
  });

  describe('monthly production forecast', () => {
    it('should use ProductionForecastService results for monthly forecasts', async () => {
      const request = { start_date: '2025-06-15', forecast_days: 90, current_values: mockCurrentValues };
      const result  = await service.getPredictions(request);
      // Should pass through the mock's forecast_type
      expect(result.monthly_production_6months.forecast_type).toBe('6_MONTH_FORECAST');
      expect(result.monthly_production_6months.total_months).toBe(6);
      expect(result.monthly_production_6months.total_production).toBe(50000);
      expect(result.monthly_production_12months.total_months).toBe(12);
      expect(result.monthly_production_12months.total_production).toBe(100000);
    });
  });

  describe('seasonal production', () => {
    it('should use ProductionForecastService results for seasonal production', async () => {
      const request = { start_date: '2025-01-15', forecast_days: 30, current_values: mockCurrentValues };
      const result  = await service.getPredictions(request);
      // Should pass through the mock's forecast_type
      expect(result.seasonal_production.forecast_type).toBe('SEASONAL_FORECAST');
      expect(result.seasonal_production.seasons).toBeDefined();
      expect(result.seasonal_production.seasons['Maha']).toBeDefined();
      expect(result.seasonal_production.seasons['Maha'].total_production).toBe(60000);
      expect(result.seasonal_production.seasons['Yala']).toBeDefined();
      expect(result.seasonal_production.seasons['Yala'].total_production).toBe(40000);
    });
  });

  describe('model info and summary', () => {
    it('should include model info with performance metrics', async () => {
      const request = { start_date: '2025-06-15', forecast_days: 3, current_values: mockCurrentValues };
      const result  = await service.getPredictions(request);
      expect(result.model_info.model_type).toBe('LSTM_Hybrid_with_Weather_ONNX');
      expect(result.model_info.performance_metrics).toEqual(mockPerformanceMetrics);
    });

    it('should include summary with aggregated production totals', async () => {
      const request = { start_date: '2025-06-15', forecast_days: 3, current_values: mockCurrentValues };
      const result  = await service.getPredictions(request);
      expect(result.summary.daily_forecast_days).toBe(3);
      expect(result.summary.monthly_6_total_production).toBe(result.monthly_production_6months.total_production);
      expect(result.summary.monthly_12_total_production).toBe(result.monthly_production_12months.total_production);
    });
  });

  describe('edge cases', () => {
    it('should handle single-day forecast', async () => {
      const request = { start_date: '2025-06-15', forecast_days: 1, current_values: mockCurrentValues };
      const result  = await service.getPredictions(request);
      expect(result.daily_parameters_forecast.forecasts).toHaveLength(1);
      expect(result.daily_parameters_forecast.forecast_start_date).toBe('2025-06-15');
      expect(result.daily_parameters_forecast.forecast_end_date).toBe('2025-06-15');
    });

    it('should handle date at year boundary', async () => {
      const request   = { start_date: '2025-12-30', forecast_days: 5, current_values: mockCurrentValues };
      const result    = await service.getPredictions(request);
      const forecasts = result.daily_parameters_forecast.forecasts;
      expect(forecasts).toHaveLength(5);
      expect(forecasts[forecasts.length - 1].date).toBe('2026-01-03');
    });

    it('should handle predictor returning more than 8 values (uses first 8)', async () => {
      mockMlPredictor.predict.mockResolvedValue(Array.from({ length: 60 }, () => [28.6, 3.3, 1.6, 0.9, 1.3, 0.7, 2.2, 2.0, 99, 100]) as any);
      const request = { start_date: '2025-06-15', forecast_days: 2, current_values: mockCurrentValues };
      const result  = await service.getPredictions(request);
      expect(result.daily_parameters_forecast.forecasts).toHaveLength(2);
    });

    it('should degrade gracefully when MongoDB history fetch fails', async () => {
      mockActualMonthlyProductionModel.find.mockReturnValue({
        sort:  jest.fn().mockReturnThis(),
        lean:  jest.fn().mockReturnThis(),
        exec:  jest.fn().mockRejectedValue(new Error('Mongo down')),
      });
      const request = { start_date: '2025-06-15', forecast_days: 1, current_values: mockCurrentValues };
      // Should not throw — forecast service called with empty history
      const result = await service.getPredictions(request);
      expect(result.status).toBe('success');
      expect(mockProductionForecastService.forecast).toHaveBeenCalledWith(
        expect.objectContaining({ productionHistory: [] }),
      );
    });
  });
});
