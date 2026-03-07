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
import {
  GetWastePredictionsQueryDto,
  GetWastePredictionsResponseDto,
  QuickPredictionDto,
  QuickPredictionResponseDto,
} from './dtos/waste-management.dto';

@ApiTags('Waste Valorization Jobs')
@Controller('waste-valorization-jobs')
export class WasteValorizationController {
  private wasteValorizationJobService: any;
  private wasteValorizationManagementService: any;
  private readonly logger = new Logger(WasteValorizationController.name);

  constructor(@Inject('WASTE_VALORIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.wasteValorizationJobService = this.client.getService('WasteValorizationJobService');
    this.wasteValorizationManagementService = this.client.getService('WasteValorizationManagementService');
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
        predictionDate: body.predictionDate,
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

      if (body.predictionDate) {
        requestData.predictionDate = body.predictionDate;
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

// New controller for waste management dashboard under salt-society prefix
@ApiTags('Salt Society - Waste Management')
@Controller('salt-society/waste-management')
export class WasteManagementDashboardController {
  private wasteValorizationManagementService: any;
  private wasteValorizationJobService: any;
  private readonly logger = new Logger(WasteManagementDashboardController.name);

  constructor(@Inject('WASTE_VALORIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.wasteValorizationManagementService = this.client.getService('WasteValorizationManagementService');
    this.wasteValorizationJobService = this.client.getService('WasteValorizationJobService');
  }

  @Get('predictions')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SALTSOCIETY, Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Waste Predictions Dashboard Data (Salt Society)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD), defaults to 30 days ago' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD), defaults to 14 days in future' })
  @ApiQuery({ name: 'includeAverages', required: false, type: Boolean, description: 'Include averages, defaults to true' })
  @ApiResponse({ status: 200, description: 'Predictions retrieved successfully', type: GetWastePredictionsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid date format or range' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getWastePredictions(
    @Query() query: GetWastePredictionsQueryDto,
    @Req() req: any
  ): Promise<GetWastePredictionsResponseDto> {
    try {
      const requestData = {
        startDate: query.startDate || '',
        endDate: query.endDate || '',
        includeAverages: query.includeAverages !== undefined ? query.includeAverages : true,
        userId: req.user?.userId || '',
      };

      this.logger.debug(`GetWastePredictions request: ${JSON.stringify(requestData)}`);

      const result: any = await firstValueFrom(
        this.wasteValorizationManagementService.GetWastePredictions(requestData).pipe(
          catchError((error) => {
            this.logger.error('Get Waste Predictions error', error);
            const errMsg = error && error.message ? error.message : JSON.stringify(error);
            throw new HttpException(`Failed to get predictions: ${errMsg}`, HttpStatus.BAD_REQUEST);
          })
        )
      );

      // Parse the JSON data from the gRPC response
      const parsedData = JSON.parse(result.data || '{"predictions":[]}');

      return {
        success: result.success,
        data: parsedData,
        timestamp: result.timestamp,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get waste predictions: ${error.message}`);
      throw error;
    }
  }

  @Post('quick-prediction')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SALTSOCIETY, Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create Quick Waste Prediction Job (Salt Society)',
    description: 'Creates an async job for waste prediction. Returns jobId to poll for results using /waste-valorization-jobs/:id endpoint.'
  })
  @ApiBody({ type: QuickPredictionDto })
  @ApiResponse({ status: 200, description: 'Prediction job created successfully', type: QuickPredictionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async quickPrediction(
    @Body() body: QuickPredictionDto,
    @Req() req: any
  ): Promise<QuickPredictionResponseDto> {
    try {
      const requestData = {
        production_volume: body.production_volume,
        rain_sum: body.rain_sum,
        temperature_mean: body.temperature_mean,
        humidity_mean: body.humidity_mean,
        wind_speed_mean: body.wind_speed_mean,
      };

      this.logger.debug(`QuickPrediction request: ${JSON.stringify(requestData)}`);  

      const result: any = await firstValueFrom(
        this.wasteValorizationManagementService.QuickPrediction(requestData).pipe(
          catchError((error) => {
            this.logger.error('Quick Prediction error', error);
            const errMsg = error && error.message ? error.message : JSON.stringify(error);
            throw new HttpException(`Failed to create prediction job: ${errMsg}`, HttpStatus.BAD_REQUEST);
          })
        )
      );

      // Parse the JSON data from the gRPC response
      const parsedData = JSON.parse(result.data || '{"jobId":null,"status":"FAILED"}');

      return {
        success: result.success,
        data: parsedData,
        timestamp: result.timestamp,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create quick prediction job: ${error.message}`);
      throw error;
    }
  }

  @Get('quick-prediction/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SALTSOCIETY, Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get Quick Prediction Job Status (Salt Society)',
    description: 'Check the status and results of a quick prediction job. Returns prediction data when job is completed.'
  })
  @ApiParam({ name: 'jobId', description: 'Job ID returned from quick prediction submission' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getQuickPredictionStatus(
    @Param('jobId') jobId: string,
    @Req() req: any
  ): Promise<any> {
    try {
      const result: any = await firstValueFrom(
        this.wasteValorizationJobService.GetJob({ id: jobId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Job error: ${error.message}`);
            throw new HttpException('Job not found or failed to retrieve', HttpStatus.NOT_FOUND);
          })
        )
      );

      if (!result.success || !result.data) {
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      // Parse the job data
      const jobData = result.data;
      
      // Map status number to string
      const statusMap: Record<number, string> = {
        0: 'pending',
        1: 'processing',
        2: 'completed',
        3: 'failed',
      };
      
      const status = statusMap[jobData.status] || 'pending';

      // If job is still processing or pending
      if (status === 'pending' || status === 'processing') {
        return {
          success: true,
          data: {
            jobId: jobData._id,
            status: status,
            message: 'Prediction is being calculated. Please check again in a few seconds.',
            progress: status === 'processing' ? 65 : 10,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // If job failed
      if (status === 'failed') {
        return {
          success: false,
          error: {
            code: 'PREDICTION_FAILED',
            message: jobData.errorMessage || 'ML model processing failed. Please try again.',
            details: jobData.errorMessage || 'Model inference timeout or invalid input parameters',
          },
          timestamp: new Date().toISOString(),
        };
      }

      // If job is completed
      let predictionData = null;
      if (jobData.resultData) {
        try {
          const parsedResult = typeof jobData.resultData === 'string' 
            ? JSON.parse(jobData.resultData) 
            : jobData.resultData;
          predictionData = parsedResult;
        } catch (e) {
          this.logger.error(`Failed to parse result data: ${e}`);
        }
      }

      return {
        success: true,
        data: {
          jobId: jobData._id,
          status: 'completed',
          prediction: predictionData,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Failed to get quick prediction status: ${error.message}`);
      throw error;
    }
  }
}
