import { ROIService } from '../../../src/app/roi/roi.service';
import { createMockBoundingBox, createMockBoundingBoxes } from '../helpers/test-data.helper';

describe('ROIService', () => {
  let service: ROIService;

  beforeEach(() => {
    service = new ROIService();
  });

  describe('getDefaultROI', () => {
    it('should return the default ROI config', () => {
      const roi = service.getDefaultROI();
      expect(roi).toEqual({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    });

    it('should return a new copy each time', () => {
      const roi1 = service.getDefaultROI();
      const roi2 = service.getDefaultROI();
      expect(roi1).toEqual(roi2);
      expect(roi1).not.toBe(roi2);
    });
  });

  describe('isInsideROI', () => {
    const roi = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };

    it('should return true when box center is inside ROI', () => {
      const box = createMockBoundingBox({ x: 0.3, y: 0.3, width: 0.1, height: 0.1 });
      expect(service.isInsideROI(box, roi)).toBe(true);
    });

    it('should return false when box center is outside ROI', () => {
      const box = createMockBoundingBox({ x: 0.0, y: 0.0, width: 0.02, height: 0.02 });
      expect(service.isInsideROI(box, roi)).toBe(false);
    });

    it('should return true when box center is exactly on the ROI boundary', () => {
      // center = x + width/2 = 0.05 + 0.1/2 = 0.1 which equals roi.x
      const box = createMockBoundingBox({ x: 0.05, y: 0.3, width: 0.1, height: 0.1 });
      expect(service.isInsideROI(box, roi)).toBe(true);
    });

    it('should return false when box center is just outside the right edge', () => {
      // center = 0.86 + 0.1/2 = 0.91, roi right edge = 0.1 + 0.8 = 0.9
      const box = createMockBoundingBox({ x: 0.86, y: 0.3, width: 0.1, height: 0.1 });
      expect(service.isInsideROI(box, roi)).toBe(false);
    });
  });

  describe('filterByROI', () => {
    const roi = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };

    it('should keep only boxes inside the ROI', () => {
      const boxes = [
        createMockBoundingBox({ x: 0.3, y: 0.3 }),  // inside
        createMockBoundingBox({ x: 0.0, y: 0.0, width: 0.02, height: 0.02 }),  // outside
        createMockBoundingBox({ x: 0.5, y: 0.5 }),  // inside
      ];
      const filtered = service.filterByROI(boxes, roi);
      expect(filtered).toHaveLength(2);
    });

    it('should return empty array when no boxes are inside', () => {
      const boxes = [
        createMockBoundingBox({ x: 0.0, y: 0.0, width: 0.02, height: 0.02 }),
      ];
      const filtered = service.filterByROI(boxes, roi);
      expect(filtered).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      expect(service.filterByROI([], roi)).toEqual([]);
    });
  });

  describe('markBoxesWithROI', () => {
    const roi = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };

    it('should add insideROI flag to each box', () => {
      const boxes = [
        createMockBoundingBox({ x: 0.3, y: 0.3 }),
        createMockBoundingBox({ x: 0.0, y: 0.0, width: 0.02, height: 0.02 }),
      ];
      const marked = service.markBoxesWithROI(boxes, roi);

      expect(marked).toHaveLength(2);
      expect(marked[0].insideROI).toBe(true);
      expect(marked[1].insideROI).toBe(false);
    });

    it('should preserve all original box properties', () => {
      const boxes = [createMockBoundingBox({ confidence: 0.95 })];
      const marked = service.markBoxesWithROI(boxes, roi);

      expect(marked[0].confidence).toBe(0.95);
      expect(marked[0].classId).toBe(1);
      expect(marked[0].className).toBe('pure');
      expect(marked[0]).toHaveProperty('insideROI');
    });
  });

  describe('calculateROIStats', () => {
    const roi = { x: 0.0, y: 0.0, width: 1.0, height: 1.0 }; // full frame — all boxes inside

    it('should count pure, impure, and unwanted correctly', () => {
      const boxes = createMockBoundingBoxes(); // 1 pure, 1 impure, 1 unwanted
      const stats = service.calculateROIStats(boxes, roi);

      expect(stats.pureCount).toBe(1);
      expect(stats.impureCount).toBe(1);
      expect(stats.unwantedCount).toBe(1);
      expect(stats.totalCount).toBe(3);
    });

    it('should calculate purity as pure/(pure+impure)*100', () => {
      const boxes = createMockBoundingBoxes(); // 1 pure, 1 impure
      const stats = service.calculateROIStats(boxes, roi);
      expect(stats.purityPercentage).toBe(50); // 1/(1+1)*100
    });

    it('should return 100% purity when no salt crystals detected', () => {
      const boxes = [
        createMockBoundingBox({ classId: 2, className: 'unwanted' }),
      ];
      const stats = service.calculateROIStats(boxes, roi);
      expect(stats.purityPercentage).toBe(100);
    });

    it('should return empty stats for no boxes', () => {
      const stats = service.calculateROIStats([], roi);
      expect(stats.totalCount).toBe(0);
      expect(stats.purityPercentage).toBe(100);
    });
  });

  describe('validateROI', () => {
    it('should return true for valid ROI', () => {
      expect(service.validateROI({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 })).toBe(true);
    });

    it('should return true for full-frame ROI', () => {
      expect(service.validateROI({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    });

    it('should return false for negative x', () => {
      expect(service.validateROI({ x: -0.1, y: 0, width: 0.5, height: 0.5 })).toBe(false);
    });

    it('should return false for negative y', () => {
      expect(service.validateROI({ x: 0, y: -0.1, width: 0.5, height: 0.5 })).toBe(false);
    });

    it('should return false for zero width', () => {
      expect(service.validateROI({ x: 0.1, y: 0.1, width: 0, height: 0.5 })).toBe(false);
    });

    it('should return false for zero height', () => {
      expect(service.validateROI({ x: 0.1, y: 0.1, width: 0.5, height: 0 })).toBe(false);
    });

    it('should return false when ROI exceeds frame bounds (x + width > 1)', () => {
      expect(service.validateROI({ x: 0.5, y: 0.1, width: 0.6, height: 0.5 })).toBe(false);
    });

    it('should return false when ROI exceeds frame bounds (y + height > 1)', () => {
      expect(service.validateROI({ x: 0.1, y: 0.5, width: 0.5, height: 0.6 })).toBe(false);
    });
  });
});
