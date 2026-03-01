import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Delete, Query, Req } from '@nestjs/common';
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
  CreateDistributorOfferDto,
  CreateDistributorOfferResponseDto,
  GetDistributorOfferResponseDto,
  GetDistributorOffersResponseDto,
  UpdateDistributorOfferDto,
  UpdateDistributorOfferResponseDto,
  DeleteDistributorOfferResponseDto,
  OfferStatus,
  OfferRequirement,
} from './dtos/distributor-offer.dto';

@ApiTags('Distributor Offers')
@Controller('distributor-offers')
export class DistributorOfferController {
  private distributorOfferService: any;
  private userService: any;
  private readonly logger = new Logger(DistributorOfferController.name);

  constructor(
    @Inject('COMPASS_PACKAGE') private client: ClientGrpcProxy,
    @Inject('USER_PACKAGE') private userClient: ClientGrpcProxy
  ) {
    this.distributorOfferService = this.client.getService('DistributorOfferService');
    this.userService = this.userClient.getService('UserService');
  }

  private async enrichOffer(offer: any): Promise<any> {
    try {
      if (!offer || !offer.userId) return offer;
      const userResponse: any = await firstValueFrom(
        this.userService.GetUserById({ id: offer.userId }).pipe(
          catchError((err) => {
            this.logger.warn(`Failed to fetch user details for userId ${offer.userId}: ${err.message}`);
            return [{ data: null, distributorDetails: null }];
          })
        )
      );

      if (userResponse.data) {
        return {
          ...offer,
          distributor: {
            user: {
              id: userResponse.data.id,
              email: userResponse.data.email,
              role: userResponse.data.role,
              isOnboarded: userResponse.data.isOnboarded,
              plan: userResponse.data.plan,
              isSubscribed: userResponse.data.isSubscribed,
              isVerified: userResponse.data.isVerified,
            },
            distributorDetails: userResponse.distributorDetails ? {
              id: userResponse.distributorDetails.id,
              userId: userResponse.distributorDetails.userId,
              docUrls: userResponse.distributorDetails.docUrls || [],
              companyName: userResponse.distributorDetails.companyName,
              registrationNumber: userResponse.distributorDetails.registrationNumber,
              address: userResponse.distributorDetails.address,
            } : null,
          }
        };
      }
      return offer;
    } catch (error) {
      this.logger.warn(`Error enriching offer with user details: ${error.message}`);
      return offer;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Distributor Offer (distributor)' })
  @ApiBody({ type: CreateDistributorOfferDto })
  @ApiResponse({ status: 201, description: 'Distributor offer created successfully', type: CreateDistributorOfferResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to create distributor offer' })
  async createOffer(@Body() body: CreateDistributorOfferDto, @Req() req: any): Promise<CreateDistributorOfferResponseDto> {
    const userId = req.user.userId;

    try {
      const requestData = {
        userId,
        pricePerKilo: body.pricePerKilo,
        targetQuantity: body.targetQuantity,
        totalInvestment: body.totalInvestment,
        requirement: body.requirement,
      };

      const result = await firstValueFrom(
        this.distributorOfferService.CreateOffer(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Create Distributor Offer error: ${error.message}`);
            throw new HttpException('Failed to create distributor offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      const enrichedData = result.data ? await this.enrichOffer(result.data) : null;

      return {
        success: result.success,
        message: result.message,
        data: enrichedData,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Distributor Offer by ID (distributor)' })
  @ApiParam({ name: 'id', type: String, description: 'Offer ID', example: '675945c5d1234567890abcde' })
  @ApiBody({ type: UpdateDistributorOfferDto })
  @ApiResponse({ status: 200, description: 'Distributor offer updated successfully', type: UpdateDistributorOfferResponseDto })
  @ApiResponse({ status: 404, description: 'Distributor offer not found' })
  async updateOffer(
    @Param('id') id: string,
    @Body() body: UpdateDistributorOfferDto
  ): Promise<UpdateDistributorOfferResponseDto> {
    try {
      const requestData: any = { id };

      // Add only defined fields to the request
      if (body.pricePerKilo !== undefined) requestData.pricePerKilo = body.pricePerKilo;
      if (body.targetQuantity !== undefined) requestData.targetQuantity = body.targetQuantity;
      if (body.collectedQuantity !== undefined) requestData.collectedQuantity = body.collectedQuantity;
      if (body.totalInvestment !== undefined) requestData.totalInvestment = body.totalInvestment;
      if (body.requirement !== undefined) requestData.requirement = body.requirement;
      if (body.status !== undefined) requestData.status = body.status;

      const result = await firstValueFrom(
        this.distributorOfferService.UpdateOffer(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Update Distributor Offer error: ${error.message}`);
            throw new HttpException('Failed to update distributor offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      const enrichedData = result.data ? await this.enrichOffer(result.data) : null;

      return {
        success: result.success,
        message: result.message,
        data: enrichedData,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Distributor Offer by ID (distributor)' })
  @ApiParam({ name: 'id', type: String, description: 'Offer ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Distributor offer deleted successfully', type: DeleteDistributorOfferResponseDto })
  @ApiResponse({ status: 404, description: 'Distributor offer not found' })
  async deleteOffer(@Param('id') id: string): Promise<DeleteDistributorOfferResponseDto> {
    try {
      const requestData = { id };

      const result = await firstValueFrom(
        this.distributorOfferService.DeleteOffer(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Delete Distributor Offer error: ${error.message}`);
            throw new HttpException('Failed to delete distributor offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get('my-offers')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get My Distributor Offers (distributor)' })
  @ApiQuery({ name: 'status', enum: OfferStatus, description: 'Filter by offer status', required: false })
  @ApiQuery({ name: 'requirement', enum: OfferRequirement, description: 'Filter by requirement level', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Distributor offers retrieved successfully', type: GetDistributorOffersResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch distributor offers' })
  async getMyOffers(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('requirement') requirement?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetDistributorOffersResponseDto> {
    const userId = req.user.userId;

    try {
      const requestData: any = { userId };
      if (status && status.trim()) requestData.status = status;
      if (requirement && requirement.trim()) requestData.requirement = requirement;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.distributorOfferService.GetOffers(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get My Distributor Offers error: ${error.message}`);
            throw new HttpException('Failed to fetch distributor offers', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[]; pagination?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} offers for user ${userId}`);

      let enrichedData: any[] = [];
      if (result.data && Array.isArray(result.data)) {
        enrichedData = await Promise.all(result.data.map((offer) => this.enrichOffer(offer)));
      }

      return {
        success: result.success,
        message: result.message,
        data: enrichedData,
        pagination: result.pagination,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.DISTRIBUTOR)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Distributor Offer by ID (distributor)' })
  @ApiParam({ name: 'id', type: String, description: 'Offer ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Distributor offer retrieved successfully', type: GetDistributorOfferResponseDto })
  @ApiResponse({ status: 404, description: 'Distributor offer not found' })
  async getOffer(@Param('id') id: string): Promise<GetDistributorOfferResponseDto> {
    try {
      if (!id) {
        throw new HttpException('Offer ID is required', HttpStatus.BAD_REQUEST);
      }

      const requestData = { id };

      const result = await firstValueFrom(
        this.distributorOfferService.GetOffer(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Distributor Offer error: ${error.message}`);
            throw new HttpException('Failed to fetch distributor offer', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      const enrichedData = result.data ? await this.enrichOffer(result.data) : null;

      return {
        success: result.success,
        message: result.message,
        data: enrichedData,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.SALTSOCIETY, Role.ADMIN, Role.SUPERADMIN, Role.LANDOWNER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get All Distributor Offers (admin, superadmin, saltsociety, landowner)' })
  @ApiQuery({ name: 'status', enum: OfferStatus, description: 'Filter by offer status', required: false })
  @ApiQuery({ name: 'requirement', enum: OfferRequirement, description: 'Filter by requirement level', required: false })
  @ApiQuery({ name: 'page', type: Number, description: 'Page number for pagination (starts from 1)', required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, description: 'Number of items per page', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Distributor offers retrieved successfully', type: GetDistributorOffersResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch distributor offers' })
  async getOffers(
    @Query('status') status?: string,
    @Query('requirement') requirement?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<GetDistributorOffersResponseDto> {
    try {
      const requestData: any = {};
      if (status && status.trim()) requestData.status = status;
      if (requirement && requirement.trim()) requestData.requirement = requirement;
      if (page !== undefined && page !== null && page >= 1) requestData.page = page;
      if (limit !== undefined && limit !== null && limit > 0) requestData.limit = limit;

      const result = await firstValueFrom(
        this.distributorOfferService.GetOffers(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Distributor Offers error: ${error.message}`);
            throw new HttpException('Failed to fetch distributor offers', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[]; pagination?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} offers`);

      let enrichedData: any[] = [];
      if (result.data && Array.isArray(result.data)) {
        enrichedData = await Promise.all(result.data.map((offer) => this.enrichOffer(offer)));
      }

      return {
        success: result.success,
        message: result.message,
        data: enrichedData,
        pagination: result.pagination,
      };
    } catch (error: any) {
      throw error;
    }
  }
}
