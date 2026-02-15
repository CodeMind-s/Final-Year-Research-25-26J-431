export interface CreateAuditLogDto {
  serviceName: string;
  action: string;
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  details?: string;
  status: string;
  ipAddress?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
}

export interface GetAuditLogsDto {
  limit?: number;
  offset?: number;
  status?: string;
  serviceName?: string;
  method?: string;
  path?: string;
}

export interface GetAuditLogsByUserDto {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface GetAuditLogsByServiceDto {
  serviceName: string;
  limit?: number;
  offset?: number;
}

export interface GetAuditLogByIdDto {
  logId: string;
}