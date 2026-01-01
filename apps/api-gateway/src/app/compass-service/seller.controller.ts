import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Delete, Query } from '@nestjs/common';
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
import { GetSellerProfileResponseDto } from './dtos/profile.dto';
import { GetMarketDemandTrendsDto, GetMarketDemandTrendsResponseDto } from './dtos/market-trends.dto';
import {
  CreateOfferDto,
  CreateOfferResponseDto,
  GetCurrentOfferResponseDto,
  UpdateOfferDto,
  UpdateOfferResponseDto,
  DeleteOfferResponseDto,
} from './dtos/offers.dto';
import { GetAvailableLandownersResponseDto } from './dtos/recommendations.dto';
import { GetSellerDealsResponseDto, GetDealProgressResponseDto } from './dtos/deals.dto';

@ApiTags('Compass - Seller')
@Controller('compass/seller')
export class SellerController {
  private sellerService: any;
  private readonly logger = new Logger(SellerController.name);

  constructor(@Inject('COMPASS_SELLER_PACKAGE') private client: ClientGrpcProxy) {
    this.sellerService = this.client.getService('SellerService');
  }

  @Get('profile/:sellerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller profile' })
  @ApiParam({ name: 'sellerId', type: String })
  @ApiResponse({ status: 200, description: 'Profile fetched successfully', type: GetSellerProfileResponseDto })
  async getSellerProfile(@Param('sellerId') sellerId: string): Promise<GetSellerProfileResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.GetSellerProfile({ sellerId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Seller Profile error: ${error.message}`);
            throw new HttpException('Failed to fetch seller profile', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetSellerProfileResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('market-demand-trends')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get market demand trends' })
  @ApiBody({ type: GetMarketDemandTrendsDto })
  @ApiResponse({ status: 200, description: 'Market demand trends fetched successfully', type: GetMarketDemandTrendsResponseDto })
  async getMarketDemandTrends(@Body() body: GetMarketDemandTrendsDto): Promise<GetMarketDemandTrendsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.GetMarketDemandTrends(body).pipe(
          catchError((error) => {
            this.logger.error(`Get Market Demand Trends error: ${error.message}`);
            throw new HttpException('Failed to fetch market demand trends', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetMarketDemandTrendsResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create seller offer' })
  @ApiBody({ type: CreateOfferDto })
  @ApiResponse({ status: 201, description: 'Offer created successfully', type: CreateOfferResponseDto })
  async createOffer(@Body() body: CreateOfferDto): Promise<CreateOfferResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.CreateOffer(body).pipe(
          catchError((error) => {
            this.logger.error(`Create Offer error: ${error.message}`);
            throw new HttpException('Failed to create offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as CreateOfferResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('offers/:sellerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current seller offer' })
  @ApiParam({ name: 'sellerId', type: String })
  @ApiResponse({ status: 200, description: 'Current offer fetched successfully', type: GetCurrentOfferResponseDto })
  async getCurrentOffer(@Param('sellerId') sellerId: string): Promise<GetCurrentOfferResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.GetCurrentOffer({ sellerId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Current Offer error: ${error.message}`);
            throw new HttpException('Failed to fetch current offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetCurrentOfferResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('offers/:sellerId/:offerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update seller offer' })
  @ApiParam({ name: 'sellerId', type: String })
  @ApiParam({ name: 'offerId', type: String })
  @ApiBody({ type: UpdateOfferDto })
  @ApiResponse({ status: 200, description: 'Offer updated successfully', type: UpdateOfferResponseDto })
  async updateOffer(
    @Param('sellerId') sellerId: string,
    @Param('offerId') offerId: string,
    @Body() body: UpdateOfferDto
  ): Promise<UpdateOfferResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.UpdateOffer({ sellerId, offerId, ...body }).pipe(
          catchError((error) => {
            this.logger.error(`Update Offer error: ${error.message}`);
            throw new HttpException('Failed to update offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as UpdateOfferResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete('offers/:sellerId/:offerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete seller offer' })
  @ApiParam({ name: 'sellerId', type: String })
  @ApiParam({ name: 'offerId', type: String })
  @ApiResponse({ status: 200, description: 'Offer deleted successfully', type: DeleteOfferResponseDto })
  async deleteOffer(
    @Param('sellerId') sellerId: string,
    @Param('offerId') offerId: string
  ): Promise<DeleteOfferResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.DeleteOffer({ sellerId, offerId }).pipe(
          catchError((error) => {
            this.logger.error(`Delete Offer error: ${error.message}`);
            throw new HttpException('Failed to delete offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as DeleteOfferResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('available-landowners/:sellerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available landowners' })
  @ApiParam({ name: 'sellerId', type: String })
  @ApiResponse({ status: 200, description: 'Available landowners fetched successfully', type: GetAvailableLandownersResponseDto })
  async getAvailableLandowners(@Param('sellerId') sellerId: string): Promise<GetAvailableLandownersResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.GetAvailableLandowners({ sellerId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Available Landowners error: ${error.message}`);
            throw new HttpException('Failed to fetch available landowners', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetAvailableLandownersResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('deals')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller deals' })
  @ApiQuery({ name: 'sellerId', type: String, required: true })
  @ApiQuery({ name: 'status', type: String, required: true, example: 'accepted' })
  @ApiResponse({ status: 200, description: 'Deals fetched successfully', type: GetSellerDealsResponseDto })
  async getSellerDeals(
    @Query('sellerId') sellerId: string,
    @Query('status') status: string
  ): Promise<GetSellerDealsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.GetSellerDeals({ sellerId, status }).pipe(
          catchError((error) => {
            this.logger.error(`Get Seller Deals error: ${error.message}`);
            throw new HttpException('Failed to fetch seller deals', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetSellerDealsResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('deal-progress/:sellerId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get deal progress' })
  @ApiParam({ name: 'sellerId', type: String })
  @ApiResponse({ status: 200, description: 'Deal progress fetched successfully', type: GetDealProgressResponseDto })
  async getDealProgress(@Param('sellerId') sellerId: string): Promise<GetDealProgressResponseDto> {
    try {
      const result = await firstValueFrom(
        this.sellerService.GetDealProgress({ sellerId }).pipe(
          catchError((error) => {
            this.logger.error(`Get Deal Progress error: ${error.message}`);
            throw new HttpException('Failed to fetch deal progress', HttpStatus.BAD_REQUEST);
          })
        )
      ) as GetDealProgressResponseDto;
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
