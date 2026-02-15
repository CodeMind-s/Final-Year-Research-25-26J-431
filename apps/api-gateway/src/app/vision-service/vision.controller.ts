import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import {
  DetectionFilterDto,
  BatchFilterDto,
  StatsSummaryQueryDto,
  StatsHourlyQueryDto,
  StatsDailyQueryDto,
  StatsTrendsQueryDto,
} from './dtos/detection-filter.dto';

@ApiTags('Vision')
@Public()
@Controller('vision')
export class VisionController {
  private visionService: any;
  private readonly logger = new Logger(VisionController.name);

  constructor(@Inject('VISION_PACKAGE') private client: ClientGrpcProxy) {
    this.visionService = this.client.getService('VisionService');
  }

  @Get('health')
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

  @Get('detections')
  @ApiOperation({ summary: 'Get paginated detections' })
  async getDetections(@Query() query: DetectionFilterDto) {
    try {
      return await firstValueFrom(
        this.visionService.GetDetections(query).pipe(
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
  @ApiOperation({ summary: 'Get a single detection by ID' })
  async getDetection(@Param('id') id: string) {
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
  @ApiOperation({ summary: 'Delete a detection by ID' })
  async deleteDetection(@Param('id') id: string) {
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
  @ApiOperation({ summary: 'Get a session by ID' })
  async getSession(@Param('id') id: string) {
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
  @ApiOperation({ summary: 'Get all batches with optional filtering' })
  async getAllBatches(@Query() query: BatchFilterDto) {
    try {
      return await firstValueFrom(
        this.visionService.GetAllBatches(query).pipe(
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
  @ApiOperation({ summary: 'Get a batch by ID' })
  async getBatch(@Param('id') id: string) {
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
  @ApiOperation({ summary: 'Get all batches for a session' })
  async getSessionBatches(@Param('sessionId') sessionId: string) {
    try {
      return await firstValueFrom(
        this.visionService.GetSessionBatches({ sessionId }).pipe(
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
  @ApiOperation({ summary: 'Get batch purity trends for a session' })
  async getBatchTrends(@Param('sessionId') sessionId: string) {
    try {
      return await firstValueFrom(
        this.visionService.GetBatchTrends({ sessionId }).pipe(
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
  @ApiOperation({ summary: 'Get detection statistics summary' })
  async getStatsSummary(@Query() query: StatsSummaryQueryDto) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsSummary(query).pipe(
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
  @ApiOperation({ summary: 'Get hourly detection statistics' })
  async getStatsHourly(@Query() query: StatsHourlyQueryDto) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsHourly(query).pipe(
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
  @ApiOperation({ summary: 'Get daily detection statistics' })
  async getStatsDaily(@Query() query: StatsDailyQueryDto) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsDaily(query).pipe(
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
  @ApiOperation({ summary: 'Get detection purity trends' })
  async getStatsTrends(@Query() query: StatsTrendsQueryDto) {
    try {
      return await firstValueFrom(
        this.visionService.GetStatsTrends(query).pipe(
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
