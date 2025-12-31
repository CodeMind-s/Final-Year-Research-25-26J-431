import { Controller, UseGuards, Inject, Get, Query } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger, HttpStatus, HttpException } from '@nestjs/common';
import {
  GetLandownerAnalyticsResponseDto,
  GetSellerAnalyticsResponseDto,
} from './dtos/analytics.dto';

@ApiTags('Compass - Analytics')
@Controller('compass/analytics')
export class AnalyticsController {
  private analyticsService: any;
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(@Inject('COMPASS_ANALYTICS_PACKAGE') private client: ClientGrpcProxy) {
    this.analyticsService = this.client.getService('AnalyticsService');
  }

  @Get('landowner')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get landowner analytics' })
  @ApiQuery({ name: 'landownerId', type: String, required: true })
  @ApiQuery({ name: 'period', type: String, required: true, example: 'month' })
  @ApiResponse({ status: 200, description: 'Analytics fetched successfully', type: GetLandownerAnalyticsResponseDto })
  async getLandownerAnalytics(
    @Query('landownerId') landownerId: string,
    @Query('period') period: string
  ): Promise<GetLandownerAnalyticsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.analyticsService.GetLandownerAnalytics({ landownerId, period }).pipe(
          catchError((error) => {
            this.logger.error(`Get Landowner Analytics error: ${error.message}`);
            throw new HttpException('Failed to fetch landowner analytics', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller analytics' })
  @ApiQuery({ name: 'sellerId', type: String, required: true })
  @ApiQuery({ name: 'period', type: String, required: true, example: 'month' })
  @ApiResponse({ status: 200, description: 'Analytics fetched successfully', type: GetSellerAnalyticsResponseDto })
  async getSellerAnalytics(
    @Query('sellerId') sellerId: string,
    @Query('period') period: string
  ): Promise<GetSellerAnalyticsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.analyticsService.GetSellerAnalytics({ sellerId, period }).pipe(
          catchError((error) => {
            this.logger.error(`Get Seller Analytics error: ${error.message}`);
            throw new HttpException('Failed to fetch seller analytics', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
