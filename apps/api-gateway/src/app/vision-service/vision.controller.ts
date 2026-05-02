import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { RequirePlan } from '../auth/decorators/plan.decorator';
import {
  DetectionFilterDto,
  BatchFilterDto,
  StatsSummaryQueryDto,
  StatsHourlyQueryDto,
  StatsDailyQueryDto,
  StatsTrendsQueryDto,
} from './dtos/detection-filter.dto';
import {
  CreateSessionDto,
  CreateBatchDto,
  SaveDetectionDto,
} from './dtos/vision-write.dto';

@ApiTags('Vision')
@ApiBearerAuth()
@Roles(Role.LABORATORY)
@Controller('vision')
export class VisionController {
  private visionService: any;
  private readonly logger = new Logger(VisionController.name);

  constructor(@Inject('VISION_PACKAGE') private client: ClientGrpcProxy) {
    this.visionService = this.client.getService('VisionService');
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Get vision service health status' })
  @ApiResponse({ status: 200, description: 'Health status returned' })
  async getHealth() {
    try {
      return await firstValueFrom(
        this.visionService.GetHealth({}).pipe(
          catchError((error: any) => {
            this.logger.error(`Health check error: ${error.message}`);
            throw new HttpException('Vision service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Post('sessions')
  @RequirePlan(2)
  @ApiOperation({
    summary: 'Create a detection session',
    description: 'Used by the Lab Agent to start a session before pushing detections.',
  })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({ status: 201, description: 'Session created' })
  async createSession(@Body() body: CreateSessionDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService
          .CreateSession({
            cameraSource: body.cameraSource,
            roi: body.roi,
            user_id: req.user.userId,
          })
          .pipe(
            catchError((error: any) => {
              this.logger.error(`CreateSession error: ${error.message}`);
              throw new HttpException('Failed to create session', HttpStatus.BAD_REQUEST);
            }),
          ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('sessions/:id/end')
  @RequirePlan(2)
  @ApiOperation({
    summary: 'End a detection session',
    description: 'Closes the session; totals are computed from detections already saved during the session.',
  })
  @ApiResponse({ status: 200, description: 'Session ended' })
  async endSession(@Param('id') id: string, @Req() _req: any) {
    try {
      return await firstValueFrom(
        this.visionService.EndSession({ sessionId: id }).pipe(
          catchError((error: any) => {
            this.logger.error(`EndSession error: ${error.message}`);
            throw new HttpException('Failed to end session', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Post('batches')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Create a batch within a session' })
  @ApiBody({ type: CreateBatchDto })
  @ApiResponse({ status: 201, description: 'Batch created' })
  async createBatch(@Body() body: CreateBatchDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService
          .CreateBatch({
            sessionId: body.sessionId,
            roi: body.roi,
            user_id: req.user.userId,
          })
          .pipe(
            catchError((error: any) => {
              this.logger.error(`CreateBatch error: ${error.message}`);
              throw new HttpException('Failed to create batch', HttpStatus.BAD_REQUEST);
            }),
          ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('batches/:id/end')
  @RequirePlan(2)
  @ApiOperation({ summary: 'End a batch' })
  @ApiResponse({ status: 200, description: 'Batch ended' })
  async endBatch(@Param('id') id: string, @Req() _req: any) {
    try {
      return await firstValueFrom(
        this.visionService.EndBatch({ batchId: id }).pipe(
          catchError((error: any) => {
            this.logger.error(`EndBatch error: ${error.message}`);
            throw new HttpException('Failed to end batch', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Post('detections')
  @RequirePlan(2)
  @ApiOperation({
    summary: 'Persist a detection from the Lab Agent',
    description:
      'Cloud-write endpoint: the Lab Agent runs inference locally and POSTs the result here. No inference happens server-side; counts and aggregates are trusted in v1.',
  })
  @ApiBody({ type: SaveDetectionDto })
  @ApiResponse({ status: 201, description: 'Detection saved', schema: { example: { id: '6630c2...' } } })
  async saveDetection(@Body() body: SaveDetectionDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService
          .SaveDetection({
            user_id: req.user.userId,
            sessionId: body.sessionId,
            batchId: body.batchId,
            frameWidth: body.frameWidth,
            frameHeight: body.frameHeight,
            processingTimeMs: body.processingTimeMs,
            roiPureCount: body.roiPureCount,
            roiImpureCount: body.roiImpureCount,
            roiUnwantedCount: body.roiUnwantedCount,
            roiTotalCount: body.roiTotalCount,
            roiPurityPercentage: body.roiPurityPercentage,
            avgWhiteness: body.avgWhiteness,
            avgQualityScore: body.avgQualityScore,
            roiAvgWhiteness: body.roiAvgWhiteness,
            roiAvgQualityScore: body.roiAvgQualityScore,
            boundingBoxes: body.boundingBoxes,
          })
          .pipe(
            catchError((error: any) => {
              this.logger.error(`SaveDetection error: ${error.message}`);
              throw new HttpException('Failed to save detection', HttpStatus.BAD_REQUEST);
            }),
          ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('detections')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get paginated detections' })
  async getDetections(@Query() query: DetectionFilterDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetDetections({ ...query, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetDetections error: ${error.message}`);
            throw new HttpException('Failed to fetch detections', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('detections/:id')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get a single detection by ID' })
  async getDetection(@Param('id') id: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetDetection({ id }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetDetection error: ${error.message}`);
            throw new HttpException('Detection not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Delete('detections/:id')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Delete a detection by ID' })
  async deleteDetection(@Param('id') id: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.DeleteDetection({ id }).pipe(
          catchError((error: any) => {
            this.logger.error(`DeleteDetection error: ${error.message}`);
            throw new HttpException('Failed to delete detection', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('sessions/:id')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get a session by ID' })
  async getSession(@Param('id') id: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetSession({ sessionId: id }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetSession error: ${error.message}`);
            throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('batches')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get all batches with optional filtering' })
  async getAllBatches(@Query() query: BatchFilterDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetAllBatches({ ...query, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetAllBatches error: ${error.message}`);
            throw new HttpException('Failed to fetch batches', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('batches/:id')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get a batch by ID' })
  async getBatch(@Param('id') id: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetBatch({ batchId: id }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetBatch error: ${error.message}`);
            throw new HttpException('Batch not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('batches/session/:sessionId')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get all batches for a session' })
  async getSessionBatches(@Param('sessionId') sessionId: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetSessionBatches({ sessionId, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetSessionBatches error: ${error.message}`);
            throw new HttpException('Failed to fetch batches', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('batches/trends/:sessionId')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get batch purity trends for a session' })
  async getBatchTrends(@Param('sessionId') sessionId: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetBatchTrends({ sessionId, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetBatchTrends error: ${error.message}`);
            throw new HttpException('Failed to fetch batch trends', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('statistics/summary')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get detection statistics summary' })
  async getStatsSummary(@Query() query: StatsSummaryQueryDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsSummary({ ...query, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetStatsSummary error: ${error.message}`);
            throw new HttpException('Failed to fetch statistics', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('statistics/hourly')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get hourly detection statistics' })
  async getStatsHourly(@Query() query: StatsHourlyQueryDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsHourly({ ...query, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetStatsHourly error: ${error.message}`);
            throw new HttpException('Failed to fetch hourly statistics', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('statistics/daily')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get daily detection statistics' })
  async getStatsDaily(@Query() query: StatsDailyQueryDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsDaily({ ...query, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetStatsDaily error: ${error.message}`);
            throw new HttpException('Failed to fetch daily statistics', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }

  @Get('statistics/trends')
  @RequirePlan(2)
  @ApiOperation({ summary: 'Get detection purity trends' })
  async getStatsTrends(@Query() query: StatsTrendsQueryDto, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsTrends({ ...query, user_id: req.user.userId }).pipe(
          catchError((error: any) => {
            this.logger.error(`GetStatsTrends error: ${error.message}`);
            throw new HttpException('Failed to fetch trends', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error: any) {
      throw error;
    }
  }
}
