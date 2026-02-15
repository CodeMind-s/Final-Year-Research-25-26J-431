import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CreateAuditLogDto, GetAuditLogByIdDto, GetAuditLogsByServiceDto, GetAuditLogsByUserDto, GetAuditLogsDto } from './dtos/audit-logs.dto';

@Injectable()
export class AuditLogService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject('AUDIT_LOG_SERVICE') private readonly auditLogClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to response topics for request-response patterns
    this.auditLogClient.subscribeToResponseOf('get_audit_log_by_id');
    this.auditLogClient.subscribeToResponseOf('get_audit_logs');
    this.auditLogClient.subscribeToResponseOf('get_audit_logs_by_user');
    this.auditLogClient.subscribeToResponseOf('get_audit_logs_by_service');
    
    await this.auditLogClient.connect();
    this.logger.log('Connected to Kafka for Audit Log Service');
  }

  /**
   * Creates an audit log entry (fire-and-forget)
   * This is used by the interceptor for logging all API requests
   */
  async createAuditLog(data: CreateAuditLogDto): Promise<void> {
    try {
      await this.auditLogClient.emit('create_audit_log', data).toPromise();
      this.logger.debug(`Audit log emitted: ${data.action} - ${data.path}`);
    } catch (error: any) {
      this.logger.error(`Failed to emit audit log: ${error.message}`);
    }
  }

  /**
   * Get audit log by ID (request-response)
   */
  async getAuditLogById(data: GetAuditLogByIdDto): Promise<any> {
    try {
      return await firstValueFrom(
        this.auditLogClient.send('get_audit_log_by_id', data).pipe(timeout(10000))
      );
    } catch (error: any) {
      this.logger.error(`Failed to get audit log by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all audit logs with filters (request-response)
   */
  async getAuditLogs(data: GetAuditLogsDto): Promise<any> {
    try {
      return await firstValueFrom(
        this.auditLogClient.send('get_audit_logs', data).pipe(timeout(10000))
      );
    } catch (error: any) {
      this.logger.error(`Failed to get audit logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get audit logs by user ID (request-response)
   */
  async getAuditLogsByUser(data: GetAuditLogsByUserDto): Promise<any> {
    try {
      return await firstValueFrom(
        this.auditLogClient.send('get_audit_logs_by_user', data).pipe(timeout(10000))
      );
    } catch (error: any) {
      this.logger.error(`Failed to get audit logs by user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get audit logs by service name (request-response)
   */
  async getAuditLogsByService(data: GetAuditLogsByServiceDto): Promise<any> {
    try {
      return await firstValueFrom(
        this.auditLogClient.send('get_audit_logs_by_service', data).pipe(timeout(10000))
      );
    } catch (error: any) {
      this.logger.error(`Failed to get audit logs by service: ${error.message}`);
      throw error;
    }
  }
}
