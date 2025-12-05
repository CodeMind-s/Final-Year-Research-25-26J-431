import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { ClientGrpc } from '@nestjs/microservices';
import { Inject, OnModuleInit } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Logs')
@Controller('logs')
@Public()
export class LogsController implements OnModuleInit {
  private logsService: any;

  constructor(
    @Inject('LOGS_SERVICE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.logsService = this.client.getService('LogsService');
  }

  @Get()
  @ApiOperation({ summary: 'Get all logs with optional filters' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of logs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip (default: 0)' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return firstValueFrom(
      this.logsService.GetLogs({
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      }),
    );
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get logs by user ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of logs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip (default: 0)' })
  @ApiResponse({ status: 200, description: 'User logs retrieved successfully' })
  async getLogsByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return firstValueFrom(
      this.logsService.GetLogsByUser({
        userId,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      }),
    );
  }

  @Get('service/:serviceName')
  @ApiOperation({ summary: 'Get logs by service name' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of logs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip (default: 0)' })
  @ApiResponse({ status: 200, description: 'Service logs retrieved successfully' })
  async getLogsByService(
    @Param('serviceName') serviceName: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return firstValueFrom(
      this.logsService.GetLogsByService({
        serviceName,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      }),
    );
  }

  @Get(':logId')
  @ApiOperation({ summary: 'Get log by ID' })
  @ApiResponse({ status: 200, description: 'Log retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Log not found' })
  async getLogById(@Param('logId') logId: string) {
    return firstValueFrom(
      this.logsService.GetLogById({ logId }),
    );
  }
}
