import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log } from './schemas/log.schema';
import {
  CreateLogDto,
  CreateLogResponseDto,
  GetLogByIdDto,
  GetLogResponseDto,
  GetLogsDto,
  GetLogsByUserDto,
  GetLogsByServiceDto,
  GetLogsResponseDto,
} from './dtos/log.dto';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectModel(Log.name) private logModel: Model<Log>,
  ) {}

  async createLog(data: CreateLogDto): Promise<CreateLogResponseDto> {
    try {
      const log = new this.logModel({
        serviceName: data.serviceName,
        action: data.action,
        userId: data.userId,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        details: data.details,
        status: data.status || 'success',
        ipAddress: data.ipAddress,
      });

      await log.save();

      this.logger.log(`Log created: ${log._id} - ${data.action} by user ${data.userId}`);

      return {
        success: true,
        message: 'Log created successfully',
        logId: log._id.toString(),
      };
    } catch (error) {
      this.logger.error(`CreateLog error: ${error.message}`);
      throw new BadRequestException('Failed to create log');
    }
  }

  async getLogById(data: GetLogByIdDto): Promise<GetLogResponseDto> {
    try {
      const log = await this.logModel.findById(data.logId).exec();

      if (!log) {
        throw new NotFoundException('Log not found');
      }

      return {
        success: true,
        message: 'Log retrieved successfully',
        log: log.toObject(),
      };
    } catch (error) {
      this.logger.error(`GetLogById error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve log');
    }
  }

  async getLogs(data: GetLogsDto): Promise<GetLogsResponseDto> {
    try {
      const query: any = {};
      
      if (data.status) {
        query.status = data.status;
      }
      
      if (data.serviceName) {
        query.serviceName = data.serviceName;
      }

      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const logs = await this.logModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec();

      const total = await this.logModel.countDocuments(query);

      return {
        success: true,
        message: 'Logs retrieved successfully',
        logs: logs.map(log => log.toObject()),
        total,
      };
    } catch (error) {
      this.logger.error(`GetLogs error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve logs');
    }
  }

  async getLogsByUser(data: GetLogsByUserDto): Promise<GetLogsResponseDto> {
    try {
      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const logs = await this.logModel
        .find({ userId: data.userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec();

      const total = await this.logModel.countDocuments({ userId: data.userId });

      return {
        success: true,
        message: 'User logs retrieved successfully',
        logs: logs.map(log => log.toObject()),
        total,
      };
    } catch (error) {
      this.logger.error(`GetLogsByUser error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve user logs');
    }
  }

  async getLogsByService(data: GetLogsByServiceDto): Promise<GetLogsResponseDto> {
    try {
      const limit = data.limit || 50;
      const offset = data.offset || 0;

      const logs = await this.logModel
        .find({ serviceName: data.serviceName })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec();

      const total = await this.logModel.countDocuments({ serviceName: data.serviceName });

      return {
        success: true,
        message: 'Service logs retrieved successfully',
        logs: logs.map(log => log.toObject()),
        total,
      };
    } catch (error) {
      this.logger.error(`GetLogsByService error: ${error.message}`);
      throw new BadRequestException('Failed to retrieve service logs');
    }
  }
}
