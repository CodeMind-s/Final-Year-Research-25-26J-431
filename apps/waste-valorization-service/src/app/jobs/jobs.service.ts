import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobStatus, JobType } from './schemas/job.schema';
import { SqsService } from '../sqs/sqs.service';
import type {
  CreateJobDto,
  CreateJobResponseDto,
  GetJobDto,
  GetJobResponseDto,
  GetJobsDto,
  GetJobsResponseDto,
  UpdateJobDto,
  UpdateJobResponseDto,
  GetJobStatusDto,
  GetJobStatusResponseDto,
  JobResponseData,
} from './dtos/jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<Job>,
    private readonly sqsService: SqsService
  ) {}

  // Map enum number to string
  private mapJobTypeToEnum(jobType: number): JobType {
    const mapping: Record<number, JobType> = {
      0: JobType.WASTE_PREDICTION,
      1: JobType.VALORIZATION_ANALYSIS,
      2: JobType.OPTIMIZATION,
    };
    return mapping[jobType] || JobType.WASTE_PREDICTION;
  }

  private mapJobStatusToEnum(status: number): JobStatus {
    const mapping: Record<number, JobStatus> = {
      0: JobStatus.PENDING,
      1: JobStatus.PROCESSING,
      2: JobStatus.COMPLETED,
      3: JobStatus.FAILED,
    };
    return mapping[status] || JobStatus.PENDING;
  }

  // Map enum string to number
  private mapJobTypeToNumber(jobType: JobType): number {
    const mapping = {
      [JobType.WASTE_PREDICTION]: 0,
      [JobType.VALORIZATION_ANALYSIS]: 1,
      [JobType.OPTIMIZATION]: 2,
    };
    return mapping[jobType] || 0;
  }

  private mapJobStatusToNumber(status: JobStatus): number {
    const mapping = {
      [JobStatus.PENDING]: 0,
      [JobStatus.PROCESSING]: 1,
      [JobStatus.COMPLETED]: 2,
      [JobStatus.FAILED]: 3,
    };
    return mapping[status] || 0;
  }

  private formatJobResponse(job: Job & { createdAt?: Date; updatedAt?: Date }): JobResponseData {
    return {
      _id: job._id.toString(),
      userId: job.userId,
      jobType: this.mapJobTypeToNumber(job.jobType),
      status: this.mapJobStatusToNumber(job.status),
      predictionDate: job.predictionDate,
      requestData: JSON.stringify(job.requestData),
      resultData: job.resultData ? JSON.stringify(job.resultData) : undefined,
      errorMessage: job.errorMessage || undefined,
      createdAt: job.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: job.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async createJob(data: CreateJobDto): Promise<CreateJobResponseDto> {
    try {
      // Validate and parse request data
      let requestData: Record<string, unknown> = {};
      if (typeof data.requestData === 'string') {
        try {
          requestData = JSON.parse(data.requestData);
        } catch {
          throw new BadRequestException('Invalid JSON in requestData');
        }
      } else {
        requestData = data.requestData || {};
      }

      // Create job
      const job = new this.jobModel({
        userId: data.userId,
        jobType: this.mapJobTypeToEnum(data.jobType),
        status: JobStatus.PENDING,
        predictionDate: data.predictionDate,
        requestData: requestData,
        metadata: null,
        resultData: null,
        errorMessage: null,
      });

      await job.save();

      // Ensure metadata.request_id is the persisted job id
      job.metadata = { request_id: job._id.toString() } as any;
      await job.save();

      // Send message to SQS asynchronously (don't wait for it)
      this.sqsService.sendJobCreatedMessage({
        jobId: job._id.toString(),
        userId: job.userId,
        jobType: this.mapJobTypeToEnum(data.jobType),
        predictionDate: job.predictionDate,
        requestData: job.requestData,
      }).catch((error) => {
        // Log error but don't fail the request
        console.error('Failed to send SQS message:', error);
      });

      return {
        success: true,
        message: 'Job created successfully',
        data: this.formatJobResponse(job),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return {
        success: false,
        message: error.message || 'Failed to create job',
      };
    }
  }

  async getJob(data: GetJobDto): Promise<GetJobResponseDto> {
    try {
      const job = await this.jobModel.findById(data.id);

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      return {
        success: true,
        message: 'Job retrieved successfully',
        data: this.formatJobResponse(job),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        message: error.message || 'Failed to retrieve job',
      };
    }
  }

  async getJobs(data: GetJobsDto): Promise<GetJobsResponseDto> {
    try {
      const page = data.page || 1;
      const limit = data.limit || 10;
      const skip = (page - 1) * limit;

      // Build query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = {};
      if (data.userId) {
        query.userId = data.userId;
      }

      // Execute query
      const [jobs, total] = await Promise.all([
        this.jobModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
        this.jobModel.countDocuments(query),
      ]);

      return {
        success: true,
        message: 'Jobs retrieved successfully',
        data: jobs.map((job) => this.formatJobResponse(job)),
        total,
        page,
        limit,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve jobs',
        data: [],
        total: 0,
        page: data.page || 1,
        limit: data.limit || 10,
      };
    }
  }

  async updateJob(data: UpdateJobDto): Promise<UpdateJobResponseDto> {
    try {
      const job = await this.jobModel.findById(data.id);

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      // Update fields
      if (data.status !== undefined && data.status !== null) {
        job.status = this.mapJobStatusToEnum(data.status);
      }
      if (data.predictionDate) {
        job.predictionDate = data.predictionDate;
      }
      if (data.resultData) {
        if (typeof data.resultData === 'string') {
          try {
            job.resultData = JSON.parse(data.resultData);
          } catch {
            throw new BadRequestException('Invalid JSON in resultData');
          }
        } else {
          job.resultData = data.resultData;
        }
      }
      if (data.errorMessage) {
        job.errorMessage = data.errorMessage;
      }

      await job.save();

      return {
        success: true,
        message: 'Job updated successfully',
        data: this.formatJobResponse(job),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      return {
        success: false,
        message: error.message || 'Failed to update job',
      };
    }
  }

  async getJobStatus(data: GetJobStatusDto): Promise<GetJobStatusResponseDto> {
    try {
      const job = await this.jobModel.findById(data.id);

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      return {
        success: true,
        message: 'Job status retrieved successfully',
        jobId: job._id.toString(),
        status: this.mapJobStatusToNumber(job.status),
        resultData: job.resultData ? JSON.stringify(job.resultData) : undefined,
        errorMessage: job.errorMessage || undefined,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        message: error.message || 'Failed to retrieve job status',
      };
    }
  }
}
