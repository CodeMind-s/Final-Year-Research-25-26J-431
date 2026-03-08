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
    compass_harvest_plans_duration: ['p(95)<2000'],
    compass_deals_duration: ['p(95)<2000'],
    compass_offers_duration: ['p(95)<2000'],
    compass_errors: ['rate<0.15'],
    http_req_failed: ['rate<0.85'],
  },
  tags: {
    testSuite: 'compass-rest',
  },
};

export default function () {
  // ═══════════════════════════════════════════════════════════════════
  // HARVEST PLANS
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // HARVEST PLANS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get My Harvest Plans (requires LANDOWNER role — 403 expected with SUPERADMIN)
  group('Get My Harvest Plans', () => {
    const res = http.get(`${BASE_URL}/harvest-plans/my-plans?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /harvest-plans/my-plans' },
    });

    harvestPlansLatency.add(res.timings.duration);

    check(res, {
      'my plans: server responded': (r) => r.status !== 0,
      'my plans: response time < 500ms': (r) => r.timings.duration < 500,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Harvest Plan by ID (requires LANDOWNER role — 403 expected with SUPERADMIN)
  group('Get Harvest Plan by ID', () => {
    const res = http.get(`${BASE_URL}/harvest-plans/${TEST_PLAN_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /harvest-plans/:id' },
    });

    harvestPlansLatency.add(res.timings.duration);

    check(res, {
      'plan by id: server responded': (r) => r.status !== 0,
      'plan by id: response time < 500ms': (r) => r.timings.duration < 500,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get All Harvest Plans (ADMIN/SUPERADMIN — 200 expected) ────────
  group('Get All Harvest Plans', () => {
    const res = http.get(`${BASE_URL}/harvest-plans?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /harvest-plans' },
    });

    harvestPlansLatency.add(res.timings.duration);

    const ok = check(res, {
      'all plans: status 200': (r) => r.status === 200,
      'all plans: response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ═══════════════════════════════════════════════════════════════════
  // DEALS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get Landowner Deals (requires LANDOWNER role — 403 expected with SUPERADMIN)
  group('Get Landowner Deals', () => {
    const res = http.get(`${BASE_URL}/deals/landowner/my-deals?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals/landowner/my-deals' },
    });

    dealsLatency.add(res.timings.duration);

    check(res, {
      'landowner deals: server responded': (r) => r.status !== 0,
      'landowner deals: response time < 800ms': (r) => r.timings.duration < 800,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Distributor Deals (requires DISTRIBUTOR role — 403 expected with SUPERADMIN)
  group('Get Distributor Deals', () => {
    const res = http.get(`${BASE_URL}/deals/distributor/my-deals?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals/distributor/my-deals' },
    });

    dealsLatency.add(res.timings.duration);

    check(res, {
      'distributor deals: server responded': (r) => r.status !== 0,
      'distributor deals: response time < 800ms': (r) => r.timings.duration < 800,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Deal by ID (requires LANDOWNER/DISTRIBUTOR — 403 expected with SUPERADMIN)
  group('Get Deal by ID', () => {
    const res = http.get(`${BASE_URL}/deals/${TEST_DEAL_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals/:id' },
    });

    dealsLatency.add(res.timings.duration);

    check(res, {
      'deal by id: server responded': (r) => r.status !== 0,
      'deal by id: response time < 800ms': (r) => r.timings.duration < 800,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get All Deals (ADMIN/SUPERADMIN — 200 expected) ────────────────
  group('Get All Deals', () => {
    const res = http.get(`${BASE_URL}/deals?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /deals' },
    });

    dealsLatency.add(res.timings.duration);

    const ok = check(res, {
      'all deals: status 200': (r) => r.status === 200,
      'all deals: response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    errorRate.add(!ok);
  });

  sleep(0.5);

  // ═══════════════════════════════════════════════════════════════════
  // DISTRIBUTOR OFFERS
  // ═══════════════════════════════════════════════════════════════════

  // ── Get My Distributor Offers (requires DISTRIBUTOR role — 403 expected with SUPERADMIN)
  group('Get My Distributor Offers', () => {
    const res = http.get(`${BASE_URL}/distributor-offers/my-offers?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /distributor-offers/my-offers' },
    });

    offersLatency.add(res.timings.duration);

    check(res, {
      'my offers: server responded': (r) => r.status !== 0,
      'my offers: response time < 500ms': (r) => r.timings.duration < 500,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get Distributor Offer by ID (requires DISTRIBUTOR role — 403 expected with SUPERADMIN)
  group('Get Distributor Offer by ID', () => {
    const res = http.get(`${BASE_URL}/distributor-offers/${TEST_OFFER_ID}`, {
      headers: defaultHeaders,
      tags: { name: 'GET /distributor-offers/:id' },
    });

    offersLatency.add(res.timings.duration);

    check(res, {
      'offer by id: server responded': (r) => r.status !== 0,
      'offer by id: response time < 500ms': (r) => r.timings.duration < 500,
    });
    // Role-restricted endpoint — don't count 403 as error
  });

  sleep(0.5);

  // ── Get All Distributor Offers (ADMIN/SUPERADMIN — 200 expected) ───
  group('Get All Distributor Offers', () => {
    const res = http.get(`${BASE_URL}/distributor-offers?page=1&limit=10`, {
      headers: defaultHeaders,
      tags: { name: 'GET /distributor-offers' },
    });

    offersLatency.add(res.timings.duration);

    const ok = check(res, {
      'all offers: status 200': (r) => r.status === 200,
      'all offers: response time < 2000ms': (r) => r.timings.duration < 2000,
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
