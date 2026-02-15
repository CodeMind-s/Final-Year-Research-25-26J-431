import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AuditLogService } from './audit-log.service';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@Public()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs with optional filters' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of logs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip (default: 0)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'serviceName', required: false, type: String, description: 'Filter by service name' })
  @ApiQuery({ name: 'method', required: false, type: String, description: 'Filter by HTTP method' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
    @Query('serviceName') serviceName?: string,
    @Query('method') method?: string,
  ) {
    return this.auditLogService.getAuditLogs({
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      status,
      serviceName,
      method,
    });
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get audit logs by user ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of logs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip (default: 0)' })
  @ApiResponse({ status: 200, description: 'User audit logs retrieved successfully' })
  async getAuditLogsByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.auditLogService.getAuditLogsByUser({
      userId,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('service/:serviceName')
  @ApiOperation({ summary: 'Get audit logs by service name' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of logs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip (default: 0)' })
  @ApiResponse({ status: 200, description: 'Service audit logs retrieved successfully' })
  async getAuditLogsByService(
    @Param('serviceName') serviceName: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.auditLogService.getAuditLogsByService({
      serviceName,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get(':logId')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async getAuditLogById(@Param('logId') logId: string) {
    return this.auditLogService.getAuditLogById({ logId });
  }
}
