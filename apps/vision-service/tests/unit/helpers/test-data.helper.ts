import { Types } from 'mongoose';

export const TEST_USER_ID = new Types.ObjectId().toString();
export const TEST_SESSION_ID = new Types.ObjectId().toString();
export const TEST_BATCH_ID = new Types.ObjectId().toString();
export const TEST_DETECTION_ID = new Types.ObjectId().toString();

export const DEFAULT_ROI = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };

export function createMockBoundingBox(overrides: Record<string, any> = {}) {
  return {
    x: 0.1,
    y: 0.2,
    width: 0.15,
    height: 0.1,
    classId: 1,
    className: 'pure',
    confidence: 0.85,
    color: '#22c55e',
    ...overrides,
  };
}

export function createMockBoundingBoxes() {
  return [
    createMockBoundingBox({ classId: 1, className: 'pure', confidence: 0.9, color: '#22c55e' }),
    createMockBoundingBox({ x: 0.3, y: 0.3, classId: 0, className: 'impure', confidence: 0.8, color: '#ef4444' }),
    createMockBoundingBox({ x: 0.5, y: 0.5, classId: 2, className: 'unwanted', confidence: 0.7, color: '#f97316' }),
  ];
}

export function createMockDetectionResult(overrides: Record<string, any> = {}) {
  const boxes = createMockBoundingBoxes();
  return {
    frameId: 'test-frame-id',
    timestamp: Date.now(),
    processingTimeMs: 45.2,
    pureCount: 1,
    impureCount: 1,
    unwantedCount: 1,
    totalCount: 3,
    purityPercentage: 50,
    boundingBoxes: boxes,
    frameWidth: 640,
    frameHeight: 480,
    ...overrides,
  };
}

export function createMockDetectionDocument(overrides: Record<string, any> = {}) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    timestamp: new Date(),
    frameWidth: 640,
    frameHeight: 480,
    processingTimeMs: 45.2,
    pureCount: 1,
    impureCount: 1,
    unwantedCount: 1,
    totalCount: 3,
    purityPercentage: 50,
    roiPureCount: 1,
    roiImpureCount: 1,
    roiUnwantedCount: 0,
    roiTotalCount: 2,
    roiPurityPercentage: 50,
    avgWhiteness: 75.5,
    avgQualityScore: 60.2,
    roiAvgWhiteness: 78.3,
    roiAvgQualityScore: 65.1,
    userId: new Types.ObjectId(TEST_USER_ID),
    sessionId: new Types.ObjectId(TEST_SESSION_ID),
    batchId: new Types.ObjectId(TEST_BATCH_ID),
    boundingBoxes: [
      { x: 0.1, y: 0.2, width: 0.15, height: 0.1, classId: 1, className: 'pure', confidence: 0.9, whitenessPercentage: 85, qualityScore: 85 },
      { x: 0.3, y: 0.3, width: 0.15, height: 0.1, classId: 0, className: 'impure', confidence: 0.8, whitenessPercentage: 65, qualityScore: 19.5 },
    ],
    ...overrides,
  };
}

export function createMockSessionDocument(overrides: Record<string, any> = {}) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    userId: new Types.ObjectId(TEST_USER_ID),
    startTime: new Date(),
    endTime: null,
    totalFrames: 0,
    totalPureCount: 0,
    totalImpureCount: 0,
    totalUnwantedCount: 0,
    avgPurityPercent: null,
    totalBatches: 0,
    avgWhiteness: null,
    avgQualityScore: null,
    roi: DEFAULT_ROI,
    cameraSource: null,
    notes: null,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    toISOString: undefined,
    ...overrides,
  };
}

export function createMockBatchDocument(overrides: Record<string, any> = {}) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    userId: new Types.ObjectId(TEST_USER_ID),
    sessionId: new Types.ObjectId(TEST_SESSION_ID),
    batchNumber: 1,
    startTime: new Date(),
    endTime: null,
    roi: DEFAULT_ROI,
    pureCount: 0,
    impureCount: 0,
    unwantedCount: 0,
    totalCount: 0,
    purityPercentage: null,
    avgWhiteness: null,
    avgQualityScore: null,
    frameCount: 0,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}
