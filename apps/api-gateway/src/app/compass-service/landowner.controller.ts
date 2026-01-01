import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Query } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger, HttpStatus, HttpException } from '@nestjs/common';
import {
  GetLandownerProfileResponseDto,
  UpdateProductionCostsDto,
  UpdateProductionCostsResponseDto,
  GetPricePredictionDto,
  GetPricePredictionResponseDto,
  GetDemandPredictionDto,
  GetDemandPredictionResponseDto,
  GetSellerRecommendationsDto,
  GetSellerRecommendationsResponseDto,
  GetSellerOffersResponseDto,
  CreateDealDto,
  CreateDealResponseDto,
  GetDealsResponseDto,
  UpdateDealStatusDto,
  UpdateDealStatusResponseDto,
} from './dtos/landowner.dto';

@ApiTags('Compass - Landowner')
@Controller('compass/landowner')
export class LandownerController {
  private landownerService: any;
  private readonly logger = new Logger(LandownerController.name);

  constructor(@Inject('COMPASS_LANDOWNER_PACKAGE') private client: ClientGrpcProxy) {
    this.landownerService = this.client.getService('LandownerService');
  }

  @Get('profile/:landownerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get landowner profile' })
  @ApiParam({ name: 'landownerId', type: String })
  @ApiResponse({ status: 200, description: 'Profile fetched successfully', type: GetLandownerProfileResponseDto })
  async getLandownerProfile(@Param('landownerId') landownerId: string): Promise<GetLandownerProfileResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.GetLandownerProfile({ landownerId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Landowner Profile error: ${error.message}`);
            throw new HttpException('Failed to fetch landowner profile', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('production-costs')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update production costs' })
  @ApiBody({ type: UpdateProductionCostsDto })
  @ApiResponse({ status: 200, description: 'Production costs updated successfully', type: UpdateProductionCostsResponseDto })
  async updateProductionCosts(@Body() body: UpdateProductionCostsDto): Promise<UpdateProductionCostsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.UpdateProductionCosts(body).pipe(
          catchError((error) => {
            this.logger.error(`Update Production Costs error: ${error.message}`);
            throw new HttpException('Failed to update production costs', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('price-prediction')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get price predictions' })
  @ApiBody({ type: GetPricePredictionDto })
  @ApiResponse({ status: 200, description: 'Price predictions fetched successfully', type: GetPricePredictionResponseDto })
  async getPricePrediction(@Body() body: GetPricePredictionDto): Promise<GetPricePredictionResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.GetPricePrediction(body).pipe(
          catchError((error) => {
            this.logger.error(`Get Price Prediction error: ${error.message}`);
            throw new HttpException('Failed to fetch price predictions', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('demand-prediction')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get demand predictions' })
  @ApiBody({ type: GetDemandPredictionDto })
  @ApiResponse({ status: 200, description: 'Demand predictions fetched successfully', type: GetDemandPredictionResponseDto })
  async getDemandPrediction(@Body() body: GetDemandPredictionDto): Promise<GetDemandPredictionResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.GetDemandPrediction(body).pipe(
          catchError((error) => {
            this.logger.error(`Get Demand Prediction error: ${error.message}`);
            throw new HttpException('Failed to fetch demand predictions', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('seller-recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller recommendations' })
  @ApiBody({ type: GetSellerRecommendationsDto })
  @ApiResponse({ status: 200, description: 'Seller recommendations fetched successfully', type: GetSellerRecommendationsResponseDto })
  async getSellerRecommendations(@Body() body: GetSellerRecommendationsDto): Promise<GetSellerRecommendationsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.GetSellerRecommendations(body).pipe(
          catchError((error) => {
            this.logger.error(`Get Seller Recommendations error: ${error.message}`);
            throw new HttpException('Failed to fetch seller recommendations', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('seller-offers/:landownerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller offers' })
  @ApiParam({ name: 'landownerId', type: String })
  @ApiResponse({ status: 200, description: 'Seller offers fetched successfully', type: GetSellerOffersResponseDto })
  async getSellerOffers(@Param('landownerId') landownerId: string): Promise<GetSellerOffersResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.GetSellerOffers({ landownerId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Seller Offers error: ${error.message}`);
            throw new HttpException('Failed to fetch seller offers', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('deals')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a deal' })
  @ApiBody({ type: CreateDealDto })
  @ApiResponse({ status: 201, description: 'Deal created successfully', type: CreateDealResponseDto })
  async createDeal(@Body() body: CreateDealDto): Promise<CreateDealResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.CreateDeal(body).pipe(
          catchError((error) => {
            this.logger.error(`Create Deal error: ${error.message}`);
            throw new HttpException('Failed to create deal', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('deals')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get deals by status' })
  @ApiQuery({ name: 'landownerId', type: String, required: true })
  @ApiQuery({ name: 'status', type: String, required: true, example: 'accepted' })
  @ApiResponse({ status: 200, description: 'Deals fetched successfully', type: GetDealsResponseDto })
  async getDeals(
    @Query('landownerId') landownerId: string,
    @Query('status') status: string
  ): Promise<GetDealsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.GetDeals({ landownerId, status }).pipe(
          catchError((error) => {
            this.logger.error(`Get Deals error: ${error.message}`);
            throw new HttpException('Failed to fetch deals', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('deals/:dealId/status')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update deal status' })
  @ApiParam({ name: 'dealId', type: String })
  @ApiBody({ type: UpdateDealStatusDto })
  @ApiResponse({ status: 200, description: 'Deal status updated successfully', type: UpdateDealStatusResponseDto })
  async updateDealStatus(
    @Param('dealId') dealId: string,
    @Body() body: UpdateDealStatusDto
  ): Promise<UpdateDealStatusResponseDto> {
    try {
      const result = await firstValueFrom(
        this.landownerService.UpdateDealStatus({ dealId, status: body.status }).pipe(
          catchError((error) => {
            this.logger.error(`Update Deal Status error: ${error.message}`);
            throw new HttpException('Failed to update deal status', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
