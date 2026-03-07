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
} from './config.js';

// Custom metrics
const jobsLatency = new Trend('waste_jobs_duration', true);
const jobStatusLatency = new Trend('waste_job_status_duration', true);
const predictionsLatency = new Trend('waste_predictions_duration', true);
const quickPredictionLatency = new Trend('waste_quick_prediction_duration', true);
const errorRate = new Rate('waste_errors');

// Select load profile via env: LOAD_PROFILE=smoke|average|stress
const profiles = { smoke: smokeTest, average: averageLoad, stress: stressTest };
const profile = profiles[__ENV.LOAD_PROFILE || 'smoke'] || smokeTest;

// TODO: Replace with real values from your database
const TEST_JOB_ID = __ENV.TEST_JOB_ID || '675945c5d1234567890abcde';

export const options = {
  ...profile,
  thresholds: {
    waste_jobs_duration: ['p(95)<500'],
    waste_job_status_duration: ['p(95)<300'],
    waste_predictions_duration: ['p(95)<1500'],
    waste_quick_prediction_duration: ['p(95)<500'],
    waste_errors: ['rate<0.1'],
  },
  tags: {
    testSuite: 'waste-valorization-rest',
  },
};

export default function () {
  // ═══════════════════════════════════════════════════════════════════
  // WASTE VALORIZATION JOBS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get Waste Valorization Jobs ─────────────────────────────────────
  group('Get Waste Valorization Jobs', () => {
    const res = http.get(`${BASE_URL}/waste-valorization-jobs?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /waste-valorization-jobs' },
    });

    jobsLatency.add(res.timings.duration);

    const ok = check(res, {
      'jobs list: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'jobs list: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Waste Valorization Job by ID ────────────────────────────────
  group('Get Waste Valorization Job by ID', () => {
    const res = http.get(`${BASE_URL}/waste-valorization-jobs/${TEST_JOB_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /waste-valorization-jobs/:id' },
    });

    jobsLatency.add(res.timings.duration);

    const ok = check(res, {
      'job by id: status 200 or 401/403/404': (r) => [200, 401, 403, 404].includes(r.status),
      'job by id: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Waste Valorization Job Status ───────────────────────────────
  group('Get Waste Job Status', () => {
    const res = http.get(`${BASE_URL}/waste-valorization-jobs/${TEST_JOB_ID}/status`, {
      headers: defaultHeaders,
      tags: { name: 'GET /waste-valorization-jobs/:id/status' },
    });

    jobStatusLatency.add(res.timings.duration);

    const ok = check(res, {
      'job status: status 200 or 401/403/404': (r) => [200, 401, 403, 404].includes(r.status),
      'job status: response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ═══════════════════════════════════════════════════════════════════
  // WASTE MANAGEMENT (SALT SOCIETY)
  // ═══════════════════════════════════════════════════════════════════

  // ── Get Waste Predictions ───────────────────────────────────────────
  group('Get Waste Predictions', () => {
    const res = http.get(
      `${BASE_URL}/salt-society/waste-management/predictions?includeAverages=true`,
      {
        headers: defaultHeaders,
        tags: { name: 'GET /salt-society/waste-management/predictions' },
      },
    );

    predictionsLatency.add(res.timings.duration);

    const ok = check(res, {
      'predictions: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'predictions: response time < 1500ms': (r) => r.timings.duration < 1500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Quick Prediction Status ─────────────────────────────────────
  group('Get Quick Prediction Status', () => {
    const res = http.get(
      `${BASE_URL}/salt-society/waste-management/quick-prediction/${TEST_JOB_ID}`,
      {
        headers: defaultHeaders,
        tags: { name: 'GET /salt-society/waste-management/quick-prediction/:jobId' },
      },
    );

    quickPredictionLatency.add(res.timings.duration);

    const ok = check(res, {
      'quick prediction: status 200 or 401/403/404': (r) => [200, 401, 403, 404].includes(r.status),
      'quick prediction: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  const reportDir = 'apps/waste-valorization-service/test-output/performance';
  const profileName = __ENV.LOAD_PROFILE || 'smoke';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const title = `Waste Valorization Service - REST ${profileName.toUpperCase()} Test`;
  return {
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.html`]: htmlReport(data, { title }),
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: htmlReport(data, { title }),
  };
}
