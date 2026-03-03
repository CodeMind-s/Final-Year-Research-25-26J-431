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

import { AuditLog, AuditLogSchema } from '../../src/app/audit-logs/schemas/audit-log.schema';
import { AuditLogService } from '../../src/app/audit-logs/audit-log.service';

const testMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/audit-log-test';

describe('Audit Log Service E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let auditLogModel: Model<any>;
  let auditLogService: AuditLogService;

  const createdIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(testMongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        }),
        MongooseModule.forFeature([
          { name: AuditLog.name, schema: AuditLogSchema },
        ]),
      ],
      providers: [AuditLogService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    auditLogModel = moduleRef.get(getModelToken(AuditLog.name));
    auditLogService = moduleRef.get(AuditLogService);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdIds.length > 0) {
        await auditLogModel.deleteMany({
          _id: { $in: createdIds.map((id) => new Types.ObjectId(id)) },
        });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }

    if (app) {
      await app.close();
    }
  }, 15000);

  describe('createAuditLog', () => {
    it('should create an audit log with all fields', async () => {
      const result = await auditLogService.createAuditLog({
        serviceName: 'e2e-test-service',
        action: 'E2E_TEST_ACTION',
        userId: 'e2e-user-123',
        resourceId: 'resource-456',
        resourceType: 'test_resource',
        details: JSON.stringify({ key: 'value' }),
        status: 'success',
        ipAddress: '127.0.0.1',
        method: 'POST',
        path: '/api/e2e-test',
        statusCode: 200,
        duration: 150,
        userAgent: 'jest-e2e-test',
      });

      createdIds.push(result.logId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Audit log created successfully');
      expect(result.logId).toBeDefined();

      // Verify persisted in DB
      const log = await auditLogModel.findById(result.logId).exec();
      expect(log).toBeDefined();
      expect(log.serviceName).toBe('e2e-test-service');
      expect(log.action).toBe('E2E_TEST_ACTION');
      expect(log.userId).toBe('e2e-user-123');
      expect(log.method).toBe('POST');
      expect(log.statusCode).toBe(200);
      expect(log.duration).toBe(150);
    });

    it('should use default status when not provided', async () => {
      const result = await auditLogService.createAuditLog({
        serviceName: 'e2e-test-service',
        action: 'E2E_DEFAULT_STATUS',
      });

      createdIds.push(result.logId);

      const log = await auditLogModel.findById(result.logId).exec();
      expect(log.status).toBe('success');
    });

    it('should set timestamps automatically', async () => {
      const result = await auditLogService.createAuditLog({
        serviceName: 'e2e-test-service',
        action: 'E2E_TIMESTAMP_TEST',
      });

      createdIds.push(result.logId);

      const log = await auditLogModel.findById(result.logId).exec();
      expect(log.createdAt).toBeInstanceOf(Date);
      expect(log.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getAuditLogById', () => {
    it('should retrieve an audit log by ID', async () => {
      const createResult = await auditLogService.createAuditLog({
        serviceName: 'e2e-test-service',
        action: 'E2E_GET_BY_ID',
        userId: 'e2e-user-get',
      });

      createdIds.push(createResult.logId);

      const result = await auditLogService.getAuditLogById({ logId: createResult.logId });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Audit log retrieved successfully');
      expect(result.log).toBeDefined();
      expect(result.log.action).toBe('E2E_GET_BY_ID');
      expect(result.log.userId).toBe('e2e-user-get');
    });

    it('should throw for non-existent ID', async () => {
      const fakeId = new Types.ObjectId().toString();

      await expect(
        auditLogService.getAuditLogById({ logId: fakeId }),
      ).rejects.toThrow();
    });
  });

  describe('getAuditLogs — filtering', () => {
    beforeAll(async () => {
      const logs = [
        { serviceName: 'e2e-auth-service', action: 'LOGIN', status: 'success', method: 'POST', path: '/api/e2e-auth/login' },
        { serviceName: 'e2e-auth-service', action: 'LOGOUT', status: 'success', method: 'POST', path: '/api/e2e-auth/logout' },
        { serviceName: 'e2e-user-service', action: 'CREATE_USER', status: 'error', method: 'POST', path: '/api/e2e-users' },
        { serviceName: 'e2e-user-service', action: 'UPDATE_USER', status: 'success', method: 'PUT', path: '/api/e2e-users/123' },
      ];

      for (const log of logs) {
        const result = await auditLogService.createAuditLog(log);
        createdIds.push(result.logId);
      }
    });

    it('should filter by status', async () => {
      const result = await auditLogService.getAuditLogs({ status: 'error' });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBeGreaterThanOrEqual(1);
      expect(result.logs.every((log: any) => log.status === 'error')).toBe(true);
    });

    it('should filter by serviceName', async () => {
      const result = await auditLogService.getAuditLogs({ serviceName: 'e2e-auth-service' });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBeGreaterThanOrEqual(2);
      expect(result.logs.every((log: any) => log.serviceName === 'e2e-auth-service')).toBe(true);
    });

    it('should filter by method', async () => {
      const result = await auditLogService.getAuditLogs({ method: 'PUT' });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBeGreaterThanOrEqual(1);
      expect(result.logs.every((log: any) => log.method === 'PUT')).toBe(true);
    });

    it('should filter by path regex', async () => {
      const result = await auditLogService.getAuditLogs({ path: 'e2e-auth' });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBeGreaterThanOrEqual(2);
      expect(result.logs.every((log: any) => log.path.includes('e2e-auth'))).toBe(true);
    });

    it('should respect pagination (limit/offset)', async () => {
      const result = await auditLogService.getAuditLogs({ limit: 2, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getAuditLogsByUser', () => {
    const testUserId = 'e2e-filter-user-' + Date.now();

    beforeAll(async () => {
      const result1 = await auditLogService.createAuditLog({
        serviceName: 'e2e-test-service',
        action: 'USER_ACTION_1',
        userId: testUserId,
      });
      createdIds.push(result1.logId);

      const result2 = await auditLogService.createAuditLog({
        serviceName: 'e2e-test-service',
        action: 'USER_ACTION_2',
        userId: testUserId,
      });
      createdIds.push(result2.logId);
    });

    it('should filter logs by userId', async () => {
      const result = await auditLogService.getAuditLogsByUser({
        userId: testUserId,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User audit logs retrieved successfully');
      expect(result.logs.length).toBe(2);
      expect(result.logs.every((log: any) => log.userId === testUserId)).toBe(true);
    });

    it('should support pagination for user logs', async () => {
      const result = await auditLogService.getAuditLogsByUser({
        userId: testUserId,
        limit: 1,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  describe('getAuditLogsByService', () => {
    it('should filter logs by serviceName', async () => {
      const result = await auditLogService.getAuditLogsByService({
        serviceName: 'e2e-auth-service',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Service audit logs retrieved successfully');
      expect(result.logs.length).toBeGreaterThanOrEqual(2);
      expect(result.logs.every((log: any) => log.serviceName === 'e2e-auth-service')).toBe(true);
    });

    it('should support pagination for service logs', async () => {
      const result = await auditLogService.getAuditLogsByService({
        serviceName: 'e2e-auth-service',
        limit: 1,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBe(1);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });
  });
});
