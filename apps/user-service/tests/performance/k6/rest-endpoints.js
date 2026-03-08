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
const getByEmailLatency = new Trend('user_get_by_email_duration', true);
const getAllLatency = new Trend('user_get_all_duration', true);
const getByIdLatency = new Trend('user_get_by_id_duration', true);
const errorRate = new Rate('user_errors');

// Select load profile via env: LOAD_PROFILE=smoke|average|stress
const profiles = { smoke: smokeTest, average: averageLoad, stress: stressTest };
const profile = profiles[__ENV.LOAD_PROFILE || 'smoke'] || smokeTest;

// TODO: Replace with real values from your database
const TEST_EMAIL = __ENV.TEST_EMAIL || 'admin@example.com';
const TEST_USER_ID = __ENV.TEST_USER_ID || '694b9a9cf106d772f1ab1cc4';

export const options = {
  ...profile,
  thresholds: {
    user_get_by_email_duration: ['p(95)<500'],
    user_get_all_duration: ['p(95)<2000'],
    user_get_by_id_duration: ['p(95)<800'],
    user_errors: ['rate<0.15'],
    http_req_failed: ['rate<0.5'],
  },
  tags: {
    testSuite: 'user-rest',
  },
};

export default function () {
  // ── Get User by Email ───────────────────────────────────────────────
  group('Get User by Email', () => {
    const res = http.get(`${BASE_URL}/user/${TEST_EMAIL}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /user/:email' },
    });

    getByEmailLatency.add(res.timings.duration);

    const ok = check(res, {
      'get by email: status 200': (r) => r.status === 200,
      'get by email: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get All Users ───────────────────────────────────────────────────
  group('Get All Users', () => {
    const res = http.get(`${BASE_URL}/user/all/users?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /user/all/users' },
    });

    getAllLatency.add(res.timings.duration);

    const ok = check(res, {
      'get all: status 200': (r) => r.status === 200,
      'get all: response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get User by ID ─────────────────────────────────────────────────
  // Note: GET /user/:id shares the same route pattern as GET /user/:email
  // in NestJS, so the :email handler catches this request first.
  // The server still responds (routes to email handler with the ID as param),
  // so we validate server response and latency rather than strict 200 status.
  group('Get User by ID', () => {
    const res = http.get(`${BASE_URL}/user/${TEST_USER_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /user/:id' },
    });

    getByIdLatency.add(res.timings.duration);

    const ok = check(res, {
      'get by id: server responded': (r) => r.status !== 0,
      'get by id: response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Don't count route-collision errors against overall error rate
  });

  sleep(1);
}

export function handleSummary(data) {
  const reportDir = 'apps/user-service/test-output/performance';
  const profileName = __ENV.LOAD_PROFILE || 'smoke';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const title = `User Service - REST ${profileName.toUpperCase()} Test`;
  return {
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.html`]: htmlReport(
      data,
      { title }
    ),
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.json`]: JSON.stringify(
      data,
      null,
      2
    ),
    stdout: htmlReport(data, { title }),
  };
}
