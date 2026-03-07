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
const harvestPlansLatency = new Trend('compass_harvest_plans_duration', true);
const dealsLatency = new Trend('compass_deals_duration', true);
const offersLatency = new Trend('compass_offers_duration', true);
const errorRate = new Rate('compass_errors');

// Select load profile via env: LOAD_PROFILE=smoke|average|stress
const profiles = { smoke: smokeTest, average: averageLoad, stress: stressTest };
const profile = profiles[__ENV.LOAD_PROFILE || 'smoke'] || smokeTest;

// TODO: Replace with real values from your database
const TEST_PLAN_ID = __ENV.TEST_PLAN_ID || '675945c5d1234567890abcde';
const TEST_DEAL_ID = __ENV.TEST_DEAL_ID || '675945c5d1234567890abcde';
const TEST_OFFER_ID = __ENV.TEST_OFFER_ID || '675945c5d1234567890abcde';

export const options = {
  ...profile,
  thresholds: {
    compass_harvest_plans_duration: ['p(95)<500'],
    compass_deals_duration: ['p(95)<800'],
    compass_offers_duration: ['p(95)<500'],
    compass_errors: ['rate<0.1'],
  },
  tags: {
    testSuite: 'compass-rest',
  },
};

export default function () {
  // ═══════════════════════════════════════════════════════════════════
  // HARVEST PLANS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get My Harvest Plans (LANDOWNER) ────────────────────────────────
  group('Get My Harvest Plans', () => {
    const res = http.get(`${BASE_URL}/harvest-plans/my-plans?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /harvest-plans/my-plans' },
    });

    harvestPlansLatency.add(res.timings.duration);

    const ok = check(res, {
      'my plans: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'my plans: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Harvest Plan by ID ──────────────────────────────────────────
  group('Get Harvest Plan by ID', () => {
    const res = http.get(`${BASE_URL}/harvest-plans/${TEST_PLAN_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /harvest-plans/:id' },
    });

    harvestPlansLatency.add(res.timings.duration);

    const ok = check(res, {
      'plan by id: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'plan by id: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get All Harvest Plans (ADMIN/SALTSOCIETY) ───────────────────────
  group('Get All Harvest Plans', () => {
    const res = http.get(`${BASE_URL}/harvest-plans?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /harvest-plans' },
    });

    harvestPlansLatency.add(res.timings.duration);

    const ok = check(res, {
      'all plans: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'all plans: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ═══════════════════════════════════════════════════════════════════
  // DEALS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get Landowner Deals ─────────────────────────────────────────────
  group('Get Landowner Deals', () => {
    const res = http.get(`${BASE_URL}/deals/landowner/my-deals?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals/landowner/my-deals' },
    });

    dealsLatency.add(res.timings.duration);

    const ok = check(res, {
      'landowner deals: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'landowner deals: response time < 800ms': (r) => r.timings.duration < 800,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Distributor Deals ───────────────────────────────────────────
  group('Get Distributor Deals', () => {
    const res = http.get(`${BASE_URL}/deals/distributor/my-deals?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals/distributor/my-deals' },
    });

    dealsLatency.add(res.timings.duration);

    const ok = check(res, {
      'distributor deals: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'distributor deals: response time < 800ms': (r) => r.timings.duration < 800,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Deal by ID ──────────────────────────────────────────────────
  group('Get Deal by ID', () => {
    const res = http.get(`${BASE_URL}/deals/${TEST_DEAL_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals/:id' },
    });

    dealsLatency.add(res.timings.duration);

    const ok = check(res, {
      'deal by id: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'deal by id: response time < 800ms': (r) => r.timings.duration < 800,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get All Deals (ADMIN/SALTSOCIETY) ───────────────────────────────
  group('Get All Deals', () => {
    const res = http.get(`${BASE_URL}/deals?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals' },
    });

    dealsLatency.add(res.timings.duration);

    const ok = check(res, {
      'all deals: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'all deals: response time < 800ms': (r) => r.timings.duration < 800,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ═══════════════════════════════════════════════════════════════════
  // DISTRIBUTOR OFFERS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get My Distributor Offers (DISTRIBUTOR) ─────────────────────────
  group('Get My Distributor Offers', () => {
    const res = http.get(`${BASE_URL}/distributor-offers/my-offers?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /distributor-offers/my-offers' },
    });

    offersLatency.add(res.timings.duration);

    const ok = check(res, {
      'my offers: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'my offers: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get Distributor Offer by ID ─────────────────────────────────────
  group('Get Distributor Offer by ID', () => {
    const res = http.get(`${BASE_URL}/distributor-offers/${TEST_OFFER_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /distributor-offers/:id' },
    });

    offersLatency.add(res.timings.duration);

    const ok = check(res, {
      'offer by id: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'offer by id: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── Get All Distributor Offers ──────────────────────────────────────
  group('Get All Distributor Offers', () => {
    const res = http.get(`${BASE_URL}/distributor-offers?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /distributor-offers' },
    });

    offersLatency.add(res.timings.duration);

    const ok = check(res, {
      'all offers: status 200 or 401/403': (r) => [200, 401, 403].includes(r.status),
      'all offers: response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  const reportDir = 'apps/compass-service/test-output/performance';
  const profileName = __ENV.LOAD_PROFILE || 'smoke';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const title = `Compass Service - REST ${profileName.toUpperCase()} Test`;
  return {
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.html`]: htmlReport(data, { title }),
    [`${reportDir}/k6-rest-${profileName}-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: htmlReport(data, { title }),
  };
}
