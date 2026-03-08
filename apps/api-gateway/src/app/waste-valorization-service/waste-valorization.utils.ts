export type JobType = 'WASTE_PREDICTION' | 'VALORIZATION_ANALYSIS' | 'OPTIMIZATION';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export function toGrpcJobType(jobType?: JobType | string): number | undefined {
  const jobTypeMap: Record<string, number> = {
    WASTE_PREDICTION: 0,
    VALORIZATION_ANALYSIS: 1,
    OPTIMIZATION: 2,
  };

  if (!jobType) return undefined;
  return jobTypeMap[jobType as string];
}

export function toGrpcJobStatus(status?: JobStatus | string): number | undefined {
  const statusMap: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 1,
    COMPLETED: 2,
    FAILED: 3,
  };

  if (!status) return undefined;
  return statusMap[status as string];
}

export function parseGrpcJson<T = any>(data: any, defaultJson = '{}'): T {
  try {
    if (!data) return JSON.parse(defaultJson) as T;
    return typeof data === 'string' ? JSON.parse(data) as T : data as T;
  } catch (e) {
    return JSON.parse(defaultJson) as T;
  }
}

export function mapJobStatusNumberToString(statusNum: number | undefined): string {
  const statusMap: Record<number, string> = {
    0: 'pending',
    1: 'processing',
    2: 'completed',
    3: 'failed',
  };
  return statusNum === undefined ? 'pending' : statusMap[statusNum] || 'pending';
}

export function buildQuickPredictionStatus(jobData: any): any {
  const status = mapJobStatusNumberToString(jobData?.status);

  if (status === 'pending' || status === 'processing') {
    return {
      success: true,
      data: {
        jobId: jobData._id,
        status: status,
        message: 'Prediction is being calculated. Please check again in a few seconds.',
        progress: status === 'processing' ? 65 : 10,
      },
    };
  }

  if (status === 'failed') {
    return {
      success: false,
      error: {
        code: 'PREDICTION_FAILED',
        message: jobData.errorMessage || 'ML model processing failed. Please try again.',
        details: jobData.errorMessage || 'Model inference timeout or invalid input parameters',
      },
    };
  }

  // completed
  let predictionData = null;
  if (jobData.resultData) {
    try {
      predictionData = typeof jobData.resultData === 'string' ? JSON.parse(jobData.resultData) : jobData.resultData;
    } catch (e) {
      predictionData = null;
    }
  }

  return {
    success: true,
    data: {
      jobId: jobData._id,
      status: 'completed',
      prediction: predictionData,
    },
  };
}
