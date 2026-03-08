import { firstValueFrom, catchError } from 'rxjs';
import { HttpException } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import {
  toGrpcJobType,
  toGrpcJobStatus,
  parseGrpcJson,
  buildQuickPredictionStatus,
} from './waste-valorization.utils';

export class WasteValorizationJobsService {
  constructor(private jobService: any, private managementService: any, private logger: any = console) {}

  async createJob(body: any, req: any): Promise<any> {
    try {
      const jobTypeNumber = toGrpcJobType(body.jobType as any);

      const payloadUserId = req.user?.userId || body.userId || null;
      const requestData = {
        userId: payloadUserId,
        jobType: jobTypeNumber,
        predictionDate: body.predictionDate,
        requestData: typeof body.requestData === 'string' ? body.requestData : JSON.stringify(body.requestData),
      };

      const result = await firstValueFrom(
        this.jobService.CreateJob(requestData).pipe(
          catchError((error: any) => {
            const errMsg = error && error.message ? error.message : JSON.stringify(error);
            throw new HttpException(`Failed to create job: ${errMsg}`, HttpStatus.BAD_REQUEST);
          })
        )
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  async getMyJobs(query: any, req: any): Promise<any> {
    const userId = req.user.userId;
    try {
      const requestData: any = {
        userId,
        page: query.page || 1,
        limit: query.limit || 10,
      };

      if (query.status) {
        requestData.status = toGrpcJobStatus(query.status as any);
      }

      if (query.jobType) {
        requestData.jobType = toGrpcJobType(query.jobType as any);
      }

      const result = await firstValueFrom(
        this.jobService.GetJobs(requestData).pipe(
          catchError((error: any) => {
            throw new HttpException('Failed to retrieve jobs', HttpStatus.BAD_REQUEST);
          })
        )
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  async getQuickPredictionStatus(jobId: string): Promise<any> {
    try {
      const result: any = await firstValueFrom(
        this.jobService.GetJob({ id: jobId }).pipe(
          catchError((error: any) => {
            throw new HttpException('Job not found or failed to retrieve', HttpStatus.NOT_FOUND);
          })
        )
      );

      if (!result.success || !result.data) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      const jobData = result.data;
      const response = buildQuickPredictionStatus(jobData);
      response.timestamp = new Date().toISOString();
      return response;
    } catch (error: any) {
      throw error;
    }
  }

  async getJob(id: string): Promise<any> {
    try {
      const result: any = await firstValueFrom(
        this.jobService.GetJob({ id }).pipe(
          catchError((error: any) => {
            throw new HttpException('Failed to retrieve job', HttpStatus.NOT_FOUND);
          })
        )
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  async getJobStatus(id: string): Promise<any> {
    try {
      const result: any = await firstValueFrom(
        this.jobService.GetJobStatus({ id }).pipe(
          catchError((error: any) => {
            throw new HttpException('Failed to retrieve job status', HttpStatus.NOT_FOUND);
          })
        )
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  async updateJob(id: string, body: any): Promise<any> {
    try {
      const requestData: any = { id };

      if (body.status) {
        requestData.status = toGrpcJobStatus(body.status as any);
      }

      if (body.predictionDate) {
        requestData.predictionDate = body.predictionDate;
      }

      if (body.resultData) {
        requestData.resultData = typeof body.resultData === 'string' ? body.resultData : JSON.stringify(body.resultData);
      }

      if (body.errorMessage) {
        requestData.errorMessage = body.errorMessage;
      }

      const result: any = await firstValueFrom(
        this.jobService.UpdateJob(requestData).pipe(
          catchError((error: any) => {
            throw new HttpException('Failed to update job', HttpStatus.BAD_REQUEST);
          })
        )
      );

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  async quickPrediction(body: any, req: any): Promise<any> {
    try {
      const requestData = {
        production_volume: body.production_volume,
        rain_sum: body.rain_sum,
        temperature_mean: body.temperature_mean,
        humidity_mean: body.humidity_mean,
        wind_speed_mean: body.wind_speed_mean,
      };

      const result: any = await firstValueFrom(
        this.managementService.QuickPrediction(requestData).pipe(
          catchError((error: any) => {
            const errMsg = error && error.message ? error.message : JSON.stringify(error);
            throw new HttpException(`Failed to create prediction job: ${errMsg}`, HttpStatus.BAD_REQUEST);
          })
        )
      );

      const parsedData = parseGrpcJson(result.data, '{"jobId":null,"status":"FAILED"}');

      return {
        success: result.success,
        data: parsedData,
        timestamp: result.timestamp,
      };
    } catch (error: any) {
      throw error;
    }
  }
}
