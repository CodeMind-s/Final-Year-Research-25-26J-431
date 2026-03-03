import { Test, TestingModule } from '@nestjs/testing';
import { CrystallizationController } from './crystallization.controller';
import { CrystallizationService } from './crystallization.service';

describe('CrystallizationController', () => {
  let controller: CrystallizationController;
  let mockService: jest.Mocked<Partial<CrystallizationService>>;

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

  beforeEach(async () => {
    mockService = {
      CreateDailyMeasurement: jest.fn(),
      GetDailyMeasurementByDate: jest.fn(),
      GetDailyMeasurementsByDateRange: jest.fn(),
      UpdateDailyMeasurementById: jest.fn(),
      DeleteDailyMeasurementById: jest.fn(),
      GetPredictions: jest.fn(),
      GetPredictedDailyMeasurement: jest.fn(),
      GetPredictedMonthlyProduction: jest.fn(),
      GetModelPerformance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrystallizationController],
      providers: [
        { provide: CrystallizationService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<CrystallizationController>(CrystallizationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CreateDailyMeasurement', () => {
    it('should delegate to service and return result', async () => {
      const dto = {
        date: '2025-06-15',
        dayNumber: 897,
        parameters: mockParameters,
        weather: mockWeather,
      };
      const expectedResponse = {
        success: true,
        message: 'Daily Measurement created successfully',
        data: { _id: '123', ...dto },
      };
      mockService.CreateDailyMeasurement.mockResolvedValue(expectedResponse);

      const result = await controller.CreateDailyMeasurement(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.CreateDailyMeasurement).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = {
        date: '2025-06-15',
        dayNumber: 897,
        parameters: mockParameters,
        weather: mockWeather,
      };
      mockService.CreateDailyMeasurement.mockRejectedValue(new Error('Service error'));

      await expect(controller.CreateDailyMeasurement(dto)).rejects.toThrow('Service error');
    });
  });

  describe('GetDailyMeasurementByDate', () => {
    it('should delegate to service and return result', async () => {
      const dto = { date: '2025-06-15' };
      const expectedResponse = {
        success: true,
        message: 'Daily Measurement fetched successfully',
        data: { date: '2025-06-15', parameters: mockParameters },
      };
      mockService.GetDailyMeasurementByDate.mockResolvedValue(expectedResponse);

      const result = await controller.GetDailyMeasurementByDate(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.GetDailyMeasurementByDate).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = { date: '2025-06-15' };
      mockService.GetDailyMeasurementByDate.mockRejectedValue(new Error('Not found'));

      await expect(controller.GetDailyMeasurementByDate(dto)).rejects.toThrow('Not found');
    });
  });

  describe('GetDailyMeasurementsByDateRange', () => {
    it('should delegate to service and return result', async () => {
      const dto = { startDate: '2025-06-01', endDate: '2025-06-30' };
      const expectedResponse = {
        success: true,
        message: 'Found 5 daily measurements',
        data: [],
      };
      mockService.GetDailyMeasurementsByDateRange.mockResolvedValue(expectedResponse);

      const result = await controller.GetDailyMeasurementsByDateRange(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.GetDailyMeasurementsByDateRange).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = { startDate: '2025-06-01', endDate: '2025-06-30' };
      mockService.GetDailyMeasurementsByDateRange.mockRejectedValue(new Error('DB error'));

      await expect(controller.GetDailyMeasurementsByDateRange(dto)).rejects.toThrow('DB error');
    });
  });

  describe('UpdateDailyMeasurementById', () => {
    it('should delegate to service and return result', async () => {
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
      const expectedResponse = {
        success: true,
        message: 'Daily Measurement updated successfully',
        data: { _id: dto.id },
      };
      mockService.UpdateDailyMeasurementById.mockResolvedValue(expectedResponse);

      const result = await controller.UpdateDailyMeasurementById(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.UpdateDailyMeasurementById).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
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
      mockService.UpdateDailyMeasurementById.mockRejectedValue(new Error('Update failed'));

      await expect(controller.UpdateDailyMeasurementById(dto)).rejects.toThrow('Update failed');
    });
  });

  describe('DeleteDailyMeasurementById', () => {
    it('should delegate to service and return result', async () => {
      const dto = { id: '507f1f77bcf86cd799439011' };
      const expectedResponse = {
        success: true,
        message: 'Daily Measurement deleted successfully',
      };
      mockService.DeleteDailyMeasurementById.mockResolvedValue(expectedResponse);

      const result = await controller.DeleteDailyMeasurementById(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.DeleteDailyMeasurementById).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = { id: '507f1f77bcf86cd799439011' };
      mockService.DeleteDailyMeasurementById.mockRejectedValue(new Error('Delete failed'));

      await expect(controller.DeleteDailyMeasurementById(dto)).rejects.toThrow('Delete failed');
    });
  });

  describe('GetPredictions', () => {
    it('should delegate to service and return result', async () => {
      const dto = {
        start_date: '2025-06-15',
        forecast_days: 7,
        current_values: mockParameters,
      };
      const expectedResponse = {
        status: 'success',
        daily_parameters_forecast: { forecasts: [] },
        model_info: { model_type: 'LSTM_Hybrid_with_Weather_ONNX' },
      };
      mockService.GetPredictions.mockResolvedValue(expectedResponse as any);

      const result = await controller.GetPredictions(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.GetPredictions).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = {
        start_date: '2025-06-15',
        forecast_days: 7,
        current_values: mockParameters,
      };
      mockService.GetPredictions.mockRejectedValue(new Error('ONNX unavailable'));

      await expect(controller.GetPredictions(dto)).rejects.toThrow('ONNX unavailable');
    });
  });

  describe('GetPredictedDailyMeasurement', () => {
    it('should delegate to service and return result', async () => {
      const dto = { startDate: '2025-06-15', endDate: '2025-06-21' };
      const expectedResponse = {
        success: true,
        message: 'Predicted daily measurements fetched successfully',
        data: [],
      };
      mockService.GetPredictedDailyMeasurement.mockResolvedValue(expectedResponse);

      const result = await controller.GetPredictedDailyMeasurement(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.GetPredictedDailyMeasurement).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = { startDate: '2025-06-15', endDate: '2025-06-21' };
      mockService.GetPredictedDailyMeasurement.mockRejectedValue(new Error('Fetch error'));

      await expect(controller.GetPredictedDailyMeasurement(dto)).rejects.toThrow('Fetch error');
    });
  });

  describe('GetPredictedMonthlyProduction', () => {
    it('should delegate to service and return result', async () => {
      const dto = { startMonth: '2025-06', endMonth: '2025-12' };
      const expectedResponse = {
        success: true,
        message: 'Predicted monthly productions fetched successfully',
        data: [],
      };
      mockService.GetPredictedMonthlyProduction.mockResolvedValue(expectedResponse);

      const result = await controller.GetPredictedMonthlyProduction(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.GetPredictedMonthlyProduction).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = { startMonth: '2025-06', endMonth: '2025-12' };
      mockService.GetPredictedMonthlyProduction.mockRejectedValue(new Error('Fetch error'));

      await expect(controller.GetPredictedMonthlyProduction(dto)).rejects.toThrow('Fetch error');
    });
  });

  describe('GetModelPerformance', () => {
    it('should delegate to service and return result', async () => {
      const dto = { limit: 5 };
      const expectedResponse = {
        success: true,
        message: 'Model performance records fetched successfully',
        data: [],
      };
      mockService.GetModelPerformance.mockResolvedValue(expectedResponse);

      const result = await controller.GetModelPerformance(dto);

      expect(result).toEqual(expectedResponse);
      expect(mockService.GetModelPerformance).toHaveBeenCalledWith(dto);
    });

    it('should propagate service errors', async () => {
      const dto = { limit: 5 };
      mockService.GetModelPerformance.mockRejectedValue(new Error('Fetch error'));

      await expect(controller.GetModelPerformance(dto)).rejects.toThrow('Fetch error');
    });
  });
});
