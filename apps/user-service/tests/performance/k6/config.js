// Shared k6 configuration for user service load tests

export const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3400/api/v1';
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const defaultHeaders = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
};

// Load profiles
export const smokeTest = {
  vus: 1,
  duration: '30s',
};

export const averageLoad = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 0 },
  ],
};

export const stressTest = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 15 },
    { duration: '1m', target: 15 },
    { duration: '30s', target: 0 },
  ],
};

export const spikeTest = {
  stages: [
    { duration: '10s', target: 2 },
    { duration: '5s', target: 15 },
    { duration: '30s', target: 15 },
    { duration: '5s', target: 2 },
    { duration: '30s', target: 2 },
    { duration: '10s', target: 0 },
  ],
};

// Thresholds
export const defaultThresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.05'],
};

export const healthThresholds = {
  http_req_duration: ['p(95)<200', 'p(99)<500'],
  http_req_failed: ['rate<0.01'],
};
