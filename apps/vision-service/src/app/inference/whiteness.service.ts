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

    const results: BoundingBoxWithWhiteness[] = [];

    for (const box of boxes) {
      try {
        const whitenessPercentage = await this.calculateBoxWhiteness(
          imageBuffer,
          box,
          frameWidth,
          frameHeight,
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

  private async calculateBoxWhiteness(
    imageBuffer: Buffer,
    box: BoundingBoxResult,
    frameWidth: number,
    frameHeight: number,
  ): Promise<number> {
    const left = Math.floor(box.x * frameWidth);
    const top = Math.floor(box.y * frameHeight);
    const width = Math.max(this.MIN_CROP_SIZE, Math.floor(box.width * frameWidth));
    const height = Math.max(this.MIN_CROP_SIZE, Math.floor(box.height * frameHeight));

    const clampedLeft = Math.max(0, Math.min(left, frameWidth - width));
    const clampedTop = Math.max(0, Math.min(top, frameHeight - height));
    const clampedWidth = Math.min(width, frameWidth - clampedLeft);
    const clampedHeight = Math.min(height, frameHeight - clampedTop);

    if (clampedWidth < this.MIN_CROP_SIZE || clampedHeight < this.MIN_CROP_SIZE) {
      return 0;
    }

    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: clampedLeft,
        top: clampedTop,
        width: clampedWidth,
        height: clampedHeight,
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    return this.calculateWhitenessFromRGB(croppedBuffer);
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
