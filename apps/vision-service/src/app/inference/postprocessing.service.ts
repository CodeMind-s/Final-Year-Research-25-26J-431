import { Injectable, Logger } from '@nestjs/common';
import { BoundingBoxResult } from '../common/interfaces/detection-result.interface';

@Injectable()
export class PostprocessingService {
  private readonly logger = new Logger(PostprocessingService.name);
  private readonly confidenceThreshold: number;
  private readonly iouThreshold: number;
  private readonly inputSize: number;
  private readonly classNames = ['impure', 'pure', 'unwanted'];
  private readonly classColors = ['#ef4444', '#22c55e', '#f97316'];

  constructor() {
    this.confidenceThreshold = parseFloat(
      process.env.VISION_CONFIDENCE_THRESHOLD || process.env.CONFIDENCE_THRESHOLD || '0.5',
    );
    this.iouThreshold = parseFloat(
      process.env.VISION_IOU_THRESHOLD || process.env.IOU_THRESHOLD || '0.45',
    );
    this.inputSize = parseInt(
      process.env.VISION_INPUT_SIZE || process.env.INPUT_SIZE || '320',
      10,
    );
  }

  processOutput(
    outputData: Float32Array,
    originalWidth: number,
    originalHeight: number,
  ): BoundingBoxResult[] {
    const numClasses = 3;
    const numPredictions = outputData.length / (4 + numClasses);

    const candidates: {
      box: number[];
      score: number;
      classId: number;
    }[] = [];

    for (let i = 0; i < numPredictions; i++) {
      const cx = outputData[0 * numPredictions + i];
      const cy = outputData[1 * numPredictions + i];
      const w = outputData[2 * numPredictions + i];
      const h = outputData[3 * numPredictions + i];

      let maxScore = 0;
      let classId = 0;
      for (let c = 0; c < numClasses; c++) {
        const score = outputData[(4 + c) * numPredictions + i];
        if (score > maxScore) {
          maxScore = score;
          classId = c;
        }
      }

      if (maxScore >= this.confidenceThreshold) {
        const x1 = cx - w / 2;
        const y1 = cy - h / 2;
        const x2 = cx + w / 2;
        const y2 = cy + h / 2;

        candidates.push({
          box: [x1, y1, x2, y2],
          score: maxScore,
          classId,
        });
      }
    }

    this.logger.debug(`Candidates before NMS: ${candidates.length}`);

    const nmsResults = this.nms(candidates);
    this.logger.debug(`Results after NMS: ${nmsResults.length}`);

    return nmsResults.map((result) => {
      const [x1, y1, x2, y2] = result.box;

      const x = Math.max(0, x1 / this.inputSize);
      const y = Math.max(0, y1 / this.inputSize);
      const width = Math.min(1 - x, (x2 - x1) / this.inputSize);
      const height = Math.min(1 - y, (y2 - y1) / this.inputSize);

      return {
        x,
        y,
        width,
        height,
        classId: result.classId,
        className: this.classNames[result.classId],
        confidence: result.score,
        color: this.classColors[result.classId],
      };
    });
  }

  private nms(
    candidates: { box: number[]; score: number; classId: number }[],
  ): { box: number[]; score: number; classId: number }[] {
    if (candidates.length === 0) return [];

    candidates.sort((a, b) => b.score - a.score);

    const selected: typeof candidates = [];

    while (candidates.length > 0) {
      const best = candidates.shift()!;
      selected.push(best);

      candidates = candidates.filter((candidate) => {
        if (candidate.classId !== best.classId) return true;
        const iou = this.calculateIoU(best.box, candidate.box);
        return iou < this.iouThreshold;
      });
    }

    return selected;
  }

  private calculateIoU(box1: number[], box2: number[]): number {
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;

    const xLeft = Math.max(x1_1, x1_2);
    const yTop = Math.max(y1_1, y1_2);
    const xRight = Math.min(x2_1, x2_2);
    const yBottom = Math.min(y2_1, y2_2);

    if (xRight < xLeft || yBottom < yTop) {
      return 0;
    }

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop);

    const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
    const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / unionArea;
  }
}
