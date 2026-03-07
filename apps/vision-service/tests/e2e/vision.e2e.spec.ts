import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as path from 'path';

// Load .env.test if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });
} catch {
  // dotenv not required — env vars may already be set
}

import { Detection, DetectionSchema } from '../../src/app/detection/schemas/detection.schema';
import { DetectionSession, DetectionSessionSchema } from '../../src/app/detection/schemas/detection-session.schema';
import { Batch, BatchSchema } from '../../src/app/detection/schemas/batch.schema';
import { DetectionService } from '../../src/app/detection/detection.service';
import { StatisticsService } from '../../src/app/statistics/statistics.service';

const testMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vision-test';

describe('Vision Service E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let detectionModel: Model<any>;
  let sessionModel: Model<any>;
  let detectionService: DetectionService;
  let statisticsService: StatisticsService;

  const createdIds: { detections: string[]; sessions: string[] } = {
    detections: [],
    sessions: [],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(testMongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        }),
        MongooseModule.forFeature([
          { name: Detection.name, schema: DetectionSchema },
          { name: DetectionSession.name, schema: DetectionSessionSchema },
          { name: Batch.name, schema: BatchSchema },
        ]),
      ],
      providers: [DetectionService, StatisticsService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    detectionModel = moduleRef.get(getModelToken(Detection.name));
    sessionModel = moduleRef.get(getModelToken(DetectionSession.name));
    detectionService = moduleRef.get(DetectionService);
    statisticsService = moduleRef.get(StatisticsService);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdIds.detections.length > 0) {
        await detectionModel.deleteMany({ _id: { $in: createdIds.detections.map((id) => new Types.ObjectId(id)) } });
      }
      if (createdIds.sessions.length > 0) {
        await sessionModel.deleteMany({ _id: { $in: createdIds.sessions.map((id) => new Types.ObjectId(id)) } });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }

    if (app) {
      await app.close();
    }
  }, 15000);

  describe('Session Lifecycle', () => {
    let sessionId: string;

    it('should create a session', async () => {
      const userId = new Types.ObjectId();
      const session = new sessionModel({
        userId,
        roi: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
      });
      const saved = await session.save();

      sessionId = saved._id.toString();
      createdIds.sessions.push(sessionId);

      expect(saved._id).toBeDefined();
      expect(saved.totalFrames).toBe(0);
      expect(saved.roi.width).toBe(0.9);
    });

    it('should retrieve the session', async () => {
      const session = await sessionModel.findById(sessionId).exec();

      expect(session).toBeDefined();
      expect(session._id.toString()).toBe(sessionId);
      expect(session.totalFrames).toBe(0);
    });

    it('should end the session', async () => {
      const session = await sessionModel.findById(sessionId).exec();
      session.endTime = new Date();
      session.avgPurityPercent = 75;
      const saved = await session.save();

      expect(saved.endTime).toBeDefined();
      expect(saved.avgPurityPercent).toBe(75);
    });
  });

  describe('Detection CRUD', () => {
    it('should create and find a detection', async () => {
      const userId = new Types.ObjectId().toString();
      const detection = await detectionService.create({
        userId,
        frameWidth: 640,
        frameHeight: 480,
        processingTimeMs: 45,
        boundingBoxes: [
          { x: 0.1, y: 0.2, width: 0.15, height: 0.1, classId: 1, className: 'pure', confidence: 0.9 },
        ],
      });

      createdIds.detections.push(detection._id.toString());

      expect(detection.pureCount).toBe(1);
      expect(detection.purityPercentage).toBe(100);

      const found = await detectionService.findOne(detection._id.toString());
      expect(found._id.toString()).toBe(detection._id.toString());
    });

    it('should list detections with pagination', async () => {
      const result = await detectionService.findAll({ page: 1, limit: 10 });

      expect(result.data).toBeDefined();
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('totalPages');
    });

    it('should delete a detection', async () => {
      const detectionId = createdIds.detections[0];
      const result = await detectionService.remove(detectionId);

      expect(result.success).toBe(true);
      createdIds.detections.shift(); // Remove from cleanup list
    });
  });

  describe('Statistics', () => {
    it('should return summary statistics', async () => {
      const result = await statisticsService.getSummary();

      expect(result).toHaveProperty('totalDetections');
      expect(result).toHaveProperty('averagePurity');
      expect(result).toHaveProperty('detectionsPerHour');
    });

    it('should return hourly stats with 24 buckets', async () => {
      const result = await statisticsService.getHourlyStats();

      expect(result).toHaveLength(24);
      expect(result[0]).toHaveProperty('hour');
      expect(result[0]).toHaveProperty('detections');
    });
  });
});
