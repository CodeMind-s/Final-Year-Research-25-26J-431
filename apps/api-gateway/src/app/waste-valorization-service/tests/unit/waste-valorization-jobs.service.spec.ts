import { of, throwError } from 'rxjs';
import { WasteValorizationJobsService } from '../../waste-valorization-jobs.service';

describe('WasteValorizationJobsService', () => {
  let svc: WasteValorizationJobsService;
  let jobServiceMock: any;
  let managementServiceMock: any;

  beforeEach(() => {
    jobServiceMock = {
      CreateJob: jest.fn(),
      GetJobs: jest.fn(),
      GetJob: jest.fn(),
      GetJobStatus: jest.fn(),
      UpdateJob: jest.fn(),
    };

    managementServiceMock = {
      GetWastePredictions: jest.fn(),
      QuickPrediction: jest.fn(),
    };

    svc = new WasteValorizationJobsService(jobServiceMock, managementServiceMock, { debug: () => {}, error: () => {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createJob maps and forwards request to gRPC', async () => {
    const body = { jobType: 'WASTE_PREDICTION', predictionDate: '2026-01-01', requestData: { a: 1 } } as any;
    jobServiceMock.CreateJob.mockReturnValueOnce(of({ success: true, data: { jobId: 'j1' } }));

    const res = await svc.createJob(body, { user: { userId: 'u1' } } as any);
    expect(jobServiceMock.CreateJob).toHaveBeenCalledTimes(1);
    const calledArg = jobServiceMock.CreateJob.mock.calls[0][0];
    expect(calledArg.jobType).toBe(0);
    expect(calledArg.userId).toBe('u1');
    expect(typeof calledArg.requestData).toBe('string');
    expect(res).toEqual({ success: true, data: { jobId: 'j1' } });
  });

  it('getMyJobs maps filters and calls GetJobs', async () => {
    jobServiceMock.GetJobs.mockReturnValueOnce(of({ success: true, data: [] }));
    const res = await svc.getMyJobs({ status: 'PROCESSING', jobType: 'OPTIMIZATION', page: 2, limit: 5 } as any, { user: { userId: 'u2' } } as any);
    expect(jobServiceMock.GetJobs).toHaveBeenCalledTimes(1);
    const arg = jobServiceMock.GetJobs.mock.calls[0][0];
    expect(arg.userId).toBe('u2');
    expect(arg.status).toBe(1);
    expect(arg.jobType).toBe(2);
    expect(res.success).toBe(true);
  });

  it('quickPrediction parses response data', async () => {
    managementServiceMock.QuickPrediction.mockReturnValueOnce(of({ success: true, data: JSON.stringify({ jobId: 'jid' }), timestamp: 'ts' }));
    const body = { production_volume: 1, rain_sum: 0, temperature_mean: 1, humidity_mean: 1, wind_speed_mean: 1 } as any;
    const res = await svc.quickPrediction(body, { user: { userId: 'u1' } } as any);
    expect(managementServiceMock.QuickPrediction).toHaveBeenCalledTimes(1);
    expect(res.data.jobId).toBe('jid');
  });

  it('getQuickPredictionStatus builds correct pending response', async () => {
    const jobData = { _id: 'id1', status: 1 };
    jobServiceMock.GetJob.mockReturnValueOnce(of({ success: true, data: jobData }));
    const res = await svc.getQuickPredictionStatus('id1');
    expect(res.success).toBe(true);
    expect(res.data.jobId).toBe('id1');
    expect(res.data.message).toContain('being calculated');
  });

  it('createJob throws when gRPC returns an error', async () => {
    jobServiceMock.CreateJob.mockReturnValueOnce({ pipe: () => throwError(() => new Error('grpc fail')) });
    await expect(svc.createJob({ jobType: 'WASTE_PREDICTION', requestData: {} } as any, { user: { userId: 'u1' } } as any)).rejects.toThrow();
  });

  it('quickPrediction handles invalid JSON in gRPC response', async () => {
    managementServiceMock.QuickPrediction.mockReturnValueOnce(of({ success: true, data: 'not-json', timestamp: 'ts' }));
    const body = { production_volume: 1, rain_sum: 0, temperature_mean: 1, humidity_mean: 1, wind_speed_mean: 1 } as any;
    const res = await svc.quickPrediction(body, { user: { userId: 'u1' } } as any);
    expect(res.data.jobId).toBeNull();
    expect(res.data.status).toBe('FAILED');
  });

  it('getQuickPredictionStatus throws when job not found', async () => {
    jobServiceMock.GetJob.mockReturnValueOnce(of({ success: false, data: null }));
    await expect(svc.getQuickPredictionStatus('nope')).rejects.toThrow();
  });

  it('createJob uses body.userId when req.user is missing', async () => {
    jobServiceMock.CreateJob.mockReturnValueOnce(of({ success: true, data: { jobId: 'j2' } }));
    const res = await svc.createJob({ jobType: 'WASTE_PREDICTION', requestData: {}, userId: 'fromBody' } as any, {} as any);
    const calledArg = jobServiceMock.CreateJob.mock.calls[0][0];
    expect(calledArg.userId).toBe('fromBody');
    expect(res.data.jobId).toBe('j2');
  });

  it('getJob returns job result from gRPC', async () => {
    jobServiceMock.GetJob.mockReturnValueOnce(of({ success: true, data: { _id: 'g1' } }));
    const res = await svc.getJob('g1');
    expect(jobServiceMock.GetJob).toHaveBeenCalledWith({ id: 'g1' });
    expect(res.data._id).toBe('g1');
  });

  it('getJobStatus returns status result from gRPC', async () => {
    jobServiceMock.GetJobStatus.mockReturnValueOnce(of({ success: true, data: { _id: 's1', status: 2 } }));
    const res = await svc.getJobStatus('s1');
    expect(jobServiceMock.GetJobStatus).toHaveBeenCalledWith({ id: 's1' });
    expect(res.data.status).toBe(2);
  });

  it('updateJob maps fields and calls UpdateJob', async () => {
    jobServiceMock.UpdateJob.mockReturnValueOnce(of({ success: true, data: { _id: 'u1' } }));
    const res = await svc.updateJob('u1', { status: 'COMPLETED', resultData: { a: 1 } } as any);
    expect(jobServiceMock.UpdateJob).toHaveBeenCalledTimes(1);
    const arg = jobServiceMock.UpdateJob.mock.calls[0][0];
    expect(arg.id).toBe('u1');
    expect(arg.status).toBe(2);
    expect(typeof arg.resultData).toBe('string');
    expect(res.success).toBe(true);
  });
});
