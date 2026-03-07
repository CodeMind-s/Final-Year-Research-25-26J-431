import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { PreprocessingService } from '../../src/app/inference/preprocessing.service';
import { PostprocessingService } from '../../src/app/inference/postprocessing.service';
import { InferenceService } from '../../src/app/inference/inference.service';
import { WhitenessService } from '../../src/app/inference/whiteness.service';
import { BoundingBoxResult } from '../../src/app/common/interfaces/detection-result.interface';

// ── Config ───────────────────────────────────────────────────────────
const WARMUP_RUNS = 3;
const BENCHMARK_RUNS = 20;
const INPUT_SIZE = 320;
const TEST_IMAGE_SIZES = [
  { width: 640, height: 480, label: '640x480 (VGA)' },
  { width: 1280, height: 720, label: '1280x720 (HD)' },
  { width: 1920, height: 1080, label: '1920x1080 (FHD)' },
];

const REPORT_DIR = path.join(__dirname, '../../test-output/performance');
const MODEL_PATH = path.join(__dirname, '../../models/best.onnx');

// ── Helpers ──────────────────────────────────────────────────────────
interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
  samples: number;
}

function computeStats(timings: number[]): LatencyStats {
  const sorted = [...timings].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  return {
    min: sorted[0],
    max: sorted[n - 1],
    avg,
    median: sorted[Math.floor(n / 2)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    stdDev: Math.sqrt(variance),
    samples: n,
  };
}

function fmt(ms: number): string {
  return ms.toFixed(2);
}

async function generateTestImage(width: number, height: number): Promise<Buffer> {
  // Create a realistic-ish image with varied pixel values
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = Math.floor(Math.random() * 256);       // R
    pixels[i + 1] = Math.floor(Math.random() * 256);   // G
    pixels[i + 2] = Math.floor(Math.random() * 256);   // B
  }
  return sharp(pixels, { raw: { width, height, channels } })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// Fake bounding boxes for whiteness benchmarks
function makeFakeBoxes(count: number): BoundingBoxResult[] {
  const classes = ['impure', 'pure', 'unwanted'] as const;
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 0.7,
    y: Math.random() * 0.7,
    width: 0.05 + Math.random() * 0.1,
    height: 0.05 + Math.random() * 0.1,
    classId: i % 3,
    className: classes[i % 3],
    confidence: 0.5 + Math.random() * 0.5,
    color: '#22c55e',
  }));
}

// ── Test suite ───────────────────────────────────────────────────────
describe('Vision Service Performance Tests', () => {
  let preprocessingService: PreprocessingService;
  let postprocessingService: PostprocessingService;
  let inferenceService: InferenceService;
  let whitenessService: WhitenessService;
  let testImages: Map<string, Buffer>;
  let modelAvailable: boolean;

  // Collect all results for the PDF report
  const allResults: {
    section: string;
    label: string;
    stats: LatencyStats;
    unit: string;
  }[] = [];
  const memorySnapshots: { label: string; heapUsedMB: number; rssMB: number }[] = [];

  beforeAll(async () => {
    process.env.VISION_INPUT_SIZE = String(INPUT_SIZE);
    process.env.VISION_CONFIDENCE_THRESHOLD = '0.5';
    process.env.VISION_IOU_THRESHOLD = '0.45';

    modelAvailable = fs.existsSync(MODEL_PATH);
    if (modelAvailable) {
      process.env.VISION_MODEL_PATH = MODEL_PATH;
    }

    const providers: any[] = [
      PreprocessingService,
      PostprocessingService,
      WhitenessService,
    ];
    if (modelAvailable) {
      providers.push(InferenceService);
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers,
    }).compile();

    preprocessingService = moduleRef.get(PreprocessingService);
    postprocessingService = moduleRef.get(PostprocessingService);
    whitenessService = moduleRef.get(WhitenessService);
    if (modelAvailable) {
      inferenceService = moduleRef.get(InferenceService);
      try {
        await inferenceService.onModuleInit();
      } catch (err) {
        console.warn(`Model loading failed (${err.message}), skipping inference tests`);
        modelAvailable = false;
      }
    }

    // Pre-generate test images
    testImages = new Map();
    for (const size of TEST_IMAGE_SIZES) {
      testImages.set(size.label, await generateTestImage(size.width, size.height));
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });

    // Baseline memory snapshot
    const mem = process.memoryUsage();
    memorySnapshots.push({
      label: 'Baseline (after model load)',
      heapUsedMB: mem.heapUsed / 1024 / 1024,
      rssMB: mem.rss / 1024 / 1024,
    });
  }, 60000);

  afterAll(async () => {
    // Final memory snapshot
    const mem = process.memoryUsage();
    memorySnapshots.push({
      label: 'After all benchmarks',
      heapUsedMB: mem.heapUsed / 1024 / 1024,
      rssMB: mem.rss / 1024 / 1024,
    });

    fs.mkdirSync(REPORT_DIR, { recursive: true });

    if (allResults.length > 0) {
      await generatePdfReport(allResults, memorySnapshots);
    }
  }, 60000);

  // ── Preprocessing benchmarks ─────────────────────────────────────
  describe('Preprocessing Performance', () => {
    for (const size of TEST_IMAGE_SIZES) {
      it(`should preprocess ${size.label} within acceptable latency`, async () => {
        const image = testImages.get(size.label)!;

        // Warmup
        for (let i = 0; i < WARMUP_RUNS; i++) {
          await preprocessingService.preprocess(image);
        }

        const timings: number[] = [];
        for (let i = 0; i < BENCHMARK_RUNS; i++) {
          const start = performance.now();
          await preprocessingService.preprocess(image);
          timings.push(performance.now() - start);
        }

        const stats = computeStats(timings);
        allResults.push({
          section: 'Preprocessing',
          label: size.label,
          stats,
          unit: 'ms',
        });

        console.log(
          `  Preprocess ${size.label}: avg=${fmt(stats.avg)}ms, p95=${fmt(stats.p95)}ms, p99=${fmt(stats.p99)}ms`,
        );

        // Preprocessing should complete within 200ms even for FHD
        expect(stats.p95).toBeLessThan(200);
      }, 30000);
    }
  });

  // ── Postprocessing benchmarks ────────────────────────────────────
  describe('Postprocessing Performance', () => {
    const detectionCounts = [10, 50, 200];

    for (const numDetections of detectionCounts) {
      it(`should postprocess ${numDetections} candidates within acceptable latency`, () => {
        // Generate synthetic output tensor (YOLOv8 format: [7, numPredictions])
        const numPredictions = 2100; // typical for 320x320
        const outputData = new Float32Array((4 + 3) * numPredictions);

        // Plant detections with high confidence
        for (let i = 0; i < Math.min(numDetections, numPredictions); i++) {
          outputData[0 * numPredictions + i] = 50 + Math.random() * 220; // cx
          outputData[1 * numPredictions + i] = 50 + Math.random() * 220; // cy
          outputData[2 * numPredictions + i] = 20 + Math.random() * 40;  // w
          outputData[3 * numPredictions + i] = 20 + Math.random() * 40;  // h
          const classId = i % 3;
          outputData[(4 + classId) * numPredictions + i] = 0.7 + Math.random() * 0.3;
        }

        // Warmup
        for (let i = 0; i < WARMUP_RUNS; i++) {
          postprocessingService.processOutput(outputData, 640, 480);
        }

        const timings: number[] = [];
        for (let i = 0; i < BENCHMARK_RUNS; i++) {
          const start = performance.now();
          postprocessingService.processOutput(outputData, 640, 480);
          timings.push(performance.now() - start);
        }

        const stats = computeStats(timings);
        allResults.push({
          section: 'Postprocessing (NMS)',
          label: `${numDetections} candidates`,
          stats,
          unit: 'ms',
        });

        console.log(
          `  Postprocess ${numDetections} candidates: avg=${fmt(stats.avg)}ms, p95=${fmt(stats.p95)}ms`,
        );

        // NMS should be fast even with many candidates
        expect(stats.p95).toBeLessThan(50);
      });
    }
  });

  // ── Whiteness calculation benchmarks ─────────────────────────────
  describe('Whiteness Calculation Performance', () => {
    const boxCounts = [5, 15, 30];

    for (const count of boxCounts) {
      it(`should calculate whiteness for ${count} boxes within acceptable latency`, async () => {
        const image = testImages.get('640x480 (VGA)')!;
        const boxes = makeFakeBoxes(count);

        // Warmup
        for (let i = 0; i < WARMUP_RUNS; i++) {
          await whitenessService.calculateWhiteness(image, boxes, 640, 480);
        }

        const timings: number[] = [];
        for (let i = 0; i < BENCHMARK_RUNS; i++) {
          const start = performance.now();
          await whitenessService.calculateWhiteness(image, boxes, 640, 480);
          timings.push(performance.now() - start);
        }

        const stats = computeStats(timings);
        allResults.push({
          section: 'Whiteness Calculation',
          label: `${count} boxes`,
          stats,
          unit: 'ms',
        });

        console.log(
          `  Whiteness ${count} boxes: avg=${fmt(stats.avg)}ms, p95=${fmt(stats.p95)}ms`,
        );

        // Whiteness scales linearly with box count; allow ~30ms per box
        const threshold = count * 30;
        expect(stats.p95).toBeLessThan(threshold);
      }, 30000);
    }
  });

  // ── Full inference pipeline (requires model) ────────────────────
  describe('Full Inference Pipeline', () => {
    for (const size of TEST_IMAGE_SIZES) {
      it(`should run full inference on ${size.label} within acceptable latency`, async () => {
        if (!modelAvailable) {
          console.log('  [SKIPPED] ONNX model not available');
          return;
        }

        const image = testImages.get(size.label)!;

        // Warmup
        for (let i = 0; i < WARMUP_RUNS; i++) {
          await inferenceService.runInference(image);
        }

        // Memory before
        const memBefore = process.memoryUsage();

        const timings: number[] = [];
        for (let i = 0; i < BENCHMARK_RUNS; i++) {
          const start = performance.now();
          await inferenceService.runInference(image);
          timings.push(performance.now() - start);
        }

        // Memory after
        const memAfter = process.memoryUsage();
        memorySnapshots.push({
          label: `After ${BENCHMARK_RUNS}x inference (${size.label})`,
          heapUsedMB: memAfter.heapUsed / 1024 / 1024,
          rssMB: memAfter.rss / 1024 / 1024,
        });

        const stats = computeStats(timings);
        const fps = 1000 / stats.avg;

        allResults.push({
          section: 'Full Inference Pipeline',
          label: size.label,
          stats,
          unit: 'ms',
        });

        console.log(
          `  Inference ${size.label}: avg=${fmt(stats.avg)}ms, p95=${fmt(stats.p95)}ms, ~${fps.toFixed(1)} FPS`,
        );
        console.log(
          `    Heap delta: ${fmt((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)} MB`,
        );

        // Full pipeline should complete within 1000ms for real-time use
        expect(stats.p95).toBeLessThan(1000);
      }, 120000);
    }
  });

  // ── Throughput test ──────────────────────────────────────────────
  describe('Throughput', () => {
    it('should sustain acceptable throughput over burst of frames', async () => {
      if (!modelAvailable) {
        console.log('  [SKIPPED] ONNX model not available');
        return;
      }

      const image = testImages.get('640x480 (VGA)')!;
      const burstSize = 50;

      // Warmup
      for (let i = 0; i < WARMUP_RUNS; i++) {
        await inferenceService.runInference(image);
      }

      const burstStart = performance.now();
      const frameTimes: number[] = [];

      for (let i = 0; i < burstSize; i++) {
        const frameStart = performance.now();
        await inferenceService.runInference(image);
        frameTimes.push(performance.now() - frameStart);
      }

      const totalTime = performance.now() - burstStart;
      const avgFps = (burstSize / totalTime) * 1000;

      const stats = computeStats(frameTimes);
      allResults.push({
        section: 'Throughput (Burst)',
        label: `${burstSize} frames @ VGA`,
        stats,
        unit: 'ms',
      });

      console.log(`  Burst throughput: ${avgFps.toFixed(1)} FPS over ${burstSize} frames`);
      console.log(`  Total time: ${fmt(totalTime)}ms`);
      console.log(`  Frame jitter (stdDev): ${fmt(stats.stdDev)}ms`);

      // Should sustain at least 1 FPS
      expect(avgFps).toBeGreaterThan(1);
    }, 300000);
  });
});

// ── PDF report generation ────────────────────────────────────────────
async function generatePdfReport(
  results: { section: string; label: string; stats: LatencyStats; unit: string }[],
  memory: { label: string; heapUsedMB: number; rssMB: number }[],
): Promise<void> {
  // Dynamic import to avoid issues if pdfkit is missing
  const PDFDocument = (await import('pdfkit')).default;

  const reportPath = path.join(REPORT_DIR, `performance-report-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(reportPath);
  doc.pipe(stream);

  // ── Title page ───────────────────────────────────────────────────
  doc.fontSize(24).font('Helvetica-Bold').text('Vision Service', { align: 'center' });
  doc.fontSize(20).text('Performance Test Report', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
  doc.text(`Platform: ${process.platform} ${process.arch}`, { align: 'center' });
  doc.text(`Node.js: ${process.version}`, { align: 'center' });
  doc.text(`Input size: ${INPUT_SIZE}x${INPUT_SIZE}`, { align: 'center' });
  doc.text(`Benchmark runs: ${BENCHMARK_RUNS} (${WARMUP_RUNS} warmup)`, { align: 'center' });
  doc.moveDown(2);

  // ── Summary table ────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').text('Performance Summary');
  doc.moveDown(0.5);

  const sections = [...new Set(results.map((r) => r.section))];

  for (const section of sections) {
    const sectionResults = results.filter((r) => r.section === section);

    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').text(section);
    doc.moveDown(0.3);

    // Table header
    const tableTop = doc.y;
    const col = { label: 50, avg: 200, p95: 275, p99: 345, min: 415, max: 475 };

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Scenario', col.label, tableTop);
    doc.text('Avg (ms)', col.avg, tableTop);
    doc.text('P95 (ms)', col.p95, tableTop);
    doc.text('P99 (ms)', col.p99, tableTop);
    doc.text('Min (ms)', col.min, tableTop);
    doc.text('Max (ms)', col.max, tableTop);
    doc.moveDown(0.2);

    // Divider
    doc.moveTo(col.label, doc.y).lineTo(540, doc.y).stroke('#cccccc');
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(9);
    for (const r of sectionResults) {
      const y = doc.y;
      doc.text(r.label, col.label, y, { width: 145 });
      doc.text(fmt(r.stats.avg), col.avg, y);
      doc.text(fmt(r.stats.p95), col.p95, y);
      doc.text(fmt(r.stats.p99), col.p99, y);
      doc.text(fmt(r.stats.min), col.min, y);
      doc.text(fmt(r.stats.max), col.max, y);
      doc.moveDown(0.4);
    }
  }

  // ── Memory usage ─────────────────────────────────────────────────
  doc.moveDown(1);
  doc.fontSize(16).font('Helvetica-Bold').text('Memory Usage');
  doc.moveDown(0.5);

  const memCol = { label: 50, heap: 280, rss: 420 };
  const memTop = doc.y;

  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Checkpoint', memCol.label, memTop);
  doc.text('Heap Used (MB)', memCol.heap, memTop);
  doc.text('RSS (MB)', memCol.rss, memTop);
  doc.moveDown(0.2);
  doc.moveTo(memCol.label, doc.y).lineTo(540, doc.y).stroke('#cccccc');
  doc.moveDown(0.2);

  doc.font('Helvetica').fontSize(9);
  for (const snap of memory) {
    const y = doc.y;
    doc.text(snap.label, memCol.label, y, { width: 225 });
    doc.text(snap.heapUsedMB.toFixed(2), memCol.heap, y);
    doc.text(snap.rssMB.toFixed(2), memCol.rss, y);
    doc.moveDown(0.4);
  }

  // ── Detailed statistics ──────────────────────────────────────────
  doc.addPage();
  doc.fontSize(16).font('Helvetica-Bold').text('Detailed Statistics');
  doc.moveDown(0.5);

  for (const r of results) {
    doc.fontSize(11).font('Helvetica-Bold').text(`${r.section} - ${r.label}`);
    doc.fontSize(9).font('Helvetica');
    doc.text(
      `  Samples: ${r.stats.samples}  |  Avg: ${fmt(r.stats.avg)} ms  |  Median: ${fmt(r.stats.median)} ms  |  StdDev: ${fmt(r.stats.stdDev)} ms`,
    );
    doc.text(
      `  Min: ${fmt(r.stats.min)} ms  |  Max: ${fmt(r.stats.max)} ms  |  P95: ${fmt(r.stats.p95)} ms  |  P99: ${fmt(r.stats.p99)} ms`,
    );
    if (r.section === 'Full Inference Pipeline' || r.section === 'Throughput (Burst)') {
      const fps = 1000 / r.stats.avg;
      doc.text(`  Estimated throughput: ~${fps.toFixed(1)} FPS`);
    }
    doc.moveDown(0.5);
  }

  // ── Footer ───────────────────────────────────────────────────────
  doc.moveDown(1);
  doc.fontSize(8).font('Helvetica').fillColor('#888888');
  doc.text('Brinex Vision Service - Automated Performance Report', { align: 'center' });

  doc.end();

  await new Promise<void>((resolve) => stream.on('finish', resolve));

  console.log(`\n  PDF report saved: ${reportPath}`);
}
