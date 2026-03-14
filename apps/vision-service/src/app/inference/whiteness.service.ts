import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { BoundingBoxResult } from '../common/interfaces/detection-result.interface';

export interface BoundingBoxWithWhiteness extends BoundingBoxResult {
  whitenessPercentage: number;
  qualityScore: number;
}

export interface WhitenessStats {
  avgWhiteness: number;
  avgQualityScore: number;
}

@Injectable()
export class WhitenessService {
  private readonly logger = new Logger(WhitenessService.name);
  private readonly MIN_CROP_SIZE = 3;

  async calculateWhiteness(
    imageBuffer: Buffer,
    boxes: BoundingBoxResult[],
    frameWidth: number,
    frameHeight: number,
  ): Promise<BoundingBoxWithWhiteness[]> {
    if (boxes.length === 0) {
      return [];
    }

    // Single decode: convert image to raw RGB pixels once
    const { data: rawPixels, info } = await sharp(imageBuffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const stride = info.width * 3;

    const results: BoundingBoxWithWhiteness[] = [];

    for (const box of boxes) {
      try {
        const whitenessPercentage = this.calculateWhitenessFromRegion(
          rawPixels,
          stride,
          Math.floor(box.x * info.width),
          Math.floor(box.y * info.height),
          Math.floor(box.width * info.width),
          Math.floor(box.height * info.height),
          info.width,
          info.height,
        );

        const isPure = box.className === 'pure';
        const isUnwanted = box.className === 'unwanted';
        const qualityScore = this.calculateQualityScore(isPure, whitenessPercentage, isUnwanted);

        results.push({
          ...box,
          whitenessPercentage,
          qualityScore,
        });
      } catch (error) {
        this.logger.warn(`Failed to calculate whiteness for box: ${error.message}`);
        results.push({
          ...box,
          whitenessPercentage: 0,
          qualityScore: 0,
        });
      }
    }

    return results;
  }

  private calculateWhitenessFromRegion(
    rawPixels: Buffer,
    stride: number,
    left: number,
    top: number,
    width: number,
    height: number,
    imgWidth: number,
    imgHeight: number,
  ): number {
    width = Math.max(this.MIN_CROP_SIZE, width);
    height = Math.max(this.MIN_CROP_SIZE, height);

    const clampedLeft = Math.max(0, Math.min(left, imgWidth - width));
    const clampedTop = Math.max(0, Math.min(top, imgHeight - height));
    const clampedWidth = Math.min(width, imgWidth - clampedLeft);
    const clampedHeight = Math.min(height, imgHeight - clampedTop);

    if (clampedWidth < this.MIN_CROP_SIZE || clampedHeight < this.MIN_CROP_SIZE) {
      return 0;
    }

    let totalWhiteness = 0;
    let pixelCount = 0;

    for (let row = clampedTop; row < clampedTop + clampedHeight; row++) {
      const rowOffset = row * stride + clampedLeft * 3;
      for (let col = 0; col < clampedWidth; col++) {
        const i = rowOffset + col * 3;
        const r = rawPixels[i] / 255;
        const g = rawPixels[i + 1] / 255;
        const b = rawPixels[i + 2] / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const v = max;
        const s = max === 0 ? 0 : (max - min) / max;

        totalWhiteness += v * (1 - s);
        pixelCount++;
      }
    }

    return pixelCount > 0 ? (totalWhiteness / pixelCount) * 100 : 0;
  }

  private calculateWhitenessFromRGB(rgbBuffer: Buffer): number {
    const pixelCount = rgbBuffer.length / 3;
    if (pixelCount === 0) return 0;

    let totalWhiteness = 0;

    for (let i = 0; i < rgbBuffer.length; i += 3) {
      const r = rgbBuffer[i] / 255;
      const g = rgbBuffer[i + 1] / 255;
      const b = rgbBuffer[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      const v = max;
      const s = max === 0 ? 0 : (max - min) / max;

      const whiteness = v * (1 - s);
      totalWhiteness += whiteness;
    }

    return (totalWhiteness / pixelCount) * 100;
  }

  calculateQualityScore(isPure: boolean, whitenessPercentage: number, isUnwanted: boolean = false): number {
    if (isUnwanted) return 0;
    const multiplier = isPure ? 1.0 : 0.3;
    return whitenessPercentage * multiplier;
  }

  calculateAggregateStats(boxes: BoundingBoxWithWhiteness[]): WhitenessStats {
    if (boxes.length === 0) {
      return { avgWhiteness: 0, avgQualityScore: 0 };
    }

    const totalWhiteness = boxes.reduce((sum, box) => sum + box.whitenessPercentage, 0);
    const totalQuality = boxes.reduce((sum, box) => sum + box.qualityScore, 0);

    return {
      avgWhiteness: Math.round((totalWhiteness / boxes.length) * 100) / 100,
      avgQualityScore: Math.round((totalQuality / boxes.length) * 100) / 100,
    };
  }

  calculateROIAggregateStats(boxes: BoundingBoxWithWhiteness[]): WhitenessStats {
    const roiBoxes = boxes.filter((box) => box.insideROI);
    return this.calculateAggregateStats(roiBoxes);
  }
}
