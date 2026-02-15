import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { AuditLogService } from './audit-log.service';
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

@Controller()
export class AuditLogController {
  private readonly logger = new Logger(AuditLogController.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  // Event-based pattern for creating audit logs (fire-and-forget)
  @EventPattern('create_audit_log')
  async handleCreateAuditLog(@Payload() data: CreateAuditLogDto): Promise<void> {
    try {
      this.logger.log(`Received create_audit_log event: ${data.action} - ${data.path}`);
      await this.auditLogService.createAuditLog(data);
    } catch (error: any) {
      this.logger.error(`Error handling create_audit_log: ${error.message}`, error.stack);
    }
  }

  // Request-response pattern for getting audit log by ID
  @MessagePattern('get_audit_log_by_id')
  async getAuditLogById(@Payload() data: GetAuditLogByIdDto): Promise<GetAuditLogResponseDto> {
    this.logger.log(`Received get_audit_log_by_id request: ${data.logId}`);
    return this.auditLogService.getAuditLogById(data);
  }

  // Request-response pattern for getting all audit logs
  @MessagePattern('get_audit_logs')
  async getAuditLogs(@Payload() data: GetAuditLogsDto): Promise<GetAuditLogsResponseDto> {
    this.logger.log(`Received get_audit_logs request`);
    return this.auditLogService.getAuditLogs(data);
  }

  // Request-response pattern for getting audit logs by user
  @MessagePattern('get_audit_logs_by_user')
  async getAuditLogsByUser(@Payload() data: GetAuditLogsByUserDto): Promise<GetAuditLogsResponseDto> {
    this.logger.log(`Received get_audit_logs_by_user request: ${data.userId}`);
    return this.auditLogService.getAuditLogsByUser(data);
  }

  // Request-response pattern for getting audit logs by service
  @MessagePattern('get_audit_logs_by_service')
  async getAuditLogsByService(@Payload() data: GetAuditLogsByServiceDto): Promise<GetAuditLogsResponseDto> {
    this.logger.log(`Received get_audit_logs_by_service request: ${data.serviceName}`);
    return this.auditLogService.getAuditLogsByService(data);
  }
}
