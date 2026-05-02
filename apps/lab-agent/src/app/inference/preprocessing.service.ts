import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class PreprocessingService {
  private readonly inputSize: number;

  constructor() {
    this.inputSize = parseInt(process.env.VISION_INPUT_SIZE || process.env.INPUT_SIZE || '320', 10);
  }

  async preprocess(imageBuffer: Buffer): Promise<{
    tensor: Float32Array;
    originalWidth: number;
    originalHeight: number;
  }> {
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || this.inputSize;
    const originalHeight = metadata.height || this.inputSize;

    const resizedBuffer = await sharp(imageBuffer)
      .resize(this.inputSize, this.inputSize, {
        fit: 'fill',
        kernel: 'lanczos3',
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    const tensor = new Float32Array(1 * 3 * this.inputSize * this.inputSize);

    for (let y = 0; y < this.inputSize; y++) {
      for (let x = 0; x < this.inputSize; x++) {
        const srcIdx = (y * this.inputSize + x) * 3;
        const r = resizedBuffer[srcIdx] / 255.0;
        const g = resizedBuffer[srcIdx + 1] / 255.0;
        const b = resizedBuffer[srcIdx + 2] / 255.0;

        const pixelIndex = y * this.inputSize + x;
        tensor[0 * this.inputSize * this.inputSize + pixelIndex] = r;
        tensor[1 * this.inputSize * this.inputSize + pixelIndex] = g;
        tensor[2 * this.inputSize * this.inputSize + pixelIndex] = b;
      }
    }

    return { tensor, originalWidth, originalHeight };
  }
}
