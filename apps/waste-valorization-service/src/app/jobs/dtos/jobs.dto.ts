// Request DTOs
export interface CreateJobDto {
  userId: string;
  jobType: number; // 0=WASTE_PREDICTION, 1=VALORIZATION_ANALYSIS, 2=OPTIMIZATION
  requestData: string | Record<string, unknown>; // JSON string or object
}

export interface GetJobDto {
  id: string;
}

export interface GetJobsDto {
  userId?: string;
  status?: number; // 0=PENDING, 1=PROCESSING, 2=COMPLETED, 3=FAILED
  jobType?: number; // 0=WASTE_PREDICTION, 1=VALORIZATION_ANALYSIS, 2=OPTIMIZATION
  page?: number;
  limit?: number;
}

export interface UpdateJobDto {
  id: string;
  status?: number;
  resultData?: string | Record<string, unknown>; // JSON string or object
  errorMessage?: string;
}

export interface GetJobStatusDto {
  id: string;
}

// Response DTOs
export interface JobResponseData {
  _id: string;
  userId: string;
  jobType: number;
  status: number;
  requestData: string | Record<string, unknown>;
  resultData?: string | Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobResponseDto {
  success: boolean;
  message: string;
  data?: JobResponseData;
}

export interface GetJobResponseDto {
  success: boolean;
  message: string;
  data?: JobResponseData;
}

export interface GetJobsResponseDto {
  success: boolean;
  message: string;
  data?: JobResponseData[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface UpdateJobResponseDto {
  success: boolean;
  message: string;
  data?: JobResponseData;
}

export interface GetJobStatusResponseDto {
  success: boolean;
  message: string;
  jobId?: string;
  status?: number;
  resultData?: string;
  errorMessage?: string;
}
