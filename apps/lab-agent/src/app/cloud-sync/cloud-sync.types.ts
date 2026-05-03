// Cloud DTO shapes — kept in sync with apps/api-gateway/src/app/vision-service/dtos/vision-write.dto.ts.

export interface CloudROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateSessionBody {
  cameraSource?: string;
  roi?: CloudROI;
}

export interface CreateBatchBody {
  sessionId: string;
  roi?: CloudROI;
}

export interface CloudBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  classId: number;
  className: string;
  confidence: number;
  whitenessPercentage?: number;
  qualityScore?: number;
}

export interface SaveDetectionBody {
  sessionId?: string;
  batchId?: string;
  frameWidth: number;
  frameHeight: number;
  processingTimeMs: number;
  roiPureCount?: number;
  roiImpureCount?: number;
  roiUnwantedCount?: number;
  roiTotalCount?: number;
  roiPurityPercentage?: number;
  avgWhiteness?: number;
  avgQualityScore?: number;
  roiAvgWhiteness?: number;
  roiAvgQualityScore?: number;
  boundingBoxes: CloudBoundingBox[];
}

export interface CreatedSessionResponse {
  id: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface CreatedBatchResponse {
  id: string;
  batchId?: string;
  [key: string]: unknown;
}
