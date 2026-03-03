import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Query, Req } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import {
  CreateJobDto,
  CreateJobResponseDto,
  GetJobResponseDto,
  GetJobsResponseDto,
  GetJobsQueryDto,
  UpdateJobDto,
  UpdateJobResponseDto,
  GetJobStatusResponseDto,
  JobType,
  JobStatus,
} from './dtos/jobs.dto';

@ApiTags('Waste Valorization Jobs')
@Controller('waste-valorization-jobs')
export class WasteValorizationController {
  private wasteValorizationJobService: any;
  private readonly logger = new Logger(WasteValorizationController.name);

  constructor(@Inject('WASTE_VALORIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.wasteValorizationJobService = this.client.getService('WasteValorizationJobService');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SALTSOCIETY)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Waste Valorization Job (landowner/salt society)' })
  @ApiBody({ type: CreateJobDto })
  @ApiResponse({ status: 201, description: 'Job created successfully', type: CreateJobResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to create job' })
  async createJob(@Body() body: CreateJobDto, @Req() req: any): Promise<CreateJobResponseDto> {
    try {
      // Map enum string to number for gRPC
      const jobTypeMap: Record<JobType, number> = {
        [JobType.WASTE_PREDICTION]: 0,
        [JobType.VALORIZATION_ANALYSIS]: 1,
        [JobType.OPTIMIZATION]: 2,
      };

      // Expect string enum in client; map to numeric for gRPC
      const jobTypeNumber = jobTypeMap[body.jobType as JobType];

      const payloadUserId = req.user?.userId || body.userId || null;
      const requestData = {
        userId: payloadUserId,
        jobType: jobTypeNumber,
        requestData: typeof body.requestData === 'string' ? body.requestData : JSON.stringify(body.requestData),
      };

      this.logger.debug(`CreateJob incoming body: ${JSON.stringify(body)}`);
      this.logger.debug(`CreateJob gRPC payload: ${JSON.stringify(requestData)}`);

      const result = await firstValueFrom(
        this.wasteValorizationJobService.CreateJob(requestData).pipe(
          catchError((error) => {
            this.logger.error('Create Job error', error);
            // include error detail when available
            const errMsg = error && error.message ? error.message : JSON.stringify(error);
            throw new HttpException(`Failed to create job: ${errMsg}`, HttpStatus.BAD_REQUEST);
          })
        )
      ) as CreateJobResponseDto;

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SALTSOCIETY)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get My Waste Valorization Jobs (landowner/salt society)' })
  @ApiQuery({ name: 'status', enum: JobStatus, required: false })
  @ApiQuery({ name: 'jobType', enum: JobType, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully', type: GetJobsResponseDto })
  async getMyJobs(@Query() query: GetJobsQueryDto, @Req() req: any): Promise<GetJobsResponseDto> {
    const userId = req.user.userId;

    try {
      // Map enum strings to numbers for gRPC
      const statusMap: Record<JobStatus, number> = {
        [JobStatus.PENDING]: 0,
        [JobStatus.PROCESSING]: 1,
        [JobStatus.COMPLETED]: 2,
        [JobStatus.FAILED]: 3,
      };

      const jobTypeMap: Record<JobType, number> = {
        [JobType.WASTE_PREDICTION]: 0,
        [JobType.VALORIZATION_ANALYSIS]: 1,
        [JobType.OPTIMIZATION]: 2,
      };

      const requestData: any = {
        userId,
        page: query.page || 1,
        limit: query.limit || 10,
      };

      if (query.status) {
        requestData.status = statusMap[query.status];
      }

      if (query.jobType) {
        requestData.jobType = jobTypeMap[query.jobType as JobType];
      }

      const result = await firstValueFrom(
        this.wasteValorizationJobService.GetJobs(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Jobs error: ${error.message}`);
            throw new HttpException('Failed to retrieve jobs', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetJobsResponseDto;

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SALTSOCIETY)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Waste Valorization Job by ID (landowner/salt society)' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully', type: GetJobResponseDto })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('id') id: string): Promise<GetJobResponseDto> {
    try {
      const result = await firstValueFrom(
        this.wasteValorizationJobService.GetJob({ id }).pipe(
          catchError((error) => {
            this.logger.error(`Get Job error: ${error.message}`);
            throw new HttpException('Failed to retrieve job', HttpStatus.NOT_FOUND);
          })
        )
      ) as GetJobResponseDto;

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SALTSOCIETY)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Waste Valorization Job Status (landowner/salt society)' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully', type: GetJobStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('id') id: string): Promise<GetJobStatusResponseDto> {
    try {
      const result = await firstValueFrom(
        this.wasteValorizationJobService.GetJobStatus({ id }).pipe(
          catchError((error) => {
            this.logger.error(`Get Job Status error: ${error.message}`);
            throw new HttpException('Failed to retrieve job status', HttpStatus.NOT_FOUND);
          })
        )
      ) as GetJobStatusResponseDto;

      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SALTSOCIETY)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Waste Valorization Job (landowner/salt society)' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiBody({ type: UpdateJobDto })
  @ApiResponse({ status: 200, description: 'Job updated successfully', type: UpdateJobResponseDto })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async updateJob(@Param('id') id: string, @Body() body: UpdateJobDto): Promise<UpdateJobResponseDto> {
    try {
      // Map enum string to number for gRPC
      const statusMap: Record<JobStatus, number> = {
        [JobStatus.PENDING]: 0,
        [JobStatus.PROCESSING]: 1,
        [JobStatus.COMPLETED]: 2,
        [JobStatus.FAILED]: 3,
      };

      const requestData: any = { id };

      if (body.status) {
        requestData.status = statusMap[body.status];
      }

      if (body.resultData) {
        requestData.resultData = typeof body.resultData === 'string' ? body.resultData : JSON.stringify(body.resultData);
      }

      if (body.errorMessage) {
        requestData.errorMessage = body.errorMessage;
      }

      const result = await firstValueFrom(
        this.wasteValorizationJobService.UpdateJob(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Update Job error: ${error.message}`);
            throw new HttpException('Failed to update job', HttpStatus.BAD_REQUEST);
          })
        )
      ) as UpdateJobResponseDto;

      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
