import 'reflect-metadata';
import { of, firstValueFrom } from 'rxjs';
import {
  toGrpcJobType,
  parseGrpcJson,
  buildQuickPredictionStatus,
} from '../../waste-valorization.utils';

describe('WasteValorization integration (controller-like flows)', () => {
  const jobServiceMock = {
    CreateJob: jest.fn(),
    GetJobs: jest.fn(),
    GetJob: jest.fn(),
    GetJobStatus: jest.fn(),
    UpdateJob: jest.fn(),
  };

  const managementServiceMock = {
    GetWastePredictions: jest.fn(),
    QuickPrediction: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  it('createJob-like flow: maps jobType and calls gRPC', async () => {
    const body = { jobType: 'WASTE_PREDICTION', predictionDate: '2026-01-01', requestData: { x: 1 } } as any;
    jobServiceMock.CreateJob.mockReturnValueOnce(of({ success: true, data: { jobId: 'int-j1' } }));

    // controller mapping logic
    const jobTypeNumber = toGrpcJobType(body.jobType as any);
    const requestData = {
      userId: 'int-user',
      jobType: jobTypeNumber,
      predictionDate: body.predictionDate,
      requestData: JSON.stringify(body.requestData),
    };

    const result = await jobServiceMock.CreateJob(requestData).toPromise?.() ?? (await jobServiceMock.CreateJob(requestData).toPromise());
    expect(jobServiceMock.CreateJob).toHaveBeenCalledWith(requestData);
    expect(result.data.jobId).toBe('int-j1');
  });

  it('quickPrediction-like flow: calls management service and parses JSON', async () => {
    managementServiceMock.QuickPrediction.mockReturnValueOnce(of({ success: true, data: JSON.stringify({ jobId: 'q1' }), timestamp: 'ts' }));
    const body = { production_volume: 1, rain_sum: 0, temperature_mean: 1, humidity_mean: 1, wind_speed_mean: 1 } as any;

    const requestData = {
      production_volume: body.production_volume,
      rain_sum: body.rain_sum,
      temperature_mean: body.temperature_mean,
      humidity_mean: body.humidity_mean,
      wind_speed_mean: body.wind_speed_mean,
    };

    const res: any = await managementServiceMock.QuickPrediction(requestData).toPromise?.() ?? (await managementServiceMock.QuickPrediction(requestData).toPromise());
    const parsed = parseGrpcJson(res.data, '{"jobId":null,"status":"FAILED"}');
    expect(managementServiceMock.QuickPrediction).toHaveBeenCalledWith(requestData);
    expect(parsed.jobId).toBe('q1');
  });

  it('getQuickPredictionStatus-like flow: builds status from job data', async () => {
    const jobData = { _id: 'jid', status: 2, resultData: JSON.stringify({ pred: 7 }) } as any;
    jobServiceMock.GetJob.mockReturnValueOnce(of({ success: true, data: jobData }));

    const res: any = await firstValueFrom(jobServiceMock.GetJob({ id: 'jid' }));
    expect(jobServiceMock.GetJob).toHaveBeenCalledWith({ id: 'jid' });
    const response = buildQuickPredictionStatus(res.data);
    expect(response.data.prediction).toEqual({ pred: 7 });
  });
});
