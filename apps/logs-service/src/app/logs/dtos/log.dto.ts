export class CreateLogDto {
  serviceName: string;
  action: string;
  userId: string;
  resourceId?: string;
  resourceType?: string;
  details?: string;
  status: string;
  ipAddress?: string;
}

export class CreateLogResponseDto {
  success: boolean;
  message: string;
  logId?: string;
}

export class GetLogByIdDto {
  logId: string;
}

export class GetLogResponseDto {
  success: boolean;
  message: string;
  log?: any;
}

export class GetLogsDto {
  limit?: number;
  offset?: number;
  status?: string;
  serviceName?: string;
}

export class GetLogsByUserDto {
  userId: string;
  limit?: number;
  offset?: number;
}

export class GetLogsByServiceDto {
  serviceName: string;
  limit?: number;
  offset?: number;
}

export class GetLogsResponseDto {
  success: boolean;
  message: string;
  logs: any[];
  total: number;
}
