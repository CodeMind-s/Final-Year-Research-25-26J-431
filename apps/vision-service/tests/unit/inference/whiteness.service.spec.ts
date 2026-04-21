jest.mock('sharp', () => {
  const mockSharp = jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockReturnThis(),
    removeAlpha: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({
      // 10x10 RGB pixels — pure white (255,255,255)
      data: Buffer.alloc(10 * 10 * 3, 255),
      info: { width: 10, height: 10, channels: 3, size: 300 },
    }),
  }));
  mockSharp.default = mockSharp;
  return mockSharp;
});

import { WhitenessService } from '../../../src/app/inference/whiteness.service';
import { createMockBoundingBox, createMockBoundingBoxes } from '../helpers/test-data.helper';

describe('WhitenessService', () => {
  let service: WhitenessService;

  beforeEach(() => {
    service = new WhitenessService();
  });

  describe('calculateWhiteness', () => {
    it('should return whiteness metrics for each bounding box', async () => {
      const boxes = [createMockBoundingBox()];
      const result = await service.calculateWhiteness(
        Buffer.from('fake-image'),
        boxes,
        640,
        480,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('whitenessPercentage');
      expect(result[0]).toHaveProperty('qualityScore');
    });

    it('should return empty array for empty boxes', async () => {
      const result = await service.calculateWhiteness(
        Buffer.from('fake-image'),
        [],
        640,
        480,
      );
      expect(result).toEqual([]);
    });

    it('should propagate errors when image decoding fails', async () => {
      const sharp = require('sharp');
      sharp.mockImplementationOnce(() => ({
        removeAlpha: jest.fn().mockReturnThis(),
        raw: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Sharp error')),
      }));

      const boxes = [createMockBoundingBox()];
      await expect(
        service.calculateWhiteness(Buffer.from('fake-image'), boxes, 640, 480),
      ).rejects.toThrow('Sharp error');
    });

    it('should calculate high whiteness for white pixels', async () => {
      const boxes = [createMockBoundingBox()];
      const result = await service.calculateWhiteness(
        Buffer.from('fake-image'),
        boxes,
        640,
        480,
      );

      // Pure white (255,255,255): v=1, s=0, whiteness = v*(1-s) = 1 => 100%
      expect(result[0].whitenessPercentage).toBe(100);
    });
  });

  describe('calculateQualityScore', () => {
    it('should return whiteness * 1.0 for pure crystals', () => {
      expect(service.calculateQualityScore(true, 80)).toBe(80);
    });

    it('should return whiteness * 0.3 for impure crystals', () => {
      expect(service.calculateQualityScore(false, 80)).toBeCloseTo(24);
    });

    it('should return 0 for unwanted', () => {
      expect(service.calculateQualityScore(false, 80, true)).toBe(0);
    });

    it('should return 0 for unwanted even if pure flag is true', () => {
      expect(service.calculateQualityScore(true, 80, true)).toBe(0);
    });
  });

  describe('calculateAggregateStats', () => {
    it('should average whiteness and quality across boxes', () => {
      const boxes = [
        { ...createMockBoundingBox(), whitenessPercentage: 80, qualityScore: 60 },
        { ...createMockBoundingBox(), whitenessPercentage: 60, qualityScore: 40 },
      ] as any[];
      const stats = service.calculateAggregateStats(boxes);

      expect(stats.avgWhiteness).toBe(70);
      expect(stats.avgQualityScore).toBe(50);
    });

    it('should return zeros for empty array', () => {
      const stats = service.calculateAggregateStats([]);
      expect(stats.avgWhiteness).toBe(0);
      expect(stats.avgQualityScore).toBe(0);
    });
  });

  describe('calculateROIAggregateStats', () => {
    it('should only average boxes with insideROI === true', () => {
      const boxes = [
        { ...createMockBoundingBox(), whitenessPercentage: 90, qualityScore: 90, insideROI: true },
        { ...createMockBoundingBox(), whitenessPercentage: 10, qualityScore: 10, insideROI: false },
      ] as any[];

      const stats = service.calculateROIAggregateStats(boxes);
      expect(stats.avgWhiteness).toBe(90);
      expect(stats.avgQualityScore).toBe(90);
    });

    it('should return zeros when no boxes are inside ROI', () => {
      const boxes = [
        { ...createMockBoundingBox(), whitenessPercentage: 80, qualityScore: 60, insideROI: false },
      ] as any[];

      const stats = service.calculateROIAggregateStats(boxes);
      expect(stats.avgWhiteness).toBe(0);
      expect(stats.avgQualityScore).toBe(0);
    });
  });
});
