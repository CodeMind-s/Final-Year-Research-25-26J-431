import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { BASE_URL, defaultHeaders } from './config.js';

// Soak test: sustained low load over extended period to detect memory leaks,
// connection pool exhaustion, or gradual performance degradation.

const healthLatency = new Trend('soak_health_duration', true);
const errorRate = new Rate('soak_errors');

export const options = {
  stages: [
    { duration: '30s', target: 2 },   // ramp up
    { duration: '5m', target: 2 },    // sustained load
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    soak_health_duration: ['p(95)<300', 'p(99)<500'],
    soak_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
  tags: {
    testSuite: 'vision-soak',
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/vision/health`, {
    headers: defaultHeaders,
    tags: { name: 'GET /vision/health (soak)' },
  });

  healthLatency.add(res.timings.duration);

  const ok = check(res, {
    'soak: status 200': (r) => r.status === 200,
    'soak: response < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!ok);

  sleep(1);
}

export function handleSummary(data) {
  const reportDir = 'apps/vision-service/test-output/performance';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`${reportDir}/k6-soak-${timestamp}.html`]: htmlReport(data, { title: 'Vision Service - Soak Test' }),
    [`${reportDir}/k6-soak-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: htmlReport(data, { title: 'Vision Service - Soak Test' }),
  };
}
