/* eslint-disable */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { io } from 'socket.io-client';

// Phase 2 sanity check — connects to the running lab-agent, sends a sample
// image as a `frame` event, prints the `detection_result`, exits.
//
// Usage: npx ts-node apps/lab-agent/tools/test-client.ts [path/to/image.jpg]

const protocol = process.env.AGENT_PROTOCOL || 'http';
const host = process.env.AGENT_HOST || 'localhost';
const port = process.env.AGENT_PORT || '5005';
const url = `${protocol}://${host}:${port}/vision`;

const imageArg = process.argv[2];
const candidatePaths = [
  imageArg,
  process.env.AGENT_TEST_IMAGE,
  resolve(__dirname, 'sample.jpg'),
  resolve(__dirname, '../src/assets/test-frame.jpg'),
].filter(Boolean) as string[];

const samplePath = candidatePaths.find((p) => existsSync(p));
if (!samplePath) {
  console.error(
    'No sample image found. Pass a path as the first argument, set AGENT_TEST_IMAGE, ' +
      `or drop one at: ${candidatePaths.join(' | ')}`,
  );
  process.exit(1);
}

const imageBuffer = readFileSync(samplePath);
console.log(`Connecting to ${url} and sending ${samplePath} (${imageBuffer.length} bytes)`);

const token = process.env.AGENT_TEST_TOKEN || '';
if (!token) {
  console.warn(
    'AGENT_TEST_TOKEN is unset — connection will be rejected by Phase 3+ agents. ' +
      'Pass a laboratory JWT in AGENT_TEST_TOKEN.',
  );
}

const socket = io(url, {
  transports: ['websocket'],
  rejectUnauthorized: false,
  auth: { token },
} as any);

const TIMEOUT_MS = 15000;
const timer = setTimeout(() => {
  console.error(`No detection_result received within ${TIMEOUT_MS}ms — failing`);
  socket.close();
  process.exit(1);
}, TIMEOUT_MS);

socket.on('connect', () => {
  console.log(`Connected, socket id: ${socket.id}`);
  socket.emit('frame', imageBuffer);
});

socket.on('connection_status', (data: any) => {
  console.log('connection_status:', data);
});

socket.on('detection_result', (result: any) => {
  clearTimeout(timer);
  console.log('detection_result:');
  console.log(
    JSON.stringify(
      {
        frameId: result.frameId,
        processingTimeMs: result.processingTimeMs,
        boundingBoxCount: result.boundingBoxes?.length ?? 0,
        purityPercentage: result.purityPercentage,
        roiPurityPercentage: result.roiPurityPercentage,
        firstBox: result.boundingBoxes?.[0],
      },
      null,
      2,
    ),
  );
  socket.close();
  process.exit(0);
});

socket.on('error', (err: any) => {
  console.error('error event:', err);
});

socket.on('connect_error', (err: any) => {
  console.error('connect_error:', err.message);
  clearTimeout(timer);
  process.exit(1);
});
