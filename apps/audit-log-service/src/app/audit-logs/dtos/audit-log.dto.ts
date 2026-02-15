export class CreateAuditLogDto {
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

export class CreateAuditLogResponseDto {
  success: boolean;
  message: string;
  logId?: string;
}

export class GetAuditLogByIdDto {
  logId: string;
}

export class GetAuditLogResponseDto {
  success: boolean;
  message: string;
  log?: any;
}

export class GetAuditLogsDto {
  limit?: number;
  offset?: number;
  status?: string;
  serviceName?: string;
  method?: string;
  path?: string;
}

export class GetAuditLogsByUserDto {
  userId: string;
  limit?: number;
  offset?: number;
}

export class GetAuditLogsByServiceDto {
  serviceName: string;
  limit?: number;
  offset?: number;
}

export class GetAuditLogsResponseDto {
  success: boolean;
  message: string;
  logs: any[];
  total: number;
}
