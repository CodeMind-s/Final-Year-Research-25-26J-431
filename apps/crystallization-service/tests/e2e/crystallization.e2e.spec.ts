import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as path from 'path';

// Load .env.test if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });
} catch {
  // dotenv not required — env vars may already be set
}

import {
  DailyMeasurement,
  DailyMeasurementSchema,
} from '../../src/app/crystallization/schemas/crystallization.schema';
import {
  DailyParameterPrediction,
  DailyParameterPredictionSchema,
} from '../../src/app/crystallization/schemas/daily-parameter-prediction.schema';
import {
  MonthlyProductionPrediction,
  MonthlyProductionPredictionSchema,
} from '../../src/app/crystallization/schemas/monthly-production-prediction.schema';
import {
  CrystallizationModelPerformance,
  CrystallizationModelPerformanceSchema,
} from '../../src/app/crystallization/schemas/crystallization-model-performance.schema';
import { CrystallizationService } from '../../src/app/crystallization/crystallization.service';

const testMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/crystallization-test';

describe('Crystallization Service E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dailyMeasurementModel: Model<any>;
  let dailyPredictionModel: Model<any>;
  let monthlyPredictionModel: Model<any>;
  let modelPerformanceModel: Model<any>;
  let crystallizationService: CrystallizationService;

  const createdIds = {
    measurements: [] as string[],
    dailyPredictions: [] as string[],
    monthlyPredictions: [] as string[],
    modelPerformance: [] as string[],
  };

  // Mock external dependencies
  const mockAuditClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  };

  const mockOnnxClient = {
    getService: jest.fn().mockReturnValue({
      GetPredictions: jest.fn(),
    }),
  };

  // ConfigService returns undefined → fetchWeatherData skips API call, uses DTO weather
  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(testMongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        }),
        MongooseModule.forFeature([
          { name: DailyMeasurement.name, schema: DailyMeasurementSchema },
          { name: DailyParameterPrediction.name, schema: DailyParameterPredictionSchema },
          { name: MonthlyProductionPrediction.name, schema: MonthlyProductionPredictionSchema },
          { name: CrystallizationModelPerformance.name, schema: CrystallizationModelPerformanceSchema },
        ]),
      ],
      providers: [
        CrystallizationService,
        { provide: 'PREDICTIONS_PACKAGE', useValue: mockOnnxClient },
        { provide: 'AUDIT_LOG_SERVICE', useValue: mockAuditClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dailyMeasurementModel = moduleRef.get(getModelToken(DailyMeasurement.name));
    dailyPredictionModel = moduleRef.get(getModelToken(DailyParameterPrediction.name));
    monthlyPredictionModel = moduleRef.get(getModelToken(MonthlyProductionPrediction.name));
    modelPerformanceModel = moduleRef.get(getModelToken(CrystallizationModelPerformance.name));
    crystallizationService = moduleRef.get(CrystallizationService);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdIds.measurements.length > 0) {
        await dailyMeasurementModel.deleteMany({
          _id: { $in: createdIds.measurements.map((id) => new Types.ObjectId(id)) },
        });
      }
      if (createdIds.dailyPredictions.length > 0) {
        await dailyPredictionModel.deleteMany({
          _id: { $in: createdIds.dailyPredictions.map((id) => new Types.ObjectId(id)) },
        });
      }
      if (createdIds.monthlyPredictions.length > 0) {
        await monthlyPredictionModel.deleteMany({
          _id: { $in: createdIds.monthlyPredictions.map((id) => new Types.ObjectId(id)) },
        });
      }
      if (createdIds.modelPerformance.length > 0) {
        await modelPerformanceModel.deleteMany({
          _id: { $in: createdIds.modelPerformance.map((id) => new Types.ObjectId(id)) },
        });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }

    if (app) {
      await app.close();
    }
  }, 15000);

  // ── Sample data ──

  const sampleParameters = {
    water_temperature: 28.5,
    lagoon: 15.2,
    OR_brine_level: 10.3,
    OR_bund_level: 8.1,
    IR_brine_level: 12.7,
    IR_bound_level: 9.4,
    East_channel: 5.6,
    West_channel: 6.8,
  };

  const sampleWeather = {
    temperature_mean: 30.5,
    temperature_max: 34.2,
    temperature_min: 26.8,
    rain_sum: 0,
    wind_speed_max: 12.5,
    wind_gusts_max: 18.3,
    relative_humidity_mean: 72,
  };

  // ──────────────── Daily Measurement CRUD ────────────────

  describe('Daily Measurement CRUD', () => {
    let measurementId: string;

    it('should create a daily measurement (new nested format)', async () => {
      const result = await crystallizationService.CreateDailyMeasurement({
        date: '2099-03-01',
        dayNumber: 1,
        parameters: sampleParameters,
        weather: sampleWeather,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily Measurement created successfully');
      expect(result.data._id).toBeDefined();
      expect(result.data.dayNumber).toBe(1);
      expect(result.data.parameters.water_temperature).toBe(28.5);
      expect(result.data.weather.temperature_mean).toBe(30.5);

      measurementId = result.data._id;
      createdIds.measurements.push(measurementId);
    });

    it('should create a daily measurement (old flat format)', async () => {
      const result = await crystallizationService.CreateDailyMeasurement({
        date: '2099-03-02',
        waterTemperature: 29.0,
        lagoon: 14.8,
        orBrineLevel: 10.0,
        orBoundLevel: 7.5,
        irBrineLevel: 11.2,
        irBoundLevel: 8.9,
        eastChannel: 5.1,
        westChannel: 6.3,
      });

      expect(result.success).toBe(true);
      expect(result.data._id).toBeDefined();
      expect(result.data.parameters.water_temperature).toBe(29.0);

      createdIds.measurements.push(result.data._id);
    });

    it('should get daily measurement by date', async () => {
      const result = await crystallizationService.GetDailyMeasurementByDate({
        date: '2099-03-01',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.parameters.water_temperature).toBe(28.5);
    });

    it('should return not found for non-existent date', async () => {
      const result = await crystallizationService.GetDailyMeasurementByDate({
        date: '1900-01-01',
      });

      expect(result.success).toBe(false);
    });

    it('should get daily measurements by date range', async () => {
      const result = await crystallizationService.GetDailyMeasurementsByDateRange({
        startDate: '2099-03-01',
        endDate: '2099-03-02',
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for out-of-range dates', async () => {
      const result = await crystallizationService.GetDailyMeasurementsByDateRange({
        startDate: '1900-01-01',
        endDate: '1900-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should update a daily measurement', async () => {
      const result = await crystallizationService.UpdateDailyMeasurementById({
        id: measurementId,
        waterTemperature: 31.0,
        lagoon: 16.0,
      });

      expect(result.success).toBe(true);
      expect(result.data.parameters.water_temperature).toBe(31.0);
      expect(result.data.parameters.lagoon).toBe(16.0);
    });

    it('should return not found when updating non-existent measurement', async () => {
      const fakeId = new Types.ObjectId().toString();

      const result = await crystallizationService.UpdateDailyMeasurementById({
        id: fakeId,
        waterTemperature: 31.0,
      });

      expect(result.success).toBe(false);
    });

    it('should delete a daily measurement', async () => {
      // Create one to delete
      const createResult = await crystallizationService.CreateDailyMeasurement({
        date: '2099-03-03',
        dayNumber: 3,
        parameters: sampleParameters,
        weather: sampleWeather,
      });
      const deleteId = createResult.data._id;

      const result = await crystallizationService.DeleteDailyMeasurementById({
        id: deleteId,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Daily Measurement deleted successfully');

      // Verify deleted
      const check = await dailyMeasurementModel.findById(deleteId);
      expect(check).toBeNull();
    });

    it('should return not found when deleting non-existent measurement', async () => {
      const fakeId = new Types.ObjectId().toString();

      const result = await crystallizationService.DeleteDailyMeasurementById({
        id: fakeId,
      });

      expect(result.success).toBe(false);
    });

    it('should emit audit log on create', async () => {
      mockAuditClient.emit.mockClear();

      const createResult = await crystallizationService.CreateDailyMeasurement({
        date: '2099-03-04',
        dayNumber: 4,
        parameters: sampleParameters,
        weather: sampleWeather,
      });

      createdIds.measurements.push(createResult.data._id);

      expect(mockAuditClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          serviceName: 'crystallization-service',
          action: 'DAILY_MEASUREMENT_CREATED',
        }),
      );
    });
  });

  // ──────────────── Daily Parameter Predictions ────────────────

  describe('Daily Parameter Predictions', () => {
    beforeAll(async () => {
      // Clean up any leftover predictions from previous runs
      await dailyPredictionModel.deleteMany({
        date: { $in: ['2099-04-01', '2099-04-02', '2099-04-03'] },
      });

      const predictions = [
        {
          date: '2099-04-01',
          dayNumber: 1,
          parameters: sampleParameters,
          weather: sampleWeather,
        },
        {
          date: '2099-04-02',
          dayNumber: 2,
          parameters: { ...sampleParameters, water_temperature: 29.0 },
          weather: sampleWeather,
        },
        {
          date: '2099-04-03',
          dayNumber: 3,
          parameters: { ...sampleParameters, water_temperature: 30.0 },
          weather: sampleWeather,
        },
      ];

      for (const pred of predictions) {
        const doc = await dailyPredictionModel.create(pred);
        createdIds.dailyPredictions.push(doc._id.toString());
      }
    });

    it('should retrieve daily predictions by date range', async () => {
      const result = await crystallizationService.GetPredictedDailyMeasurement({
        startDate: '2099-04-01',
        endDate: '2099-04-03',
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.data[0].date).toBe('2099-04-01');
      expect(result.data[2].date).toBe('2099-04-03');
    });

    it('should return empty for out-of-range predictions', async () => {
      const result = await crystallizationService.GetPredictedDailyMeasurement({
        startDate: '1900-01-01',
        endDate: '1900-01-31',
      });

      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(0);
    });
  });

  // ──────────────── Monthly Production Predictions ────────────────

  describe('Monthly Production Predictions', () => {
    beforeAll(async () => {
      // Clean up any leftover predictions from previous runs
      await monthlyPredictionModel.deleteMany({
        month: { $in: ['2099-04', '2099-05'] },
      });

      const predictions = [
        {
          month: '2099-04',
          monthNumber: 4,
          productionForecast: 1500,
          lowerBound: 1200,
          upperBound: 1800,
          season: 'dry',
        },
        {
          month: '2099-05',
          monthNumber: 5,
          productionForecast: 1700,
          lowerBound: 1400,
          upperBound: 2000,
          season: 'dry',
        },
      ];

      for (const pred of predictions) {
        const doc = await monthlyPredictionModel.create(pred);
        createdIds.monthlyPredictions.push(doc._id.toString());
      }
    });

    it('should retrieve monthly predictions by month range', async () => {
      const result = await crystallizationService.GetPredictedMonthlyProduction({
        startMonth: '2099-04',
        endMonth: '2099-05',
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0].month).toBe('2099-04');
      expect(result.data[0].productionForecast).toBe(1500);
    });

    it('should return empty for out-of-range months', async () => {
      const result = await crystallizationService.GetPredictedMonthlyProduction({
        startMonth: '1900-01',
        endMonth: '1900-12',
      });

      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(0);
    });
  });

  // ──────────────── Model Performance ────────────────

  describe('Model Performance', () => {
    beforeAll(async () => {
      const records = [
        {
          model_type: 'LSTM',
          forecast_generated: new Date('2099-03-01'),
          performance_metrics: {
            test_mae: 0.5,
            test_rmse: 0.7,
            test_r2_score: 0.92,
            test_accuracy: 0.95,
            validation_r2_score: 0.90,
            validation_accuracy: 0.93,
          },
        },
        {
          model_type: 'LSTM',
          forecast_generated: new Date('2099-03-02'),
          performance_metrics: {
            test_mae: 0.4,
            test_rmse: 0.6,
            test_r2_score: 0.94,
            test_accuracy: 0.96,
            validation_r2_score: 0.92,
            validation_accuracy: 0.94,
          },
        },
      ];

      for (const record of records) {
        const doc = await modelPerformanceModel.create(record);
        createdIds.modelPerformance.push(doc._id.toString());
      }
    });

    it('should retrieve model performance records', async () => {
      const result = await crystallizationService.GetModelPerformance({ limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data[0].model_type).toBe('LSTM');
      expect(result.data[0].performance_metrics.test_r2_score).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const result = await crystallizationService.GetModelPerformance({ limit: 1 });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
    });
  });
});
