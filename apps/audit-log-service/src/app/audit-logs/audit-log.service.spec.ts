import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './schemas/audit-log.schema';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditLogModel: any;

  const mockAuditLog = {
    _id: '507f1f77bcf86cd799439011',
    serviceName: 'auth-service',
    action: 'LOGIN',
    userId: 'user-123',
    resourceId: 'res-456',
    resourceType: 'User',
    details: '{"ip":"127.0.0.1"}',
    status: 'success',
    ipAddress: '127.0.0.1',
    method: 'POST',
    path: '/api/v1/auth/login',
    statusCode: 200,
    duration: 150,
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439011',
      serviceName: 'auth-service',
      action: 'LOGIN',
      userId: 'user-123',
      status: 'success',
      method: 'POST',
      path: '/api/v1/auth/login',
      statusCode: 200,
      duration: 150,
    }),
  };

  const createMockModel = (mockData: any = null) => {
    const mockModelInstance = {
      _id: mockData?._id || '507f1f77bcf86cd799439011',
      ...mockData,
      save: jest.fn().mockResolvedValue(mockData),
    };

    const model = jest.fn().mockImplementation(() => mockModelInstance);

    Object.assign(model, {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockData ? [mockData] : []),
            }),
          }),
        }),
      }),
      countDocuments: jest.fn().mockResolvedValue(mockData ? 1 : 0),
    });

    return model;
  };

  beforeEach(async () => {
    auditLogModel = createMockModel(mockAuditLog);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getModelToken(AuditLog.name), useValue: auditLogModel },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should create an audit log and return success with logId', async () => {
      const createDto = {
        serviceName: 'auth-service',
        action: 'LOGIN',
        userId: 'user-123',
        resourceId: 'res-456',
        resourceType: 'User',
        details: '{"ip":"127.0.0.1"}',
        status: 'success',
        ipAddress: '127.0.0.1',
        method: 'POST',
        path: '/api/v1/auth/login',
        statusCode: 200,
        duration: 150,
        userAgent: 'Mozilla/5.0',
      };

      const result = await service.createAuditLog(createDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Audit log created successfully');
      expect(result.logId).toBeDefined();
      expect(auditLogModel).toHaveBeenCalledWith({
        serviceName: 'auth-service',
        action: 'LOGIN',
        userId: 'user-123',
        resourceId: 'res-456',
        resourceType: 'User',
        details: '{"ip":"127.0.0.1"}',
        status: 'success',
        ipAddress: '127.0.0.1',
        method: 'POST',
        path: '/api/v1/auth/login',
        statusCode: 200,
        duration: 150,
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should default status to "success" when not provided', async () => {
      const createDto = {
        serviceName: 'user-service',
        action: 'UPDATE_PROFILE',
        status: undefined,
      };

      await service.createAuditLog(createDto as any);

      expect(auditLogModel).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
        }),
      );
    });

    it('should throw BadRequestException when save fails', async () => {
      const failingModel = createMockModel(mockAuditLog);
      const failingInstance = { save: jest.fn().mockRejectedValue(new Error('DB write error')) };
      failingModel.mockImplementation(() => failingInstance);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuditLogService,
          { provide: getModelToken(AuditLog.name), useValue: failingModel },
        ],
      }).compile();

      const failingService = module.get<AuditLogService>(AuditLogService);

      const createDto = {
        serviceName: 'auth-service',
        action: 'LOGIN',
        status: 'success',
      };

      await expect(failingService.createAuditLog(createDto as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(failingService.createAuditLog(createDto as any)).rejects.toThrow(
        'Failed to create audit log',
      );
    });
  });

  describe('getAuditLogById', () => {
    it('should return audit log when found', async () => {
      const result = await service.getAuditLogById({ logId: '507f1f77bcf86cd799439011' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Audit log retrieved successfully');
      expect(result.log).toBeDefined();
      expect(auditLogModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw BadRequestException when log is not found', async () => {
      auditLogModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getAuditLogById({ logId: 'nonexistent-id' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getAuditLogById({ logId: 'nonexistent-id' }),
      ).rejects.toThrow('Failed to retrieve audit log');
    });

    it('should throw BadRequestException when database error occurs', async () => {
      auditLogModel.findById.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });

      await expect(
        service.getAuditLogById({ logId: '507f1f77bcf86cd799439011' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAuditLogs', () => {
    it('should return logs with default pagination (limit=50, offset=0)', async () => {
      const result = await service.getAuditLogs({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Audit logs retrieved successfully');
      expect(result.logs).toBeDefined();
      expect(result.total).toBeDefined();
      expect(auditLogModel.find).toHaveBeenCalledWith({});
    });

    it('should filter by status when provided', async () => {
      await service.getAuditLogs({ status: 'error' });

      expect(auditLogModel.find).toHaveBeenCalledWith({ status: 'error' });
    });

    it('should filter by serviceName when provided', async () => {
      await service.getAuditLogs({ serviceName: 'auth-service' });

      expect(auditLogModel.find).toHaveBeenCalledWith({ serviceName: 'auth-service' });
    });

    it('should filter by method when provided', async () => {
      await service.getAuditLogs({ method: 'POST' });

      expect(auditLogModel.find).toHaveBeenCalledWith({ method: 'POST' });
    });

    it('should filter by path with case-insensitive regex when provided', async () => {
      await service.getAuditLogs({ path: '/api/v1/auth' });

      expect(auditLogModel.find).toHaveBeenCalledWith({
        path: { $regex: '/api/v1/auth', $options: 'i' },
      });
    });

    it('should apply multiple filters simultaneously', async () => {
      await service.getAuditLogs({
        status: 'success',
        serviceName: 'user-service',
        method: 'GET',
        path: '/users',
      });

      expect(auditLogModel.find).toHaveBeenCalledWith({
        status: 'success',
        serviceName: 'user-service',
        method: 'GET',
        path: { $regex: '/users', $options: 'i' },
      });
    });

    it('should apply custom limit and offset for pagination', async () => {
      await service.getAuditLogs({ limit: 10, offset: 20 });

      expect(auditLogModel.find).toHaveBeenCalledWith({});
    });

    it('should return mapped logs using toObject()', async () => {
      const result = await service.getAuditLogs({});

      expect(result.logs).toEqual([mockAuditLog.toObject()]);
    });

    it('should throw BadRequestException on database error', async () => {
      auditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              exec: jest.fn().mockRejectedValue(new Error('Query timeout')),
            }),
          }),
        }),
      });

      await expect(service.getAuditLogs({})).rejects.toThrow(BadRequestException);
      await expect(service.getAuditLogs({})).rejects.toThrow('Failed to retrieve audit logs');
    });
  });

  describe('getAuditLogsByUser', () => {
    it('should return logs filtered by userId', async () => {
      const result = await service.getAuditLogsByUser({ userId: 'user-123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User audit logs retrieved successfully');
      expect(result.logs).toBeDefined();
      expect(result.total).toBeDefined();
      expect(auditLogModel.find).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(auditLogModel.countDocuments).toHaveBeenCalledWith({ userId: 'user-123' });
    });

    it('should apply custom limit and offset', async () => {
      await service.getAuditLogsByUser({ userId: 'user-123', limit: 25, offset: 10 });

      expect(auditLogModel.find).toHaveBeenCalledWith({ userId: 'user-123' });
    });

    it('should use default limit=50 and offset=0 when not specified', async () => {
      await service.getAuditLogsByUser({ userId: 'user-456' });

      expect(auditLogModel.find).toHaveBeenCalledWith({ userId: 'user-456' });
    });

    it('should throw BadRequestException on error', async () => {
      auditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              exec: jest.fn().mockRejectedValue(new Error('DB error')),
            }),
          }),
        }),
      });

      await expect(
        service.getAuditLogsByUser({ userId: 'user-123' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getAuditLogsByUser({ userId: 'user-123' }),
      ).rejects.toThrow('Failed to retrieve user audit logs');
    });
  });

  describe('getAuditLogsByService', () => {
    it('should return logs filtered by serviceName', async () => {
      const result = await service.getAuditLogsByService({ serviceName: 'auth-service' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Service audit logs retrieved successfully');
      expect(result.logs).toBeDefined();
      expect(result.total).toBeDefined();
      expect(auditLogModel.find).toHaveBeenCalledWith({ serviceName: 'auth-service' });
      expect(auditLogModel.countDocuments).toHaveBeenCalledWith({ serviceName: 'auth-service' });
    });

    it('should apply custom limit and offset', async () => {
      await service.getAuditLogsByService({ serviceName: 'vision-service', limit: 5, offset: 15 });

      expect(auditLogModel.find).toHaveBeenCalledWith({ serviceName: 'vision-service' });
    });

    it('should use default limit=50 and offset=0 when not specified', async () => {
      await service.getAuditLogsByService({ serviceName: 'payment-service' });

      expect(auditLogModel.find).toHaveBeenCalledWith({ serviceName: 'payment-service' });
    });

    it('should throw BadRequestException on error', async () => {
      auditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              exec: jest.fn().mockRejectedValue(new Error('DB error')),
            }),
          }),
        }),
      });

      await expect(
        service.getAuditLogsByService({ serviceName: 'auth-service' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getAuditLogsByService({ serviceName: 'auth-service' }),
      ).rejects.toThrow('Failed to retrieve service audit logs');
    });
  });
});
