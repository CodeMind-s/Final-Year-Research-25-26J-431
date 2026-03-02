import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { JobsService } from './jobs.service';
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
} from './dtos/jobs.dto';

@Controller('WasteValorizationJob')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @GrpcMethod('WasteValorizationJobService', 'CreateJob')
  async CreateJob(data: CreateJobDto): Promise<CreateJobResponseDto> {
    return this.jobsService.createJob(data);
  }

  @GrpcMethod('WasteValorizationJobService', 'GetJob')
  async GetJob(data: GetJobDto): Promise<GetJobResponseDto> {
    return this.jobsService.getJob(data);
  }

  @GrpcMethod('WasteValorizationJobService', 'GetJobs')
  async GetJobs(data: GetJobsDto): Promise<GetJobsResponseDto> {
    return this.jobsService.getJobs(data);
  }

  @GrpcMethod('WasteValorizationJobService', 'UpdateJob')
  async UpdateJob(data: UpdateJobDto): Promise<UpdateJobResponseDto> {
    return this.jobsService.updateJob(data);
  }

  @GrpcMethod('WasteValorizationJobService', 'GetJobStatus')
  async GetJobStatus(data: GetJobStatusDto): Promise<GetJobStatusResponseDto> {
    return this.jobsService.getJobStatus(data);
  }
}
