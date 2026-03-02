import { PostprocessingService } from '../../../src/app/inference/postprocessing.service';

describe('PostprocessingService', () => {
  let service: PostprocessingService;

  beforeEach(() => {
    // Set env vars before constructing the service
    process.env.VISION_CONFIDENCE_THRESHOLD = '0.5';
    process.env.VISION_IOU_THRESHOLD = '0.45';
    process.env.VISION_INPUT_SIZE = '320';

    service = new PostprocessingService();
  });

  afterEach(() => {
    delete process.env.VISION_CONFIDENCE_THRESHOLD;
    delete process.env.VISION_IOU_THRESHOLD;
    delete process.env.VISION_INPUT_SIZE;
  });

  describe('processOutput', () => {
    it('should return empty array for empty output', () => {
      const output = new Float32Array(0);
      const result = service.processOutput(output, 640, 480);
      expect(result).toEqual([]);
    });

    it('should parse a single high-confidence detection', () => {
      // YOLOv8 output format: (4 + numClasses) x numPredictions, transposed
      // For 1 prediction with 3 classes:
      // Row 0: cx, Row 1: cy, Row 2: w, Row 3: h, Row 4-6: class scores
      const numPreds = 1;
      const output = new Float32Array(7 * numPreds);

      // Center at (160, 160), size (64, 64) — centered in 320x320 input
      output[0 * numPreds + 0] = 160; // cx
      output[1 * numPreds + 0] = 160; // cy
      output[2 * numPreds + 0] = 64;  // w
      output[3 * numPreds + 0] = 64;  // h
      output[4 * numPreds + 0] = 0.1; // impure score
      output[5 * numPreds + 0] = 0.9; // pure score
      output[6 * numPreds + 0] = 0.05; // unwanted score

      const result = service.processOutput(output, 640, 480);

      expect(result).toHaveLength(1);
      expect(result[0].classId).toBe(1); // pure
      expect(result[0].className).toBe('pure');
      expect(result[0].confidence).toBeCloseTo(0.9, 5);
      expect(result[0].color).toBe('#22c55e');
      // Normalized coords: x1 = (160-32)/320 = 0.4, y1 = (160-32)/320 = 0.4
      expect(result[0].x).toBeCloseTo(0.4, 1);
      expect(result[0].y).toBeCloseTo(0.4, 1);
      expect(result[0].width).toBeCloseTo(0.2, 1);
      expect(result[0].height).toBeCloseTo(0.2, 1);
    });

    it('should filter out detections below confidence threshold', () => {
      const numPreds = 2;
      const output = new Float32Array(7 * numPreds);

      // Detection 1: high confidence
      output[0 * numPreds + 0] = 100;
      output[1 * numPreds + 0] = 100;
      output[2 * numPreds + 0] = 50;
      output[3 * numPreds + 0] = 50;
      output[5 * numPreds + 0] = 0.8; // pure, above threshold

      // Detection 2: low confidence
      output[0 * numPreds + 1] = 200;
      output[1 * numPreds + 1] = 200;
      output[2 * numPreds + 1] = 50;
      output[3 * numPreds + 1] = 50;
      output[5 * numPreds + 1] = 0.3; // pure, below threshold

      const result = service.processOutput(output, 640, 480);
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBeCloseTo(0.8, 5);
    });

    it('should correctly map class IDs and names', () => {
      const numPreds = 3;
      const output = new Float32Array(7 * numPreds);

      // Impure detection
      output[0 * numPreds + 0] = 80; output[1 * numPreds + 0] = 80;
      output[2 * numPreds + 0] = 40; output[3 * numPreds + 0] = 40;
      output[4 * numPreds + 0] = 0.9; // impure

      // Pure detection
      output[0 * numPreds + 1] = 160; output[1 * numPreds + 1] = 160;
      output[2 * numPreds + 1] = 40; output[3 * numPreds + 1] = 40;
      output[5 * numPreds + 1] = 0.85; // pure

      // Unwanted detection
      output[0 * numPreds + 2] = 240; output[1 * numPreds + 2] = 240;
      output[2 * numPreds + 2] = 40; output[3 * numPreds + 2] = 40;
      output[6 * numPreds + 2] = 0.75; // unwanted

      const result = service.processOutput(output, 640, 480);
      expect(result).toHaveLength(3);

      const impure = result.find((b) => b.classId === 0);
      const pure = result.find((b) => b.classId === 1);
      const unwanted = result.find((b) => b.classId === 2);

      expect(impure.className).toBe('impure');
      expect(impure.color).toBe('#ef4444');
      expect(pure.className).toBe('pure');
      expect(pure.color).toBe('#22c55e');
      expect(unwanted.className).toBe('unwanted');
      expect(unwanted.color).toBe('#f97316');
    });

    it('should apply NMS to overlapping same-class detections', () => {
      const numPreds = 2;
      const output = new Float32Array(7 * numPreds);

      // Two heavily overlapping pure detections at nearly the same location
      output[0 * numPreds + 0] = 160; output[1 * numPreds + 0] = 160;
      output[2 * numPreds + 0] = 60; output[3 * numPreds + 0] = 60;
      output[5 * numPreds + 0] = 0.9; // pure, higher confidence

      output[0 * numPreds + 1] = 165; output[1 * numPreds + 1] = 165;
      output[2 * numPreds + 1] = 60; output[3 * numPreds + 1] = 60;
      output[5 * numPreds + 1] = 0.7; // pure, lower confidence

      const result = service.processOutput(output, 640, 480);
      // NMS should keep only the higher confidence one
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBeCloseTo(0.9, 5);
    });

    it('should keep overlapping detections of different classes', () => {
      const numPreds = 2;
      const output = new Float32Array(7 * numPreds);

      // Pure detection
      output[0 * numPreds + 0] = 160; output[1 * numPreds + 0] = 160;
      output[2 * numPreds + 0] = 60; output[3 * numPreds + 0] = 60;
      output[5 * numPreds + 0] = 0.9; // pure

      // Impure detection at nearly same location
      output[0 * numPreds + 1] = 165; output[1 * numPreds + 1] = 165;
      output[2 * numPreds + 1] = 60; output[3 * numPreds + 1] = 60;
      output[4 * numPreds + 1] = 0.85; // impure

      const result = service.processOutput(output, 640, 480);
      // NMS skips different classes — both should remain
      expect(result).toHaveLength(2);
    });

    it('should normalize coordinates to 0-1 range', () => {
      const numPreds = 1;
      const output = new Float32Array(7 * numPreds);

      output[0 * numPreds + 0] = 160; // cx = center of 320
      output[1 * numPreds + 0] = 160;
      output[2 * numPreds + 0] = 320; // w = full width
      output[3 * numPreds + 0] = 320; // h = full height
      output[5 * numPreds + 0] = 0.9;

      const result = service.processOutput(output, 640, 480);
      expect(result).toHaveLength(1);
      // Coordinates should be clamped to 0-1
      expect(result[0].x).toBeGreaterThanOrEqual(0);
      expect(result[0].y).toBeGreaterThanOrEqual(0);
      expect(result[0].x + result[0].width).toBeLessThanOrEqual(1);
      expect(result[0].y + result[0].height).toBeLessThanOrEqual(1);
    });
  });
});
