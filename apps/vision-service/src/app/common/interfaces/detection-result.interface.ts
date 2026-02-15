export interface BoundingBoxResult {
  x: number;           // normalized 0-1, top-left x
  y: number;           // normalized 0-1, top-left y
  width: number;       // normalized 0-1
  height: number;      // normalized 0-1
  classId: number;     // 0 = impure, 1 = pure, 2 = unwanted
  className: string;   // "impure", "pure", or "unwanted"
  confidence: number;  // 0-1
  color: string;       // hex color for rendering
  insideROI?: boolean; // whether box center is inside ROI

  // Whiteness metrics
  whitenessPercentage?: number;  // 0-100, whiteness of crystal region
  qualityScore?: number;          // 0-100, combined score
}

export interface ROIConfig {
  x: number;      // normalized 0-1, top-left x
  y: number;      // normalized 0-1, top-left y
  width: number;  // normalized 0-1
  height: number; // normalized 0-1
}

export interface DetectionResult {
  frameId: string;
  timestamp: number;
  processingTimeMs: number;

  // Counts (all detected)
  pureCount: number;
  impureCount: number;
  unwantedCount: number;
  totalCount: number;
  purityPercentage: number;

  // ROI-filtered counts
  roiPureCount?: number;
  roiImpureCount?: number;
  roiUnwantedCount?: number;
  roiTotalCount?: number;
  roiPurityPercentage?: number;

  // Whiteness aggregates (all detected)
  avgWhiteness?: number;
  avgQualityScore?: number;

  // ROI-filtered whiteness aggregates
  roiAvgWhiteness?: number;
  roiAvgQualityScore?: number;

  // Bounding boxes for overlay
  boundingBoxes: BoundingBoxResult[];

  // Frame dimensions
  frameWidth: number;
  frameHeight: number;

  // ROI configuration
  roi?: ROIConfig;

  // Batch info
  currentBatchId?: string;
  currentBatchNumber?: number;
}

export interface InferenceOutput {
  boxes: number[][];    // [x, y, w, h] in absolute pixels
  scores: number[];
  classIds: number[];
}
