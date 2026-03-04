import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { CrystallizationService } from './crystallization.service';

// Mock axios at module level
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CrystallizationService', () => {
  let service: CrystallizationService;
  let dailyMeasurementModel: any;
  let dailyParameterPredictionModel: any;
  let monthlyProductionPredictionModel: any;
  let crystallizationModelPerformanceModel: any;
  let mockOnnxClient: any;
  let mockAuditLogClient: any;
  let mockConfigService: any;
  let mockPredictionsONNXService: any;

  // --- Mock data ---

  const mockParameters = {
    water_temperature: 28.5,
    lagoon: 3.2,
    OR_brine_level: 1.5,
    OR_bund_level: 0.8,
    IR_brine_level: 1.2,
    IR_bound_level: 0.6,
    East_channel: 2.1,
    West_channel: 1.9,
  };

  const mockWeather = {
    temperature_mean: 27.5,
    temperature_max: 30.0,
    temperature_min: 25.0,
    rain_sum: 0,
    wind_speed_max: 15,
    wind_gusts_max: 25,
    relative_humidity_mean: 78,
  };

  const mockMeasurementDoc = {
    _id: '507f1f77bcf86cd799439011',
    date: new Date('2025-06-15'),
    dayNumber: 897,
    parameters: mockParameters,
    weather: mockWeather,
    createdAt: new Date('2025-06-15T10:00:00Z'),
    updatedAt: new Date('2025-06-15T10:00:00Z'),
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439011',
      date: new Date('2025-06-15'),
      dayNumber: 897,
      parameters: mockParameters,
      weather: mockWeather,
      createdAt: new Date('2025-06-15T10:00:00Z'),
      updatedAt: new Date('2025-06-15T10:00:00Z'),
    }),
  };

  const mockPredictionDoc = {
    _id: '507f1f77bcf86cd799439012',
    date: '2025-06-16',
    dayNumber: 1,
    parameters: mockParameters,
    weather: mockWeather,
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439012',
      date: '2025-06-16',
      dayNumber: 1,
      parameters: mockParameters,
      weather: mockWeather,
    }),
  };

  const mockMonthlyPredictionDoc = {
    _id: '507f1f77bcf86cd799439013',
    month: '2025-07',
    monthNumber: 1,
    productionForecast: 5000,
    lowerBound: 4250,
    upperBound: 5750,
    season: 'Yala',
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439013',
      month: '2025-07',
      monthNumber: 1,
      productionForecast: 5000,
      lowerBound: 4250,
      upperBound: 5750,
      season: 'Yala',
    }),
  };

  const mockPerformanceDoc = {
    _id: '507f1f77bcf86cd799439014',
    model_type: 'LSTM_Hybrid_with_Weather_ONNX',
    forecast_generated: new Date('2025-06-15T10:00:00Z'),
    performance_metrics: {
      test_mae: 0.226,
      test_rmse: 0.365,
      test_r2_score: 0.775,
      test_accuracy: 77.5,
      validation_r2_score: 0.888,
      validation_accuracy: 88.8,
    },
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439014',
      model_type: 'LSTM_Hybrid_with_Weather_ONNX',
      forecast_generated: new Date('2025-06-15T10:00:00Z'),
      performance_metrics: {
        test_mae: 0.226,
        test_rmse: 0.365,
        test_r2_score: 0.775,
        test_accuracy: 77.5,
        validation_r2_score: 0.888,
        validation_accuracy: 88.8,
      },
    }),
  };

  // --- Factory for Mongoose models ---

  const createMockModel = () => {
    const model: any = jest.fn();
    Object.assign(model, {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
      countDocuments: jest.fn(),
      deleteOne: jest.fn(),
    });
    return model;
  };

  beforeEach(async () => {
    // Reset axios mock
    (mockedAxios.get as jest.Mock).mockReset();

    // Create mock models
    dailyMeasurementModel = createMockModel();
    dailyParameterPredictionModel = createMockModel();
    monthlyProductionPredictionModel = createMockModel();
    crystallizationModelPerformanceModel = createMockModel();

    // Mock the gRPC ONNX predictions service
    mockPredictionsONNXService = {
      GetPredictions: jest.fn(),
    };

    // Mock the gRPC client
    mockOnnxClient = {
      getService: jest.fn().mockReturnValue(mockPredictionsONNXService),
    };

    // Mock Kafka audit log client
    mockAuditLogClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    };

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          OPENWEATHER_API_KEY: 'test-api-key',
          OPENWEATHER_LAT: '7.8731',
          OPENWEATHER_LON: '80.7718',
        };
        return config[key] || undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrystallizationService,
        { provide: getModelToken('DailyMeasurement'), useValue: dailyMeasurementModel },
        { provide: getModelToken('DailyParameterPrediction'), useValue: dailyParameterPredictionModel },
        { provide: getModelToken('MonthlyProductionPrediction'), useValue: monthlyProductionPredictionModel },
        { provide: getModelToken('CrystallizationModelPerformance'), useValue: crystallizationModelPerformanceModel },
        { provide: 'PREDICTIONS_PACKAGE', useValue: mockOnnxClient },
        { provide: 'AUDIT_LOG_SERVICE', useValue: mockAuditLogClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CrystallizationService>(CrystallizationService);

    // Call onModuleInit to set up gRPC service reference
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- onModuleInit ---

  describe('onModuleInit', () => {
    it('should initialize the ONNX predictions gRPC service', async () => {
      expect(mockOnnxClient.getService).toHaveBeenCalledWith('PredictionsService');
    });

    it('should connect the audit log Kafka client', async () => {
      expect(mockAuditLogClient.connect).toHaveBeenCalled();
    });
  });

  // --- CreateDailyMeasurement ---

  describe('CreateDailyMeasurement', () => {
    it('should create a daily measurement with new format data and fetched weather', async () => {
      // Mock weather API response
      (mockedAxios.get as jest.Mock).mockResolvedValue({
        data: {
          main: { temp: 300.65, temp_min: 298.15, temp_max: 303.15, humidity: 78 },
          wind: { speed: 15, gust: 25 },
          rain: { '1h': 0 },
        },
      });

      dailyMeasurementModel.create.mockResolvedValue(mockMeasurementDoc);

      const dto = {
        date: '2025-06-15',
        dayNumber: 897,
        parameters: mockParameters,
        weather: mockWeather,
      };

      const result = await service.CreateDailyMeasurement(dto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily Measurement created successfully');
      expect(result.data).toBeDefined();
      expect(result.data._id).toBe('507f1f77bcf86cd799439011');
      expect(dailyMeasurementModel.create).toHaveBeenCalled();
      // Should emit success audit log
      expect(mockAuditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'DAILY_MEASUREMENT_CREATED',
          status: 'success',
        }),
      );
    });

    it('should create a daily measurement with old flat format data', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({
        data: {
          main: { temp: 300.65, temp_min: 298.15, temp_max: 303.15, humidity: 78 },
          wind: { speed: 15, gust: 25 },
          rain: { '1h': 0 },
        },
      });

      dailyMeasurementModel.create.mockResolvedValue(mockMeasurementDoc);

      const oldFormatDto = {
        date: '2025-06-15',
        waterTemperature: 28.5,
        lagoon: 3.2,
        orBrineLevel: 1.5,
        orBoundLevel: 0.8,
        irBrineLevel: 1.2,
        irBoundLevel: 0.6,
        eastChannel: 2.1,
        westChannel: 1.9,
      };

      const result = await service.CreateDailyMeasurement(oldFormatDto);

      expect(result.success).toBe(true);
      expect(dailyMeasurementModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2025-06-15',
          parameters: expect.objectContaining({
            water_temperature: 28.5,
            lagoon: 3.2,
          }),
        }),
      );
    });

    it('should use provided weather when OpenWeatherMap API fails', async () => {
      (mockedAxios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      dailyMeasurementModel.create.mockResolvedValue(mockMeasurementDoc);

      const dto = {
        date: '2025-06-15',
        dayNumber: 897,
        parameters: mockParameters,
        weather: mockWeather,
      };

      const result = await service.CreateDailyMeasurement(dto);

      expect(result.success).toBe(true);
      // Weather data from DTO should be used as fallback
      expect(dailyMeasurementModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          weather: mockWeather,
        }),
      );
    });

    it('should use provided weather when API credentials are missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      dailyMeasurementModel.create.mockResolvedValue(mockMeasurementDoc);

      const dto = {
        date: '2025-06-15',
        dayNumber: 897,
        parameters: mockParameters,
        weather: mockWeather,
      };

      const result = await service.CreateDailyMeasurement(dto);

      expect(result.success).toBe(true);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when create fails', async () => {
      (mockedAxios.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      dailyMeasurementModel.create.mockRejectedValue(new Error('Validation failed'));

      const dto = {
        date: '2025-06-15',
        dayNumber: 897,
        parameters: mockParameters,
        weather: mockWeather,
      };

      await expect(service.CreateDailyMeasurement(dto)).rejects.toThrow(BadRequestException);
      // Should emit error audit log
      expect(mockAuditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'DAILY_MEASUREMENT_CREATION_FAILED',
          status: 'error',
        }),
      );
    });
  });

  // --- GetDailyMeasurementByDate ---

  describe('GetDailyMeasurementByDate', () => {
    it('should return a measurement for a given date', async () => {
      dailyMeasurementModel.findOne.mockResolvedValue(mockMeasurementDoc);

      const result = await service.GetDailyMeasurementByDate({ date: '2025-06-15' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily Measurement fetched successfully');
      expect(result.data).toBeDefined();
      expect(result.data._id).toBe('507f1f77bcf86cd799439011');
      expect(dailyMeasurementModel.findOne).toHaveBeenCalledWith({ date: '2025-06-15' });
    });

    it('should return success false when no measurement found', async () => {
      dailyMeasurementModel.findOne.mockResolvedValue(null);

      const result = await service.GetDailyMeasurementByDate({ date: '2025-01-01' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No daily measurement found');
      expect(result.data).toBeNull();
    });

    it('should throw BadRequestException on database error', async () => {
      dailyMeasurementModel.findOne.mockRejectedValue(new Error('DB connection error'));

      await expect(
        service.GetDailyMeasurementByDate({ date: '2025-06-15' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- GetDailyMeasurementsByDateRange ---

  describe('GetDailyMeasurementsByDateRange', () => {
    it('should return measurements within a date range', async () => {
      const sortMock = jest.fn().mockResolvedValue([mockMeasurementDoc]);
      dailyMeasurementModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetDailyMeasurementsByDateRange({
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(dailyMeasurementModel.find).toHaveBeenCalledWith({
        date: {
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        },
      });
      expect(sortMock).toHaveBeenCalledWith({ date: 1 });
    });

    it('should return empty array when no measurements found in range', async () => {
      const sortMock = jest.fn().mockResolvedValue([]);
      dailyMeasurementModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetDailyMeasurementsByDateRange({
        startDate: '2020-01-01',
        endDate: '2020-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.message).toContain('No daily measurements found');
    });

    it('should return empty array when find returns null', async () => {
      const sortMock = jest.fn().mockResolvedValue(null);
      dailyMeasurementModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetDailyMeasurementsByDateRange({
        startDate: '2020-01-01',
        endDate: '2020-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should throw BadRequestException on database error', async () => {
      dailyMeasurementModel.find.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(
        service.GetDailyMeasurementsByDateRange({
          startDate: '2025-06-01',
          endDate: '2025-06-30',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- UpdateDailyMeasurementById ---

  describe('UpdateDailyMeasurementById', () => {
    it('should update a daily measurement by ID', async () => {
      dailyMeasurementModel.findByIdAndUpdate.mockResolvedValue(mockMeasurementDoc);

      const dto = {
        id: '507f1f77bcf86cd799439011',
        waterTemperature: 29.0,
        lagoon: 3.5,
        orBrineLevel: 0,
        orBoundLevel: 0,
        irBrineLevel: 0,
        irBoundLevel: 0,
        eastChannel: 0,
        westChannel: 0,
      };

      const result = await service.UpdateDailyMeasurementById(dto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily Measurement updated successfully');
      expect(dailyMeasurementModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          'parameters.water_temperature': 29.0,
          'parameters.lagoon': 3.5,
        }),
        { new: true, runValidators: true },
      );
      // Should emit success audit log
      expect(mockAuditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'DAILY_MEASUREMENT_UPDATED',
          status: 'success',
        }),
      );
    });

    it('should return success false when no valid fields are provided', async () => {
      const dto = {
        id: '507f1f77bcf86cd799439011',
        waterTemperature: 0,
        lagoon: 0,
        orBrineLevel: 0,
        orBoundLevel: 0,
        irBrineLevel: 0,
        irBoundLevel: 0,
        eastChannel: 0,
        westChannel: 0,
      };

      const result = await service.UpdateDailyMeasurementById(dto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No valid fields provided to update');
      expect(dailyMeasurementModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return success false when measurement not found', async () => {
      dailyMeasurementModel.findByIdAndUpdate.mockResolvedValue(null);

      const dto = {
        id: 'nonexistent-id',
        waterTemperature: 29.0,
        lagoon: 0,
        orBrineLevel: 0,
        orBoundLevel: 0,
        irBrineLevel: 0,
        irBoundLevel: 0,
        eastChannel: 0,
        westChannel: 0,
      };

      const result = await service.UpdateDailyMeasurementById(dto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No daily measurement found');
    });

    it('should throw BadRequestException on database error', async () => {
      dailyMeasurementModel.findByIdAndUpdate.mockRejectedValue(new Error('DB error'));

      const dto = {
        id: '507f1f77bcf86cd799439011',
        waterTemperature: 29.0,
        lagoon: 0,
        orBrineLevel: 0,
        orBoundLevel: 0,
        irBrineLevel: 0,
        irBoundLevel: 0,
        eastChannel: 0,
        westChannel: 0,
      };

      await expect(service.UpdateDailyMeasurementById(dto)).rejects.toThrow(BadRequestException);
      // Should emit error audit log
      expect(mockAuditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'DAILY_MEASUREMENT_UPDATE_FAILED',
          status: 'error',
        }),
      );
    });
  });

  // --- DeleteDailyMeasurementById ---

  describe('DeleteDailyMeasurementById', () => {
    it('should delete a daily measurement by ID', async () => {
      dailyMeasurementModel.findByIdAndDelete.mockResolvedValue(mockMeasurementDoc);

      const result = await service.DeleteDailyMeasurementById({ id: '507f1f77bcf86cd799439011' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily Measurement deleted successfully');
      expect(dailyMeasurementModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      // Should emit success audit log
      expect(mockAuditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'DAILY_MEASUREMENT_DELETED',
          status: 'success',
        }),
      );
    });

    it('should return success false when measurement not found for deletion', async () => {
      dailyMeasurementModel.findByIdAndDelete.mockResolvedValue(null);

      const result = await service.DeleteDailyMeasurementById({ id: 'nonexistent-id' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No daily measurement found');
    });

    it('should throw BadRequestException on database error during deletion', async () => {
      dailyMeasurementModel.findByIdAndDelete.mockRejectedValue(new Error('DB error'));

      await expect(
        service.DeleteDailyMeasurementById({ id: '507f1f77bcf86cd799439011' }),
      ).rejects.toThrow(BadRequestException);
      // Should emit error audit log
      expect(mockAuditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'DAILY_MEASUREMENT_DELETION_FAILED',
          status: 'error',
        }),
      );
    });
  });

  // --- GetPredictions ---

  describe('GetPredictions', () => {
    const predictionRequest = {
      start_date: '2025-06-15',
      forecast_days: 7,
      current_values: mockParameters,
    };

    const mockOnnxResponse = {
      status: 'success',
      daily_parameters_forecast: {
        forecast_type: 'daily_parameters',
        forecast_start_date: '2025-06-15',
        forecast_end_date: '2025-06-21',
        total_days: 7,
        forecasts: [
          {
            date: '2025-06-15',
            day_number: 1,
            parameters: mockParameters,
            weather: mockWeather,
          },
        ],
      },
      monthly_production_12months: {
        forecasts: [
          {
            month: '2025-06',
            month_number: 1,
            production_forecast: 5000,
            lower_bound: 4250,
            upper_bound: 5750,
            season: 'Yala',
          },
        ],
      },
      model_info: {
        model_type: 'LSTM_Hybrid_with_Weather_ONNX',
        forecast_generated: '2025-06-15 10:00:00',
        performance_metrics: {
          test_mae: 0.226,
          test_rmse: 0.365,
          test_r2_score: 0.775,
          test_accuracy: 77.5,
          validation_r2_score: 0.888,
          validation_accuracy: 88.8,
        },
      },
      summary: {
        daily_forecast_days: 7,
        monthly_6_total_production: 30000,
        monthly_12_total_production: 60000,
      },
    };

    it('should forward prediction request to ONNX service and return result', async () => {
      mockPredictionsONNXService.GetPredictions.mockReturnValue(of(mockOnnxResponse));
      crystallizationModelPerformanceModel.create.mockResolvedValue({});
      dailyParameterPredictionModel.findOneAndUpdate.mockResolvedValue({});
      monthlyProductionPredictionModel.findOneAndUpdate.mockResolvedValue({});

      const result = await service.GetPredictions(predictionRequest);

      expect(result.status).toBe('success');
      expect(mockPredictionsONNXService.GetPredictions).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: '2025-06-15',
          forecast_days: 7,
          current_values: mockParameters,
        }),
      );
    });

    it('should save model performance metrics to database', async () => {
      mockPredictionsONNXService.GetPredictions.mockReturnValue(of(mockOnnxResponse));
      crystallizationModelPerformanceModel.create.mockResolvedValue({});
      dailyParameterPredictionModel.findOneAndUpdate.mockResolvedValue({});
      monthlyProductionPredictionModel.findOneAndUpdate.mockResolvedValue({});

      await service.GetPredictions(predictionRequest);

      expect(crystallizationModelPerformanceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model_type: 'LSTM_Hybrid_with_Weather_ONNX',
          performance_metrics: expect.objectContaining({
            test_mae: 0.226,
          }),
        }),
      );
    });

    it('should save daily parameter predictions via upsert', async () => {
      mockPredictionsONNXService.GetPredictions.mockReturnValue(of(mockOnnxResponse));
      crystallizationModelPerformanceModel.create.mockResolvedValue({});
      dailyParameterPredictionModel.findOneAndUpdate.mockResolvedValue({});
      monthlyProductionPredictionModel.findOneAndUpdate.mockResolvedValue({});

      await service.GetPredictions(predictionRequest);

      expect(dailyParameterPredictionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { date: '2025-06-15' },
        expect.objectContaining({
          date: '2025-06-15',
          dayNumber: 1,
          parameters: mockParameters,
          weather: mockWeather,
        }),
        { upsert: true, new: true },
      );
    });

    it('should save monthly production predictions via upsert', async () => {
      mockPredictionsONNXService.GetPredictions.mockReturnValue(of(mockOnnxResponse));
      crystallizationModelPerformanceModel.create.mockResolvedValue({});
      dailyParameterPredictionModel.findOneAndUpdate.mockResolvedValue({});
      monthlyProductionPredictionModel.findOneAndUpdate.mockResolvedValue({});

      await service.GetPredictions(predictionRequest);

      expect(monthlyProductionPredictionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { month: '2025-06' },
        expect.objectContaining({
          month: '2025-06',
          monthNumber: 1,
          productionForecast: 5000,
          metadata: mockParameters,
        }),
        { upsert: true, new: true },
      );
    });

    it('should still return predictions even if performance save fails', async () => {
      mockPredictionsONNXService.GetPredictions.mockReturnValue(of(mockOnnxResponse));
      crystallizationModelPerformanceModel.create.mockRejectedValue(new Error('Save failed'));
      dailyParameterPredictionModel.findOneAndUpdate.mockResolvedValue({});
      monthlyProductionPredictionModel.findOneAndUpdate.mockResolvedValue({});

      const result = await service.GetPredictions(predictionRequest);

      expect(result.status).toBe('success');
    });

    it('should handle response without model_info gracefully', async () => {
      const responseWithoutModelInfo = {
        ...mockOnnxResponse,
        model_info: undefined,
      };
      mockPredictionsONNXService.GetPredictions.mockReturnValue(of(responseWithoutModelInfo));
      dailyParameterPredictionModel.findOneAndUpdate.mockResolvedValue({});
      monthlyProductionPredictionModel.findOneAndUpdate.mockResolvedValue({});

      const result = await service.GetPredictions(predictionRequest);

      expect(result).toBeDefined();
      expect(crystallizationModelPerformanceModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when ONNX service call fails', async () => {
      mockPredictionsONNXService.GetPredictions.mockImplementation(() => {
        throw new Error('ONNX service unavailable');
      });

      await expect(service.GetPredictions(predictionRequest)).rejects.toThrow(BadRequestException);
    });
  });

  // --- GetPredictedDailyMeasurement ---

  describe('GetPredictedDailyMeasurement', () => {
    it('should return predicted daily measurements within date range', async () => {
      const sortMock = jest.fn().mockResolvedValue([mockPredictionDoc]);
      dailyParameterPredictionModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetPredictedDailyMeasurement({
        startDate: '2025-06-15',
        endDate: '2025-06-21',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Predicted daily measurements fetched successfully');
      expect(result.data).toHaveLength(1);
      expect(dailyParameterPredictionModel.find).toHaveBeenCalledWith({
        date: { $gte: '2025-06-15', $lte: '2025-06-21' },
      });
      expect(sortMock).toHaveBeenCalledWith({ date: 1 });
    });

    it('should return success false when no predictions found', async () => {
      const sortMock = jest.fn().mockResolvedValue([]);
      dailyParameterPredictionModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetPredictedDailyMeasurement({
        startDate: '2020-01-01',
        endDate: '2020-01-31',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No predicted daily measurements found');
      expect(result.data).toEqual([]);
    });

    it('should throw BadRequestException on database error', async () => {
      dailyParameterPredictionModel.find.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(
        service.GetPredictedDailyMeasurement({
          startDate: '2025-06-15',
          endDate: '2025-06-21',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- GetPredictedMonthlyProduction ---

  describe('GetPredictedMonthlyProduction', () => {
    it('should return predicted monthly productions within month range', async () => {
      const sortMock = jest.fn().mockResolvedValue([mockMonthlyPredictionDoc]);
      monthlyProductionPredictionModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetPredictedMonthlyProduction({
        startMonth: '2025-06',
        endMonth: '2025-12',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Predicted monthly productions fetched successfully');
      expect(result.data).toHaveLength(1);
      expect(monthlyProductionPredictionModel.find).toHaveBeenCalledWith({
        month: { $gte: '2025-06', $lte: '2025-12' },
      });
      expect(sortMock).toHaveBeenCalledWith({ month: 1 });
    });

    it('should return success false when no monthly predictions found', async () => {
      const sortMock = jest.fn().mockResolvedValue([]);
      monthlyProductionPredictionModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetPredictedMonthlyProduction({
        startMonth: '2020-01',
        endMonth: '2020-12',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No predicted monthly productions found');
      expect(result.data).toEqual([]);
    });

    it('should throw BadRequestException on database error', async () => {
      monthlyProductionPredictionModel.find.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(
        service.GetPredictedMonthlyProduction({
          startMonth: '2025-06',
          endMonth: '2025-12',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- GetModelPerformance ---

  describe('GetModelPerformance', () => {
    it('should return model performance records with default limit', async () => {
      const limitMock = jest.fn().mockResolvedValue([mockPerformanceDoc]);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      crystallizationModelPerformanceModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetModelPerformance({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Model performance records fetched successfully');
      expect(result.data).toHaveLength(1);
      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(limitMock).toHaveBeenCalledWith(10); // default limit
    });

    it('should respect custom limit within bounds', async () => {
      const limitMock = jest.fn().mockResolvedValue([mockPerformanceDoc]);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      crystallizationModelPerformanceModel.find.mockReturnValue({ sort: sortMock });

      await service.GetModelPerformance({ limit: 5 });

      expect(limitMock).toHaveBeenCalledWith(5);
    });

    it('should cap limit to 10 when above 100', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      crystallizationModelPerformanceModel.find.mockReturnValue({ sort: sortMock });

      await service.GetModelPerformance({ limit: 200 });

      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('should use default limit for zero or negative values', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      crystallizationModelPerformanceModel.find.mockReturnValue({ sort: sortMock });

      await service.GetModelPerformance({ limit: 0 });

      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('should return empty array with success when no records found', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      crystallizationModelPerformanceModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.GetModelPerformance({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('No model performance records found');
      expect(result.data).toEqual([]);
    });

    it('should throw BadRequestException on database error', async () => {
      crystallizationModelPerformanceModel.find.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.GetModelPerformance({})).rejects.toThrow(BadRequestException);
    });
  });

  // --- GetWeatherForecast ---

  describe('GetWeatherForecast', () => {
    const mockForecastResponse = {
      city: { id: 1229293, name: 'Puttalam', coord: { lon: 79.8147, lat: 8.0615 }, country: 'LK', population: 45661, timezone: 19800 },
      cod: '200',
      message: 0.75,
      cnt: 16,
      list: [
        {
          dt: 1772605800,
          temp: { day: 300.89, min: 295.72, max: 300.89, night: 298.93, eve: 299.52, morn: 295.87 },
          weather: [{ id: 501, main: 'Rain', description: 'moderate rain', icon: '10d' }],
          humidity: 64,
          speed: 5.14,
        },
      ],
    };

    it('should return weather forecast successfully', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: mockForecastResponse });

      const result = await service.GetWeatherForecast({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Weather forecast fetched successfully');
      expect(result.data).toBe(JSON.stringify(mockForecastResponse));
      expect(mockedAxios.get as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('forecast/daily?lat=8.061542&lon=79.814714&cnt=16'),
      );
    });

    it('should include the API key in the request URL', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: mockForecastResponse });

      await service.GetWeatherForecast({});

      expect(mockedAxios.get as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('appid=test-api-key'),
      );
    });

    it('should return success false when API key is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.GetWeatherForecast({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('API key is not configured');
      expect(result.data).toBe('');
      expect(mockedAxios.get as jest.Mock).not.toHaveBeenCalled();
    });

    it('should return success false when the HTTP call fails', async () => {
      (mockedAxios.get as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const result = await service.GetWeatherForecast({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network timeout');
      expect(result.data).toBe('');
    });

    it('should use custom lat/lon/cnt from request data when provided', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: mockForecastResponse });

      await service.GetWeatherForecast({ lat: 6.927079, lon: 79.861244, cnt: 7 });

      expect(mockedAxios.get as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('lat=6.927079&lon=79.861244&cnt=7'),
      );
    });

    it('should fall back to default lat/lon/cnt when not provided', async () => {
      (mockedAxios.get as jest.Mock).mockResolvedValue({ data: mockForecastResponse });

      await service.GetWeatherForecast({});

      expect(mockedAxios.get as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('lat=8.061542&lon=79.814714&cnt=16'),
      );
    });
  });
});
