import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import {
  CreateAuditLogDto,
  CreateAuditLogResponseDto,
  GetAuditLogByIdDto,
  GetAuditLogResponseDto,
  GetAuditLogsDto,
  GetAuditLogsByUserDto,
  GetAuditLogsByServiceDto,
  GetAuditLogsResponseDto,
} from './dtos/audit-log.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
  ) {}

  async createAuditLog(data: CreateAuditLogDto): Promise<CreateAuditLogResponseDto> {
    try {
      const auditLog = new this.auditLogModel({
        serviceName: data.serviceName,
        action: data.action,
        userId: data.userId,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        details: data.details,
        status: data.status || 'success',
        ipAddress: data.ipAddress,
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        duration: data.duration,
        userAgent: data.userAgent,
      });

      await auditLog.save();

      this.logger.log(`Audit log created: ${auditLog._id} - ${data.action} by user ${data.userId || 'anonymous'}`);

      return {
        success: true,
        message: 'Audit log created successfully',
        logId: auditLog._id.toString(),
      };
    } catch (error) {
      this.logger.error(`CreateAuditLog error: ${error.message}`);
      throw new BadRequestException('Failed to create audit log');
    }
  }

  async getAuditLogById(data: GetAuditLogByIdDto): Promise<GetAuditLogResponseDto> {
    try {
      const auditLog = await this.auditLogModel.findById(data.logId).exec();

      if (!auditLog) {
        throw new NotFoundException('Audit log not found');
      }

      return {
        success: true,
        message: 'Audit log retrieved successfully',
        log: auditLog.toObject(),
      };
    } catch (error) {
      this.logger.error(`GetAuditLogById error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve audit log');
    }
  }

  async getAuditLogs(data: GetAuditLogsDto): Promise<GetAuditLogsResponseDto> {
    try {
      const query: any = {};
      
      if (data.status) {
        query.status = data.status;
      }
      
      if (data.serviceName) {
        query.serviceName = data.serviceName;
      }

      if (data.method) {
        query.method = data.method;
      }

      if (data.path) {
        query.path = { $regex: data.path, $options: 'i' };
      }

      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const logs = await this.auditLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec();

      const total = await this.auditLogModel.countDocuments(query);

      return {
        success: true,
        message: 'Audit logs retrieved successfully',
        logs: logs.map(log => log.toObject()),
        total,
      };
    } catch (error) {
      this.logger.error(`GetAuditLogs error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve audit logs');
    }
  }

  async getAuditLogsByUser(data: GetAuditLogsByUserDto): Promise<GetAuditLogsResponseDto> {
    try {
      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const logs = await this.auditLogModel
        .find({ userId: data.userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec();

      const total = await this.auditLogModel.countDocuments({ userId: data.userId });

      return {
        success: true,
        message: 'User audit logs retrieved successfully',
        logs: logs.map(log => log.toObject()),
        total,
      };
    } catch (error) {
      this.logger.error(`GetAuditLogsByUser error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve user audit logs');
    }
  }

  async getAuditLogsByService(data: GetAuditLogsByServiceDto): Promise<GetAuditLogsResponseDto> {
    try {
      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const logs = await this.auditLogModel
        .find({ serviceName: data.serviceName })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec();

      const total = await this.auditLogModel.countDocuments({ serviceName: data.serviceName });

      return {
        success: true,
        message: 'Service audit logs retrieved successfully',
        logs: logs.map(log => log.toObject()),
        total,
      };
    } catch (error) {
      this.logger.error(`GetAuditLogsByService error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve service audit logs');
    }
  }
}
