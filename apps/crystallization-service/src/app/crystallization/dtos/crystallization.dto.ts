export class GetLogByIdDto {
  logId: string;
}

export class GetLogResponseDto {
  success: boolean;
  message: string;
  log?: any;
}