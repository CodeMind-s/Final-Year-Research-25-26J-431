import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockAuditLogResponse = {
    success: true,
    message: 'Audit log retrieved successfully',
    log: {
      _id: '507f1f77bcf86cd799439011',
      serviceName: 'auth-service',
      action: 'LOGIN',
      userId: 'user-123',
      status: 'success',
      method: 'POST',
      path: '/api/v1/auth/login',
      statusCode: 200,
      duration: 150,
    },
  };

  const mockAuditLogsResponse = {
    success: true,
    message: 'Audit logs retrieved successfully',
    logs: [mockAuditLogResponse.log],
    total: 1,
  };

  beforeEach(async () => {
    const mockAuditLogService = {
      createAuditLog: jest.fn().mockResolvedValue({
        success: true,
        message: 'Audit log created successfully',
        logId: '507f1f77bcf86cd799439011',
      }),
      getAuditLogById: jest.fn().mockResolvedValue(mockAuditLogResponse),
      getAuditLogs: jest.fn().mockResolvedValue(mockAuditLogsResponse),
      getAuditLogsByUser: jest.fn().mockResolvedValue({
        ...mockAuditLogsResponse,
        message: 'User audit logs retrieved successfully',
      }),
      getAuditLogsByService: jest.fn().mockResolvedValue({
        ...mockAuditLogsResponse,
        message: 'Service audit logs retrieved successfully',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCreateAuditLog (EventPattern)', () => {
    it('should delegate to auditLogService.createAuditLog', async () => {
      const createDto = {
        serviceName: 'auth-service',
        action: 'LOGIN',
        userId: 'user-123',
        status: 'success',
        method: 'POST',
        path: '/api/v1/auth/login',
        statusCode: 200,
        duration: 150,
      };

      await controller.handleCreateAuditLog(createDto);

      expect(auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(createDto);
    });

    it('should catch errors silently (fire-and-forget)', async () => {
      auditLogService.createAuditLog.mockRejectedValue(new Error('Database failure'));

      const createDto = {
        serviceName: 'auth-service',
        action: 'LOGIN',
        status: 'success',
        method: 'POST',
        path: '/api/v1/auth/login',
      };

      // Should not throw even though the service throws
      await expect(
        controller.handleCreateAuditLog(createDto),
      ).resolves.not.toThrow();

      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(createDto);
    });

    it('should not rethrow when createAuditLog rejects', async () => {
      auditLogService.createAuditLog.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        controller.handleCreateAuditLog({
          serviceName: 'test',
          action: 'TEST',
          status: 'error',
        } as any),
      ).resolves.toBeUndefined();
    });
  });

  describe('getAuditLogById (MessagePattern)', () => {
    it('should delegate to auditLogService.getAuditLogById and return result', async () => {
      const data = { logId: '507f1f77bcf86cd799439011' };

      const result = await controller.getAuditLogById(data);

      expect(result).toEqual(mockAuditLogResponse);
      expect(auditLogService.getAuditLogById).toHaveBeenCalledTimes(1);
      expect(auditLogService.getAuditLogById).toHaveBeenCalledWith(data);
    });

    it('should propagate errors from auditLogService', async () => {
      auditLogService.getAuditLogById.mockRejectedValue(new Error('Not found'));

      await expect(
        controller.getAuditLogById({ logId: 'invalid-id' }),
      ).rejects.toThrow('Not found');
    });
  });

  describe('getAuditLogs (MessagePattern)', () => {
    it('should delegate to auditLogService.getAuditLogs and return result', async () => {
      const data = { status: 'success', limit: 10, offset: 0 };

      const result = await controller.getAuditLogs(data);

      expect(result).toEqual(mockAuditLogsResponse);
      expect(auditLogService.getAuditLogs).toHaveBeenCalledTimes(1);
      expect(auditLogService.getAuditLogs).toHaveBeenCalledWith(data);
    });

    it('should pass filters through to service', async () => {
      const data = {
        status: 'error',
        serviceName: 'vision-service',
        method: 'POST',
        path: '/api/v1/vision',
        limit: 25,
        offset: 50,
      };

      await controller.getAuditLogs(data);

      expect(auditLogService.getAuditLogs).toHaveBeenCalledWith(data);
    });

    it('should work with empty filter object', async () => {
      await controller.getAuditLogs({});

      expect(auditLogService.getAuditLogs).toHaveBeenCalledWith({});
    });

    it('should propagate errors from auditLogService', async () => {
      auditLogService.getAuditLogs.mockRejectedValue(new Error('Query failed'));

      await expect(controller.getAuditLogs({})).rejects.toThrow('Query failed');
    });
  });

  describe('getAuditLogsByUser (MessagePattern)', () => {
    it('should delegate to auditLogService.getAuditLogsByUser and return result', async () => {
      const data = { userId: 'user-123' };

      const result = await controller.getAuditLogsByUser(data);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User audit logs retrieved successfully');
      expect(auditLogService.getAuditLogsByUser).toHaveBeenCalledTimes(1);
      expect(auditLogService.getAuditLogsByUser).toHaveBeenCalledWith(data);
    });

    it('should pass pagination parameters to service', async () => {
      const data = { userId: 'user-456', limit: 20, offset: 40 };

      await controller.getAuditLogsByUser(data);

      expect(auditLogService.getAuditLogsByUser).toHaveBeenCalledWith(data);
    });

    it('should propagate errors from auditLogService', async () => {
      auditLogService.getAuditLogsByUser.mockRejectedValue(new Error('User logs error'));

      await expect(
        controller.getAuditLogsByUser({ userId: 'user-123' }),
      ).rejects.toThrow('User logs error');
    });
  });

  describe('getAuditLogsByService (MessagePattern)', () => {
    it('should delegate to auditLogService.getAuditLogsByService and return result', async () => {
      const data = { serviceName: 'auth-service' };

      const result = await controller.getAuditLogsByService(data);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Service audit logs retrieved successfully');
      expect(auditLogService.getAuditLogsByService).toHaveBeenCalledTimes(1);
      expect(auditLogService.getAuditLogsByService).toHaveBeenCalledWith(data);
    });

    it('should pass pagination parameters to service', async () => {
      const data = { serviceName: 'vision-service', limit: 100, offset: 0 };

      await controller.getAuditLogsByService(data);

      expect(auditLogService.getAuditLogsByService).toHaveBeenCalledWith(data);
    });

    it('should propagate errors from auditLogService', async () => {
      auditLogService.getAuditLogsByService.mockRejectedValue(new Error('Service logs error'));

      await expect(
        controller.getAuditLogsByService({ serviceName: 'auth-service' }),
      ).rejects.toThrow('Service logs error');
    });
  });
});
