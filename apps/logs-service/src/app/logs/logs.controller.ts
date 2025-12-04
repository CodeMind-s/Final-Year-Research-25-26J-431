import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LogsService } from './logs.service';
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

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @GrpcMethod('LogsService', 'CreateLog')
  async createLog(data: CreateLogDto): Promise<CreateLogResponseDto> {
    return this.logsService.createLog(data);
  }

  @GrpcMethod('LogsService', 'GetLogById')
  async getLogById(data: GetLogByIdDto): Promise<GetLogResponseDto> {
    return this.logsService.getLogById(data);
  }

  @GrpcMethod('LogsService', 'GetLogs')
  async getLogs(data: GetLogsDto): Promise<GetLogsResponseDto> {
    return this.logsService.getLogs(data);
  }

  @GrpcMethod('LogsService', 'GetLogsByUser')
  async getLogsByUser(data: GetLogsByUserDto): Promise<GetLogsResponseDto> {
    return this.logsService.getLogsByUser(data);
  }

  @GrpcMethod('LogsService', 'GetLogsByService')
  async getLogsByService(data: GetLogsByServiceDto): Promise<GetLogsResponseDto> {
    return this.logsService.getLogsByService(data);
  }
}
