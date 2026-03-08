import {
  toGrpcJobType,
  toGrpcJobStatus,
  parseGrpcJson,
  mapJobStatusNumberToString,
  buildQuickPredictionStatus,
} from '../../waste-valorization.utils';

describe('waste-valorization.utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('toGrpcJobType', () => {
    it('maps known job types to numbers', () => {
      expect(toGrpcJobType('WASTE_PREDICTION')).toBe(0);
      expect(toGrpcJobType('VALORIZATION_ANALYSIS')).toBe(1);
      expect(toGrpcJobType('OPTIMIZATION')).toBe(2);
    });

    it('returns undefined for unknown types', () => {
      expect(toGrpcJobType('UNKNOWN')).toBeUndefined();
    });
  });

  describe('toGrpcJobStatus', () => {
    it('maps status strings to numbers', () => {
      expect(toGrpcJobStatus('PENDING')).toBe(0);
      expect(toGrpcJobStatus('PROCESSING')).toBe(1);
      expect(toGrpcJobStatus('COMPLETED')).toBe(2);
      expect(toGrpcJobStatus('FAILED')).toBe(3);
    });
  });

  describe('parseGrpcJson', () => {
    it('parses JSON string', () => {
      expect(parseGrpcJson('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns default for invalid JSON', () => {
      expect(parseGrpcJson('notjson', '{"fallback":true}')).toEqual({ fallback: true });
    });
  });

  describe('mapJobStatusNumberToString', () => {
    it('maps numbers to strings', () => {
      expect(mapJobStatusNumberToString(0)).toBe('pending');
      expect(mapJobStatusNumberToString(1)).toBe('processing');
      expect(mapJobStatusNumberToString(2)).toBe('completed');
      expect(mapJobStatusNumberToString(3)).toBe('failed');
    });
  });

  describe('buildQuickPredictionStatus', () => {
    it('returns pending/processing structure', () => {
      const job = { _id: 'j1', status: 1 };
      const res = buildQuickPredictionStatus(job);
      expect(res.success).toBe(true);
      expect(res.data.jobId).toBe('j1');
      expect(res.data.progress).toBe(65);
    });

    it('returns failed structure', () => {
      const job = { _id: 'j2', status: 3, errorMessage: 'err' };
      const res = buildQuickPredictionStatus(job);
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('PREDICTION_FAILED');
    });

    it('returns completed and parsed prediction data', () => {
      const job = { _id: 'j3', status: 2, resultData: JSON.stringify({ pred: 42 }) };
      const res = buildQuickPredictionStatus(job);
      expect(res.success).toBe(true);
      expect(res.data.prediction).toEqual({ pred: 42 });
    });
  });
});
