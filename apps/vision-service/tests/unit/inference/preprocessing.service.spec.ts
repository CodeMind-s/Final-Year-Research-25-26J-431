jest.mock('sharp', () => {
  const mockSharp = jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 640, height: 480 }),
    resize: jest.fn().mockReturnThis(),
    removeAlpha: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(
      // 320x320 RGB pixels all set to 128
      Buffer.alloc(320 * 320 * 3, 128),
    ),
  }));
  mockSharp.default = mockSharp;
  return mockSharp;
});

import { PreprocessingService } from '../../../src/app/inference/preprocessing.service';

describe('PreprocessingService', () => {
  let service: PreprocessingService;

  beforeEach(() => {
    process.env.VISION_INPUT_SIZE = '320';
    service = new PreprocessingService();
  });

  afterEach(() => {
    delete process.env.VISION_INPUT_SIZE;
  });

  describe('preprocess', () => {
    it('should return tensor of correct size', async () => {
      const imageBuffer = Buffer.from('fake-image');
      const result = await service.preprocess(imageBuffer);

      // Tensor size = 1 * 3 * 320 * 320 = 307200
      expect(result.tensor).toBeInstanceOf(Float32Array);
      expect(result.tensor.length).toBe(1 * 3 * 320 * 320);
    });

    it('should return original dimensions from metadata', async () => {
      const imageBuffer = Buffer.from('fake-image');
      const result = await service.preprocess(imageBuffer);

      expect(result.originalWidth).toBe(640);
      expect(result.originalHeight).toBe(480);
    });

    it('should normalize pixel values to 0-1', async () => {
      const imageBuffer = Buffer.from('fake-image');
      const result = await service.preprocess(imageBuffer);

      // All pixels are 128, so normalized = 128/255 ≈ 0.502
      for (let i = 0; i < result.tensor.length; i++) {
        expect(result.tensor[i]).toBeCloseTo(128 / 255, 4);
      }
    });

    it('should produce CHW format (channels first)', async () => {
      const imageBuffer = Buffer.from('fake-image');
      const result = await service.preprocess(imageBuffer);

      const channelSize = 320 * 320;
      // In CHW format, channel 0 (R) occupies indices 0..channelSize-1
      // All values should be the same since our mock returns uniform pixels
      const rChannel = result.tensor.slice(0, channelSize);
      const gChannel = result.tensor.slice(channelSize, 2 * channelSize);
      const bChannel = result.tensor.slice(2 * channelSize, 3 * channelSize);

      // For uniform 128 pixels, all channels are equal
      expect(rChannel[0]).toBeCloseTo(gChannel[0], 4);
      expect(gChannel[0]).toBeCloseTo(bChannel[0], 4);
    });
  });
});
