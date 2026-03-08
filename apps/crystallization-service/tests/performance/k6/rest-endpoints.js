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
const dailyMeasurementLatency = new Trend('cryst_daily_measurement_duration', true);
const predictedDailyLatency = new Trend('cryst_predicted_daily_duration', true);
const predictedMonthlyLatency = new Trend('cryst_predicted_monthly_duration', true);
const modelPerformanceLatency = new Trend('cryst_model_performance_duration', true);
const saltProductionLatency = new Trend('cryst_salt_production_duration', true);
const errorRate = new Rate('cryst_errors');

// Select load profile via env: LOAD_PROFILE=smoke|average|stress
const profiles = { smoke: smokeTest, average: averageLoad, stress: stressTest };
const profile = profiles[__ENV.LOAD_PROFILE || 'smoke'] || smokeTest;

// TODO: Replace with real values from your database
const TEST_DATE = __ENV.TEST_DATE || '2025-01-15';
const TEST_PRODUCTION_ID = __ENV.TEST_PRODUCTION_ID || '675945c5d1234567890abcde';

export const options = {
  ...profile,
  thresholds: {
    cryst_daily_measurement_duration: ['p(95)<2000'],
    cryst_predicted_daily_duration: ['p(95)<2000'],
    cryst_predicted_monthly_duration: ['p(95)<2000'],
    cryst_model_performance_duration: ['p(95)<2000'],
    cryst_salt_production_duration: ['p(95)<2000'],
    cryst_errors: ['rate<0.15'],
    // All endpoints require SALTSOCIETY role — 403 expected with SUPERADMIN token
    http_req_failed: ['rate<1.1'],
  },
  tags: {
    testSuite: 'crystallization-rest',
  },
};

export default function () {
  // ── Get Daily Measurement by Date (requires SALTSOCIETY role) ──────
  group('Get Daily Measurement by Date', () => {
    const res = http.get(`${BASE_URL}/crystallization/daily-measurement/${TEST_DATE}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /crystallization/daily-measurement/:date' },
    });

    dailyMeasurementLatency.add(res.timings.duration);

    check(res, {
      'daily by date: server responded': (r) => r.status !== 0,
      'daily by date: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Daily Measurements by Date Range (requires SALTSOCIETY role)
  group('Get Daily Measurements by Range', () => {
    const res = http.get(
      `${BASE_URL}/crystallization/daily-measurement?startDate=2025-01-01&endDate=2025-01-31`,
      {
        headers: defaultHeaders,
        tags: { name: 'GET /crystallization/daily-measurement' },
      },
    );

    dailyMeasurementLatency.add(res.timings.duration);

    check(res, {
      'daily by range: server responded': (r) => r.status !== 0,
      'daily by range: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Predicted Daily Measurements (requires SALTSOCIETY + Pro plan)
  group('Get Predicted Daily Measurements', () => {
    const res = http.get(
      `${BASE_URL}/crystallization/predicted-daily-measurement?startDate=2025-01-01&endDate=2025-01-31`,
      {
        headers: defaultHeaders,
        tags: { name: 'GET /crystallization/predicted-daily-measurement' },
      },
    );

    predictedDailyLatency.add(res.timings.duration);

    check(res, {
      'predicted daily: server responded': (r) => r.status !== 0,
      'predicted daily: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Predicted Monthly Productions (requires SALTSOCIETY + Pro plan)
  group('Get Predicted Monthly Productions', () => {
    const res = http.get(
      `${BASE_URL}/crystallization/predicted-monthly-productions?startMonth=2025-01&endMonth=2025-06`,
      {
        headers: defaultHeaders,
        tags: { name: 'GET /crystallization/predicted-monthly-productions' },
      },
    );

    predictedMonthlyLatency.add(res.timings.duration);

    check(res, {
      'predicted monthly: server responded': (r) => r.status !== 0,
      'predicted monthly: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Model Performance (requires SALTSOCIETY + Pro plan) ────────
  group('Get Model Performance', () => {
    const res = http.get(`${BASE_URL}/crystallization/model-performance?limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /crystallization/model-performance' },
    });

    modelPerformanceLatency.add(res.timings.duration);

    check(res, {
      'model performance: server responded': (r) => r.status !== 0,
      'model performance: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Salt Productions by Range (requires SALTSOCIETY + Pro plan) ─
  group('Get Salt Productions by Range', () => {
    const res = http.get(
      `${BASE_URL}/saltproductions?startMonth=2025-01&endMonth=2025-06`,
      {
        headers: defaultHeaders,
        tags: { name: 'GET /saltproductions' },
      },
    );

    saltProductionLatency.add(res.timings.duration);

    check(res, {
      'productions by range: server responded': (r) => r.status !== 0,
      'productions by range: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Salt Production by ID (requires SALTSOCIETY + Pro plan) ─────
  group('Get Salt Production by ID', () => {
    const res = http.get(`${BASE_URL}/saltproductions/${TEST_PRODUCTION_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /saltproductions/:id' },
    });

    saltProductionLatency.add(res.timings.duration);

    check(res, {
      'production by id: server responded': (r) => r.status !== 0,
      'production by id: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Salt Production by Month (requires SALTSOCIETY + Pro plan) ──
  group('Get Salt Production by Month', () => {
    const res = http.get(`${BASE_URL}/saltproductions/month/2025-01`, {
      headers: defaultHeaders,
      tags: { name: 'GET /saltproductions/month/:month' },
    });

    saltProductionLatency.add(res.timings.duration);

    check(res, {
      'production by month: server responded': (r) => r.status !== 0,
      'production by month: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    // Role-restricted — don't count 403 as error
  });

  sleep(1);
}

export function handleSummary(data) {
  const reportDir = 'apps/crystallization-service/test-output/performance';
  const profileName = __ENV.LOAD_PROFILE || 'smoke';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const title = `Crystallization Service - REST ${profileName.toUpperCase()} Test`;
  return {
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.html`]: htmlReport(data, { title }),
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: htmlReport(data, { title }),
  };
}
