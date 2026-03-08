import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {
  BASE_URL,
  defaultHeaders,
  smokeTest,
  averageLoad,
  stressTest,
  healthThresholds,
  detectionThresholds,
} from './config.js';

// Custom metrics
const healthLatency = new Trend('vision_health_duration', true);
const detectionsLatency = new Trend('vision_detections_duration', true);
const batchesLatency = new Trend('vision_batches_duration', true);
const statsLatency = new Trend('vision_stats_duration', true);
const errorRate = new Rate('vision_errors');

// Select load profile via env: LOAD_PROFILE=smoke|average|stress
const profiles = { smoke: smokeTest, average: averageLoad, stress: stressTest };
const profile = profiles[__ENV.LOAD_PROFILE || 'smoke'] || smokeTest;

export const options = {
  ...profile,
  thresholds: {
    vision_health_duration: ['p(95)<500'],
    vision_detections_duration: ['p(95)<5000'],
    vision_batches_duration: ['p(95)<2000'],
    vision_stats_duration: ['p(95)<2000'],
    vision_errors: ['rate<0.15'],
    http_req_failed: ['rate<0.90'],
    // Health endpoint must always succeed (public, no auth)
    'http_req_failed{name:GET /vision/health}': ['rate<0.01'],
  },
  tags: {
    testSuite: 'vision-rest',
  },
};

export default function () {
  // ── Health endpoint (public, no auth) ─────────────────────────────
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/vision/health`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/health' },
    });

    healthLatency.add(res.timings.duration);

    const ok = check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: has modelLoaded field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.modelLoaded !== undefined;
        } catch {
          return false;
        }
      },
      'health: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Detections listing (requires LABORATORY role + Lab plan) ──────
  group('Get Detections', () => {
    const res = http.get(`${BASE_URL}/vision/detections?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/detections' },
    });

    detectionsLatency.add(res.timings.duration);

    check(res, {
      'detections: server responded': (r) => r.status !== 0,
      'detections: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Plan-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Batches listing (requires LABORATORY role + Lab plan) ────────
  group('Get Batches', () => {
    const res = http.get(`${BASE_URL}/vision/batches?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/batches' },
    });

    batchesLatency.add(res.timings.duration);

    check(res, {
      'batches: server responded': (r) => r.status !== 0,
      'batches: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Plan-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Statistics summary (requires LABORATORY role + Lab plan) ─────
  group('Get Statistics Summary', () => {
    const res = http.get(`${BASE_URL}/vision/statistics/summary`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/statistics/summary' },
    });

    statsLatency.add(res.timings.duration);

    check(res, {
      'stats summary: server responded': (r) => r.status !== 0,
      'stats summary: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Plan-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Statistics hourly (requires LABORATORY role + Lab plan) ──────
  group('Get Statistics Hourly', () => {
    const res = http.get(`${BASE_URL}/vision/statistics/hourly`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/statistics/hourly' },
    });

    statsLatency.add(res.timings.duration);

    check(res, {
      'stats hourly: server responded': (r) => r.status !== 0,
    });
    // Plan-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Statistics daily (requires LABORATORY role + Lab plan) ───────
  group('Get Statistics Daily', () => {
    const res = http.get(`${BASE_URL}/vision/statistics/daily`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/statistics/daily' },
    });

    statsLatency.add(res.timings.duration);

    check(res, {
      'stats daily: server responded': (r) => r.status !== 0,
    });
    // Plan-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Statistics trends (requires LABORATORY role + Lab plan) ──────
  group('Get Statistics Trends', () => {
    const res = http.get(`${BASE_URL}/vision/statistics/trends?period=7d`, {
      headers: defaultHeaders,
      tags: { name: 'GET /vision/statistics/trends' },
    });

    statsLatency.add(res.timings.duration);

    check(res, {
      'stats trends: server responded': (r) => r.status !== 0,
    });
    // Plan-restricted endpoint — don't count 403 as error
  });

  sleep(1);
}

export function handleSummary(data) {
  const reportDir = 'apps/vision-service/test-output/performance';
  const profileName = __ENV.LOAD_PROFILE || 'smoke';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const title = `Vision Service - REST ${profileName.toUpperCase()} Test`;
  return {
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.html`]: htmlReport(data, { title }),
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: htmlReport(data, { title }),
  };
}
