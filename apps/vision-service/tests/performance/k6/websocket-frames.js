import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import ws from 'k6/ws';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3400';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const FRAMES_PER_SESSION = parseInt(__ENV.FRAMES_PER_SESSION || '30', 10);
const FRAME_INTERVAL_MS = parseInt(__ENV.FRAME_INTERVAL_MS || '200', 10);

// Custom metrics
const frameLatency = new Trend('ws_frame_roundtrip', true);
const connectionTime = new Trend('ws_connection_time', true);
const framesProcessed = new Counter('ws_frames_processed');
const frameErrors = new Rate('ws_frame_errors');
const sessionErrors = new Rate('ws_session_errors');

// Select profile: LOAD_PROFILE=smoke|average|stress
const profiles = {
  smoke: { vus: 1, duration: '30s' },
  average: {
    stages: [
      { duration: '20s', target: 3 },
      { duration: '1m', target: 3 },
      { duration: '20s', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '20s', target: 5 },
      { duration: '1m', target: 10 },
      { duration: '30s', target: 20 },
      { duration: '1m', target: 20 },
      { duration: '30s', target: 0 },
    ],
  },
};

const profile = profiles[__ENV.LOAD_PROFILE || 'smoke'] || profiles.smoke;

export const options = {
  ...profile,
  thresholds: {
    ws_frame_roundtrip: ['p(95)<2000', 'p(99)<5000'],
    ws_connection_time: ['p(95)<3000'],
    ws_frame_errors: ['rate<0.1'],
    ws_session_errors: ['rate<0.1'],
  },
  tags: {
    testSuite: 'vision-websocket',
  },
};

// Generate a small synthetic JPEG-like base64 payload (~2KB)
// In real tests, replace with actual camera frame data
function generateFakeFrameBase64() {
  // Create a minimal valid base64 string simulating a small image
  const size = randomIntBetween(1500, 3000);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function () {
  // Socket.IO uses HTTP long-polling upgrade, so we connect via the Engine.IO path
  // For k6, we use raw WebSocket to the Socket.IO endpoint
  const socketIOUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&namespace=/vision`;
  const wsUrl = socketIOUrl + (AUTH_TOKEN ? `&token=${AUTH_TOKEN}` : '');

  const connectStart = Date.now();

  const res = ws.connect(wsUrl, { tags: { name: 'vision-ws' } }, function (socket) {
    const connectDuration = Date.now() - connectStart;
    connectionTime.add(connectDuration);

    let connected = false;
    let sessionId = null;
    let pendingFrameTimestamp = null;

    socket.on('open', () => {
      connected = true;

      // Socket.IO handshake: send connect packet for /vision namespace
      socket.send('40/vision,');
    });

    socket.on('message', (msg) => {
      // Socket.IO protocol: messages prefixed with packet type
      // 40 = CONNECT, 42 = EVENT, 43 = ACK

      if (msg.startsWith('40/vision')) {
        // Connected to namespace — start stream
        const startStreamPayload = JSON.stringify([
          'start_stream',
          { cameraSource: 'k6-load-test' },
        ]);
        socket.send(`42/vision,${startStreamPayload}`);
        return;
      }

      if (msg.startsWith('42/vision,')) {
        try {
          const eventData = JSON.parse(msg.substring(10));
          const eventName = eventData[0];
          const payload = eventData[1];

          if (eventName === 'stream_started') {
            sessionId = payload.sessionId;

            // Start a batch
            const startBatchPayload = JSON.stringify(['start_batch', {}]);
            socket.send(`42/vision,${startBatchPayload}`);
          }

          if (eventName === 'batch_started') {
            // Begin sending frames
            sendFrames(socket);
          }

          if (eventName === 'detection_result') {
            if (pendingFrameTimestamp) {
              const latency = Date.now() - pendingFrameTimestamp;
              frameLatency.add(latency);
              pendingFrameTimestamp = null;
            }
            framesProcessed.add(1);
            frameErrors.add(false);
          }

          if (eventName === 'error') {
            frameErrors.add(true);
          }

          if (eventName === 'stream_stopped') {
            socket.close();
          }
        } catch {
          // Ignore parse errors for non-event messages
        }
      }
    });

    socket.on('error', (e) => {
      sessionErrors.add(true);
    });

    function sendFrames(sock) {
      let framesSent = 0;

      const interval = setInterval(() => {
        if (framesSent >= FRAMES_PER_SESSION) {
          clearInterval(interval);

          // End batch then stop stream
          const endBatch = JSON.stringify(['end_batch', {}]);
          sock.send(`42/vision,${endBatch}`);

          setTimeout(() => {
            const stopStream = JSON.stringify(['stop_stream', {}]);
            sock.send(`42/vision,${stopStream}`);
          }, 500);

          return;
        }

        const frameData = generateFakeFrameBase64();
        pendingFrameTimestamp = Date.now();

        const framePayload = JSON.stringify([
          'frame',
          { data: frameData, timestamp: Date.now() },
        ]);
        sock.send(`42/vision,${framePayload}`);
        framesSent++;
      }, FRAME_INTERVAL_MS);
    }

    // Timeout: close socket after max duration
    const maxDuration = (FRAMES_PER_SESSION * FRAME_INTERVAL_MS + 10000);
    socket.setTimeout(function () {
      if (connected) {
        const stopStream = JSON.stringify(['stop_stream', {}]);
        socket.send(`42/vision,${stopStream}`);
      }
      socket.close();
    }, maxDuration);
  });

  const wsOk = check(res, {
    'ws: connected successfully': (r) => r && r.status === 101,
  });

  sessionErrors.add(!wsOk);

  sleep(2);
}

export function handleSummary(data) {
  const reportDir = 'apps/vision-service/test-output/performance';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`${reportDir}/k6-websocket-${timestamp}.html`]: htmlReport(data, { title: 'Vision Service - WebSocket Load Test' }),
    [`${reportDir}/k6-websocket-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: htmlReport(data, { title: 'Vision Service - WebSocket Load Test' }),
  };
}
